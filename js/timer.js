/**
 * timer.js
 * Pomodoro timer logic. Manages focus/break phases.
 * Dispatches CustomEvents on phase changes so other modules can react
 * without direct coupling.
 *
 * Events dispatched on document:
 *   cp2b:focus-start  -> { detail: { cycleNumber } }
 *   cp2b:focus-end    -> { detail: { cycleNumber } }
 *   cp2b:break-start  -> { detail: { cycleNumber } }
 *   cp2b:break-end    -> { detail: { cycleNumber } }
 *
 * STUB — full implementation in Phase 2.
 */

import { getState, setState } from "./gameState.js";

const FOCUS_SECONDS = 25 * 60;
const BREAK_SECONDS = 5 * 60;

// DOM refs (cached at init)
let _displayEl = null;
let _btnEl = null;
let _resetBtnEl = null;
let _phaseLabel = null;
let _cyclesEl = null;

/**
 * Initialises the timer module, binding DOM elements and restoring state.
 */
function initTimer() {
  _displayEl  = document.getElementById("pomodoro-display");
  _btnEl      = document.getElementById("pomodoro-btn");
  _resetBtnEl = document.getElementById("pomodoro-reset-btn");
  _phaseLabel = document.getElementById("pomodoro-phase-label");
  _cyclesEl   = document.getElementById("pomodoro-cycles");

  _btnEl.addEventListener("click", () => {
    const { pomodoro } = getState();
    if (pomodoro.isRunning) {
      pauseTimer();
    } else {
      startTimer();
    }
  });

  _resetBtnEl.addEventListener("click", resetTimer);
}

/**
 * Called each tick by main.js game loop.
 * @param {number} deltaSeconds
 */
function tickTimer(deltaSeconds) {
  const state = getState();
  const pom = state.pomodoro;
  if (!pom.isRunning) return;

  let remaining = pom.secondsRemaining - deltaSeconds;

  if (remaining <= 0) {
    // Phase boundary
    if (pom.phase === "focus") {
      _fireFocusEnd(pom.cyclesCompleted);
      _startBreak(pom.cyclesCompleted);
    } else if (pom.phase === "break") {
      _fireBreakEnd(pom.cyclesCompleted);
      _returnToIdle();
    }
  } else {
    setState({ pomodoro: { secondsRemaining: remaining } });
  }
}

/** Starts or resumes a focus session. */
function startTimer() {
  const state = getState();
  const pom = state.pomodoro;

  if (pom.phase === "idle") {
    setState({
      pomodoro: {
        phase: "focus",
        secondsRemaining: FOCUS_SECONDS,
        isRunning: true
      }
    });
    document.body.classList.add("focus-active");
    const bagacinho = document.getElementById("bagacinho-sprite");
    if (bagacinho) bagacinho.classList.remove("dancing");
    _fireFocusStart(state.pomodoro.cyclesCompleted);
  } else {
    setState({ pomodoro: { isRunning: true } });
  }

  if (_btnEl) _btnEl.textContent = "PAUSE";
}

/** Pauses the running timer. */
function pauseTimer() {
  setState({ pomodoro: { isRunning: false } });
  if (_btnEl) _btnEl.textContent = "RESUME";
}

/** Resets timer to idle state. */
function resetTimer() {
  setState({
    pomodoro: {
      phase: "idle",
      secondsRemaining: FOCUS_SECONDS,
      isRunning: false
    }
  });
  document.body.classList.remove("focus-active");
  const bagacinho = document.getElementById("bagacinho-sprite");
  if (bagacinho) bagacinho.classList.remove("dancing");
  if (_btnEl) _btnEl.textContent = "START FOCUS";
  if (_phaseLabel) _phaseLabel.textContent = "IDLE";
}

/**
 * @returns {boolean} true when a focus session is actively running
 */
function isFocusActive() {
  return getState().pomodoro.phase === "focus" && getState().pomodoro.isRunning;
}

/**
 * @returns {boolean} true when a break session is active
 */
function isBreakActive() {
  return getState().pomodoro.phase === "break";
}

// --- Private helpers ---

function _startBreak(cycleNumber) {
  setState({
    pomodoro: {
      phase: "break",
      secondsRemaining: BREAK_SECONDS,
      isRunning: true,
      cyclesCompleted: cycleNumber + 1
    }
  });
  document.body.classList.remove("focus-active");
  const bagacinho = document.getElementById("bagacinho-sprite");
  if (bagacinho) bagacinho.classList.add("dancing");
  if (_phaseLabel) _phaseLabel.textContent = "BREAK";
  if (_btnEl) _btnEl.textContent = "PAUSE BREAK";
  _fireBreakStart(cycleNumber + 1);
}

function _returnToIdle() {
  setState({
    pomodoro: {
      phase: "idle",
      secondsRemaining: FOCUS_SECONDS,
      isRunning: false
    }
  });
  const bagacinho = document.getElementById("bagacinho-sprite");
  if (bagacinho) bagacinho.classList.remove("dancing");
  if (_phaseLabel) _phaseLabel.textContent = "IDLE";
  if (_btnEl) _btnEl.textContent = "START FOCUS";
}

function _fireFocusStart(cycleNumber) {
  document.dispatchEvent(new CustomEvent("cp2b:focus-start", { detail: { cycleNumber } }));
  if (_phaseLabel) _phaseLabel.textContent = "FOCUS";
}

function _fireFocusEnd(cycleNumber) {
  document.dispatchEvent(new CustomEvent("cp2b:focus-end", { detail: { cycleNumber } }));
}

function _fireBreakStart(cycleNumber) {
  document.dispatchEvent(new CustomEvent("cp2b:break-start", { detail: { cycleNumber } }));
}

function _fireBreakEnd(cycleNumber) {
  document.dispatchEvent(new CustomEvent("cp2b:break-end", { detail: { cycleNumber } }));
}

export { initTimer, tickTimer, startTimer, pauseTimer, resetTimer, isFocusActive, isBreakActive };
