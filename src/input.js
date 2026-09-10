// input.js — keyboard tracking and input-to-velocity helper.
//
// Task 2.1 implements the pure input-to-velocity helper (computeVelocity) below.
// Task 10.1 implements keyboard tracking (a "keys held" set + getInputSnapshot).

// Set of currently held keys, tracked as lowercased key names so that WASD and
// arrow keys can be looked up uniformly. Updated by keydown/keyup listeners.
const held = new Set();

if (typeof window !== 'undefined') {
  window.addEventListener('keydown', (e) => held.add(e.key.toLowerCase()));
  window.addEventListener('keyup', (e) => held.delete(e.key.toLowerCase()));
}

/**
 * Produce a plain directional snapshot of currently held keys so the simulation
 * never has to know about DOM key events. WASD and arrow keys map to the same
 * directional intent (Req 1.1–1.4):
 * - up:    w / ArrowUp
 * - down:  s / ArrowDown
 * - left:  a / ArrowLeft
 * - right: d / ArrowRight
 *
 * @returns {{up:boolean, down:boolean, left:boolean, right:boolean}} Directional intent.
 */
export function getInputSnapshot() {
  return {
    up: held.has('w') || held.has('arrowup'),
    down: held.has('s') || held.has('arrowdown'),
    left: held.has('a') || held.has('arrowleft'),
    right: held.has('d') || held.has('arrowright'),
  };
}

/**
 * Turn a directional input snapshot into a velocity vector.
 *
 * Rules (Requirement 1):
 * - Opposing keys on an axis cancel to zero on that axis only, leaving the
 *   perpendicular axis unaffected (Req 1.7).
 * - When no direction is held, velocity is {vx:0, vy:0}.
 * - Otherwise the direction vector is normalized with Math.hypot and scaled by
 *   `speed`, so diagonal speed equals single-axis speed (Req 1.5).
 *
 * @param {{up:boolean, down:boolean, left:boolean, right:boolean}} input Directional intent.
 * @param {number} speed Movement speed in pixels per second.
 * @returns {{vx:number, vy:number}} Velocity in pixels per second.
 */
export function computeVelocity(input, speed) {
  // -1, 0, or +1 per axis. Holding both keys on an axis cancels to 0 (Req 1.7).
  const dx = (input.right ? 1 : 0) - (input.left ? 1 : 0);
  const dy = (input.down ? 1 : 0) - (input.up ? 1 : 0);

  if (dx === 0 && dy === 0) return { vx: 0, vy: 0 };

  const len = Math.hypot(dx, dy); // 1 for single axis, √2 for a diagonal
  return { vx: (dx / len) * speed, vy: (dy / len) * speed }; // normalized (Req 1.5)
}
