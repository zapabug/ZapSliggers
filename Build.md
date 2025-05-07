# Vibe Coding Build Log

## LLD 1: YYYY-MM-DD HH:MM

**Project:** Zapslingers

**Goal:** A 2-player, turn-based steampunk space artillery game rendered on an HTML Canvas, featuring physics-based projectiles influenced by planets and unique SLINGER planets. Built mobile-first with Nostr integration for challenges and core gameplay actions, focusing on a physics-grounded steampunk aesthetic.

**Theme:** Steampunk Contraptions vs. Space Physics.

**Core Gameplay Loop (Based on Gameplay.md & refinements):**
1.  **Setup:** Players connect via Nostr (`useAuth`, `ChallengeHandler`). `LobbyScreen` transitions to `GameScreen`.
2.  **Round Start:** `useGameInitialization` randomly places steampunk ships and celestial bodies (standard planets, SLINGER planets) based on distance rules. `useGameLogic` manages round state (Best of 3), turn order (alternating start), scores, and HP (100 start).
3.  **Aiming Phase (Simultaneous Local Input in `GameScreen`):** Players use controls (Keyboard Left/Right angle, Up/Down power; UI Joystick/Slider) via `AimingInterface` to set trajectory and power. Select abilities (`ZapSplits`, `Magnetar`, `Gyro` via `ActionButtons`, cost 25 HP, max 3 total/1 per type per match).
4.  **Firing:** Players fire (Spacebar/Button). `useGameLogic` handles local fire action, sends Nostr `kind:30079` event (basic sync), and calls `useMatterPhysics` to add projectile.
5.  **Resolution Phase:**
    *   `useMatterPhysics` simulates projectile path, applying forces:
        *   **Standard Planets:** Attractive gravity.
        *   **SLINGER planets (Implemented as 2 overlapping bodies):** Larger body applies standard attraction. Smaller (1/3 size, orange) inner body applies strong, limited-range repulsion.
        *   **Boundaries:** Destructive on impact (Default). Configurable toggle (`gameSettings.ts`) for bouncing boundaries (for sandbox/future modes).
    *   Collision Detection (`useMatterPhysics` events handled by `useGameLogic`):
        *   Hit Opponent (Standard Shot): Round win.
        *   Hit Opponent (Ability Shot): Round win *only if* opponent is Vulnerable (used >=2 abilities).
        *   Hit Self: Round loss.
        *   Hit Planet/Gas Giant: Projectile removed (unless Gas Giant has specific pass-through logic added later).
        *   Hit Boundary: Projectile removed (if destructive).
        *   Timeout (45s): Projectile removed.
    *   `useShotTracers` records/displays projectile paths (last 10).
6.  **End of Round:** `useGameLogic` updates scores. A UI element (e.g., temporary overlay or part of `PlayerHUD`) displays the round score (e.g., "1 - 0"). Check for match win (first to 2 rounds).
7.  **Next Round / End Match:** Proceed to next round or end match screen (payouts handled via NUT-18 TBD).
8.  **Sudden Death (Target - Round 5):** Boundaries become bouncy (if not already toggled), ships exert gravity, first hit loses.

**Key Features:**
*   2-Player PvP via Nostr challenges (`kind:4`) and action sync (`kind:30079`).
*   Physics-based artillery combat on HTML Canvas (`matter-js`).
*   Unique Gas Giant mechanics (attractive outer body + short-range repulsive inner core).
*   Standard planets with attractive gravity.
*   HP system as resource for 3 distinct abilities: `ZapSplits`, `Magnetar`, `Gyro`.
*   Best of 3 rounds format.
*   Random level generation (`useGameInitialization`).
*   Dynamic camera (`useDynamicViewport`).
*   Destructive boundaries (default) with bounce toggle setting.
*   End-of-round score display.
*   Mobile-first controls (Joystick/Slider) + Keyboard support.
*   Practice Mode (`PracticeScreen`) using `useGameLogic`.
*   Developer Sandbox (`DeveloperSandboxScreen`) using `useGameLogic`.

**Tech Stack:**
*   **Framework:** Vite + React (v18.3.1+)
*   **Language:** TypeScript (v5.6.2+)
*   **Styling:** Tailwind CSS (v3.4.13+)
*   **Physics:** `matter-js` (likely via `useMatterPhysics` hook)
*   **Nostr:** `nostr-tools` (v2.7.2+) or NDK, `useAuth`, `ChallengeHandler`, `useNDKInit`, NIP-07/NIP-46 (`applesauce-nip46` lib)
*   **State Management:** React Hooks (`useGameLogic`, `useAuth`, etc.)
*   **Rendering:** HTML Canvas (`GameRenderer`)

