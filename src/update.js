// update.js — the pure simulation step (update, clampToField, firing helpers).
//
// Task 2.5 implements the pure per-axis boundary-clamping helper below.
// Task 6.1 adds the automatic-firing helpers (findNearestEnemy, updateFiring).
// Task 7 wires the full update() pipeline: gem drops on projectile kills, gem
// collection + XP gain, leveling, and the PLAYING/GAME_OVER/LEVEL_UP phase.

import { createProjectile, createGem } from './entities.js';
import { enemyHitsPlayer, resolveProjectileEnemyCollisions, circlesOverlap } from './collision.js';
import { computeVelocity } from './input.js';
import { updateSpawner, moveEnemyTowardPlayer } from './spawner.js';
import { updateScore } from './scoring.js';
import { applyLeveling } from './leveling.js';
import { offerUpgrades } from './upgrades.js';

/**
 * Clamp a position so the entity's circle stays fully inside the field.
 *
 * Each axis is clamped independently, so pushing into one wall while moving
 * along the other axis still lets movement continue on the in-bounds axis
 * (Req 1.6).
 *
 * @param {{x:number, y:number}} pos    Intended center position.
 * @param {number} radius               Entity radius in pixels.
 * @param {{width:number, height:number}} field Field dimensions in pixels.
 * @returns {{x:number, y:number}} The clamped center position.
 */
export function clampToField(pos, radius, field) {
  return {
    x: Math.min(Math.max(pos.x, radius), field.width - radius),
    y: Math.min(Math.max(pos.y, radius), field.height - radius),
  };
}


/**
 * Find the living enemy nearest to the player.
 *
 * Distance is compared using squared straight-line distance (no sqrt needed
 * for ordering). On ties, the first such enemy in iteration order is returned,
 * making the choice deterministic and guaranteeing exactly one target
 * (Req 2.2, 2.3).
 *
 * @param {{x:number, y:number}} player The player entity.
 * @param {Array<{x:number, y:number, alive:boolean}>} enemies Enemy list.
 * @returns {object|null} The nearest living enemy, or null if none are alive.
 */
export function findNearestEnemy(player, enemies) {
  let nearest = null;
  let nearestDistSq = Infinity;
  for (const enemy of enemies) {
    if (!enemy.alive) continue;
    const dx = enemy.x - player.x;
    const dy = enemy.y - player.y;
    const distSq = dx * dx + dy * dy;
    // Strict "<" keeps the first enemy on ties (deterministic single choice).
    if (distSq < nearestDistSq) {
      nearestDistSq = distSq;
      nearest = enemy;
    }
  }
  return nearest;
}

/**
 * Advance the automatic-fire timer and emit projectiles.
 *
 * The fire timer accumulates delta time and fires once per full fire interval,
 * carrying the remainder forward so timing stays frame-rate independent
 * (Req 2.1). The interval is read from the player (`player.fireInterval`) so an
 * upgrade can make the player fire faster (Req 6.2); it replaces the old
 * module-level FIRE_INTERVAL constant. Each fired projectile is aimed as a unit
 * vector at the nearest living enemy (Req 2.2, 2.3). When no living enemy exists
 * at a fire interval, that firing is skipped while the accumulated timer is
 * preserved, so the next interval with a target fires normally (Req 2.4).
 *
 * This helper is pure: it returns the projectiles to add and the carried-forward
 * timer without mutating the input state. Wiring into update() happens in task 8.6.
 *
 * @param {{player:object, enemies:Array, projectiles:Array, fireTimer:number}} state
 *        The current game state.
 * @param {number} dt Elapsed time in seconds since the previous update.
 * @returns {{projectiles:Array, fireTimer:number}} New projectile list and timer.
 */
export function updateFiring(state, dt) {
  const { player, enemies, projectiles } = state;
  const interval = state.player.fireInterval; // per-player, upgradeable (Req 6.2)
  let timer = state.fireTimer + dt;
  const newProjectiles = [];

  while (timer >= interval) {
    timer -= interval; // consume one interval, carrying the remainder forward
    const target = findNearestEnemy(player, enemies);
    if (target === null) {
      // No living enemy: skip firing but keep the elapsed timing (Req 2.4).
      continue;
    }
    const dx = target.x - player.x;
    const dy = target.y - player.y;
    const dist = Math.hypot(dx, dy);
    if (dist === 0) {
      // Target is exactly on the player; direction is undefined, so skip aiming
      // this interval rather than normalizing a zero-length vector.
      continue;
    }
    newProjectiles.push(
      createProjectile(player.x, player.y, dx / dist, dy / dist)
    );
  }

  return {
    projectiles: [...projectiles, ...newProjectiles],
    fireTimer: timer,
  };
}

