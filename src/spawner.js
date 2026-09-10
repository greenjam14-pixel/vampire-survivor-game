// spawner.js — pure spawning and enemy-movement helpers.

import { createEnemy } from './entities.js';

// Enemy spawn cadence in seconds (Req 3.1).
const SPAWN_INTERVAL = 1.0;

/**
 * Spawn a single enemy at a uniformly-random edge of the field, at a random
 * point along that edge (Req 3.2).
 *
 * One of the four edges (top, bottom, left, right) is chosen uniformly at
 * random, then a random point along that edge determines the enemy position.
 *
 * @param {{width:number, height:number}} field The game field dimensions.
 * @returns {{x:number, y:number, radius:number, speed:number, alive:boolean}} A new enemy on the chosen edge.
 */
export function spawnEnemyAtRandomEdge(field) {
  const edge = Math.floor(Math.random() * 4); // 0=top,1=bottom,2=left,3=right (uniform)
  let x, y;
  switch (edge) {
    case 0: // top
      x = Math.random() * field.width;
      y = 0;
      break;
    case 1: // bottom
      x = Math.random() * field.width;
      y = field.height;
      break;
    case 2: // left
      x = 0;
      y = Math.random() * field.height;
      break;
    default: // 3: right
      x = field.width;
      y = Math.random() * field.height;
      break;
  }
  return createEnemy(x, y);
}

/**
 * Accumulate delta time into the spawn timer and emit one enemy per full
 * SPAWN_INTERVAL (1.0 s), carrying the remainder forward so spawning is
 * frame-rate independent and free of drift (Req 3.1).
 *
 * Pure: does not mutate the incoming state.
 *
 * @param {{enemies:Array, spawnTimer:number, field:{width:number, height:number}}} state Current game state.
 * @param {number} dt Elapsed time since the previous update, in seconds.
 * @returns {{enemies:Array, spawnTimer:number}} Updated enemy list and carried-over spawn timer.
 */
export function updateSpawner(state, dt) {
  let timer = state.spawnTimer + dt;
  const newEnemies = [];
  while (timer >= SPAWN_INTERVAL) {
    newEnemies.push(spawnEnemyAtRandomEdge(state.field));
    timer -= SPAWN_INTERVAL; // carry remainder forward (no drift)
  }
  return { enemies: [...state.enemies, ...newEnemies], spawnTimer: timer };
}


/**
 * Move a single enemy one step toward the player's current position at the
 * enemy's speed (60 px/s), using delta time so movement is frame-rate
 * independent (Req 3.3).
 *
 * A unit vector from the enemy to the player is scaled by `min(speed*dt, dist)`
 * so the enemy never overshoots the player. When the enemy is exactly on top of
 * the player (`dist === 0`) the direction is undefined, so the enemy is returned
 * unchanged (guards division by zero).
 *
 * Pure: returns a new enemy object and does not mutate the input.
 *
 * @param {{x:number, y:number, speed:number}} enemy The enemy to move.
 * @param {{x:number, y:number}} player The player's current position.
 * @param {number} dt Elapsed time since the previous update, in seconds.
 * @returns {{x:number, y:number, speed:number}} A new enemy stepped toward the player.
 */
export function moveEnemyTowardPlayer(enemy, player, dt) {
  const dx = player.x - enemy.x;
  const dy = player.y - enemy.y;
  const dist = Math.hypot(dx, dy);
  if (dist === 0) return enemy; // already on the player; direction undefined (Req 3.3)
  const step = Math.min(enemy.speed * dt, dist); // don't overshoot the player
  return { ...enemy, x: enemy.x + (dx / dist) * step, y: enemy.y + (dy / dist) * step };
}
