// scoring.js — pure survival-time scoring helper (updateScore).

/**
 * Accumulate total survival time and derive the score as whole seconds
 * survived.
 *
 * Rather than resetting a fractional accumulator each frame (which risks
 * losing sub-second time), we accumulate the *total* survival time and derive
 * the score as its floor. This carries partial elapsed time forward toward the
 * next whole second and discards nothing (Req 5.2, 5.3). The score starts at 0
 * because survivalTime starts at 0 in the initial state (Req 5.1).
 *
 * Pure: does not mutate the incoming state.
 *
 * @param {{survivalTime:number}} state Current game state (uses survivalTime).
 * @param {number} dt Elapsed time since the previous update, in seconds.
 * @returns {{survivalTime:number, score:number}} Updated total survival time and derived score.
 */
export function updateScore(state, dt) {
  const survivalTime = state.survivalTime + dt; // total seconds, never reset
  const score = Math.floor(survivalTime); // whole seconds survived
  return { survivalTime, score };
}
