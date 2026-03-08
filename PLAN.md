<!-- CLAUDE: READ THIS FILE BEFORE WRITING ANY CODE IN THIS REPO -->

# CP2B Research Station — Full Build Plan
## Pixel Idle / Ambient Productivity Game for GitHub Pages

---

## CLAUDE: READ THIS SECTION FIRST ON EVERY SESSION

This is a living plan document. Before writing any code, do the following:

1. Read `PLAN.md` in the repo root (this file)
2. Check the **Phase Status Tracker** below to know the current phase
3. Read the **completed phase summaries** to understand what already exists
4. Only then proceed with the current phase deliverables
5. After completing a phase, update the tracker and write a short completed-phase summary

**Repo root:** `A:\NIPE_FUNNY_RESERACH`
**Deployment:** GitHub Actions -> GitHub Pages, deploy from `main` branch
**Stack:** Vanilla HTML + CSS + ES6 modules. No build tools. No frameworks.
**External assets allowed:** Press Start 2P font from Google Fonts only.

---

## Phase Status Tracker

| Phase | Name | Status |
|-------|------|--------|
| 0 | Project Setup & GitHub Actions | COMPLETE |
| 1 | Foundation: HTML + CSS + gameState.js | COMPLETE |
| 2 | Core Loop Part 1: timer.js + nursery.js | PENDING |
| 3 | Core Loop Part 2: economy.js + upgrades.js | PENDING |
| 4 | Wiring & Rendering: main.js + ui.js | PENDING |
| 5 | Polish & Win Condition | PENDING |

**Current phase: 2**

---

## Completed Phase Summaries

### Phase 0 — Project Setup & GitHub Actions (COMPLETE)
Files created:
- `.github/workflows/deploy.yml` — GitHub Actions Pages deployment (checkout@v4, configure-pages@v5, upload-pages-artifact@v3, deploy-pages@v4)
- `index.html` — placeholder with "Loading..." message
- `.gitignore` — excludes node_modules, logs, OS files
- `PLAN.md` — this file

Next phase needs: Full index.html layout, style.css, js/gameState.js

### Phase 1 — Foundation: HTML + CSS + gameState.js (COMPLETE)
Files created:
- `index.html` — full 3-column layout with all required IDs
- `style.css` — complete design system, all 17 sections, CSS variables locked
- `js/gameState.js` — full implementation: getState/setState, addBiomass/spendBiomass, addEnergy/spendEnergy, addPlant/updatePlant/removePlant, setUpgrade, saveGame/loadGame, applySavedState, calculateOfflineProgress (8h cap, formula-based)
- `js/timer.js` — FULL implementation (not stub): startTimer/pauseTimer/resetTimer, tickTimer, isFocusActive/isBreakActive, CustomEvents dispatch
- `js/nursery.js` — FULL implementation: PLANT_TYPES config, initNursery, tickNursery, plantSeed, harvestPlant, getAvailableSlots, unlockTier, floating text, growth stage CSS classes
- `js/economy.js` — functional implementation: initEconomy, tickEconomy, loadBiomassToDigester, getConversionRate
- `js/upgrades.js` — full UPGRADE_TREE, purchaseUpgrade, canAfford, isUnlocked, isPurchased, renderUpgradeCards
- `js/ui.js` — full render system: initUI, renderFrame, tickDayNight (returns state delta for main.js to apply), showWelcomeBack, triggerWinSequence
- `js/main.js` — full game loop: init order, setInterval tick, visibilitychange handler, effectDispatcher, sandbox mode stub

Key implementation notes for Phase 2:
- timer.js and nursery.js are ALREADY fully implemented (not stubs)
- economy.js and upgrades.js are functional but can be enhanced in Phase 3
- tickDayNight() in ui.js returns { minutesElapsed, phase } which main.js applies via setState
- ml_harvesting auto-harvest is driven by the gameState.upgrades.ml_harvesting flag in nursery.tickNursery

---

## Project File Structure

