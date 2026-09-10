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

// Clamp a single simulation step to at most 50 ms. If the tab is hidden or a
// debugger pauses execution, the next timestamp gap could be several seconds,
// teleporting enemies through the player. Clamping keeps each step stable.
const MAX_DT = 0.05;

// The id of the <canvas> element declared in index.html.
const CANVAS_ID = 'game-canvas';

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
