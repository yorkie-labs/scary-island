import * as THREE from 'three';

// Playing together, one client (the host) runs the monsters and sends their
// pose and state a few times a second; everyone else draws them from that.
// Each monster has `snap()` (host: what to send), `apply(snap)` (others: take
// it in) and `puppet(dt)` (others: glide there and play the looks).

const r2 = (n) => Math.round(n * 100) / 100;

// [x, y, z, heading, stateIndex, ...extra]
export const snapOf = (obj, heading, states, state, ...extra) =>
  [r2(obj.position.x), r2(obj.position.y), r2(obj.position.z), r2(heading), states.indexOf(state), ...extra];

// Take in the host's pose; a new state restarts the monster's clock so its
// looks (a wake-up shiver, a wind-up) play from the start here too.
export function applySnap(e, states, [x, y, z, heading, state]) {
  (e.netPose ??= new THREE.Vector3()).set(x, y, z);
  e.heading = heading;
  const s = states[state] ?? e.state;
  if (s !== e.state) { e.state = s; e.t = 0; }
}

// Glide toward the host's pose (a big jump snaps); returns how far it moved,
// so the looks know whether it is walking.
export function glide(e, obj, dt, turn = 8) {
  if (!e.netPose) return 0;
  const before = obj.position.clone();
  if (obj.position.distanceTo(e.netPose) > 5) obj.position.copy(e.netPose);
  else obj.position.lerp(e.netPose, 1 - Math.exp(-10 * dt));
  obj.rotation.y = THREE.MathUtils.lerp(obj.rotation.y, e.heading, 1 - Math.exp(-turn * dt));
  return before.distanceTo(obj.position);
}
