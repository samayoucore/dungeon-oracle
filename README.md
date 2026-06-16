<div align="center">

# ⚔️ Dungeon Oracle

### A browser RPG where the AI Dungeon Master doesn't just describe the world — it runs it

[![React](https://img.shields.io/badge/React-18-61DAFB?style=flat-square&logo=react&logoColor=white)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.4-3178C6?style=flat-square&logo=typescript&logoColor=white)](https://typescriptlang.org)
[![Vite](https://img.shields.io/badge/Vite-5.2-646CFF?style=flat-square&logo=vite&logoColor=white)](https://vitejs.dev)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-3.4-06B6D4?style=flat-square&logo=tailwindcss&logoColor=white)](https://tailwindcss.com)
[![Zustand](https://img.shields.io/badge/Zustand-4.5-FF6B35?style=flat-square)](https://zustand-demo.pmnd.rs)
[![Groq](https://img.shields.io/badge/Groq-Llama_3.3_70B-F55036?style=flat-square)](https://groq.com)

<br/>

*There is no pre-built dungeon. There is no script.<br/>The AI Dungeon Master invents every room, every face, and every consequence as you go — while the dice stay honest.*

</div>

---

## ✨ What this actually does

Most "AI RPG" demos are a chat window with a fantasy system prompt. Dungeon Oracle goes further: the AI's response is a structured object, and the frontend treats every field as a real game mechanic — not flavor text layered on top of a static game.

- **The AI controls the world, not just the words.** Every player action can move you to a new location, introduce a named NPC, start a quest, change your gold, scar you with a permanent stat change, or poison you for the next several turns — and all of it is reflected immediately in your character sheet, inventory, and map.
- **No pre-generated dungeon.** There's no fixed layout waiting to be unlocked. The AI invents each location's name and description as the story reaches it, and remembers it well enough to send you back to the *same* tavern, not a copy of it.
- **Dice still decide fights.** The Dungeon Master narrates the encounter and decides when it starts — but initiative, attack rolls, critical hits, and damage are resolved by deterministic code. No amount of clever phrasing lets the AI simply declare a fight won.
- **Boss fights can't be talked away.** Key enemies are flagged as must-fight. If you try to narrate your way past one without actually fighting, the story twists on you — the clever plan fails at the last second, and real combat begins anyway.
- **The world remembers, within limits.** NPC relationships, world facts, shop inventories, and quest progress persist across the session via explicit IDs the AI is given — not vibes. A rolling story summary keeps long sessions coherent without the prompt growing forever.
- **Generated content is sanity-checked.** Enemies and items the AI invents are clamped to sane ranges for the current depth, so a "CR 30 ancient dragon" can't show up two rooms into the game.
- **Works with or without an API key.** No key configured → a template-based narrative engine still handles room descriptions and basic commands. Add a free Groq key → the full reactive Dungeon Master takes over.

---

## 🎮 How to Play

1. **Create your hero** — pick a race, class, name, and distribute ability points via point-buy.
2. **Say what you do, in your own words** — *"Осматриваю руны на стене"*, *"Иду на свет в конце коридора"*, *"Предлагаю торговцу свой кинжал в обмен на зелье"*. The Dungeon Master reacts to the literal thing you typed, not a multiple-choice menu.
3. **Watch the world respond** — new locations appear on the map, NPCs remember you, quests pick up objectives, your inventory and gold update live.
4. **Fight when it's time** — combat hands off to a proper turn-based D&D-style system: roll initiative, attack, dodge, use items, watch the dice.
5. **Survive, descend, return** — go back to a safe location to rest and trade, then head deeper for tougher fights and better loot.

> **Tip:** add a free Groq API key in Settings to unlock the living Dungeon Master. Get one at [console.groq.com](https://console.groq.com) — no credit card required.

---

## 🚀 Getting Started

```bash
git clone https://github.com/your-username/dungeon-oracle.git
cd dungeon-oracle
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) and begin.

The game is fully playable without an API key — a keyword-based fallback handles basic actions (`look`, `search`, `rest`, `inventory`). Add a Groq key in Settings for the complete AI-driven experience.

---

## 🏗️ How It's Built

The project draws a hard line between two kinds of truth, and that line is the whole design:

| Decided by deterministic code | Decided by the AI Dungeon Master |
|---|---|
| Dice rolls, attack and damage math | Where you are, and what a place looks like |
| Turn order and initiative | NPCs — their names, roles, attitudes |
| Whether an attack hits or misses | Quests and their objectives |
| HP loss during combat | Loot, gold, and XP outside combat |
| Character creation math (HP/AC/modifiers) | Status effects from non-combat causes |
| Leveling thresholds and stat growth | Shop inventories and prices |
| Sanity limits on AI-generated content | The tone and voice of every response |

Combat outcomes are never narrated into existence — they're computed. Everything else is the AI's to shape.

### The response is a contract, not a chat message

Every player action sends the full game state to Groq and gets back structured JSON, not prose. A trimmed example of what the model actually returns:

```json
{
  "narrative": "Торговец прищуривается и кивает на ряд бутылочек на прилавке.",
  "npcIntroduced": {
    "id": "boris_merchant",
    "name": "Борис",
    "role": "торговец",
    "shopInventory": [{ "name": "Зелье лечения", "value": 25 }]
  },
  "requiresRoll": { "stat": "cha", "dc": 12, "description": "Сбить цену" }
}
```

The frontend walks every field in a fixed order — world state first, then HP and status effects, then inventory and gold, then NPCs and quests, then combat, then navigation — and applies each one as an actual store update. If a skill check is pending, the dice roll happens client-side and gets sent back to the AI as a follow-up message so it can narrate the consequence correctly.

### A graph, not a grid

Locations aren't tiles on a pre-built map — they're nodes the AI creates on demand, connected by labeled paths ("through a hidden crack in the wall," "down a spiral staircase"). When the AI tries to send you to "the merchant's stall" a second time, a name-similarity check resolves it to the *same* location and NPC instead of quietly duplicating them. A handful of guardrails keep this honest: enemy and item stats generated by the AI are clamped against the current depth, must-fight enemies can't be cleared without combat actually resolving, and a periodically-regenerated story summary keeps the model's context from growing without bound over a long session.

### Two narrators, one voice

Room *arrival* text can come from a fast, local template engine — hundreds of patterns and contextual variables that need no network call. Room *reaction* — anything the player actually does — goes to the AI. The seam between them is invisible in play, but it means the game never feels frozen waiting on a network request just to describe a doorway.

---

## 🛠️ Tech Stack

| Technology | Purpose |
|---|---|
| React 18 + TypeScript | UI layer, strict typing throughout |
| Vite | Dev server and bundler |
| Tailwind CSS | Dark fantasy utility-first styling |
| Zustand + Immer | Single source of truth for all game state |
| Framer Motion | Dice rolls, transitions, combat feedback |
| Canvas API | Legacy dungeon-grid renderer (superseded by the location atlas) |
| Groq API (Llama 3.3 70B) | The Dungeon Master itself |
| Web Audio API | Every sound effect, generated — zero audio files |
| localStorage | 3-slot saves, including AI conversation memory |

---

## 📁 Project Structure

```
src/
├── engine/                 # Pure TypeScript — no React, no store imports
│   ├── combat/             # Dice, turn resolution, status effects, enemy AI
│   ├── character/          # Creation math, leveling, class data
│   ├── narrative/           # Template engine for fast, AI-free room intros
│   ├── world/                # Content validation/clamping, NPC & location dedup, world bootstrap
│   ├── ai/                  # Groq client, system prompt builder, message history
│   └── audio/               # Procedural sound generation
│
├── store/                  # Zustand store — every mutation the AI or player can trigger
├── components/
│   ├── screens/             # Title, Character Creation, Game, Game Over, Level Up
│   ├── game/                 # Narrative log, combat panel, location atlas, player input
│   ├── character/            # Character sheet, inventory & equipment
│   └── ui/                   # Typewriter text, toasts, dice roller
├── types/                   # Every interface in one place
└── utils/ · hooks/            # Save/load, autosave, sound toggle
```

---

## 🤔 Design Decisions Worth Knowing

A few things look like limitations at first glance but are deliberate:

Free-text input during an active fight goes to the combat system, not the AI — you choose Attack, Dodge, Flee, or an item from a fixed set of buttons. Letting the AI adjudicate combat flavor mid-fight would blur the one line the whole architecture depends on, so it's saved for outside combat instead.

The AI can occasionally misname or slightly reword something it created earlier (a merchant becomes "the merchant" becomes "Boris the merchant"). The dedup logic catches close matches, but it's a similarity heuristic, not a guarantee — a few odd duplicate locations after very long sessions are a known, accepted edge case rather than a bug being chased.

---
