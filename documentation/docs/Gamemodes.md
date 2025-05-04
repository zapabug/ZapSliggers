# Zapsliggers Game Modes

This document outlines the different game modes available or planned in Zapsliggers, an installable PWA designed for minimal setup. Each mode utilizes a specific configuration profile defined in `src/config/gameSettings.ts` to tailor the gameplay experience. **Note: There is currently no in-game UI for changing settings; all configuration is managed directly within the codebase.**

## 1. Main (Multiplayer)

*   **Screen:** `src/components/screens/GameScreen.tsx`
*   **Settings Profile:** `gameSettings` from `src/config/gameSettings.ts`
*   **Description:** The standard PvP mode. Players engage via Nostr for challenges and gameplay events (`kind:30079`). The goal is a **"semi-live" feel achieved solely through Nostr communication within the PWA**, where actions are sent and received, triggering local simulations and animations.

## 2. Practice

*   **Screen:** `src/components/screens/PracticeScreen.tsx`
*   **Settings Profile:** `practiceSettings` from `src/config/gameSettings.ts`
*   **Description:** A single-player mode for learning controls and physics against a static opponent position, using settings potentially different from multiplayer (e.g., no Sliggers). Turns alternate locally.
*   **Status:** Refactored to use `useGameLogic`. Needs testing.

## 3. Custom / Developer Sandbox

*   **Screen:** `src/components/screens/DeveloperSandboxScreen.tsx`
*   **Settings Profile:** `sandboxSettings` from `src/config/gameSettings.ts`
*   **Description:** A single-player mode for development, testing, and debugging. It allows loading the game with the `sandboxSettings` profile. **Settings for this mode must be changed directly in the `src/config/gameSettings.ts` file; there is no UI for modification.** Access to this mode may be restricted (e.g., to specific developer/tester `npubs`) and it can serve as a base for testing custom rulesets for potential tournaments or challenges.
