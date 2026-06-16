# ⚔️ Dungeon Master

> A procedural browser RPG built **without AI APIs** — every dungeon, story beat and battle is driven by pure algorithms, templates and weighted random tables, exactly like a tabletop game master would run them.

![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black)
![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178C6?logo=typescript&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-8-646CFF?logo=vite&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind-v4-38BDF8?logo=tailwindcss&logoColor=white)
![Zustand](https://img.shields.io/badge/Zustand-state-2D3748)
![License](https://img.shields.io/badge/license-MIT-c9a227)

---

## 🎮 Demo

> 📹 *Recording coming soon.* In the meantime, **clone and run locally to play** (see [Getting Started](#-getting-started)). The whole game runs offline in the browser — no backend, no API keys.

---

## ✨ Features

- 🏰 **Procedural dungeon generation** — Binary Space Partitioning carves 12–18 connected rooms per floor onto an 80×60 grid.
- 🗺️ **Canvas mini-map with fog of war** — rooms reveal as you explore, with a pulsing "you are here" marker.
- 📜 **Procedural narrative engine** — hundreds of templates + contextual variables produce unique room descriptions every time. No two runs read alike.
- ⌨️ **Natural-language commands** — type `look`, `search`, `rest`, `inventory`… or use quick-action buttons. Output is printed with a typewriter effect.
- 🎲 **D&D 5e-inspired combat** — initiative, advantage/disadvantage, criticals & fumbles, per-enemy AI (aggressive, berserker, tactical, coward, support), status effects and an animated dice roller.
- 🧙 **Full character creation** — race, class, point-buy stats, background, derived HP/AC and starting gear.
- 📈 **Leveling & progression** — XP thresholds, hit-die HP gains, class features and a celebratory level-up screen.
- 🎒 **Inventory & equipment** — equip weapons/armor/shields into slots, recompute AC, manage encumbrance.
- 🔊 **Procedural sound** — every effect is synthesised at runtime with the Web Audio API. Zero audio files.
- 💾 **3 save slots + autosave** — full game state persists to `localStorage`; autosaves every few turns.
- 📱 **Responsive** — three-column desktop layout collapses to a tabbed mobile interface.

---

## 🏗️ Architecture

The project deliberately separates the **game engine** from **React**:

```
src/engine/    ← pure TypeScript: no React, no DOM, no store. Deterministic & testable.
src/components ← presentation only. Reads the store, calls engine functions, renders UI.
src/store/     ← a single Zustand + Immer store holding the whole GameState.
```

Keeping `src/engine/` framework-free means the dungeon generator, combat math and narrative system can be reasoned about (and unit-tested) in isolation — UI bugs can never corrupt game logic, and the logic has no idea a UI exists.

**The narrative engine** is the heart of the "DM-without-AI" illusion. Each description is a template like
`"You enter a {size} corridor. {lighting}. {floor_detail}."` whose placeholders are filled from weighted
dictionaries chosen by context (room type, enemies present, the hero's wounds). A few hundred templates and
variables combine into thousands of variations, so descriptions feel hand-written without a single API call.

**The BSP dungeon generator** starts with the full map rectangle and recursively splits it into smaller
sub-spaces (40–60% cuts for variety). Each leaf becomes a room; sibling sub-trees are joined with
L-shaped corridors, guaranteeing a fully connected floor. A separate *populator* then assigns each room a
type and fills it with enemies, loot, traps and lore from weighted tables.

---

## 🚀 Getting Started

```bash
git clone <your-repo-url>
cd dnd
npm install
npm run dev
```

Then open the printed local URL (default `http://localhost:5173`).

```bash
npm run build    # type-check + production bundle
npm run preview  # serve the production build
```

---

## 🎲 How to Play

1. **Create your hero** — pick a race and class, spend 27 point-buy points, choose a background.
2. **Explore** — read each room's description, then pick an exit to move deeper into the dungeon.
3. **Act** — type commands (`search`, `rest`, `look`…) or tap the quick-action buttons.
4. **Fight** — entering a room with enemies starts combat. Attack, dodge, flee, or quaff a potion; the dice decide your fate.
5. **Grow** — defeat foes for XP and loot, level up to unlock class features, and equip what you find.

> 💡 Tip: press **Space** (or click) to skip the typewriter animation.

---

## 🛠️ Tech Stack

| Technology | Why it's used |
|---|---|
| **React 19 + TypeScript** | Component UI with strict, fully-typed game models |
| **Vite 8** | Instant dev server and fast production builds |
| **Tailwind CSS v4** | Utility-first styling with a custom dark fantasy theme (CSS-first `@theme`) |
| **Zustand + Immer** | Minimal global store with ergonomic immutable updates |
| **Framer Motion** | Screen and combat transitions, modals, level-up burst |
| **Canvas API** | The dungeon mini-map with fog of war |
| **Web Audio API** | Fully procedural sound effects — no asset files |
| **lucide-react** | Crisp UI icons |

---

## 📁 Project Structure

```
src/
├── engine/                 # Framework-free game logic (pure, testable)
│   ├── random.ts           #   Seeded RNG (mulberry32) + weighted helpers
│   ├── character/          #   Creation, progression, equipment, data tables
│   ├── dungeon/            #   BSP generator, populator, bestiary, loot tables
│   ├── narrative/          #   Template dictionaries + text-assembly engine
│   ├── combat/             #   Dice math + the turn-based combat system
│   └── audio/              #   Procedural Web Audio sound engine
├── components/
│   ├── screens/            #   Title, creation wizard, game, game over, level up
│   ├── character/          #   Character sheet, inventory, equipment
│   ├── game/               #   Map, combat panel, narrative log, player input
│   └── ui/                 #   Typewriter text, toasts
├── hooks/                  # useAutosave, useSound
├── store/                  # The Zustand game store
├── utils/                  # localStorage save/load
└── types/                  # All shared domain types
```

---

<p align="center"><em>Built as a portfolio project — clean architecture, strict TypeScript, zero external game services.</em></p>