**File Structure (Key Files - based on `layout.md` with adjustments):**
*   `src/`: Root
    *   `App.tsx`: Main router, context providers (`useAuth`).
    *   `main.tsx`: Entry point, NDK init.
    *   `config/gameSettings.ts`: Game profiles (`main`, `practice`, `custom`), boundary bounce toggle.
    *   `components/`: UI Components
        *   `screens/GameScreen.tsx`: Main PvP container.
        *   `screens/PracticeScreen.tsx`: Practice mode container.
        *   `screens/DeveloperSandboxScreen.tsx`: Dev testing container.
        *   `screens/LobbyScreen.tsx`: Lobby view.
        *   `game/GameRenderer.tsx`: Canvas rendering logic.
        *   `ui_overlays/`: ActionButtons, AimingInterface, PlayerHUD, **EndOfRoundScoreDisplay.tsx** (New).
        *   `ChallengeHandler.tsx`: Nostr challenge logic.
    *   `hooks/`: Custom Hooks
        *   `useGameLogic.ts`: Core state machine, integrates other hooks.
        *   `useMatterPhysics.ts`: Physics engine, collision logic, **Gas Giant dual-force logic, boundary destruction/bounce logic.**
        *   `useGameInitialization.ts`: Level generation, **spawning Gas Giant pairs.**
        *   `useShotTracers.ts`: Projectile path history.
        *   `useDynamicViewport.ts`: Camera control.
        *   `useAuth.ts`: Authentication and NDK management.
        *   `useNDKInit.ts`: NDK singleton helper.
        *   `useGameAssets.ts`: Asset loading.
    *   `types/game.ts`: Game-specific types.
    *   `lib/applesauce-nip46/`: NIP-46 implementation.
    *   `index.css`: Tailwind setup.

**Setup Commands:**
*   `npm create vite@latest Zapslingers --template react-ts`
*   `cd Zapslingers`
*   `npm install` (Installs React, TS, etc.)
*   `npm install tailwindcss@^3.4.13 postcss autoprefixer`
*   `npx tailwindcss init -p` (Configure `tailwind.config.js`, `index.css`)
*   `npm install nostr-tools@^2.7.2` (or preferred Nostr library like `@nostr-dev-kit/ndk`)
*   `npm install matter-js @types/matter-js`

**Normie-Friendly UX:**
*   **End-of-Round Score Display:** Show score clearly (e.g., "1 - 0") after each round.
*   (No intro pop-up, No tooltips as per decision).
*   Intuitive mobile controls (Joystick/Slider).

**Build Decisions & Implementation Notes:**
*   SLINGER planets implemented as two overlapping bodies (attractive outer, limited-range repulsive inner) in `useMatterPhysics` and `useGameInitialization`.
*   Boundaries are destructive by default; add toggle in `gameSettings.ts` and logic in `useMatterPhysics`.
*   Abilities named: `ZapSplits`, `Magnetar`, `Gyro`.
*   Core game state managed centrally by `useGameLogic`.
*   Basic Nostr sync (`kind:30079` for fire) via `useGameLogic` - needs refinement for robust multiplayer.
*   Visuals: Focus on Steampunk ship sprites and appropriate planet/gas giant/projectile visuals later (`useGameAssets`, `GameRenderer`).
*   Future: Refine Nostr sync, implement Sudden Death, add NUT-18 wagering, add moons/other hazards (potentially via Sandbox first).

**Next Steps (Post-LLD):**
1.  Review and refine the implementation plan based on this LLD.
2.  Implement/Update `useMatterPhysics` with Gas Giant dual-force logic (using two bodies) and boundary toggle logic.
3.  Implement/Update `useGameInitialization` to spawn Gas Giant pairs correctly.
4.  Implement the `EndOfRoundScoreDisplay.tsx` component and integrate it with `useGameLogic` state.
5.  Update ability names in `ActionButtons` and related logic.
6.  Begin testing core mechanics in `PracticeScreen` and `DeveloperSandboxScreen`.
7.  Refine Nostr synchronization (`useGameLogic`) for multiplayer stability. 