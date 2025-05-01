**Klunkstr Development Roadmap (React/TS/NDK/matter-js - 2D Canvas)**

**Phase 1: Core Klunkstr Mechanics (Local Play - Mostly Complete)**

*   **Goal:** Implement the core local gameplay loop for Klunkstr, including physics, controls, and basic game rules.
*   **Key Steps:**
    1.  **Setup & Rendering:** Integrate `matter-js`, HTML Canvas (`GameRenderer`), UI overlays. - *Done*.
    2.  **Assets:** Load game assets (`useGameAssets`). Placeholder visuals currently used. - *Setup Done*.
    3.  **Physics Engine (`useMatterPhysics`):** Initialize engine, implement custom tuned gravity, handle basic collisions, implement projectile timeout. - *Done*.
    4.  **Level Setup (`useGameInitialization`):** Random ship/planet placement, wide viewport. - *Done*.
    5.  **Controls & Firing:** Implement aiming/power controls and projectile firing. - *Done*.
    6.  **Aiming Aids (`useShotTracers`):** Render historical traces and active trails. - *Done*.
    7.  **Klunkstr Rules (Partial):** Implement HP as resource, ability selection UI/logic, basic win condition callback. - *Done*.
    8.  **Authentication (`useAuth`):** Implement NIP-07/NIP-46/nsec login. - *Done*.
    9.  **Lobby:** Implement `LobbyScreen` with interactive `LobbyPlayground`. - *Done*.
   10. **Challenges (`ChallengeHandler`):** Implement basic DM challenge handling. - *Done*.
   11. **Viewport/Camera (`useDynamicViewport`):** Implement adaptive zoom/pan. - *Done*.
   12. **PWA Setup:** Configure `vite-plugin-pwa`. - *Configured*
   13. **Practice Mode:** Implement full practice mode logic (Best of 3 rounds, scoring, HP tie-breaker, alternating start, opponent display). - *Done*

**Phase 2: Nostr Integration & Gameplay Completion (Current Focus)**

*   **Goal:** Integrate Nostr for multiplayer, complete Klunkstr ruleset, implement payments, and test thoroughly.
*   **Key Steps:**
    1.  **Visuals:** Render actual sprites/assets in `GameRenderer`. - *(Next Immediate Step)*
    2.  **Nostr Login Testing:** Debug and verify login flows (`useAuth`) on mobile devices.
    3.  **Matchmaking:** Implement full DM (`kind:4`) challenge flow (Accept/Reject) in `ChallengeHandler`/`LobbyScreen`.
    4.  **Wagering (NUT-18):** Define and implement backend service API, integrate frontend flow for payment requests/verification.
    5.  **Turn Synchronization:** Implement sending/receiving moves (`kind:30079`), synchronize game state for simultaneous resolution.
    6.  **Klunkstr Rules Completion:** Implement ability physics effects, full win conditions (HP/Vulnerability), Vulnerability state, ability limits, turn timer/limits, Sudden Death.
    7.  **Lobby Refinement:** Potentially refine challenge UI.

**Phase 3: Polish & Refinement**

*   **Goal:** Improve the user experience, add visual/audio flair, and finalize testing.
*   **Key Steps:**
    1.  **Visual Polish:** Add 2D sprite animations, particle effects, UI transitions.
    2.  **Sound Effects:** Integrate sound effects.
    3.  **Advanced Levels:** Add Gas Giants, moving planets.
    4.  **Error Handling:** Improve Nostr/payment/game error handling robustness.
    5.  **Tutorials/Onboarding:** Implement help popups or guides.
    6.  **Testing:** Thoroughly test game balance, Nostr interactions, payments, and mobile responsiveness.

This roadmap reflects the current state where the local Klunkstr core is built, and the focus is now on completing the gameplay rules and integrating Nostr/payments.
