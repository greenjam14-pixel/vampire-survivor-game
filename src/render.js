// render.js — draws the current state to the canvas and updates the HUD/overlay.
//
// This module contains NO game logic and NEVER mutates the state. It is a pure
// projection of the current GameState onto the screen: it clears the canvas,
// redraws every entity as a circle, refreshes the HUD text, and toggles the
// game-over overlay. A logic bug lives in update.js; a bug here only makes the
// game *look* wrong while still playing correctly.

import { levelThreshold } from './leveling.js';

// Entity fill colors. Kept in one place so the palette is easy to adjust.
const PLAYER_COLOR = '#4da3ff'; // blue
const ENEMY_COLOR = '#ff5b5b'; // red
const PROJECTILE_COLOR = '#ffe066'; // yellow
const GEM_COLOR = '#7CFC00'; // bright green

/**
 * Draw a filled circle centered at (x, y) with the given radius and color.
 * Small helper so player/enemy/projectile drawing stays a one-liner.
 *
 * @param {CanvasRenderingContext2D} ctx    The 2D drawing context.
 * @param {number} x        Center x in pixels.
 * @param {number} y        Center y in pixels.
 * @param {number} radius   Circle radius in pixels.
 * @param {string} color    CSS fill color.
 * @returns {void}
 */
export function drawCircle(ctx, x, y, radius, color) {
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();
}

/**
 * Render one frame from the current state (no logic, no mutation).
 *
 * Clears the canvas, draws the player (blue), enemies (red), and projectiles
 * (yellow) as circles, then updates the HUD with the current score (Req 5.4)
 * and health. When the game is over, reveals the game-over overlay showing the
 * final — and now frozen — score (Req 4.6, 5.6).
 *
 * @param {CanvasRenderingContext2D} ctx The canvas 2D context to draw into.
 * @param {object} state The current GameState (read-only here).
 * @returns {void}
 */
export function render(ctx, state) {
  const { field, player, enemies, projectiles, gems, score, phase, pendingUpgrades } = state;

  // 1. Clear the whole field before redrawing this frame.
  ctx.clearRect(0, 0, field.width, field.height);

  // 2. Draw entities as circles from their current positions. Gems are drawn
  //    first (under the player) so the player always stays visible on top
  //    (Req 7.1). Older states may lack a gems list, so guard with `|| []`.
  for (const gem of gems || []) {
    drawCircle(ctx, gem.x, gem.y, gem.radius, GEM_COLOR);
  }
  drawCircle(ctx, player.x, player.y, player.radius, PLAYER_COLOR);
  for (const enemy of enemies) {
    drawCircle(ctx, enemy.x, enemy.y, enemy.radius, ENEMY_COLOR);
  }
  for (const projectile of projectiles) {
    drawCircle(ctx, projectile.x, projectile.y, projectile.radius, PROJECTILE_COLOR);
  }

  // 3. Update the HUD (plain DOM elements) with the current score, level/XP
  //    (Req 7.2), and health.
  updateHud(score, player.health, player.level, player.xp);

  // 4. Show or hide the game-over overlay with the final score (Req 4.6, 5.6).
  updateGameOverOverlay(phase, score);

  // 5. Show or hide the level-up overlay with the offered upgrades (Req 7.3–7.5).
  updateLevelUpOverlay(phase, pendingUpgrades);
}

/**
 * Update the HUD DOM elements with the current score (Req 5.4) and health.
 * Lookups are defensive so render() can run in environments without the full
 * page markup (e.g., unit tests that only stub some elements).
 *
 * @param {number} score  Current score (whole seconds survived).
 * @param {number} health Current player health.
 * @param {number} level  Current player level (Req 7.2).
 * @param {number} xp     Current XP toward the next level (Req 7.2).
 * @returns {void}
 */
function updateHud(score, health, level, xp) {
  const scoreEl = getElement('hud-score');
  if (scoreEl) scoreEl.textContent = `Score: ${score}`;

  const levelEl = getElement('hud-level');
  if (levelEl) levelEl.textContent = `Lv ${level} — XP ${xp}/${levelThreshold(level)}`;

  const healthEl = getElement('hud-health');
  if (healthEl) healthEl.textContent = `HP: ${health}`;
}

/**
 * Toggle the game-over overlay. In GAME_OVER, reveal the overlay and populate
 * the frozen final score (Req 4.6, 5.6); otherwise keep it hidden.
 *
 * @param {string} phase The current phase ('PLAYING' | 'GAME_OVER').
 * @param {number} score The score to display as the final score.
 * @returns {void}
 */
function updateGameOverOverlay(phase, score) {
  const overlay = getElement('game-over-overlay');
  if (!overlay) return;

  if (phase === 'GAME_OVER') {
    const finalScoreEl = getElement('game-over-score');
    if (finalScoreEl) finalScoreEl.textContent = `Final Score: ${score}`;
    overlay.classList.remove('hidden');
  } else {
    overlay.classList.add('hidden');
  }
}

/**
 * Toggle the level-up overlay. In LEVEL_UP, populate the three upgrade buttons
 * with the offered upgrade labels and reveal the overlay (Req 7.3–7.5);
 * otherwise keep it hidden. This is a pure projection: it only reads state and
 * sets DOM text/visibility — it never mutates state or applies an upgrade
 * (that click logic lives in main.js).
 *
 * @param {string} phase The current phase ('PLAYING' | 'GAME_OVER' | 'LEVEL_UP').
 * @param {Array<{label:string}>} pendingUpgrades The offered upgrades to display.
 * @returns {void}
 */
function updateLevelUpOverlay(phase, pendingUpgrades) {
  const overlay = getElement('level-up-overlay');
  if (!overlay) return;

  if (phase === 'LEVEL_UP') {
    const upgrades = pendingUpgrades || [];
    for (let i = 0; i < 3; i += 1) {
      const button = getUpgradeButton(i);
      if (button) button.textContent = upgrades[i]?.label ?? '';
    }
    overlay.classList.remove('hidden');
  } else {
    overlay.classList.add('hidden');
  }
}

/**
 * Look up a DOM element by id, guarding against environments where `document`
 * is unavailable so this rendering module never throws outside the browser.
 *
 * @param {string} id The element id.
 * @returns {HTMLElement|null} The element, or null if not found/unavailable.
 */
function getElement(id) {
  if (typeof document === 'undefined') return null;
  return document.getElementById(id);
}

/**
 * Look up an upgrade button by its `data-slot` index, guarding against a
 * missing `document` so this module never throws outside the browser.
 *
 * @param {number} slot The button's data-slot index (0, 1, or 2).
 * @returns {HTMLElement|null} The matching button, or null if unavailable.
 */
function getUpgradeButton(slot) {
  if (typeof document === 'undefined') return null;
  return document.querySelector(`.upgrade-button[data-slot="${slot}"]`);
}
