/**
 * gameState.js
 * Single source of truth for all game data.
 * All state mutations go through the exported setter functions.
 * Other modules import getState() and the setters — never the raw state object.
 */

const VERSION = "1.0.0";
const SAVE_KEY = "cp2b_save";
const OFFLINE_CAP_SECONDS = 28800; // 8 hours

const DEFAULT_STATE = {
  version: VERSION,
  biomass: 0,
  energy: 0,
  totalBiomassEver: 0,
  totalEnergyEver: 0,
  plants: [],
  // plants entry shape: { uid, type, plantedAt, growthDuration, progress, harvested }
  upgrades: {
    nipe_desk: true   // pre-unlocked; all others default false
  },
  pomodoro: {
    phase: "idle",            // "idle" | "focus" | "break"
    secondsRemaining: 25 * 60,
    cyclesCompleted: 0,
    isRunning: false
  },
  digester: {
    queue: 0,                 // BM units loaded
    accumulator: 0,           // fractional BE in progress
    totalConverted: 0
  },
  dayNight: {
    phase: "morning",         // "dawn"|"morning"|"afternoon"|"dusk"|"night"
    minutesElapsed: 0         // real minutes since session start
  },
  lastSaved: Date.now(),
  sessionStarted: Date.now()
};

/** Deep clone a value (handles plain objects and arrays) */
function deepClone(obj) {
  if (obj === null || typeof obj !== "object") return obj;
  if (Array.isArray(obj)) return obj.map(deepClone);
  const out = {};
  for (const key of Object.keys(obj)) {
    out[key] = deepClone(obj[key]);
  }
  return out;
}

/** Deep merge source into target (mutates target) */
function deepMerge(target, source) {
  for (const key of Object.keys(source)) {
    if (
      source[key] !== null &&
      typeof source[key] === "object" &&
      !Array.isArray(source[key]) &&
      typeof target[key] === "object" &&
      target[key] !== null &&
      !Array.isArray(target[key])
    ) {
      deepMerge(target[key], source[key]);
    } else {
      target[key] = deepClone(source[key]);
    }
  }
}

let _state = deepClone(DEFAULT_STATE);

/**
 * Returns a deep-clone snapshot of the current game state.
 * @returns {Object}
 */
function getState() {
  return deepClone(_state);
}

/**
 * Deep-merges a partial update into game state.
 * @param {Object} partialUpdate
 */
function setState(partialUpdate) {
  deepMerge(_state, partialUpdate);
}

/**
 * Adds biomass to the player's balance and totalBiomassEver.
 * @param {number} amount
 */
function addBiomass(amount) {
  _state.biomass += amount;
  _state.totalBiomassEver += amount;
}

/**
 * Deducts biomass from the player's balance if sufficient funds exist.
 * @param {number} amount
 * @returns {boolean} true if successful, false if insufficient
 */
function spendBiomass(amount) {
  if (_state.biomass < amount) return false;
  _state.biomass -= amount;
  return true;
}

/**
 * Adds energy (BE) to the player's balance and totalEnergyEver.
 * @param {number} amount
 */
function addEnergy(amount) {
  _state.energy += amount;
  _state.totalEnergyEver += amount;
}

/**
 * Deducts energy (BE) from the player's balance if sufficient funds exist.
 * @param {number} amount
 * @returns {boolean} true if successful, false if insufficient
 */
function spendEnergy(amount) {
  if (_state.energy < amount) return false;
  _state.energy -= amount;
  return true;
}

/**
 * Adds a plant entry to the state.
 * @param {{ uid: string, type: string, plantedAt: number, growthDuration: number, progress: number, harvested: boolean }} plantEntry
 */
function addPlant(plantEntry) {
  _state.plants.push(plantEntry);
}

/**
 * Updates a plant entry by uid.
 * @param {string} uid
 * @param {Object} partialUpdate
 */
function updatePlant(uid, partialUpdate) {
  const plant = _state.plants.find(p => p.uid === uid);
  if (plant) Object.assign(plant, partialUpdate);
}

/**
 * Removes a plant entry by uid.
 * @param {string} uid
 */
function removePlant(uid) {
  _state.plants = _state.plants.filter(p => p.uid !== uid);
}

/**
 * Sets an upgrade flag in state.
 * @param {string} id - upgrade key
 * @param {boolean} value
 */
function setUpgrade(id, value) {
  _state.upgrades[id] = value;
}

/**
 * Persists current game state to localStorage.
 */
function saveGame() {
  _state.lastSaved = Date.now();
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(_state));
  } catch (e) {
    console.warn("[gameState] saveGame failed:", e);
  }
}

/**
 * Loads saved game state from localStorage.
 * @returns {Object|null} parsed save data, or null if not found / invalid
 */
function loadGame() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || !parsed.version) return null;
    return parsed;
  } catch (e) {
    console.warn("[gameState] loadGame failed:", e);
    return null;
  }
}

/**
 * Applies a saved state object over the current state.
 * Merges so that any new keys added in DEFAULT_STATE still get defaults.
 * @param {Object} savedState
 */