/**
 * Advance every projectile by its velocity and cull any that leave the field.
 *
 * Each projectile is moved by `vx * dt` / `vy * dt` (frame-rate independent via
 * delta time). After moving, any projectile whose circle has crossed beyond the
 * field boundaries — i.e., any part of it is outside the field — is removed, so
 * off-field projectiles disappear within a single update and the projectile
 * array cannot grow without bound (Req 2.6).
 *
 * A projectile is considered off-field when any part of its circle crosses a
 * boundary: its center's left edge (`x - radius`) is past the left wall, its
 * right edge (`x + radius`) is past the right wall, or the analogous checks on
 * the vertical axis.
 *
 * This helper is pure: it returns a new projectile array without mutating the
 * input projectiles or their objects. Wiring into update() happens in task 8.6.
 *
 * @param {Array<{x:number, y:number, radius:number, vx:number, vy:number}>} projectiles
 *        The current projectile list.
 * @param {{width:number, height:number}} field Field dimensions in pixels.
 * @param {number} dt Elapsed time in seconds since the previous update.
 * @returns {Array<object>} A new list of the projectiles still within the field.
 */
export function updateProjectiles(projectiles, field, dt) {
  const moved = [];
  for (const projectile of projectiles) {
    const next = {
      ...projectile,
      x: projectile.x + projectile.vx * dt,
      y: projectile.y + projectile.vy * dt,
    };
    // Keep only projectiles whose circle is still (at least partly) in bounds.
    // Any part crossing a boundary marks the projectile off-field (Req 2.6).
    const offField =
      next.x + next.radius < 0 ||
      next.x - next.radius > field.width ||
      next.y + next.radius < 0 ||
      next.y - next.radius > field.height;
    if (!offField) {
      moved.push(next);
    }
  }
  return moved;
}


/**
 * Resolve enemy↔player collisions: apply damage and detect game over.
 *
 * Each enemy within the fixed 20 px collision distance of the player
 * (`enemyHitsPlayer`, Req 3.4) counts as a collision: it is removed from the
 * field and reduces the player's health by 10, clamped to a minimum of 0
 * (Req 4.2). Because health is clamped with `Math.max(0, health - 10)`, a
 * collision that occurs while health is already 0 leaves it at 0 and applies no
 * further damage action (Req 4.3). When the resulting health reaches 0, the
 * returned `phase` is `'GAME_OVER'` (Req 4.4); otherwise it stays `'PLAYING'`.
 *
 * This helper is pure: it returns new `player` and `enemies` objects/arrays and
 * a `phase`, without mutating the inputs. Wiring into update() happens in task 8.6.
 *
 * @param {{x:number, y:number, health:number}} player The player entity.
 * @param {Array<{x:number, y:number, alive:boolean}>} enemies The enemy list.
 * @returns {{player:object, enemies:Array, phase:('PLAYING'|'GAME_OVER')}}
 *          The updated player (with reduced health), the enemies that did not
 *          collide, and the resulting phase.
 */
export function resolveEnemyPlayerCollisions(player, enemies) {
  const survivingEnemies = [];
  let health = player.health;

  for (const enemy of enemies) {
    // Only living enemies within the 20 px predicate register a collision.
    if (enemy.alive && enemyHitsPlayer(enemy, player)) {
      // Clamp at 0 so damage never underflows and a hit at 0 stays at 0
      // (Req 4.2, 4.3). The colliding enemy is removed (not carried forward).
      health = Math.max(0, health - 10);
    } else {
      survivingEnemies.push(enemy);
    }
  }

  // Health reaching 0 transitions the game to the Game_Over phase (Req 4.4).
  const phase = health === 0 ? 'GAME_OVER' : 'PLAYING';

  return {
    player: { ...player, health },
    enemies: survivingEnemies,
    phase,
  };
}


