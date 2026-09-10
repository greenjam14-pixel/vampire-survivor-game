// main.js — orchestration and the I/O boundary (canvas + requestAnimationFrame + clock).
//
// This module is the only place that touches "the outside world": the real
// browser clock (via requestAnimationFrame timestamps) and the canvas. It owns
// the game loop and the current GameState, measures delta time, reads the input
// snapshot, advances the pure simulation via update(), and draws via render().
//
// Data flow each frame: Input → Update (pure simulation) → Render.

import { createInitialState } from './entities.js';
import { update } from './update.js';
import { render } from './render.js';
import { getInputSnapshot } from './input.js';
import { applyUpgrade } from './upgrades.js';
import { tryPlaceTurret } from './turrets.js';

// Clamp a single simulation step to at most 50 ms. If the tab is hidden or a
// debugger pauses execution, the next timestamp gap could be several seconds,
// teleporting enemies through the player. Clamping keeps each step stable.
const MAX_DT = 0.05;

// The id of the <canvas> element declared in index.html.
const CANVAS_ID = 'game-canvas';

/**
 * Convert a browser mouse event to canvas (game) coordinates.
 *
 * A `click` event reports the pointer position in the browser page
 * (`event.clientX` / `event.clientY`, measured from the top-left of the visible
 * window), but the game thinks in canvas coordinates (0..width across, 0..height
 * down, measured from the canvas's top-left). Two corrections are applied:
 *
 *   1. Page offset — `canvas.getBoundingClientRect()` gives the canvas's
 *      top-left corner (`rect.left`, `rect.top`) in the same page coordinates
 *      as `clientX/clientY`; subtracting makes the position relative to the
 *      canvas.
 *   2. CSS scale — the canvas backing buffer (`canvas.width`/`canvas.height`)
 *      may differ from its displayed size (`rect.width`/`rect.height`) if CSS
 *      stretches or shrinks it; multiplying by `canvas.width / rect.width` (and
 *      likewise for height) rescales displayed pixels back to buffer pixels.
 *
 * When the canvas is displayed at its native size, both scale factors are 1 and
 * this simply subtracts the offset.
 *
 * @param {HTMLCanvasElement} canvas The game canvas.
 * @param {MouseEvent} event The click event.
 * @returns {{x:number, y:number}} The click position in canvas/game coordinates.
 */
function toCanvasCoords(canvas, event) {
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width; // buffer px per displayed px (x)
  const scaleY = canvas.height / rect.height; // buffer px per displayed px (y)
  return {
    x: (event.clientX - rect.left) * scaleX,
    y: (event.clientY - rect.top) * scaleY,
  };
}

/**
 * Boot the game: acquire the canvas and its 2D context, create the initial
 * state, wire up restart handling, and start the requestAnimationFrame loop.
 *
 * If the 2D context is unavailable (`getContext('2d')` returns null), a plain
 * message is shown in the page instead of throwing, so the user sees why
 * nothing rendered (Error Handling: missing canvas / context).
 *
 * @returns {void}
 */
