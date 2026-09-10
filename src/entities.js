// entities.js — data shapes and factory functions for Player, Enemy, Projectile, GameState.
//
// All entities are plain data objects. Positions are the entity *center* in canvas
// pixel coordinates; the origin (0,0) is the top-left, x grows right, y grows down
// (standard canvas convention).

// Projectile travel speed in pixels per second. Fast enough to reach enemies reliably.
const PROJECTILE_SPEED = 400;

/**
 * Create the player entity, centered in the field.
 *
 * @param {number} fieldWidth  Width of the game field in pixels.
 * @param {number} fieldHeight Height of the game field in pixels.
 * @returns {{x:number, y:number, radius:number, speed:number, health:number}}
 */
export function createPlayer(fieldWidth, fieldHeight) {
  return {
    x: fieldWidth / 2, // start centered
    y: fieldHeight / 2,
    radius: 12, // used for boundary clamping and collision
    speed: 200, // pixels per second (Req 1)
    health: 100, // Req 4.1
  };
}

/**
 * Create an enemy entity at the given position.
 *
 * @param {number} x Center x in pixels.
 * @param {number} y Center y in pixels.
 * @returns {{x:number, y:number, radius:number, speed:number, alive:boolean}}
 */
export function createEnemy(x, y) {
  return {
    x,
    y,
    radius: 10,
    speed: 60, // pixels per second toward the player (Req 3.3)
    alive: true,
  };
}

/**
 * Create a projectile entity at the given position, moving in the given unit direction.
 *
 * @param {number} x    Center x in pixels.
 * @param {number} y    Center y in pixels.
 * @param {number} dirX Unit-vector x component toward the target enemy (Req 2.2).
 * @param {number} dirY Unit-vector y component toward the target enemy (Req 2.2).
 * @returns {{x:number, y:number, radius:number, vx:number, vy:number}}
 */
export function createProjectile(x, y, dirX, dirY) {
  return {
    x,
    y,
    radius: 4,
    // dirX/dirY is a unit vector toward the target enemy (Req 2.2)
    vx: dirX * PROJECTILE_SPEED,
    vy: dirY * PROJECTILE_SPEED,
  };
}

/**
 * Create the initial game state — the single source of truth for the simulation.
 *
 * @param {number} fieldWidth  Width of the game field in pixels.
 * @param {number} fieldHeight Height of the game field in pixels.
 * @returns {object} A fresh GameState in the PLAYING phase.
 */
export function createInitialState(fieldWidth, fieldHeight) {
  return {
    phase: 'PLAYING', // 'PLAYING' | 'GAME_OVER'
    field: { width: fieldWidth, height: fieldHeight },
    player: createPlayer(fieldWidth, fieldHeight),
    enemies: [],
    projectiles: [],
    // timers accumulate elapsed seconds and "fire" when they cross a threshold
    fireTimer: 0, // for automatic attack (Req 2.1)
    spawnTimer: 0, // for enemy spawning (Req 3.1)
    survivalTime: 0, // total seconds survived (Req 5.2/5.3)
    score: 0, // floor(survivalTime), frozen at game over (Req 5.1)
  };
}