/**
 * Resolve XP_Gem collection by the player in a single pass.
 *
 * Every gem whose circle overlaps the player's circle is collected this step:
 * "touching counts as overlap", so a gem is collected when the distance between
 * centers is at most the sum of the two radii (`circlesOverlap`, Req 2.1). The
 * gems are partitioned in one pass into collected and remaining: each collected
 * gem's `xpValue` is summed into `xpGained`, while non-overlapping gems are kept
 * in `remaining` at their current position, unchanged (Req 2.5).
 *
 * Because the partition is a single pass over the list, the result does not
 * depend on the order the gems are processed (Req 2.4), and every gem is tested
 * — and therefore collected — at most once, so no gem is collected twice in this
 * or a later step (Req 2.3). The accumulated `xpGained` is a sum of the
 * collected gems' XP values, forming a non-decreasing contribution to the
 * player's running XP total (Req 2.2). A gem uses a Gem_XP_Value of 1 when it
 * carries no explicit `xpValue` (Req 1.3 default).
 *
 * This helper is pure: it returns a new gem list and the gained XP without
 * mutating the player, the gem list, or any gem object. Wiring into update()
 * happens in task 7.
 *
 * @param {{x:number, y:number, radius:number}} player The player entity.
 * @param {Array<{x:number, y:number, radius:number, xpValue?:number}>} gems
 *        The current XP_Gem list.
 * @returns {{gems:Array, xpGained:number}} The gems still on the field and the
 *          total XP gained from the collected gems this step.
 */
export function resolveGemCollection(player, gems) {
  const remaining = [];
  let xpGained = 0;

  for (const gem of gems) {
    // "Touching counts as overlap": collect when the player's circle overlaps
    // the gem's circle (Req 2.1). Non-overlapping gems are kept as-is (Req 2.5).
    if (circlesOverlap(player, gem)) {
      // Sum this gem's XP value into the running total (Req 2.2). A gem with no
      // explicit xpValue is worth the default Gem_XP_Value of 1 (Req 1.3).
      xpGained += gem.xpValue ?? 1;
    } else {
      remaining.push(gem);
    }
  }

  return { gems: remaining, xpGained };
}


/**
 * Advance the simulation one step and return the next GameState.
 *
 * This is the pure heart of the game: it takes the current state, the elapsed
 * delta time, and an input snapshot, and returns a brand-new GameState without
 * mutating its inputs. It contains no drawing and no direct clock access.
 *
 * The very first thing it does is check `phase`: when the game is not in the
 * PLAYING phase (either GAME_OVER or LEVEL_UP), it returns the state unchanged.
 * This single early-return enforces every "while not Playing, do nothing"
 * requirement in one place — no movement, no spawning, no firing, no
 * health/score change, gems and pending upgrades untouched, and input is ignored
 * (Req 1.5, 1.8, 3.5, 4.2–4.6, 4.8, 5.5). The phase can be one of
 * 'PLAYING' | 'GAME_OVER' | 'LEVEL_UP'.
 *
 * When PLAYING, the pipeline runs in the order fixed by the design (State
 * Management + Collision Detection resolution order), so collisions are based on
 * the positions actually produced that frame:
 *   1. Compute velocity from input and move & clamp the player (Req 1.x).
 *   2. Move every living enemy toward the player (Req 3.3).
 *   3. Spawn new enemies on the spawn timer (Req 3.1, 3.2).
 *   4. Advance the fire timer (per-player interval) and emit projectiles at the
 *      nearest enemy (Req 2.1–2.4, 6.2).
 *   5. Move projectiles and cull any that leave the field (Req 2.6).
 *   6. Resolve projectile↔enemy hits, learning which enemies died (Req 2.5), and
 *      drop one XP gem at each projectile-killed enemy's position (Req 1.1, 1.2).
 *   7. Resolve enemy↔player hits, apply damage, and check game over
 *      (Req 3.4, 4.2, 4.3, 4.4).
 *   7b. Collect gems the player is touching and add their XP to the player
 *      (Req 2.1–2.5), then run leveling on the new XP total (Req 3.4–3.6, 3.8).
 *   7c. Choose the resulting phase — GAME_OVER takes priority over LEVEL_UP; a
 *      level-up enters LEVEL_UP and offers 3 upgrades, otherwise PLAYING
 *      (Req 4.1, 5.1). Because LEVEL_UP is set at the end of the step, the next
 *      frame hits the early-return and freezes until an upgrade is chosen.
 *   8. Update the survival-time score (Req 5.1–5.3).
 *
 * @param {object} state The current GameState.
 * @param {number} dt    Elapsed time in seconds since the previous update.
 * @param {{up:boolean, down:boolean, left:boolean, right:boolean}} input
 *        Directional input snapshot.
 * @returns {object} The next GameState (new object; inputs are not mutated).
 */
