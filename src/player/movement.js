// Pure movement maths for the player, kept apart from three.js and Rapier.

export const WALK_SPEED = 2.6; // m/s, a small dog's trot
export const RUN_SPEED = 5.0;
export const FAST_SHOES_RUN = 6.2; // "빠른 신발" upgrade
export const ROLL_SPEED = 7.0;
export const JUMP_SPEED = 5.4; // about 1.5 m of hang
export const TURN_RATE = 14;
export const DROWN_DEPTH = 0.9; // metres under the sea before we respawn

// Input axes (forward/right in -1..1) turned into a world-space XZ direction,
// relative to where the camera looks. Camera yaw 0 looks toward -Z.
export function moveDirection({ forward = 0, right = 0 }, cameraYaw) {
  const len = Math.hypot(forward, right);
  if (len < 1e-6) return { x: 0, z: 0 };
  const f = forward / Math.max(1, len), r = right / Math.max(1, len);
  const sin = Math.sin(cameraYaw), cos = Math.cos(cameraYaw);
  return { x: -sin * f + cos * r, z: -cos * f - sin * r };
}

// Yaw that turns a +Z-facing model toward the direction (x, z).
export const headingOf = (x, z) => Math.atan2(x, z);

export function dampAngle(current, target, rate, dt) {
  let d = target - current;
  d = Math.atan2(Math.sin(d), Math.cos(d));
  return current + d * (1 - Math.exp(-rate * dt));
}

// Gravity in the air, a small press into the ground while standing (so
// snap-to-ground holds on slopes), a jump when asked on the ground.
export function verticalVelocity(vy, { grounded, jump, gravity, dt }) {
  if (grounded && jump) return JUMP_SPEED;
  if (grounded && vy <= 0) return -1;
  return vy - gravity * dt;
}

export const shouldRespawn = (y, seaLevel) => y < seaLevel - DROWN_DEPTH;

// Speed for this frame from the input and what the player is doing.
export function groundSpeed({ moving, run, action, fastShoes }) {
  if (!moving) return 0;
  if (action === 'sniff' || action === 'bark' || action === 'interact' || action === 'cheer') return 0;
  const base = run ? (fastShoes ? FAST_SHOES_RUN : RUN_SPEED) : WALK_SPEED;
  return action === 'swing' ? base * 0.3 : base;
}
