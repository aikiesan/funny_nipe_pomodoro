/**
 * upgrades.js
 * Canonical UPGRADE_TREE configuration and purchase/effect logic.
 * Effects are applied by calling back into the relevant modules
 * via the effect dispatcher, keeping upgrades.js decoupled.
 *
 * STUB for Phase 1/2 — full implementation in Phase 3.
 */

import { getState, setUpgrade, spendEnergy, addEnergy } from "./gameState.js";

/** Canonical upgrade tree. */
const UPGRADE_TREE = {
  // Tier 0
  nipe_desk:          { label: "Set Up NIPE Desk",             cost: 0,     currency: "BE",  requires: [],                                  effect: "unlock_nursery" },
  // Tier 1 - Data Infrastructure
  ibge_api:           { label: "Connect IBGE API",             cost: 50,    currency: "BE",  requires: ["nipe_desk"],                        effect: null },
  snis_integration:   { label: "Integrate SNIS Database",      cost: 120,   currency: "BE",  requires: ["ibge_api"],                         effect: null },
  mapbiomas_layer:    { label: "MapBiomas Land Use Layer",      cost: 200,   currency: "BE",  requires: ["snis_integration"],                 effect: "unlock_tier2" },
  // Tier 2 - Platform Dev
  optimize_hrt:       { label: "Optimizar HRT",                cost: 100,   currency: "BE",  requires: ["nipe_desk"],                        effect: null },
  codigestion:        { label: "Codigestao (Sewage Sludge)",   cost: 300,   currency: "BE",  requires: ["snis_integration"],                 effect: null },
  advanced_substrate: { label: "Advanced Substrate Mix",       cost: 250,   currency: "BE",  requires: ["ibge_api"],                         effect: null },
  cp2b_maps_v1:       { label: "Launch CP2B Maps v1",          cost: 400,   currency: "BE",  requires: ["mapbiomas_layer"],                  effect: null },
  bagacinho_ai:       { label: "Activate Bagacinho AI",        cost: 600,   currency: "BE",  requires: ["cp2b_maps_v1"],                     effect: null },
  ml_harvesting:      { label: "ML Harvesting Algorithms",     cost: 900,   currency: "BE",  requires: ["bagacinho_ai"],                     effect: { autoHarvest: { tier: 1, intervalSec: 1 } } },
  // Tier 3 - Research Outputs
  rais_validation:    { label: "Validate 425 Biogas Plants",   cost: 1500,  currency: "BE",  requires: ["ml_harvesting"],                    effect: "unlock_tier3" },
  bioroute_builder:   { label: "Deploy BioRoute Builder",      cost: 2500,  currency: "BE",  requires: ["rais_validation"],                  effect: null },
  pilar2b_beta:       { label: "PILAR-2b Beta Release",        cost: 4000,  currency: "BE",  requires: ["bioroute_builder"],                 effect: null },
  // Tier 4 - Funding & Recognition
  fapesp_report:      { label: "Submit FAPESP Annual Report",  cost: 6000,  currency: "BE",  requires: ["pilar2b_beta"],                     effect: "unlock_tier4" },
  a1_article:         { label: "Publish A1 Article",           cost: 8000,  currency: "BE",  requires: ["fapesp_report"],                    effect: null },
  // WIN
  pilar2b_submit:     { label: "Submit PILAR-2b to EnvModSW", cost: 15000, currency: "BE",  requires: ["a1_article"],                       effect: "win_condition" }
};

// Effect dispatcher callback (set by initUpgrades)
let _effectDispatcher = null;

/**
 * Initialises upgrades module, renders initial upgrade list.
 * @param {Function} effectDispatcher - function(effect) called on purchase
 */
function initUpgrades(effectDispatcher) {
  _effectDispatcher = effectDispatcher;
  renderUpgradeCards();
}

/**
 * Attempts to purchase an upgrade.
 * @param {string} id - upgrade key
 * @returns {boolean} true if purchased
 */
function purchaseUpgrade(id) {
  const upgrade = UPGRADE_TREE[id];
  if (!upgrade) return false;
  if (!isUnlocked(id)) return false;
  if (isPurchased(id)) return false;
  if (!canAfford(id)) return false;

  if (upgrade.cost > 0) {
    if (!spendEnergy(upgrade.cost)) return false;
  }

  setUpgrade(id, true);

  if (upgrade.effect && _effectDispatcher) {
    _effectDispatcher(upgrade.effect, id);
  }

  renderUpgradeCards();
  return true;
}

/**
 * @param {string} id
 * @returns {boolean}
 */
function canAfford(id) {
  const upgrade = UPGRADE_TREE[id];
  if (!upgrade) return false;
  const { energy } = getState();
  return energy >= upgrade.cost;
}

/**
 * Returns true if all prerequisite upgrades are purchased.
 * @param {string} id
 * @returns {boolean}
 */
function isUnlocked(id) {
  const upgrade = UPGRADE_TREE[id];
  if (!upgrade) return false;
  const { upgrades } = getState();
  return upgrade.requires.every(req => !!upgrades[req]);
}

/**
 * @param {string} id
 * @returns {boolean}
 */
function isPurchased(id) {
  return !!getState().upgrades[id];
}

/**
 * Returns IDs of upgrades that are unlocked but not yet purchased.
 * @returns {string[]}
 */
function getAvailableUpgrades() {
  return Object.keys(UPGRADE_TREE).filter(id => isUnlocked(id) && !isPurchased(id));
}

/**
 * Renders all upgrade cards into #upgrades-list.
 * Called after any state change that affects upgrade visibility.
 */
function renderUpgradeCards() {
  const listEl = document.getElementById("upgrades-list");
  if (!listEl) return;

  listEl.innerHTML = "";

  for (const [id, upgrade] of Object.entries(UPGRADE_TREE)) {
    const purchased = isPurchased(id);
    const unlocked = isUnlocked(id);
    const affordable = canAfford(id);

    let cardClass = "upgrade-card";
    if (purchased) cardClass += " purchased";
    else if (unlocked && affordable) cardClass += " available";
    else if (unlocked && !affordable) cardClass += " available";  // show but dim
    else cardClass += " locked";

    const card = document.createElement("div");
    card.className = cardClass;
    card.dataset.upgradeId = id;
    card.innerHTML = `
      <span class="upgrade-status"></span>
      <span class="upgrade-label">${upgrade.label}</span>
      <span class="upgrade-cost">${upgrade.cost} ${upgrade.currency}</span>
    `;

    if (unlocked && !purchased) {
      card.style.opacity = affordable ? "1" : "0.6";
      card.addEventListener("click", () => purchaseUpgrade(id));
    }

    listEl.appendChild(card);
  }
}

export {
  UPGRADE_TREE,
  initUpgrades,
  purchaseUpgrade,
  canAfford,
  isUnlocked,
  isPurchased,
  getAvailableUpgrades,
  renderUpgradeCards
};
