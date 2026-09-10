// leveling.js — pure XP-to-level progression helpers (levelThreshold, applyLeveling).
//
// XP is a whole-number running total the player accumulates by collecting gems.
// When XP reaches the current level's threshold, the player levels up and the
// surplus XP carries forward toward the next level. All functions here are pure:
// they never mutate the input player and never touch the DOM or the clock.

/**
 * The maximum supported player level. The level is capped here so leveling can
 * never run away on a huge XP amount (Req 3.8).
 */
export const MAX_LEVEL = 999;

/**
 * XP needed to advance from `level` to the next level.
 *
 * The curve is 5, 8, 11, 14, ... — strictly increasing and always greater than 0
 * for every level from 1 to 999, so the threshold is non-decreasing as the level
 * rises (Req 3.2, 3.3).
 *
 * @param {number} level The current player level (>= 1).
 * @returns {number} The XP required to reach the next level.
 */
export function levelThreshold(level) {
  return 5 + (level - 1) * 3;
}

/**
 * Consume XP and raise the level as many times as the accumulated XP allows.
 *
 * Each iteration subtracts the current level's threshold and increments the
 * level, carrying any surplus XP forward toward the next level (Req 3.4–3.6).
 * The `level < MAX_LEVEL` guard both caps the level at 999 and prevents an
 * infinite loop when a very large XP amount arrives; any leftover XP is simply
 * retained (Req 3.8).
 *
 * Pure: does not mutate the input player.
 *
 * @param {{level:number, xp:number}} player Current player (uses level and xp).
 * @returns {{level:number, xp:number, leveledUp:boolean}} Updated level and surplus XP, plus whether any level-up happened.
 */
export function applyLeveling(player) {
  let level = player.level;
  let xp = player.xp;
  let leveledUp = false;

  while (level < MAX_LEVEL && xp >= levelThreshold(level)) {
    xp -= levelThreshold(level); // surplus carries forward (Req 3.5)
    level += 1; // one level per iteration (Req 3.6)
    leveledUp = true;
  }

  return { level, xp, leveledUp };
}