function applySavedState(savedState) {
  // Start from a fresh default, then layer the save on top
  _state = deepClone(DEFAULT_STATE);
  deepMerge(_state, savedState);
}

/**
 * Calculates offline progress for a given elapsed time in seconds.
 * Uses formula-based math rather than simulating each tick.
 * Caps at OFFLINE_CAP_SECONDS (8 hours).
 *
 * @param {number} deltaSeconds - seconds elapsed since last save
 * @returns {{ biomassGained: number, energyGained: number, plantsMatured: string[], summary: string[] }}
 */
function calculateOfflineProgress(deltaSeconds) {
  const capped = Math.min(deltaSeconds, OFFLINE_CAP_SECONDS);
  const state = _state; // work directly with live state

  let biomassGained = 0;
  let energyGained = 0;
  const plantsMatured = [];
  const summary = [];

  const hasAutoHarvest = !!state.upgrades.ml_harvesting;

  // --- Plant maturation ---
  const plantCounts = {};
  for (const plant of state.plants) {
    if (plant.harvested) continue;

    const remaining = plant.growthDuration - plant.progress;
    if (remaining <= capped) {
      // Plant matures during offline period
      plantsMatured.push(plant.uid);
      if (hasAutoHarvest) {
        // Auto-harvest: credit BM
        const PLANT_TYPES = _getPlantTypes();
        const pt = PLANT_TYPES[plant.type];
        if (pt) {
          biomassGained += pt.bmYield;
          plantCounts[plant.type] = (plantCounts[plant.type] || 0) + 1;
        }
        plant.progress = plant.growthDuration;
        plant.harvested = true;
      } else {
        // Mark as mature but not auto-harvested
        plant.progress = plant.growthDuration;
      }
    } else {
      // Plant still growing
      plant.progress += capped;
    }
  }

  // Build summary lines for plant activity
  for (const [type, count] of Object.entries(plantCounts)) {
    const PLANT_TYPES = _getPlantTypes();
    const name = PLANT_TYPES[type]?.name ?? type;
    summary.push(`${count}x ${name} auto-harvested`);
  }

  const maturedNotHarvested = plantsMatured.filter(uid => {
    const p = state.plants.find(pl => pl.uid === uid);
    return p && !p.harvested;
  });
  if (maturedNotHarvested.length > 0) {
    summary.push(`${maturedNotHarvested.length} plant(s) ready to harvest`);
  }

  // --- Digester offline production ---
  if (state.digester.queue > 0) {
    const baseRate = 0.05; // BE/s per BM unit
    const hasOptimizeHRT = !!state.upgrades.optimize_hrt;
    const hasCodigestion = !!state.upgrades.codigestion;
    const hasBioroute = !!state.upgrades.bioroute_builder;

    let rate = baseRate;
    if (hasOptimizeHRT) rate = 0.0625;
    if (hasCodigestion) rate *= 1.3;
    if (hasBioroute) rate *= 2;

    const maxBEFromQueue = state.digester.queue * 0.5; // 1 BM → 0.5 BE total
    const rawProduced = rate * capped + state.digester.accumulator;
    const actualProduced = Math.min(rawProduced, maxBEFromQueue - state.digester.totalConverted);

    if (actualProduced > 0) {
      const whole = Math.floor(actualProduced);
      const frac = actualProduced - whole;

      energyGained += whole;
      state.digester.accumulator = frac;
      state.digester.totalConverted += whole;

      // Drain queue proportionally
      const bmConsumed = whole / 0.5;
      state.digester.queue = Math.max(0, state.digester.queue - bmConsumed);

      summary.push(`Digester produced ${whole} BE`);
    }
  }

  // --- Apply gains to state ---
  if (biomassGained > 0) {
    addBiomass(biomassGained);
    summary.push(`${Math.floor(biomassGained)} BM from auto-harvest`);
  }
  if (energyGained > 0) {
    addEnergy(energyGained);
  }

  if (summary.length === 0) {
    summary.push("Bagacinho kept the lights on");
  }

  return {
    biomassGained,
    energyGained,
    plantsMatured,
    summary
  };
}

/**
 * Internal helper — returns PLANT_TYPES without importing nursery.js
 * (avoids circular dependency; duplicates the minimal data needed here)
 * @private
 */
function _getPlantTypes() {
  return {
    arachis:    { name: "Arachis pintoi",       bmYield: 5 },
    napier:     { name: "Capim Elefante",        bmYield: 15 },
    sugarcane:  { name: "Cana-de-Acucar",        bmYield: 20 },
    eucalyptus: { name: "Eucalyptus spp.",       bmYield: 90 },
    bamboo:     { name: "Bambu (Dendrocalamus)", bmYield: 200 },
    macauba:    { name: "Macauba (Acrocomia)",   bmYield: 500 },
    ipe:        { name: "Ipe Amarelo",           bmYield: 2000 }
  };
}

export {
  getState,
  setState,
  addBiomass,
  spendBiomass,
  addEnergy,
  spendEnergy,
  addPlant,
  updatePlant,
  removePlant,
  setUpgrade,
  saveGame,
  loadGame,
  applySavedState,
  calculateOfflineProgress
};
