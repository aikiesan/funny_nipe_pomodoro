/**
 * ui.js
 * All DOM manipulation lives here.
 * Reads state via getState(), never writes state directly.
 * Exports renderFrame() called each tick, plus one-shot animation helpers.
 *
 * STUB for Phase 1 — full implementation in Phase 4.
 */

import { getState } from "./gameState.js";

// DOM cache — all getElementById calls happen here at module init
let _bmEl = null;
let _beEl = null;
let _pomDisplayEl = null;
let _pomCyclesEl = null;
let _digesterQueueEl = null;
let _digesterHrtBarEl = null;
let _digesterBeDisplayEl = null;
let _dayNightIndicatorEl = null;
let _welcomeBackModal = null;
let _welcomeBackAwayTime = null;
let _welcomeBackList = null;
let _welcomeBackClose = null;
let _winModal = null;
let _winText = null;
let _winContinue = null;
let _winMap = null;

// Diff-based nursery render cache
let _lastNurseryState = {};

// Day/night timing
const DAY_PHASES = [
  { phase: "dawn",      maxMin: 2  },
  { phase: "morning",   maxMin: 8  },
  { phase: "afternoon", maxMin: 16 },
  { phase: "dusk",      maxMin: 20 },
  { phase: "night",     maxMin: 24 }
];

const DAY_CYCLE_TOTAL_MINUTES = 24;

/**
 * Initialises the UI module, caching all DOM references.
 * Must be called before renderFrame().
 */
function initUI() {
  _bmEl                 = document.getElementById("resource-bm");
  _beEl                 = document.getElementById("resource-be");
  _pomDisplayEl         = document.getElementById("pomodoro-display");
  _pomCyclesEl          = document.getElementById("pomodoro-cycles");
  _digesterQueueEl      = document.getElementById("digester-queue");
  _digesterHrtBarEl     = document.getElementById("digester-hrt-bar");
  _digesterBeDisplayEl  = document.getElementById("digester-be-display");
  _dayNightIndicatorEl  = document.getElementById("day-night-indicator");
  _welcomeBackModal     = document.getElementById("welcome-back-modal");
  _welcomeBackAwayTime  = document.getElementById("welcome-back-away-time");
  _welcomeBackList      = document.getElementById("welcome-back-list");
  _welcomeBackClose     = document.getElementById("welcome-back-close");
  _winModal             = document.getElementById("win-modal");
  _winText              = document.getElementById("win-text");
  _winContinue          = document.getElementById("win-continue");
  _winMap               = document.getElementById("win-map");

  if (_welcomeBackClose) {
    _welcomeBackClose.addEventListener("click", hideWelcomeBack);
  }

  if (_winContinue) {
    _winContinue.addEventListener("click", () => {
      if (_winModal) _winModal.classList.add("hidden");
    });
  }
}

/**
 * Full render pass — called each tick by main.js.
 */
function renderFrame() {
  const state = getState();
  renderResourceBar(state);
  renderPomodoroDisplay(state.pomodoro);
  renderDigesterPanel(state.digester, state.energy);
  renderDayNightPhase(state.dayNight.phase);
}

/**
 * Renders BM and BE counters.
 * @param {Object} state
 */
function renderResourceBar(state) {
  if (_bmEl) _bmEl.textContent = Math.floor(state.biomass);
  if (_beEl) _beEl.textContent = Math.floor(state.energy);
}

/**
 * Renders the Pomodoro timer display.
 * @param {Object} pomodoro
 */
function renderPomodoroDisplay(pomodoro) {
  if (!_pomDisplayEl) return;
  const secs = Math.max(0, Math.ceil(pomodoro.secondsRemaining));
  const mm = String(Math.floor(secs / 60)).padStart(2, "0");
  const ss = String(secs % 60).padStart(2, "0");
  _pomDisplayEl.textContent = `${mm}:${ss}`;

  if (_pomCyclesEl) {
    _pomCyclesEl.textContent = `Cycles: ${pomodoro.cyclesCompleted}`;
  }
}

/**
 * Renders the digester panel.
 * @param {Object} digester
 * @param {number} energy
 */
function renderDigesterPanel(digester, energy) {
  if (_digesterQueueEl) _digesterQueueEl.textContent = Math.floor(digester.queue);
  if (_digesterBeDisplayEl) _digesterBeDisplayEl.textContent = Math.floor(energy);

  // HRT bar: progress of current batch
  if (_digesterHrtBarEl) {
    const maxBE = digester.queue * 0.5;
    const pct = maxBE > 0 ? Math.min((digester.totalConverted / maxBE) * 100, 100) : 0;
    _digesterHrtBarEl.style.width = `${pct}%`;
  }
}

/**
 * Applies the day/night phase class to the body element.
 * @param {string} phase
 */
function renderDayNightPhase(phase) {
  const phases = ["dawn", "morning", "afternoon", "dusk", "night"];
  phases.forEach(p => {
    if (p === phase) document.body.classList.add(p);
    else document.body.classList.remove(p);
  });

  if (_dayNightIndicatorEl) {
    _dayNightIndicatorEl.textContent = phase.toUpperCase();
  }
}

/**
 * Advances the day/night cycle based on elapsed real minutes.
 * @param {number} deltaSeconds
 */
function tickDayNight(deltaSeconds) {
  const state = getState();
  const newMinutes = state.dayNight.minutesElapsed + (deltaSeconds / 60);
  const wrapped = newMinutes % DAY_CYCLE_TOTAL_MINUTES;

  let phase = "morning";
  for (const entry of DAY_PHASES) {
    if (wrapped < entry.maxMin) {
      phase = entry.phase;
      break;
    }
  }

  // Only import setState here if needed — use a dynamic approach
  // tickDayNight is called from main.js which has the setState import
  // We export the new state values so main.js can apply them
  return { minutesElapsed: newMinutes, phase };
}

