// turrets.js — pure logic for deployable turrets: targeting, auto-firing (plus the
// turret destruction framework), and placement.
//
// Kept in its own module so update.js stays focused. `updateTurrets` is wired into
// the update() pipeline; `tryPlaceTurret` is called from the canvas click boundary
// in main.js. Every function here is pure: it reads its inputs and returns new data
// without mutating anything.

import {
  createProjectile,
  createTurret,
  TURRET_RANGE,
  TURRET_FIRE_INTERVAL,
  TURRET_COST,
  PLACEMENT_RADIUS,
} from './entities.js';

/**
 * Nearest living enemy within `range` pixels of a point, or null if none.
 *
 * Uses squared distance for ordering and a squared range for the cutoff (no sqrt).
 * Dead enemies (`alive === false`) are skipped. On ties, the first such enemy in
 * iteration order wins because the comparison is strict `<` on squared distance
 * (deterministic, Req 5.2).
 *
 * @param {{x:number, y:number}} origin The point to measure from (a turret center).
 * @param {Array<{x:number, y:number, alive:boolean}>} enemies Candidate enemies.
 * @param {number} range Maximum distance in pixels the enemy may be from `origin`.
 * @returns {object|null} The nearest living in-range enemy, or null if none.
 */
export function findNearestEnemyInRange(origin, enemies, range) {
  let nearest = null;
  let nearestDistSq = Infinity;
  const rangeSq = range * range;
  for (const enemy of enemies) {
    if (!enemy.alive) continue; // skip dead enemies (Req 5.2)
    const dx = enemy.x - origin.x;
    const dy = enemy.y - origin.y;
    const distSq = dx * dx + dy * dy;
    if (distSq <= rangeSq && distSq < nearestDistSq) {
      // in range AND strictly closer than the best so far (first wins ties)
      nearestDistSq = distSq;
      nearest = enemy;
    }
  }
  return nearest;
}

/**
 * Advance every turret's fire timer, emit turret projectiles, and apply the
 * destruction framework (remove any turret with health <= 0).
 *
 * For each turret: add dt to its own fire timer (Req 5.1). While the timer is at
 * or above TURRET_FIRE_INTERVAL, look for the nearest living enemy within
 * TURRET_RANGE. If one exists, subtract the interval (carrying the remainder,
 * Req 5.4) and emit one projectile aimed as a unit vector at it (Req 5.2, 5.3).
 * If none is in range, stop WITHOUT subtracting so the accumulated timer carries
 * forward unchanged (Req 5.5).
 *
 * After timers/firing, the returned turret list EXCLUDES any turret whose
 * health <= 0 and keeps every turret with health > 0 (Req 7.3, 7.4). Nothing in
 * this feature reduces turret.health, so the filter is a no-op in practice — it
 * establishes the framework for a future "enemies damage turrets" feature.
 *
 * Each turret is processed from its OWN timer only, so turrets are independent of
 * each other and of the player's auto-fire (Req 5.6). Pure: returns new turret
 * objects and a new projectile list without mutating inputs.
 *
 * @param {Array<{x:number, y:number, fireTimer:number, health:number}>} turrets
 * @param {Array<{x:number, y:number, alive:boolean}>} enemies
 * @param {number} dt Elapsed seconds since the last update.
 * @returns {{turrets:Array, projectiles:Array}} Surviving turrets and new projectiles.
 */
export function updateTurrets(turrets, enemies, dt) {
  const advancedTurrets = [];
  const newProjectiles = [];

  for (const turret of turrets) {
    let timer = turret.fireTimer + dt; // this turret's own timer only (Req 5.1, 5.6)

    while (timer >= TURRET_FIRE_INTERVAL) {
      const target = findNearestEnemyInRange(turret, enemies, TURRET_RANGE);
      if (target === null) {
        // No enemy in range: do NOT subtract; keep the accumulated timer (Req 5.5).
        break;
      }
      timer -= TURRET_FIRE_INTERVAL; // consume one interval, carry remainder (Req 5.4)
      const dx = target.x - turret.x;
      const dy = target.y - turret.y;
      const dist = Math.hypot(dx, dy);
      if (dist === 0) continue; // enemy exactly on the turret: skip aiming this interval
      newProjectiles.push(
        createProjectile(turret.x, turret.y, dx / dist, dy / dist) // same mechanic/speed (Req 5.3)
      );
    }

    advancedTurrets.push({ ...turret, fireTimer: timer });
  }

  // Destruction framework: keep only turrets whose health is still above 0.
  // Turrets with health <= 0 are removed this step (Req 7.3, 7.4).
  const survivingTurrets = advancedTurrets.filter((turret) => turret.health > 0);

  return { turrets: survivingTurrets, projectiles: newProjectiles };
}

/**
 * Attempt to place a turret at a clicked field position.
 *
 * Placement succeeds only when ALL hold (Req 6.1, 8.1):
 *   - phase is PLAYING,
 *   - the click is within PLACEMENT_RADIUS of the player (Euclidean, compared as
 *     squared distances so there is no sqrt),
 *   - the player has at least TURRET_COST scrap.
 * On success: return a new state with a turret at the click and scrap reduced by
 * TURRET_COST (Req 6.1, 6.2). On any failure: return the state UNCHANGED
 * (Req 6.3, 6.4, 8.2, 9.3). Pure: never mutates the input state.
 *
 * There is no cap on turret count — placement is limited only by scrap, so
 * repeatedly placing with S scrap yields floor(S / TURRET_COST) turrets (Req 6.5).
 *
 * @param {object} state The current game state.
 * @param {number} clickX Click x in game (canvas) coordinates.
 * @param {number} clickY Click y in game (canvas) coordinates.
 * @returns {object} The next state (the same object on failure).
 */
export function tryPlaceTurret(state, clickX, clickY) {
  if (state.phase !== 'PLAYING') return state; // frozen: ignore (Req 8.2, 9.3)

  const dx = clickX - state.player.x;
  const dy = clickY - state.player.y;
  const withinRadius = dx * dx + dy * dy <= PLACEMENT_RADIUS * PLACEMENT_RADIUS; // squared, no sqrt
  if (!withinRadius) return state; // too far: ignore (Req 6.3)

  if (state.player.scrap < TURRET_COST) return state; // can't afford: ignore (Req 6.4)

  return {
    ...state,
    turrets: [...state.turrets, createTurret(clickX, clickY)], // at the click (Req 6.1)
    player: { ...state.player, scrap: state.player.scrap - TURRET_COST }, // pay (Req 6.2)
  };
}
