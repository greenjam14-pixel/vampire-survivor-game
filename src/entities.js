// entities.js — data shapes and factory functions for Player, Enemy, Projectile, GameState.
//
// All entities are plain data objects. Positions are the entity *center* in canvas
// pixel coordinates; the origin (0,0) is the top-left, x grows right, y grows down
// (standard canvas convention).

// Projectile travel speed in pixels per second. Fast enough to reach enemies reliably.
const PROJECTILE_SPEED = 400;

// --- Deployable Turrets feature: tunable constants ---
// All feature numbers live in one place as named constants so they can be adjusted easily.

// Probability (0.0–1.0) that a projectile-killed enemy drops one Scrap Pickup.
export const SCRAP_DROP_CHANCE = 0.25; // Req 1.5
// Starting (and maximum) health for a turret — a whole number > 0.
export const TURRET_MAX_HEALTH = 30; // Req 7.2
// How far a turret can see/shoot an enemy, in pixels.
export const TURRET_RANGE = 180; // Req 5.7
// Seconds between one turret's shots.
export const TURRET_FIRE_INTERVAL = 0.8; // Req 5.7
// Scrap spent to place one turret.
export const TURRET_COST = 3; // Req 6.6
// How far from the player a click may place a turret, in pixels.
export const PLACEMENT_RADIUS = 150; // Req 6.6

/**
 * Create the player entity, centered in the field.
 *
 * @param {number} fieldWidth  Width of the game field in pixels.
 * @param {number} fieldHeight Height of the game field in pixels.
 * @returns {{x:number, y:number, radius:number, speed:number, health:number, level:number, xp:number, fireInterval:number}}
 */
export function createPlayer(fieldWidth, fieldHeight) {
  return {
    x: fieldWidth / 2, // start centered
    y: fieldHeight / 2,
    radius: 12, // used for boundary clamping and collision
    speed: 200, // pixels per second (Req 1)
    health: 100, // Req 4.1
    level: 1, // starting level (Req 3.1)
    xp: 0, // current XP toward next level (Req 3.1)
    fireInterval: 0.5, // seconds between shots; was FIRE_INTERVAL const, now per-player and upgradeable (Req 6.1)
    scrap: 0, // Scrap Count — a whole number, starts at 0 (Req 4.1)
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
 * Create an XP gem entity — a small pickup dropped where a projectile kills an enemy.
 * The player collects it by walking over it to gain XP.
 *
 * @param {number} x Center x in pixels (the killed enemy's position).
 * @param {number} y Center y in pixels (the killed enemy's position).
 * @returns {{x:number, y:number, radius:number, xpValue:number}}
 */
export function createGem(x, y) {
  return {
    x,
    y,
    radius: 5, // Req 1.2
    xpValue: 1, // XP granted on collection (Req 1.2)
  };
}

/**
 * Create a Scrap Pickup at a killed enemy's death position.
 * A second pickup resource, collected by walking over it (like gems).
 *
 * @param {number} x Center x in pixels (the killed enemy's position).
 * @param {number} y Center y in pixels (the killed enemy's position).
 * @returns {{x:number, y:number, radius:number}}
 */
export function createScrap(x, y) {
  return { x, y, radius: 5 }; // radius 5 for circle-overlap pickup (Req 1.2, 3.1)
}

/**
 * Create a Turret at a placement position. Each turret owns its own fire timer
 * and its own health. A fresh turret starts at full health (health === maxHealth) —
 * it is a destructible structure.
 *
 * @param {number} x Center x in pixels.
 * @param {number} y Center y in pixels.
 * @returns {{x:number, y:number, radius:number, fireTimer:number, health:number, maxHealth:number}}
 */
export function createTurret(x, y) {
  return {
    x,
    y,
    radius: 12, // visual radius 12
    fireTimer: 0, // own fire timer starts at 0 (Req 5.1)
    health: TURRET_MAX_HEALTH, // current health, starts full (Req 7.1)
    maxHealth: TURRET_MAX_HEALTH, // starting/maximum health (Req 7.1, 7.2)
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
    phase: 'PLAYING', // 'PLAYING' | 'GAME_OVER' | 'LEVEL_UP'
    field: { width: fieldWidth, height: fieldHeight },
    player: createPlayer(fieldWidth, fieldHeight),
    enemies: [],
    projectiles: [],
    gems: [], // uncollected XP gems on the field (Req 1.3, 9.3)
    pendingUpgrades: [], // the 3 offered upgrades; empty unless LEVEL_UP (Req 5.1)
    // timers accumulate elapsed seconds and "fire" when they cross a threshold
    fireTimer: 0, // for automatic attack (Req 2.1)
    spawnTimer: 0, // for enemy spawning (Req 3.1)
    survivalTime: 0, // total seconds survived (Req 5.2/5.3)
    score: 0, // floor(survivalTime), frozen at game over (Req 5.1)
    scrapPickups: [], // uncollected Scrap Pickups on the field (Req 2.1)
    turrets: [], // placed turrets (Req 10.2)
  };
}
