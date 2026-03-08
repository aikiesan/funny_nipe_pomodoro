/**
 * nursery.js
 * Manages the nursery grid: planting, growth, and harvesting of feedstock plants.
 * Contains the canonical PLANT_TYPES configuration object.
 *
 * STUB for Phase 1 — full implementation in Phase 2.
 */

import { getState, addBiomass, addPlant, updatePlant, removePlant } from "./gameState.js";
import { isFocusActive } from "./timer.js";
import { showFloatingText } from "./ui.js";

/** Canonical plant type definitions. */
const PLANT_TYPES = {
  arachis:    { name: "Arachis pintoi",          tier: 1, baseGrowthMin: 3,   bmYield: 5,    palette: ["#4a7c59","#6aab7b","#2d5a3d"] },
  napier:     { name: "Capim Elefante",           tier: 1, baseGrowthMin: 8,   bmYield: 15,   palette: ["#5a8a3c","#7ab85c","#3a6025"] },
  sugarcane:  { name: "Cana-de-Acucar",           tier: 1, baseGrowthMin: 10,  bmYield: 20,   palette: ["#8ab840","#c8e060","#5a8020"] },
  eucalyptus: { name: "Eucalyptus spp.",          tier: 2, baseGrowthMin: 45,  bmYield: 90,   palette: ["#7aaa88","#9acca8","#4a7a58"] },
  bamboo:     { name: "Bambu (Dendrocalamus)",    tier: 2, baseGrowthMin: 90,  bmYield: 200,  palette: ["#6a9a50","#90cc70","#406030"] },
  macauba:    { name: "Macauba (Acrocomia)",      tier: 3, baseGrowthMin: 180, bmYield: 500,  palette: ["#8a7a40","#baa860","#604820"] },
  ipe:        { name: "Ipe Amarelo",              tier: 4, baseGrowthMin: 480, bmYield: 2000, palette: ["#c8a820","#f0d040","#906000"] }
};

const NURSERY_SIZE = 12;

/** Growth progress thresholds for each visual stage. */
const GROWTH_STAGE_THRESHOLDS = { s1: 0.25, s2: 0.60, s3: 1.0 };

/**
 * Pure: maps 0.0–1.0 progress ratio to stage index 0–3.
 * @param {number} ratio
 * @returns {number}
 */
function progressToStage(ratio) {
  if (ratio >= 1.0)                        return 3;
  if (ratio >= GROWTH_STAGE_THRESHOLDS.s2) return 2;
  if (ratio >= GROWTH_STAGE_THRESHOLDS.s1) return 1;
  return 0;
}

/**
 * Pure: creates a new plant data entry (no DOM, no state side-effects).
 * @param {string} uid
 * @param {string} type
 * @param {number} growthDuration - seconds
 * @returns {Object}
 */
function createPlantEntry(uid, type, growthDuration) {
  return { uid, type, plantedAt: Date.now(), growthDuration, progress: 0, harvested: false };
}

/**
 * Pure: calculates effective growth duration in seconds based on game context.
 * @param {string} type - key from PLANT_TYPES
 * @param {{ focusActive: boolean, isNight: boolean, hasSubstrate: boolean }} ctx
 * @returns {number} duration in seconds
 */
function calcGrowthDuration(type, { focusActive, isNight, hasSubstrate }) {
  const pt = PLANT_TYPES[type];
  if (!pt) return 0;
  let duration = pt.baseGrowthMin * 60;
  if (focusActive)   duration /= 2;
  if (hasSubstrate)  duration /= 1.5;
  if (isNight)       duration *= 1.15;
  return duration;
}

// Unlocked tiers (starts at 1; upgrades call unlockTier to expand)
const _unlockedTiers = new Set([1]);

// DOM ref for the grid
let _gridEl = null;
let _plantSelectEl = null;
let _plantBtnEl = null;

// Track which slots have plants (index -> uid or null)
const _slots = new Array(NURSERY_SIZE).fill(null);

// uid counter
let _uidCounter = 0;

/**
 * Initialises the nursery: renders grid tiles, binds click handlers.
 */
function initNursery() {
  _gridEl = document.getElementById("nursery-grid");
  _plantSelectEl = document.getElementById("plant-type-select");
  _plantBtnEl = document.getElementById("plant-btn");

  // Render initial empty slots
  _gridEl.innerHTML = "";
  for (let i = 0; i < NURSERY_SIZE; i++) {
    const slot = document.createElement("div");
    slot.className = "plant-slot empty";
    slot.dataset.slotIndex = i;
    slot.addEventListener("click", () => _onSlotClick(i));
    _gridEl.appendChild(slot);
  }

  // Restore any plants from saved state
  const { plants } = getState();
  for (const plant of plants) {
    const slotIdx = _findSlotForUid(plant.uid);
    if (slotIdx === -1) {
      // Assign to first free slot
      const freeIdx = _slots.indexOf(null);
      if (freeIdx !== -1) {
        _slots[freeIdx] = plant.uid;
        _renderSlot(freeIdx, plant);
      }
    }
  }

  // Plant button
  _plantBtnEl.addEventListener("click", () => {
    const type = _plantSelectEl.value;
    const freeIdx = _slots.indexOf(null);
    if (freeIdx === -1) {
      console.log("[nursery] No free slots");
      return;
    }
    plantSeed(freeIdx, type);
  });
}

/**
 * Advances plant growth each tick. Called by main game loop.
 * @param {number} deltaSeconds
 */