export function update(state, dt, input) {
  // GAME_OVER or LEVEL_UP (any non-PLAYING phase): freeze the entire simulation
  // and return the state unchanged. This also freezes LEVEL_UP with no extra
  // pause code (Req 1.5, 1.8, 3.5, 4.2–4.6, 4.8, 5.5).
  if (state.phase !== 'PLAYING') {
    return state;
  }

  const { field } = state;

  // 1. Move & clamp the player from the input-derived velocity (Req 1.x).
  const { vx, vy } = computeVelocity(input, state.player.speed);
  const clamped = clampToField(
    { x: state.player.x + vx * dt, y: state.player.y + vy * dt },
    state.player.radius,
    field
  );
  const player = { ...state.player, x: clamped.x, y: clamped.y };

  // 2. Move every enemy toward the player's (just-updated) position (Req 3.3).
  const movedEnemies = state.enemies.map((enemy) =>
    moveEnemyTowardPlayer(enemy, player, dt)
  );

  // 3. Spawn new enemies on the 1.0 s spawn timer (Req 3.1, 3.2).
  const { enemies: spawnedEnemies, spawnTimer } = updateSpawner(
    { enemies: movedEnemies, spawnTimer: state.spawnTimer, field },
    dt
  );

  // 4. Advance the fire timer and emit projectiles at the nearest enemy
  //    (Req 2.1–2.4). Firing targets the current enemy set.
  const { projectiles: firedProjectiles, fireTimer } = updateFiring(
    {
      player,
      enemies: spawnedEnemies,
      projectiles: state.projectiles,
      fireTimer: state.fireTimer,
    },
    dt
  );

  // 5. Move projectiles and cull any that leave the field (Req 2.6).
  const movedProjectiles = updateProjectiles(firedProjectiles, field, dt);

  // 6. Resolve projectile↔enemy collisions: both are removed on a hit,
  //    at most one enemy per projectile (Req 2.5). Also learn which enemies died
  //    so we can drop gems at their positions.
  const {
    projectiles: survivingProjectiles,
    enemies: enemiesAfterProjectileHits,
    killed,
  } = resolveProjectileEnemyCollisions(movedProjectiles, spawnedEnemies);

  // 6b. Drop one gem per projectile-killed enemy, at its death position, and
  //     add them to the gems already on the field (Req 1.1, 1.2). Contact kills
  //     are handled in step 7 and drop no gems (Req 1.4).
  const droppedGems = killed.map((e) => createGem(e.x, e.y));
  const gemsOnField = [...state.gems, ...droppedGems];

  // 7. Resolve enemy↔player collisions: apply damage (clamped at 0), remove the
  //    colliding enemies, and detect game over (Req 3.4, 4.2, 4.3, 4.4).
  const {
    player: playerAfterDamage,
    enemies: survivingEnemies,
    phase,
  } = resolveEnemyPlayerCollisions(player, enemiesAfterProjectileHits);

  // 7b. Collect gems the player is touching and add the XP to the player
  //     (Req 2.1–2.5), then run leveling on the new XP total (Req 3.4–3.6, 3.8).
  const { gems: remainingGems, xpGained } = resolveGemCollection(
    playerAfterDamage,
    gemsOnField
  );
  const playerWithXp = {
    ...playerAfterDamage,
    xp: playerAfterDamage.xp + xpGained,
  };
  const { level, xp, leveledUp } = applyLeveling(playerWithXp);
  const leveledPlayer = { ...playerWithXp, level, xp };

  // 7c. Choose the resulting phase. Game-over takes priority over level-up: if
  //     the player died this step we stay GAME_OVER; otherwise a level-up enters
  //     LEVEL_UP and offers 3 upgrades, else we remain PLAYING (Req 4.1, 5.1).
  const finalPhase =
    phase === 'GAME_OVER' ? 'GAME_OVER' : leveledUp ? 'LEVEL_UP' : 'PLAYING';
  const pendingUpgrades = finalPhase === 'LEVEL_UP' ? offerUpgrades() : [];

  // 8. Update the survival-time score (Req 5.1–5.3).
  const { survivalTime, score } = updateScore(state, dt);

  return {
    phase: finalPhase,
    field,
    player: leveledPlayer,
    enemies: survivingEnemies,
    projectiles: survivingProjectiles,
    gems: remainingGems,
    pendingUpgrades,
    fireTimer,
    spawnTimer,
    survivalTime,
    score,
  };
}
