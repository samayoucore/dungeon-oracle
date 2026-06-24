<div align="center">

# ⚔️ Dungeon Oracle

### Браузерная RPG, в которой ИИ-Мастер не просто описывает мир — он управляет им

</div>

---

## Русская версия

### О проекте

**Dungeon Oracle** — концептуальная браузерная RPG, вдохновлённая настольными ролевыми играми и классической механикой Dungeons & Dragons.

В игре нет заранее подготовленного сюжета, фиксированной карты или набора прописанных диалогов. Мир формируется непосредственно во время прохождения: ИИ-Мастер создаёт локации, персонажей, события, задания и последствия, основываясь на действиях игрока и текущем состоянии игры.

Игрок самостоятельно описывает свои действия в свободной форме, а система интерпретирует их и изменяет игровой мир. Можно исследовать помещения, разговаривать с персонажами, торговать, принимать решения, выполнять задания, находить предметы и вступать в сражения.

### Что делает проект

Dungeon Oracle объединяет генеративный ИИ и традиционные игровые механики.

ИИ отвечает за:

- создание новых локаций и их описаний;
- генерацию NPC, их характеров, ролей и отношения к игроку;
- формирование заданий и сюжетных событий;
- изменение мира в зависимости от решений игрока;
- создание предметов, наград, торговцев и противников;
- продолжение истории с учётом предыдущих событий.

При этом основные игровые расчёты выполняются программным кодом. Броски кубиков, порядок ходов, попадания, критические удары, урон, здоровье и другие боевые механики не определяются ИИ и не могут быть изменены с помощью текста игрока.

Ответ ИИ обрабатывается не как обычное сообщение в чате, а как набор структурированных игровых команд. Они могут изменить здоровье персонажа, добавить предмет в инвентарь, открыть новую локацию, начать задание, создать NPC или запустить бой.

Благодаря этому ИИ не просто рассказывает историю, а становится полноценной частью игровой системы.

### Цель проекта

Dungeon Oracle создаётся как portfolio pet-project, демонстрирующий:

- интеграцию генеративного ИИ в полноценную игровую механику;
- работу со структурированными ответами языковой модели;
- разделение ответственности между ИИ и детерминированным кодом;
- создание процедурно формируемого игрового мира;
- разработку системы сохранения состояния, истории и контекста;
- построение современной браузерной RPG на React и TypeScript;
- проектирование сложного интерактивного интерфейса;
- создание игрового опыта, в котором каждое прохождение развивается по-разному.

Главная идея проекта — показать, что языковая модель может использоваться не только как генератор текста, но и как динамический управляющий слой внутри полноценного игрового приложения.

---

## English Version

### About the Project

**Dungeon Oracle** is a conceptual browser-based RPG inspired by tabletop role-playing games and classic Dungeons & Dragons mechanics.

The game has no pre-written storyline, fixed map, or predefined dialogue tree. The world is created during the playthrough: the AI Dungeon Master generates locations, characters, events, quests, and consequences based on the player’s actions and the current game state.

Players describe their actions freely, while the system interprets those actions and updates the world accordingly. They can explore locations, interact with characters, trade, make decisions, complete quests, discover items, and enter combat.

### What the Project Does

Dungeon Oracle combines generative AI with traditional game mechanics.

The AI is responsible for:

- creating new locations and descriptions;
- generating NPCs, including their personalities, roles, and attitudes;
- producing quests and story events;
- changing the world in response to player decisions;
- creating items, rewards, merchants, and enemies;
- continuing the story while taking previous events into account.

Core gameplay calculations are handled by deterministic code. Dice rolls, turn order, hit checks, critical strikes, damage, health, and other combat mechanics are not controlled by the AI and cannot be changed through persuasive player input.

The AI response is processed not as a regular chat message, but as a set of structured game commands. These commands can modify the player’s health, add an item to the inventory, create a new location, start a quest, introduce an NPC, or trigger combat.

This approach allows the AI to become an actual part of the game system rather than simply acting as a narrative text generator.

### Project Goal

Dungeon Oracle is being developed as a portfolio pet project that demonstrates:

- the integration of generative AI into complete gameplay systems;
- working with structured language-model responses;
- separating AI-controlled logic from deterministic game code;
- creating a procedurally generated game world;
- managing persistent state, story history, and AI context;
- building a modern browser RPG with React and TypeScript;
- designing a complex interactive user interface;
- creating a game experience in which every playthrough develops differently.

The main goal of the project is to demonstrate that a language model can be used not only to generate text, but also as a dynamic control layer inside a complete interactive game.