```
<repo-root>/
├── PLAN.md                          <- living doc, mirrors this file
├── index.html                       <- main UI shell
├── style.css                        <- all visual styles + CSS Variables
├── js/
│   ├── main.js                      <- entry point, game loop (1s tick)
│   ├── gameState.js                 <- single source of truth, save/load
│   ├── timer.js                     <- Pomodoro logic (25/5), focus/break
│   ├── nursery.js                   <- PLANT_TYPES config, grow/harvest
│   ├── economy.js                   <- digester BM->BE, passive income
│   ├── upgrades.js                  <- UPGRADE_TREE, purchaseUpgrade()
│   └── ui.js                        <- render loop, floating text, animations
└── .github/
    └── workflows/
        └── deploy.yml               <- GitHub Actions -> Pages deployment
```

---

## Global Design Constraints (apply to all phases)

- `const` and `let` only — no `var`
- Every function has a JSDoc comment block
- Every file opens with a module-level comment explaining its responsibility
- State mutations ONLY through gameState setter functions — no direct writes from other modules
- All DOM queries cached at module init — no `querySelector` inside the game loop
- Game loop uses timestamp-based delta to handle tab-background slowdowns
- No image files — all pixel art via CSS `box-shadow` technique

---

## CSS Color Palette (locked — do not deviate)

```css
:root {
  --bg-primary:      #1a1a2e;   /* deep night blue */
  --bg-terminal:     #0d1117;   /* DOS terminal black */
  --green-phosphor:  #39ff14;   /* CRT green glow */
  --amber-focus:     #ffb347;   /* focus mode warm glow */
  --earth-brown:     #8B4513;   /* soil / nursery beds */
  --biogas-green:    #4caf50;   /* digester panels */
  --energy-gold:     #ffd700;   /* BE currency */
  --pixel-border:    3px solid var(--green-phosphor);
}
```

---

## Plant Tiers (CANONICAL)

| ID | Name | Growth (base) | BM Yield | Tier | Unlock Condition |
|----|------|--------------|----------|------|-----------------|
| `arachis` | Arachis pintoi | 3 min | 5 BM | 1 | Default |
| `napier` | Capim Elefante | 8 min | 15 BM | 1 | Default |
| `sugarcane` | Cana-de-Acucar | 10 min | 20 BM | 1 | Default |
| `eucalyptus` | Eucalyptus spp. | 45 min | 90 BM | 2 | `mapbiomas_layer` upgrade |
| `bamboo` | Bambu (Dendrocalamus) | 90 min | 200 BM | 2 | `mapbiomas_layer` upgrade |
| `macauba` | Macauba (Acrocomia) | 180 min | 500 BM | 3 | `rais_validation` upgrade |
| `ipe` | Ipe Amarelo | 480 min | 2000 BM | 4 | `fapesp_report` upgrade |

**Growth formula:**
```js
actualGrowthSeconds = basePlantSeconds
  / (isFocusActive ? 2 : 1)
  / (upgrades.advanced_substrate ? 1.5 : 1)
  * (isNightPhase ? 1.15 : 1)
```

---

## PHASE 0 — Project Setup & GitHub Actions [COMPLETE]

See Completed Phase Summaries above.

---

## PHASE 1 — Foundation: index.html + style.css + gameState.js

### Goal
Complete HTML layout shell, full CSS design system, and the game state module.

### Deliverables

#### `index.html` — Full Layout

Three-column grid:
```
┌─────────────────────────────────────────────────────┐
│  [HEADER] CP2B RESEARCH STATION  |  NIPE/UNICAMP    │
├──────────────┬──────────────────┬───────────────────┤
│  #nursery    │  #pomodoro-panel │  #digester-panel  │
│  (col-left)  │  (col-center)    │  (col-right)      │
├──────────────┴──────────────────┴───────────────────┤
│  #upgrades-panel                                    │
│  #resource-bar  (BM: 0  |  BE: 0)                  │
└─────────────────────────────────────────────────────┘
```

Required IDs (js modules bind to these — do NOT change them):
- `#nursery-grid` — CSS Grid for plant tiles
- `#pomodoro-display` — MM:SS countdown
- `#pomodoro-btn` — start/pause button
- `#bagacinho-sprite` — mascot div (hidden during focus)
- `#digester-queue` — BM units loaded display
- `#digester-hrt-bar` — progress bar inner div
- `#digester-be-display` — BE total display
- `#ch4-flame` — methane flame animation div
- `#upgrades-list` — upgrade card container
- `#resource-bm` — biomass counter
- `#resource-be` — energy counter
- `#focus-overlay` — full-page amber tint during focus (z-index: 1, pointer-events: none)
- `#welcome-back-modal` — offline progress summary modal (hidden by default)
- `#win-modal` — win condition full-screen (hidden by default)