function main() {
  const canvas =
    typeof document !== 'undefined' ? document.getElementById(CANVAS_ID) : null;

  // Defensive: no canvas element or no 2D context support. Show a plain page
  // message rather than throwing so the failure is visible and explained.
  const ctx = canvas && canvas.getContext ? canvas.getContext('2d') : null;
  if (!ctx) {
    showContextError();
    return;
  }

  // The single source of truth for the simulation. Reassigned each frame with
  // the next state returned by update(), and replaced wholesale on restart.
  let gameState = createInitialState(canvas.width, canvas.height);

  // Wall-clock reference for delta-time. `null` until the first frame so the
  // very first dt is 0 (no jump from an undefined "previous" timestamp).
  let lastTime = null;

  /**
   * The requestAnimationFrame callback: run once per browser repaint.
   *
   * Computes delta time from the high-resolution timestamps the browser hands
   * us (converted ms → seconds and clamped by MAX_DT), reads the current input
   * snapshot, advances the pure simulation, draws the new state, and
   * re-schedules itself.
   *
   * @param {number} timestamp High-resolution time in milliseconds.
   * @returns {void}
   */
  function frame(timestamp) {
    if (lastTime === null) lastTime = timestamp;
    let dt = (timestamp - lastTime) / 1000; // ms → seconds
    lastTime = timestamp;

    // Clamp so a background tab / breakpoint can't cause a huge simulation jump.
    if (dt > MAX_DT) dt = MAX_DT;

    const input = getInputSnapshot(); // from input.js
    gameState = update(gameState, dt, input); // pure simulation step
    render(ctx, gameState); // draw the current state

    requestAnimationFrame(frame);
  }

  /**
   * Wire the level-up upgrade buttons — the one mouse-click input in the game.
   * Called once at boot (not per frame). Each `.upgrade-button` gets a click
   * listener that only acts while in LEVEL_UP: it reads the button's `data-slot`,
   * looks up the matching pending upgrade, applies it to the player, and resumes
   * PLAYING with the pending list cleared (Req 5.3, 5.4, 4.7, 5.5, 9.5).
   *
   * This mirrors the restart keydown boundary: the click logic lives here in the
   * I/O layer, never inside the frozen pure update().
   *
   * @returns {void}
   */
  function wireUpgradeButtons() {
    if (typeof document === 'undefined') return;
    const buttons = document.querySelectorAll('.upgrade-button');
    buttons.forEach((button) => {
      button.addEventListener('click', () => {
        // A click only means something while the level-up menu is showing; a
        // stray click in PLAYING or GAME_OVER is ignored (Req 5.5).
        if (gameState.phase !== 'LEVEL_UP') return;

        const slot = Number(button.dataset.slot);
        const chosen = gameState.pendingUpgrades[slot];
        if (!chosen) return;

        // Apply the chosen upgrade purely, clear the offered list, and resume.
        gameState = {
          ...gameState,
          player: applyUpgrade(gameState.player, chosen.id),
          phase: 'PLAYING',
          pendingUpgrades: [],
        };
        // Reset the clock reference so the first resumed frame's dt is 0 rather
        // than a large gap accumulated while the menu was open.
        lastTime = null;
      });
    });
  }

  // Restart from the game-over screen: pressing any key while in GAME_OVER
  // replaces the state with a fresh initial state, returning to PLAYING
  // (Req 4.7 — inputs are ignored until the game is restarted). During PLAYING
  // this listener does nothing; movement input is read via getInputSnapshot().
  if (typeof window !== 'undefined') {
    window.addEventListener('keydown', () => {
      if (gameState.phase === 'GAME_OVER') {
        gameState = createInitialState(canvas.width, canvas.height);
        // Reset the clock reference so the first post-restart dt is 0 rather
        // than a large gap accumulated while sitting on the game-over screen.
        lastTime = null;
      }
    });
  }

  // Attach the upgrade-button click handlers once, at boot.
  wireUpgradeButtons();

  // Turret placement: a click on the <canvas> itself (distinct from the
  // upgrade-button DOM clicks above). Convert the mouse position to game
  // coordinates and hand it to the pure tryPlaceTurret, which checks
  // phase === 'PLAYING', the placement radius, and affordability internally and
  // returns the same state on failure — so no extra guards are needed here.
  canvas.addEventListener('click', (event) => {
    const { x, y } = toCanvasCoords(canvas, event);
    gameState = tryPlaceTurret(gameState, x, y);
  });

  // Kick off the loop.
  requestAnimationFrame(frame);
}

/**
 * Replace the page body with a plain message explaining that the canvas 2D
 * context could not be obtained, so the user understands why nothing rendered.
 *
 * @returns {void}
 */
function showContextError() {
  if (typeof document === 'undefined' || !document.body) return;
  document.body.textContent =
    'Unable to start the game: your browser did not provide a 2D canvas context.';
}

// Start once the DOM is ready. As a module script, main.js is deferred by
// default, so the DOM is already parsed when this runs; guard for safety.
if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', main);
  } else {
    main();
  }
}
