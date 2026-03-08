/**
 * main.js
 * Entry point and game loop coordinator.
 * Initialises all modules in correct order, starts the 1-second tick,
 * handles tab visibility changes for delta compensation.
 */

import {
  getState,
  setState,
  loadGame,
  saveGame,
  applySavedState,
  calculateOfflineProgress
} from "./gameState.js";

import { initTimer, tickTimer } from "./timer.js";
import { initNursery, tickNursery, unlockTier } from "./nursery.js";
import { initEconomy, tickEconomy } from "./economy.js";
import { initUpgrades, renderUpgradeCards } from "./upgrades.js";
import {
  initUI,
  renderFrame,
  tickDayNight,
  showWelcomeBack,
  triggerWinSequence
} from "./ui.js";

const SAVE_INTERVAL_TICKS = 30; // save every 30 ticks (~30s)
const OFFLINE_THRESHOLD_SECONDS = 60; // show welcome-back if away > 60s

let _lastTickTime = null;
let _frameCount = 0;
let _hiddenAt = null;
let _gameLoopHandle = null;

/** Main game loop — runs once per second via setInterval. */
function tick() {
  const now = performance.now();

  if (_lastTickTime === null) {
    _lastTickTime = now;
    return;
  }

  const delta = Math.min((now - _lastTickTime) / 1000, 5); // cap delta at 5s per tick
  _lastTickTime = now;
  _frameCount++;

  tickTimer(delta);
  tickNursery(delta);
  tickEconomy(delta);

  // Tick day/night cycle (returns new state values)
  const dayNightUpdate = tickDayNight(delta);
  setState({ dayNight: dayNightUpdate });

  renderFrame();

  // Upgrade card refresh every 5 ticks (cheap DOM update)
  if (_frameCount % 5 === 0) {
    renderUpgradeCards();
  }

  // Save every SAVE_INTERVAL_TICKS ticks
  if (_frameCount % SAVE_INTERVAL_TICKS === 0) {
    saveGame();
  }
}

/** Handles browser tab visibility changes. */
function handleVisibilityChange() {
  if (document.hidden) {
    _hiddenAt = Date.now();
    saveGame();
  } else {
    if (_hiddenAt !== null) {
      const deltaSeconds = (Date.now() - _hiddenAt) / 1000;
      _hiddenAt = null;
      _lastTickTime = null; // reset tick timer to avoid huge delta on resume

      if (deltaSeconds > OFFLINE_THRESHOLD_SECONDS) {
        const result = calculateOfflineProgress(deltaSeconds);
        showWelcomeBack({
          awaySeconds: deltaSeconds,
          summary: result.summary
        });
      }
    }
  }
}

/** Effect dispatcher for upgrades — maps effect strings to game actions. */
function effectDispatcher(effect, upgradeId) {
  if (typeof effect === "string") {
    switch (effect) {
      case "unlock_nursery":
        // nipe_desk is pre-unlocked; nursery is already active
        break;
      case "unlock_tier2":
        unlockTier(2);
        break;
      case "unlock_tier3":
        unlockTier(3);
        break;
      case "unlock_tier4":
        unlockTier(4);
        break;
      case "win_condition":
        triggerWinSequence();
        _activateSandboxMode();
        break;
      default:
        console.log("[main] Unknown effect string:", effect);
    }
  } else if (typeof effect === "object" && effect !== null) {
    if (effect.passiveBM) {
      // Phase 3: register passive BM income
      console.log("[main] passiveBM effect:", effect.passiveBM);
    }
    if (effect.passiveBE) {
      console.log("[main] passiveBE effect:", effect.passiveBE);
    }
    if (effect.autoHarvest) {
      console.log("[main] autoHarvest effect:", effect.autoHarvest);
      // ml_harvesting flag in gameState drives this — already handled in nursery.js
    }
    if (effect.oneTimeBE) {
      const { addEnergy } = /** @type {any} */ (window._cp2bInternals || {});
      console.log("[main] oneTimeBE effect:", effect.oneTimeBE);
    }
  }
}

/** Activates sandbox mode after win (reduces growth rates, adds post-doc upgrades). */
function _activateSandboxMode() {
  setState({ sandboxMode: true });
  console.log("[main] Sandbox mode activated");
  // Phase 5 will flesh out sandbox upgrades and UI
}

/** Initialisation sequence. */
async function init() {
  // 1. Load saved game or use defaults
  const saved = loadGame();
  let offlineDelta = 0;

  if (saved) {
    offlineDelta = (Date.now() - saved.lastSaved) / 1000;
    applySavedState(saved);
  }

  // 2. Init all modules (order matters — gameState must be ready first)
  initUI();
  initTimer();
  initNursery();
  initEconomy();
  initUpgrades(effectDispatcher);

  // 3. Calculate and show offline progress if applicable
  if (saved && offlineDelta > OFFLINE_THRESHOLD_SECONDS) {
    const result = calculateOfflineProgress(offlineDelta);
    showWelcomeBack({
      awaySeconds: offlineDelta,
      summary: result.summary
    });
  }

  // 4. Initial render
  renderFrame();
  renderUpgradeCards();

  // 5. Start game loop
  _gameLoopHandle = setInterval(tick, 1000);

  // 6. Handle tab visibility
  document.addEventListener("visibilitychange", handleVisibilityChange);

  console.log("[CP2B] Research Station initialised.");
}

// Boot when DOM is ready
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
