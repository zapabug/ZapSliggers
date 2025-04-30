Okay, here is a concise roadmap focused on replicating the original Slingshot gameplay within the modern web stack, then adding the Klunkstr twists.

**Klunkstr Development Roadmap (React/TS/NDK/matter-js - 2D Canvas)**

**Phase 1A: Original Slingshot Replica (Local Simulation - 2D Canvas - CURRENT FOCUS)**

*   **Goal:** Create a functional local version replicating the core physics and feel of the original Python Slingshot game using the web stack and original assets.
*   **Key Steps:**
    1.  **Setup:** Integrate `matter-js`, HTML Canvas (`GameRenderer.tsx`), UI overlays (`AimingInterface.tsx`, `ActionButtons.tsx`, `PlayerHUD.tsx` positioned in `GameScreen.tsx`). - *Partially Done (Basic setup)*
    2.  **Assets:** Copy original assets to `/public/images`. - *Done*.
    3.  **Physics Engine:** Initialize `matter-js`, disable world gravity, add static planets. - *Done*.
    4.  **Firing:** Implement projectile creation and initial velocity application via UI controls. - *Done*.
    5.  **Custom Gravity:** Implement and tune planetary gravity: Force uses an 'effectiveRadius' (base radius + size-based bonus) to subtly increase larger planets' influence range (`GRAVITY_CONSTANT=0.5`, `GRAVITY_AOE_BONUS_FACTOR=0.1`). - *Done*
    6.  **Collisions:** Implement basic collision detection (destroy projectile on planet hit). Handle ship hits (projectile destroyed, damage logic TBD). - *Done*
    7.  **Projectile Timeout:** Implement removal of projectiles after 45 seconds. - *Done*
    8.  **Visuals:** Render original assets (`.png` files) for planets, ships, projectiles on the canvas.
    9.  **Last Shot Trace:** Implement rendering the path of the previous shots (Last 10, dashed lines). - *Done (via `useShotTracers`)*
   10.  **Active Trail:** Implement visual trail for active projectile (Solid line). - *Done (via `useShotTracers`, goal: particles)*
   11.  **Level Loading:** Basic random level generation (place planets).
     - Implement random generation of ship starting positions (within side zones, min separation enforced). - *Done*.
     - Implement random generation of planet positions (respecting min distance from ships and other planets). - *Done*.
     - Implement central planet spawning zone (currently 80% of virtual area). - *Done*.
     - Implement wider aspect ratio (1200x600) for the game's virtual coordinate system. - *Done*.
     - Implement adaptive camera view (aspect ratio fitting, dynamic zoom with 50% minimum view size). - *Done*.

**Phase 1B: Klunkstr Rules & Features**

*   **Goal:** Layer the specific Klunkstr gameplay mechanics onto the replica foundation.
*   **Key Steps:**
    1.  **HP System:** Implement HP as a resource for abilities. *(Partially Done: State managed in `GameScreen`, used as resource)*
    2.  **Abilities:** Implement Triple Shot, Explosive Arrow, Lead Tipped (cost, effects, usage limits).
        - Implement ability selection UI/logic. *(Done: `ActionButtons`/`GameScreen` handle selection, cost, limits)*
        - Implement ability effects in physics engine. *(Todo)*
    3.  **Vulnerability:** Implement the mechanic based on ability usage. *(Partially Done: State tracking in `GameScreen`)*
    4.  **Game Flow:** Implement turn structure (timer, state), round structure (Best of 3, 5 turns), Sudden Death, Klunkstr win conditions.
        - Implement basic round win detection for standard hits. *(Done: `onRoundWin` callback)*
        - Implement full round/match win conditions (incl. ability hits, turn limits, Sudden Death). *(Todo)*
        - Implement turn timer logic. *(Todo)*
    5.  **Advanced Levels:** Add Gas Giants, moving planets, level visualization. *(Todo)*
    6.  **PWA Setup:** Configure `vite-plugin-pwa` and add icons. *(Configured - Needs Icons)*

**Phase 2: Nostr Multiplayer & Wagering Integration**

*   **Goal:** Connect two players via Nostr for a turn-based match with mandatory NUT-18 wagering.
*   **Key Steps:**
    1.  **Nostr Setup:** Integrate NDK (`useNDKInit`), handle login/signing (`nostr-login`), display profiles (`PlayerHUD`). - *Partially Done (NDK/Login setup)*
    2.  **Matchmaking:** Implement DM (`kind:4`) challenge flow (`ChallengeHandler.tsx`) with Accept/Reject logic.
    3.  **Wagering (NUT-18 Backend):**
        *   Set up backend service.
        *   Implement frontend display/handling of `creq`.
        *   Implement backend verification.
        *   Gate game start on payment confirmation.
    4.  **Turn Synchronization:**
        *   Send player moves (`kind:30079`).
        *   Subscribe to opponent's moves.
    5.  **Simultaneous Resolution:** Trigger local simulation based on received moves.
    6.  **UI Integration:** Connect game state to UI (HP, ability usage, etc.).
    7.  **Lobby Refinement:** Flesh out `LobbyScreen.tsx` with challenge list UI and entry point for practice mode.

**Phase 3: Polish & Refinement**

*   **Goal:** Improve the user experience, add visual flair, and conduct thorough testing.
*   **Key Steps:**
    1.  **Visual Polish:** Add 2D sprite animations, particle effects, UI transitions. Refine asset rendering.
    2.  **Sound Effects:** Integrate sound effects.
    3.  **Error Handling:** Improve Nostr/payment/game error handling.
    4.  **Tutorials/Onboarding:** Implement help popups.
    5.  **Testing:** Thoroughly test balance, Nostr, payments, mobile responsiveness.

This revised roadmap reflects the initial focus on building the replica foundation before adding Klunkstr-specific features and multiplayer.
