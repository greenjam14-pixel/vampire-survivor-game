// upgrades.js — the upgrade catalog offered on level-up, plus pure helpers
// to offer and apply upgrades. Each upgrade's `apply` returns a NEW player and
// never mutates its input, matching the pure-function style of the simulation.

/** Minimum fire interval (seconds); Faster Fire never drops below this (Req 6.3). */
export const MIN_FIRE_INTERVAL = 0.05;

/** Maximum player health; Heal never raises health above this (Req 5.8). */
export const MAX_HEALTH = 100;

/**
 * The upgrade catalog. Each entry is a plain object with a stable `id`, a
 * non-empty display `label`, and a pure `apply(player)` that returns a brand-new
 * player with the effect applied (spread, no mutation) (Req 5.2).
 *
 * @type {ReadonlyArray<{id:string, label:string, apply:(player:object)=>object}>}
 */
export const UPGRADES = [
  {
    id: 'faster-fire',
    label: 'Faster Fire (−15% fire interval)',
    // Reduce fire interval by 15%, clamped to the MIN_FIRE_INTERVAL floor so it
    // stays > 0 and updateFiring can never spin forever (Req 5.6, 6.3).
    apply: (p) => ({ ...p, fireInterval: Math.max(MIN_FIRE_INTERVAL, p.fireInterval * 0.85) }),
  },
  {
    id: 'faster-move',
    label: 'Faster Move (+20 speed)',
    // Increase movement speed by a flat 20 (Req 5.7).
    apply: (p) => ({ ...p, speed: p.speed + 20 }),
  },
  {
    id: 'heal',
    label: 'Heal (+30 HP)',
    // Restore 30 HP, clamped to MAX_HEALTH (Req 5.8).
    apply: (p) => ({ ...p, health: Math.min(MAX_HEALTH, p.health + 30) }),
  },
];

/**
 * Pick the 3 upgrades to offer this level-up. For the MVP these are the fixed
 * catalog entries; this function is the single seam to make selection random or
 * weighted later without touching callers (Req 5.1).
 *
 * @returns {Array<{id:string, label:string, apply:(player:object)=>object}>} The offered upgrades.
 */
export function offerUpgrades() {
  return UPGRADES.slice(0, 3);
}

/**
 * Apply the chosen upgrade to the player by its id. An unknown id returns the
 * player unchanged, so a stray click can never corrupt the player (Req 5.3, 5.4).
 *
 * Pure: does not mutate the incoming player; the matching upgrade's `apply`
 * returns a new player.
 *
 * @param {object} player The current player.
 * @param {string} upgradeId The id of the upgrade to apply.
 * @returns {object} The upgraded player, or the same player if the id is unknown.
 */
export function applyUpgrade(player, upgradeId) {
  const upgrade = UPGRADES.find((u) => u.id === upgradeId);
  return upgrade ? upgrade.apply(player) : player;
}
