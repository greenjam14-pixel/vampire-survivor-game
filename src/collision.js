// collision.js — pure collision predicates and resolvers.
//
// All entities are treated as circles, so overlap is a simple distance check.
// Comparisons use squared distances to avoid Math.sqrt. These functions are
// pure: they never mutate their inputs.

// Fixed enemy↔player collision distance in pixels (Req 3.4). Per the design,
// this is a fixed predicate rather than the sum of the two radii.
const ENEMY_PLAYER_COLLISION_DISTANCE = 20;

/**
 * True when two circular entities overlap.
 *
 * Two circles overlap when the distance between their centers is less than or
 * equal to the sum of their radii. We compare squared distances so no sqrt is
 * needed (Req 2.5).
 *
 * @param {{x:number, y:number, radius:number}} a First circle.
 * @param {{x:number, y:number, radius:number}} b Second circle.
 * @returns {boolean} True if the circles overlap (touching counts as overlap).
 */
export function circlesOverlap(a, b) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  const rSum = a.radius + b.radius;
  return dx * dx + dy * dy <= rSum * rSum; // squared-distance comparison (no sqrt)
}

/**
 * True when an enemy is within the fixed 20 px collision distance of the player.
 *
 * Implements Req 3.4 directly as `distance(enemy, player) <= 20`, using a
 * squared comparison to avoid sqrt.
 *
 * @param {{x:number, y:number}} enemy  Enemy center position.
 * @param {{x:number, y:number}} player Player center position.
 * @returns {boolean} True if a collision should be registered this frame.
 */
export function enemyHitsPlayer(enemy, player) {
  const dx = enemy.x - player.x;
  const dy = enemy.y - player.y;
  return (
    dx * dx + dy * dy <=
    ENEMY_PLAYER_COLLISION_DISTANCE * ENEMY_PLAYER_COLLISION_DISTANCE
  );
}

/**
 * Resolve projectile↔enemy collisions.
 *
 * For each projectile, find the first living enemy it overlaps: that enemy is
 * removed and that projectile is removed. Each projectile affects at most one
 * enemy, and each enemy can be consumed by at most one projectile (Req 2.5).
 *
 * This is pure — it returns new arrays and does not mutate the inputs.
 *
 * @param {Array<{x:number, y:number, radius:number}>} projectiles Current projectiles.
 * @param {Array<{x:number, y:number, radius:number, alive:boolean}>} enemies Current enemies.
 * @returns {{projectiles:Array, enemies:Array}} Surviving projectiles and enemies.
 */
export function resolveProjectileEnemyCollisions(projectiles, enemies) {
  // Track which enemies have been consumed so one enemy can't be hit twice and
  // a projectile that hits an already-consumed enemy still looks for another.
  const consumedEnemy = new Array(enemies.length).fill(false);
  const survivingProjectiles = [];

  for (const projectile of projectiles) {
    let hitIndex = -1;

    for (let i = 0; i < enemies.length; i++) {
      const enemy = enemies[i];
      if (!enemy.alive || consumedEnemy[i]) continue;
      if (circlesOverlap(projectile, enemy)) {
        hitIndex = i;
        break; // each projectile affects at most one enemy (Req 2.5)
      }
    }

    if (hitIndex === -1) {
      // No hit: the projectile survives this resolution step.
      survivingProjectiles.push(projectile);
    } else {
      // Hit: consume the enemy and drop the projectile (both removed).
      consumedEnemy[hitIndex] = true;
    }
  }

  const survivingEnemies = enemies.filter((_, i) => !consumedEnemy[i]);

  return { projectiles: survivingProjectiles, enemies: survivingEnemies };
}