/**
 * Creates a floating "+X BM" div at the given anchor element's position.
 * @param {Element} anchorEl
 * @param {string} text
 */
function showFloatingText(anchorEl, text) {
  const rect = anchorEl.getBoundingClientRect();
  const el = document.createElement("div");
  el.className = "floating-bm";
  el.textContent = text;
  el.style.left = `${rect.left + rect.width / 2}px`;
  el.style.top = `${rect.top}px`;
  el.style.position = "fixed";
  document.body.appendChild(el);
  el.addEventListener("animationend", () => el.remove());
}

/**
 * Populates and shows the welcome-back modal.
 * @param {{ awaySeconds: number, summary: string[] }} data
 */
function showWelcomeBack(data) {
  if (!_welcomeBackModal) return;

  const hrs = Math.floor(data.awaySeconds / 3600);
  const mins = Math.floor((data.awaySeconds % 3600) / 60);
  const timeStr = hrs > 0 ? `${hrs}h ${mins}m` : `${mins}m`;

  if (_welcomeBackAwayTime) {
    _welcomeBackAwayTime.textContent = `You were away for: ${timeStr}`;
  }
  if (_welcomeBackList) {
    _welcomeBackList.innerHTML = data.summary
      .map(line => `<li>${line}</li>`)
      .join("");
  }

  _welcomeBackModal.classList.remove("hidden");
}

/** Hides the welcome-back modal. */
function hideWelcomeBack() {
  if (_welcomeBackModal) _welcomeBackModal.classList.add("hidden");
}

/**
 * Triggers the full win sequence animation.
 */
function triggerWinSequence() {
  if (!_winModal) return;

  // Render SP state silhouette as box-shadow pixel art on #win-map
  if (_winMap) {
    _winMap.style.boxShadow = _buildSPStateSilhouette();
  }

  _winModal.classList.remove("hidden");

  // Typewriter effect for win text
  const message = "PILAR-2B SUBMITTED.\nFAPESP SMILES.\nBAGACINHO DANCES FOREVER.";
  if (_winText) {
    _winText.textContent = "";
    let charIdx = 0;
    const typeInterval = setInterval(() => {
      if (charIdx < message.length) {
        _winText.textContent += message[charIdx];
        charIdx++;
      } else {
        clearInterval(typeInterval);
      }
    }, 60);
  }
}

/**
 * Builds a simplified CSS box-shadow representation of São Paulo state silhouette.
 * @private
 * @returns {string}
 */
function _buildSPStateSilhouette() {
  // Simplified pixel art silhouette of SP state outline with Campinas blinking dot
  const pixels = [
    // Rough SP state outline (each entry: x, y in 4px units, color)
    [10,2,"#39ff14"],[11,2,"#39ff14"],[12,2,"#39ff14"],
    [9,3,"#39ff14"],[10,3,"#39ff14"],[11,3,"#39ff14"],[12,3,"#39ff14"],[13,3,"#39ff14"],
    [8,4,"#39ff14"],[9,4,"#39ff14"],[10,4,"#39ff14"],[11,4,"#39ff14"],[12,4,"#39ff14"],[13,4,"#39ff14"],[14,4,"#39ff14"],
    [7,5,"#39ff14"],[8,5,"#39ff14"],[9,5,"#39ff14"],[10,5,"#39ff14"],[11,5,"#39ff14"],[12,5,"#39ff14"],[13,5,"#39ff14"],[14,5,"#39ff14"],[15,5,"#39ff14"],
    [7,6,"#39ff14"],[8,6,"#39ff14"],[9,6,"#39ff14"],[10,6,"#39ff14"],[11,6,"#39ff14"],[12,6,"#39ff14"],[13,6,"#39ff14"],[14,6,"#39ff14"],[15,6,"#39ff14"],[16,6,"#39ff14"],
    [6,7,"#39ff14"],[7,7,"#39ff14"],[8,7,"#39ff14"],[9,7,"#39ff14"],[10,7,"#39ff14"],[11,7,"#39ff14"],[12,7,"#39ff14"],[13,7,"#39ff14"],[14,7,"#39ff14"],[15,7,"#39ff14"],[16,7,"#39ff14"],
    [6,8,"#39ff14"],[7,8,"#39ff14"],[8,8,"#39ff14"],[9,8,"#39ff14"],[10,8,"#39ff14"],[11,8,"#39ff14"],[12,8,"#39ff14"],[13,8,"#39ff14"],[14,8,"#39ff14"],
    [7,9,"#39ff14"],[8,9,"#39ff14"],[9,9,"#39ff14"],[10,9,"#39ff14"],[11,9,"#39ff14"],[12,9,"#39ff14"],[13,9,"#39ff14"],
    [8,10,"#39ff14"],[9,10,"#39ff14"],[10,10,"#39ff14"],[11,10,"#39ff14"],[12,10,"#39ff14"],
    [9,11,"#39ff14"],[10,11,"#39ff14"],[11,11,"#39ff14"],
    // Campinas dot (blinking via animation applied separately)
    [11,6,"#ffd700"],[11,7,"#ffd700"],
  ];

  return pixels.map(([x, y, c]) => `${x * 4}px ${y * 4}px 0 2px ${c}`).join(", ");
}

export {
  initUI,
  renderFrame,
  renderResourceBar,
  renderPomodoroDisplay,
  renderDigesterPanel,
  renderDayNightPhase,
  tickDayNight,
  showFloatingText,
  showWelcomeBack,
  hideWelcomeBack,
  triggerWinSequence
};
