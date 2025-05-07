# Zapslingers Game Modes

This document outlines the different game modes available or planned in Zapslingers. Each mode utilizes a specific configuration profile defined in `src/config/gameSettings.ts` to tailor the gameplay experience.

## 1. Main (Multiplayer)

*   **Screen:** `src/components/screens/GameScreen.tsx` (Refactored to use `useGameLogic`)
*   **Settings Profile:** `mainSettings` from `src/config/gameSettings.ts`
*   **Description:** The standard player-vs-player (PvP) mode. Players engage in matches consisting of multiple rounds. This mode relies on Nostr for communication (currently basic fire action sync) and state management via the `useGameLogic` hook. It uses the standard ruleset defined in `mainSettings`, including HP, ability costs, physics parameters, etc.

## 2. Practice

*   **Screen:** `src/components/screens/PracticeScreen.tsx`
*   **Settings Profile:** `practiceSettings` from `src/config/gameSettings.ts`
*   **Description:** A single-player mode designed for players to familiarize themselves with the controls, physics, and abilities without the pressure of a live opponent. It uses the `useGameLogic` hook in `'practice'` mode. Settings (`practiceSettings`) might offer more lenient rules, such as increased ability uses or simplified level layouts, although the core mechanics remain the same. Turns alternate between the player and a static opponent position.
*   **Status:** Refactored to use `useGameLogic`. **Needs testing** to confirm if previous rendering issues are resolved.

## 3. Custom / Developer Sandbox

*   **Screen:** `src/components/screens/DeveloperSandboxScreen.tsx`
*   **Settings Profile:** Based on `defaultCustomSettings` from `src/config/gameSettings.ts`, likely modifiable via UI controls within the screen.
*   **Description:** A single-player mode primarily intended for development, testing, and debugging. It functions similarly to Practice mode (likely using `useGameLogic` in `'custom'` mode) but allows developers to load the game with custom parameters defined in `defaultCustomSettings` or modified versions thereof. This provides a flexible environment to test:
    *   Changes to physics parameters (gravity, friction, etc.).
    *   Ability balancing (costs, effects).
    *   Level generation variations (number of planets, sizes).
    *   Specific edge cases or gameplay scenarios.
    It does **not** involve multiplayer synchronization via Nostr.
