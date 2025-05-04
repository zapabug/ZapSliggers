**Zapsliggers Development Roadmap (React/TS/NDK/matter-js - 2D Canvas)**

**Phase 1: Core Zapsliggers Mechanics (Local Play - Mostly Complete)**

*   **Goal:** Implement the core local gameplay loop for Zapsliggers, including physics, controls, and basic game rules.
*   **Key Steps:**
    1.  **Setup & Rendering:** Integrate `matter-js`, HTML Canvas (`GameRenderer`), UI overlays. - *Done*.
    2.  **Assets:** Load game assets (`useGameAssets`). Placeholder visuals currently used. - *Setup Done*.
    3.  **Physics Engine (`useMatterPhysics`):** Initialize engine, implement custom tuned gravity, handle basic collisions, implement projectile timeout. - *Done*.
    4.  **Level Setup (`useGameInitialization`):** Random ship/planet placement, wide viewport. - *Done*.
    5.  **Controls & Firing:** Implement aiming/power controls and projectile firing. - *Done*.
    6.  **Aiming Aids (`useShotTracers`):** Render historical traces and active trails. - *Done*.
    7.  **Zapsliggers Rules (Partial):** Implement HP as resource, ability selection UI/logic, basic win condition callback. - *Done*.
    8.  **Authentication (`useAuth`):** Implement NIP-07/NIP-46/nsec login. - *Done*.
    9.  **Lobby:** Implement `LobbyScreen`. - *Done*
   10. **Challenges (`ChallengeHandler`):** Implement basic DM challenge handling. - *Done*.
   11. **Viewport/Camera (`useDynamicViewport`):** Implement adaptive zoom/pan. - *Done*.
   12. **PWA Setup:** Configure `vite-plugin-pwa`. - *Configured*
   13. **Practice Mode:** Implement full practice mode logic (Best of 3 rounds, scoring, HP tie-breaker, alternating start, opponent display). - ***Broken (Needs Debugging Post-Refactor)***

**Phase 2: Sligger Implementation, Nostr Integration & Gameplay Completion (Current Focus)**

*   **Goal:** Implement Sligger mechanics, integrate Nostr for multiplayer, complete Zapsliggers ruleset, implement payments (Cashu), and test thoroughly.
*   **Sligger Implementation Status:** *Done*. Logic for edge-zone placement (using `SLIGGER_BORDER_PADDING`) and conditional attraction/repulsion (using factors) is implemented in `useGameInitialization.ts` and `useMatterPhysics.ts`.
*   **Nostr Sync Status:** **Basic fire action sync (`kind:30079`) implemented in `useGameLogic`**. Remaining lint errors need manual fixing. Requires testing.

*   **Key Steps (Immediate Focus - Testing & Lint Fixes):**
    1.  **Manual Lint Fixes (`src/hooks/useGameLogic.ts`):** Fix persistent errors related to callback ref signatures and `cost` variable scope.
    2.  **Basic Multiplayer Sync Testing (`testGameplay.md`):** Verify `kind:30079` fire events are sent and received correctly using console logs.
    3.  **Practice Mode Testing:** Verify `PracticeScreen` functionality after `useGameLogic` refactor.
    4.  **Manual Settings Tuning (`src/config/gameSettings.ts`):**
        *   Adjust `GRAVITY_CONSTANT`.
        *   Adjust `MIN_PLANET_PLANET_DISTANCE`.
        *   Adjust `INITIAL_VIEW_WIDTH_FACTOR`.
        *   Tune Sligger factors/padding if `NUM_SLIGGERS > 0`.
    5.  **Testing (Sandbox):** Test tuned settings and Sligger interactions if enabled.

*   **Key Steps (Following Basic Sync Test & Tuning):**
    6.  **Visuals:** Render actual sprites/assets in `GameRenderer` (including Sliggers).
    7.  **Nostr Login Testing:** Debug and verify login flows (`useAuth`) on mobile devices.
    8.  **Matchmaking:** Implement full DM (`kind:4`) challenge flow (Accept/Reject) in `ChallengeHandler`/`LobbyScreen`.
    9.  **Wagering (Cashu):** Define and implement Agent/Bot logic, integrate frontend flow.
   10. **Turn Synchronization (Full):**
        *   **Status:** Basic fire sync done. Needs refinement/completion.
        *   Implement robust turn state management (Aiming, Waiting, Resolving).
        *   Ensure strict turn enforcement prevents out-of-turn actions reliably.
        *   Synchronize simulation results: Decide method (e.g., send winner/state update event, deterministic simulation checks) to ensure consistent outcomes (hits, HP, score).
        *   Handle turn timers if desired.
   11. **Zapsliggers Rules Completion:** Implement ability physics effects, full win conditions (HP/Vulnerability), Vulnerability state, ability limits, Sudden Death.
   12. **Lobby Refinement:** Potentially refine challenge UI.

**Phase 3: Polish & Refinement**

*   **Goal:** Improve the user experience, add visual/audio flair, and finalize testing.
*   **Key Steps:**
    1.  **Visual Polish:** Add 2D sprite animations, particle effects, UI transitions.
    2.  **Sound Effects:** Integrate sound effects.
    3.  **Advanced Levels:** Add Gas Giants, moving planets.
    4.  **Error Handling:** Improve Nostr/payment/game error handling robustness.
    5.  **Tutorials/Onboarding:** Implement help popups or guides.
    6.  **Testing:** Thoroughly test game balance, Nostr interactions, payments, and mobile responsiveness.

This roadmap reflects the current state where the local Zapsliggers core is built, and the focus is now on completing the gameplay rules and integrating Nostr/payments.