function tickNursery(deltaSeconds) {
  const state = getState();
  const focusActive = isFocusActive();
  const isNight = state.dayNight.phase === "night";
  const hasAdvancedSubstrate = !!state.upgrades.advanced_substrate;

  for (const plant of state.plants) {
    if (plant.harvested || plant.progress >= plant.growthDuration) continue;

    // Growth rate modifiers
    let effectiveDelta = deltaSeconds;
    if (focusActive) effectiveDelta *= 2;
    if (hasAdvancedSubstrate) effectiveDelta *= 1.5;
    if (isNight) effectiveDelta *= (1 / 1.15); // night slightly slower

    const newProgress = Math.min(plant.progress + effectiveDelta, plant.growthDuration);
    updatePlant(plant.uid, { progress: newProgress });

    // Auto-harvest if ml_harvesting active and plant is mature
    if (state.upgrades.ml_harvesting && newProgress >= plant.growthDuration) {
      harvestPlant(plant.uid);
    }
  }
}

/**
 * Plants a seed in the given slot.
 * @param {number} slotIndex
 * @param {string} plantType - key from PLANT_TYPES
 */
function plantSeed(slotIndex, plantType) {
  const pt = PLANT_TYPES[plantType];
  if (!pt) { console.warn("[nursery] Unknown plant type:", plantType); return; }
  if (!_unlockedTiers.has(pt.tier)) { console.log("[nursery] Tier locked:", pt.tier); return; }
  if (_slots[slotIndex] !== null) { console.log("[nursery] Slot occupied:", slotIndex); return; }

  const uid = `plant_${Date.now()}_${_uidCounter++}`;
  const state = getState();

  const duration = calcGrowthDuration(plantType, {
    focusActive:  isFocusActive(),
    isNight:      state.dayNight.phase === "night",
    hasSubstrate: !!state.upgrades.advanced_substrate
  });

  const plantEntry = createPlantEntry(uid, plantType, duration);

  addPlant(plantEntry);
  _slots[slotIndex] = uid;
  _renderSlot(slotIndex, plantEntry);
}

/**
 * Harvests a mature plant, adding BM to state.
 * @param {string} uid
 */
function harvestPlant(uid) {
  const state = getState();
  const plant = state.plants.find(p => p.uid === uid);
  if (!plant || plant.harvested) return;
  if (plant.progress < plant.growthDuration) return; // not ready

  const pt = PLANT_TYPES[plant.type];
  if (pt) addBiomass(pt.bmYield);

  updatePlant(uid, { harvested: true });

  const slotIdx = _slots.indexOf(uid);
  if (slotIdx !== -1) {
    _slots[slotIdx] = null;
    _clearSlot(slotIdx);

    // Show floating text (via ui.js — Dependency Inversion)
    const slotEl = _gridEl.children[slotIdx];
    if (slotEl && pt) {
      showFloatingText(slotEl, `+${pt.bmYield} BM`);
    }
  }

  removePlant(uid);
}

/**
 * Returns the number of empty nursery slots.
 * @returns {number}
 */
function getAvailableSlots() {
  return _slots.filter(s => s === null).length;
}

/**
 * Unlocks planting of a given tier number.
 * @param {number} tierNumber
 */
function unlockTier(tierNumber) {
  _unlockedTiers.add(tierNumber);
  _updatePlantSelector();
}

// --- Private helpers ---

function _onSlotClick(slotIdx) {
  const uid = _slots[slotIdx];
  if (!uid) return; // empty slot, ignore (planting is via button)

  const state = getState();
  const plant = state.plants.find(p => p.uid === uid);
  if (!plant) return;

  if (plant.progress >= plant.growthDuration) {
    harvestPlant(uid);
  }
}

function _renderSlot(slotIdx, plant) {
  const slotEl = _gridEl.children[slotIdx];
  if (!slotEl) return;

  const pt = PLANT_TYPES[plant.type];
  const progress = plant.progress / plant.growthDuration;
  const stage = progressToStage(progress);
  const isMature = progress >= 1;

  slotEl.className = `plant-slot${isMature ? " mature" : ""}`;
  slotEl.innerHTML = `
    <div class="plant-sprite ${plant.type} stage-${stage}"></div>
    <div class="plant-slot-label">${pt ? pt.name.split(" ")[0] : plant.type}</div>
    <div class="plant-progress-bar" style="width:${Math.min(progress * 100, 100)}%"></div>
  `;
}

function _clearSlot(slotIdx) {
  const slotEl = _gridEl.children[slotIdx];
  if (!slotEl) return;
  slotEl.className = "plant-slot empty";
  slotEl.innerHTML = "";
}

function _findSlotForUid(uid) {
  return _slots.indexOf(uid);
}

function _updatePlantSelector() {
  if (!_plantSelectEl) return;
  _plantSelectEl.innerHTML = "";
  for (const [id, pt] of Object.entries(PLANT_TYPES)) {
    if (!_unlockedTiers.has(pt.tier)) continue;
    const opt = document.createElement("option");
    opt.value = id;
    opt.textContent = `${pt.name} (${pt.baseGrowthMin}m / ${pt.bmYield} BM)`;
    _plantSelectEl.appendChild(opt);
  }
}

export {
  PLANT_TYPES,
  GROWTH_STAGE_THRESHOLDS,
  progressToStage,
  createPlantEntry,
  calcGrowthDuration,
  initNursery,
  tickNursery,
  plantSeed,
  harvestPlant,
  getAvailableSlots,
  unlockTier
};
