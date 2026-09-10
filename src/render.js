// render.js — draws the current state to the canvas and updates the HUD/overlay.
//
// This module contains NO game logic and NEVER mutates the state. It is a pure
// projection of the current GameState onto the screen: it clears the canvas,
// redraws every entity as a circle, refreshes the HUD text, and toggles the
// game-over overlay. A logic bug lives in update.js; a bug here only makes the
// game *look* wrong while still playing correctly.

// Entity fill colors. Kept in one place so the palette is easy to adjust.
const PLAYER_COLOR = '#4da3ff'; // blue
const ENEMY_COLOR = '#ff5b5b'; // red
const PROJECTILE_COLOR = '#ffe066'; // yellow

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
  const { field, player, enemies, projectiles, score, phase } = state;

  // 1. Clear the whole field before redrawing this frame.
  ctx.clearRect(0, 0, field.width, field.height);

  // 2. Draw entities as circles from their current positions.
  drawCircle(ctx, player.x, player.y, player.radius, PLAYER_COLOR);
  for (const enemy of enemies) {
    drawCircle(ctx, enemy.x, enemy.y, enemy.radius, ENEMY_COLOR);
  }
  for (const projectile of projectiles) {
    drawCircle(ctx, projectile.x, projectile.y, projectile.radius, PROJECTILE_COLOR);
  }

  // 3. Update the HUD (plain DOM elements) with the current score and health.
  updateHud(score, player.health);

  // 4. Show or hide the game-over overlay with the final score (Req 4.6, 5.6).
  updateGameOverOverlay(phase, score);
}

/**
 * Update the HUD DOM elements with the current score (Req 5.4) and health.
 * Lookups are defensive so render() can run in environments without the full
 * page markup (e.g., unit tests that only stub some elements).
 *
 * @param {number} score  Current score (whole seconds survived).
 * @param {number} health Current player health.
 * @returns {void}
 */
function updateHud(score, health) {
  const scoreEl = getElement('hud-score');
  if (scoreEl) scoreEl.textContent = `Score: ${score}`;

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
