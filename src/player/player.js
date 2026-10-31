import * as THREE from 'three';
import { GRAVITY } from '../physics/physics.js';
import { createYorkie, createYorkieAnimator } from '../entities/yorkie.js';
import { sfx } from '../audio/sound.js';
import {
  TURN_RATE, ROLL_SPEED,
  moveDirection, headingOf, dampAngle, verticalVelocity, shouldRespawn, groundSpeed,
} from './movement.js';

const RADIUS = 0.24;
const HEIGHT = 1.0;
const SKIN = 0.04;
const INVULNERABLE_AFTER_HIT = 1.6;

const ACTIONS = {
  swing: { duration: 0.45, cooldown: 0.1 },
  roll: { duration: 0.5, cooldown: 0.25 },
  bark: { duration: 0.6, cooldown: 0.8 },
  sniff: { duration: 1.2, cooldown: 0.5 },
  hurt: { duration: 0.35, cooldown: 0 },
  interact: { duration: 0.45, cooldown: 0 },
  cheer: { duration: 1.4, cooldown: 0 },
};

// Yorkie under a kinematic capsule driven by Rapier's character controller.
export function createPlayer(G, spawn) {
  const { RAPIER, world } = G.physics;
  const model = createYorkie();
  const animate = createYorkieAnimator(model);
  const rig = model.userData.rig;
  G.scene.add(model);

  const half = HEIGHT / 2 - RADIUS;
  const body = world.createRigidBody(RAPIER.RigidBodyDesc.kinematicPositionBased()
    .setTranslation(spawn.x, spawn.y + HEIGHT / 2 + SKIN, spawn.z));
  const collider = world.createCollider(RAPIER.ColliderDesc.capsule(half, RADIUS), body);
  G.physics.heroHandles.add(collider.handle);
  const notMonster = (c) => !G.physics.moverHandles.has(c.handle);

  const controller = world.createCharacterController(SKIN);
  controller.enableAutostep(0.3, 0.12, true);
  controller.enableSnapToGround(0.35);
  controller.setMaxSlopeClimbAngle(THREE.MathUtils.degToRad(46));
  controller.setMinSlopeSlideAngle(THREE.MathUtils.degToRad(40));
  controller.setApplyImpulsesToDynamicBodies(true);
  controller.setCharacterMass(25);

  const s = {
    vy: 0, grounded: true, speed: 0, heading: spawn.heading ?? Math.PI,
    action: null, cooldown: 0, jumpQueued: false,
    knock: new THREE.Vector2(), invulnerable: 0, hidden: false, frozen: false,
    stepTimer: 0, wasGrounded: true,
  };
  const safe = new THREE.Vector3(spawn.x, spawn.y, spawn.z);
  let safeTimer = 0;
  const forward = new THREE.Vector3();

  function act(name) {
    if (s.frozen) return false;
    if (s.action && s.action.name !== 'hurt' && name !== 'hurt') return false;
    if (s.cooldown > 0 && name !== 'hurt') return false;
    if (name === 'roll' && !s.grounded) return false;
    if ((name === 'roll' || name === 'sniff') && !G.canUse(name)) return false;
    s.action = { name, t: 0, duration: ACTIONS[name].duration, fired: false };
    if (name === 'roll') { sfx.roll(); s.invulnerable = Math.max(s.invulnerable, 0.5); }
    if (name === 'swing') sfx.swing();
    if (name === 'bark') { sfx.bark(); G.emit('noise', { pos: model.position.clone(), radius: 16, kind: 'bark' }); }
    if (name === 'sniff') { sfx.sniff(); G.emit('sniff', { pos: model.position.clone() }); }
    return true;
  }

  function hurt(from, amount = 1) {
    if (s.invulnerable > 0 || G.mode !== 'play') return false;
    s.invulnerable = INVULNERABLE_AFTER_HIT;
    const away = new THREE.Vector2(model.position.x - from.x, model.position.z - from.z);
    if (away.lengthSq() < 1e-4) away.set(0, 1);
    s.knock.copy(away.normalize().multiplyScalar(3.5)); // a gentle bump, not a shove
    s.vy = 3;
    s.action = null;
    act('hurt');
    sfx.hurt();
    G.emit('hurt', { amount });
    return true;
  }

  function fixedUpdate(input, cameraYaw, dt) {
    if (s.frozen) return;
    const a = s.action?.name;
    const dir = input.world ?? moveDirection(input, cameraYaw);
    const moving = dir.x !== 0 || dir.z !== 0;
    let vx = 0, vz = 0;

    if (a === 'roll') {
      vx = Math.sin(s.heading) * ROLL_SPEED;
      vz = Math.cos(s.heading) * ROLL_SPEED;
      s.speed = 0;
    } else {
      const speed = groundSpeed({ moving, run: input.run, action: a, fastShoes: G.state.upgrades.shoes });
      s.speed = speed;
      if (moving && speed > 0) s.heading = dampAngle(s.heading, headingOf(dir.x, dir.z), TURN_RATE, dt);
      vx = dir.x * speed; vz = dir.z * speed;
    }
    vx += s.knock.x; vz += s.knock.y;
    s.knock.multiplyScalar(Math.exp(-8 * dt));

    if (s.jumpQueued && s.grounded) sfx.jump();
    s.vy = verticalVelocity(s.vy, { grounded: s.grounded, jump: s.jumpQueued, gravity: GRAVITY, dt });
    s.jumpQueued = false;

    const desired = { x: vx * dt, y: s.vy * dt, z: vz * dt };
    controller.computeColliderMovement(collider, desired, undefined, undefined, notMonster);
    const m = controller.computedMovement();
    s.wasGrounded = s.grounded;
    s.grounded = controller.computedGrounded();
    if (s.grounded && !s.wasGrounded && s.vy < -3) sfx.land();
    if (s.grounded && s.vy < 0) s.vy = -1;
    if (!s.grounded && s.vy > 0 && m.y < desired.y - 1e-4) s.vy = 0; // bumped a ceiling

    const t = body.translation();
    body.setNextKinematicTranslation({ x: t.x + m.x, y: t.y + m.y, z: t.z + m.z });

    const feetY = t.y - HEIGHT / 2 - SKIN;
    safeTimer += dt;
    if (s.grounded && feetY > G.seaLevelAt(t.x, t.z) + 0.3 && safeTimer > 0.5) {
      safe.set(t.x, feetY, t.z);
      safeTimer = 0;
    }
    if (shouldRespawn(feetY, G.seaLevelAt(t.x, t.z))) {
      sfx.splash();
      teleport(safe, s.heading);
      G.emit('fell');
    }
  }

  function teleport(at, heading) {
    // stand ON whatever is there: a stored checkpoint height can be lower than
    // the ground at that spot (the ancient gate stores the arena's height), and
    // a spawn inside the ground falls forever
    if (at.x < 400 && G.groundAt) at = { x: at.x, y: Math.max(at.y, G.groundAt(at.x, at.z) + 0.05), z: at.z };
    const p = { x: at.x, y: at.y + HEIGHT / 2 + 0.3, z: at.z };
    body.setTranslation(p, true);
    body.setNextKinematicTranslation(p);
    model.position.set(at.x, at.y + 0.26, at.z);
    s.vy = 0; s.knock.set(0, 0);
    if (heading !== undefined) s.heading = heading;
    safe.set(at.x, at.y, at.z);
    G.emit('teleported');
  }

  function update(dt) {
    s.cooldown = Math.max(0, s.cooldown - dt);
    s.invulnerable = Math.max(0, s.invulnerable - dt);
    if (s.action) {
      s.action.t += dt;
      if (s.action.name === 'swing' && !s.action.fired && s.action.t > 0.24) {
        s.action.fired = true;
        G.hammerHit(hitPoint());
      }
      if (s.action.t >= s.action.duration) { s.cooldown = ACTIONS[s.action.name].cooldown; s.action = null; }
    }
    if (!s.frozen) {
      const t = body.translation();
      model.position.set(t.x, t.y - HEIGHT / 2 - SKIN, t.z);
    }
    model.rotation.y = s.heading;
    s.hidden = !!G.inHideSpot?.(model.position) && s.speed < 3 && !s.action;
    rig.hammer.visible = G.state.items.hammer;
    // blink while invulnerable after a hit
    model.visible = s.invulnerable <= 0 || s.action?.name === 'roll' || Math.floor(s.invulnerable * 12) % 2 === 0;

    if (s.grounded && s.speed > 0.5) {
      s.stepTimer -= dt * s.speed;
      if (s.stepTimer <= 0) { sfx.step(); s.stepTimer = 1.1; }
    }
    const riding = !!G.riding?.();
    animate(dt, { speed: riding ? 0 : s.speed, grounded: s.grounded, vy: s.vy, action: riding ? null : s.action, hidden: s.hidden,
      sitting: riding, airborne: riding && G.rideHeight?.() > 0.05 });
  }

  function hitPoint() {
    forward.set(Math.sin(s.heading), 0, Math.cos(s.heading));
    return model.position.clone().addScaledVector(forward, 0.85).setY(model.position.y + 0.4);
  }

  return {
    model, body, collider, state: s, height: HEIGHT,
    fixedUpdate, update, act, hurt, teleport,
    jump() { if (s.grounded && !s.frozen && s.action?.name !== 'roll' && G.canUse('jump')) s.jumpQueued = true; },
    get position() { return model.position; },
    get facing() { return forward.set(Math.sin(s.heading), 0, Math.cos(s.heading)); },
    get safe() { return safe; },
  };
}
