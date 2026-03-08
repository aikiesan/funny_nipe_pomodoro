/**
 * economy.js
 * Manages the CP2B Digester: BM -> BE conversion pipeline.
 * Also processes passive income from upgrades each tick.
 *
 * Conversion rate (base): 1 BM -> 0.5 BE over 10 seconds
 * = 0.05 BE per second per 1 BM unit in queue
 *
 * STUB for Phase 1/2 — full implementation in Phase 3.
 */

import { getState, setState, spendBiomass, addEnergy } from "./gameState.js";

// DOM refs
let _queueEl = null;
let _hrtBarEl = null;
let _beDisplayEl = null;
let _ch4FlameEl = null;
let _loadInputEl = null;
let _loadBtnEl = null;

/**
 * Initialises the economy module, binding DOM elements.
 */
function initEconomy() {
  _queueEl      = document.getElementById("digester-queue");
  _hrtBarEl     = document.getElementById("digester-hrt-bar");
  _beDisplayEl  = document.getElementById("digester-be-display");
  _ch4FlameEl   = document.getElementById("ch4-flame");
  _loadInputEl  = document.getElementById("load-bm-input");
  _loadBtnEl    = document.getElementById("load-bm-btn");

  _loadBtnEl.addEventListener("click", () => {
    const amount = parseInt(_loadInputEl.value, 10);
    if (isNaN(amount) || amount < 1) return;
    loadBiomassToDigester(amount);
  });
}

/**
 * Called each tick by main.js game loop.
 * Processes digester conversion and passive income.
 * @param {number} deltaSeconds
 */
function tickEconomy(deltaSeconds) {
  const state = getState();
  const { digester } = state;

  if (digester.queue <= 0) {
    if (_ch4FlameEl) _ch4FlameEl.classList.remove("active");
    return;
  }

  if (_ch4FlameEl) _ch4FlameEl.classList.add("active");

  const rate = getConversionRate();
  const maxBE = digester.queue * 0.5;
  const alreadyConverted = digester.totalConverted;

  if (alreadyConverted >= maxBE) return;

  const rawProduced = rate * deltaSeconds + digester.accumulator;
  const canProduce = maxBE - alreadyConverted;
  const actualProduced = Math.min(rawProduced, canProduce);

  const whole = Math.floor(actualProduced);
  const frac = actualProduced - whole;

  if (whole > 0) {
    addEnergy(whole);
    const bmConsumed = whole / 0.5;
    setState({
      digester: {
        queue: Math.max(0, digester.queue - bmConsumed),
        accumulator: frac,
        totalConverted: digester.totalConverted + whole
      }
    });
  } else {
    setState({ digester: { accumulator: frac } });
  }
}

/**
 * Moves BM from player balance into the digester queue.
 * @param {number} amount
 */
function loadBiomassToDigester(amount) {
  if (!spendBiomass(amount)) {
    console.log("[economy] Not enough BM to load:", amount);
    return;
  }
  const state = getState();
  setState({
    digester: {
      queue: state.digester.queue + amount,
      totalConverted: 0  // reset conversion tracker for new batch
    }
  });
}

/**
 * Returns the current BE/s conversion rate based on upgrades.
 * @returns {number}
 */
function getConversionRate() {
  const { upgrades } = getState();
  let rate = 0.05;
  if (upgrades.optimize_hrt) rate = 0.0625;
  if (upgrades.codigestion) rate *= 1.3;
  if (upgrades.bioroute_builder) rate *= 2;
  return rate;
}

/**
 * Returns passive BM per minute from upgrades.
 * @returns {number}
 */
function getPassiveBMRate() {
  return 0; // expanded in Phase 3
}

/**
 * Returns passive BE per minute from upgrades.
 * @returns {number}
 */
function getPassiveBERate() {
  return 0; // expanded in Phase 3
}

export {
  initEconomy,
  tickEconomy,
  loadBiomassToDigester,
  getConversionRate,
  getPassiveBMRate,
  getPassiveBERate
};