#### `style.css` — Full Design System

Sections:
1. CSS Variables
2. Reset & Base
3. Layout Grid (3-col main + bottom bar)
4. Header styles
5. Panel shared styles
6. Nursery Grid + Plant Tile base styles
7. Plant Sprite stubs (4 growth stages, @keyframes)
8. Pomodoro panel styles
9. Bagacinho sprite + dance @keyframes (4 frames)
10. Digester panel styles + HRT bar + CH4 flame flicker
11. Upgrade card styles (locked / available / purchased)
12. Resource bar styles
13. Focus mode overlay animation
14. Floating text (.floating-bm) — @keyframes floatUp
15. Day/Night cycle classes applied to body
16. Welcome-back modal + win modal styles
17. Scrollbar styling

#### `js/gameState.js`

Single source of truth. All state mutations through exported setters.
Key functions: getState, setState, addBiomass, spendBiomass, addEnergy, spendEnergy,
addPlant, updatePlant, removePlant, setUpgrade, saveGame, loadGame, calculateOfflineProgress

---

## PHASE 2 — Core Loop Part 1: timer.js + nursery.js

### Goal
Working Pomodoro timer. Working nursery grid — plant, grow, harvest.

### Deliverables

#### `js/timer.js`
CustomEvents: cp2b:focus-start, cp2b:focus-end, cp2b:break-start, cp2b:break-end
Functions: initTimer, tickTimer, startTimer, pauseTimer, resetTimer, isFocusActive, isBreakActive

#### `js/nursery.js`
PLANT_TYPES config + NURSERY_SIZE = 12 slots (4x3 grid)
Functions: initNursery, tickNursery, plantSeed, harvestPlant, getAvailableSlots, unlockTier
Growth stages: 0%=stage-0, 25%=stage-1, 60%=stage-2, 100%=stage-3

---

## PHASE 3 — Core Loop Part 2: economy.js + upgrades.js

### Goal
Working digester (BM->BE). Full upgrade tree.

### Deliverables

#### `js/economy.js`
Base conversion: 1 BM -> 0.5 BE over 10s (0.05 BE/s per BM in queue)
Functions: initEconomy, tickEconomy, loadBiomassToDigester, getConversionRate, getPassiveBMRate, getPassiveBERate

#### `js/upgrades.js`
Full UPGRADE_TREE (see master plan for canonical list)
Functions: initUpgrades, purchaseUpgrade, canAfford, isUnlocked, isPurchased, getAvailableUpgrades

---

## PHASE 4 — Wiring & Rendering: main.js + ui.js

### Goal
All modules wired. Complete render system.

### Deliverables

#### `js/main.js`
Init order: loadGame -> offlineProgress -> init all modules -> start game loop (setInterval 1s)
Game loop: tickTimer, tickNursery, tickEconomy, tickDayNight, renderFrame
Save every 30 ticks (30s).

#### `js/ui.js`
DOM cache at module init. diff-based nursery render.
Functions: initUI, renderFrame, showFloatingText, showWelcomeBack, hideWelcomeBack, triggerWinSequence, tickDayNight

Day/Night (real minutes): 0-2 dawn, 2-8 morning, 8-16 afternoon, 16-20 dusk, 20-24 night, reset

---

## PHASE 5 — Polish & Win Condition

### Goal
Win animation, offline modal, Bagacinho polish, day/night transitions, sandbox mode.

Win sequence: fade to black -> SP state map -> envelope animation -> typewriter text -> sandbox mode
Sandbox mode: 0.5x growth rates + 3 post-doc upgrade placeholders

---

## GitHub Actions Notes

The deploy.yml uploads entire repo root as Pages artifact.
Never commit build artifacts or large binaries to root.

Local testing with ES6 modules requires a server:
```bash
python -m http.server 8080
# or
npx serve .
```

---

## Key Design Decisions

1. Sugarcane as Tier 1 — SP's dominant agroindustrial feedstock accessible from start
2. Macauba as Tier 3 — Native cerrado palm bridging Bamboo (T2) and Ipe (T4)
3. No build tools — ES6 modules work natively, GitHub Pages serves static files
4. CustomEvents for inter-module communication — prevents tight coupling
5. diff-based nursery render — avoids layout thrash from rebuilding 12 tiles/second
