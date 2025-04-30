# Vibe Coding Build Log

## LLD 1: 2025-07-26 11:00 (Placeholder Time)

**Low-Level Design: Klunkstr**

**1. Goal:**
   - **Phase 1A (Current Focus):** Replicate the core mechanics of the original Python Slingshot game (gravity, collisions, aiming feel) using React/TS/Canvas/`matter-js` and original assets. **Random ship/planet placement with distance constraints and wider viewport (1200x600) implemented.**
   - **Phase 1B (Klunkstr):** Build upon the replica foundation to implement the full Klunkstr ruleset: a turn-based, 2-player online space artillery game inspired by Slingshot, **rendered in 2D on HTML Canvas**.
   - Players shoot projectiles affected by planet gravity to hit their opponent.
   - Uses Nostr for matchmaking discovery (`kind:1` mentioning game npub - *Deferred*) + confirmation (`kind:4`) and turn-based move communication (`kind:30079`).
   - **Mandatory Wagering:** Uses pre-paid eCash escrow facilitated by NUT-18 Payment Requests handled by a trusted game service.
   - **Game NPub** `npub10nxjs7e4vh7a05a0qz8u7x4kdtlq6nk5lugeczddk5l40x5kdysqt2e96x`

**2. Features:**
   **Phase 1A: Original Slingshot Replica (Current Implementation)**
   - **Rendering:** 2D rendering on HTML Canvas using `matter-js` bodies. Basic background image loaded. Placeholder shapes drawn for planets, ships, projectiles. **Viewport uses wider 1200x600 virtual coordinates.**
   - **Physics:** `matter-js` engine initialized, world gravity disabled. **Static planets and ships added based on random initial positions respecting distance constraints.**
     - Planetary Gravity: Implemented custom force calculation applying gravity from planets to projectiles. Force strength uses an effective radius (base + size bonus) making larger planets more influential (`GRAVITY_CONSTANT`, `GRAVITY_AOE_BONUS_FACTOR`). World gravity remains disabled.
   - **Firing:** Projectiles created via UI controls (`AimingInterface`, `ActionButtons`, keyboard) calling `GameRenderer.fireProjectile`. Initial velocity applied. **Starts from randomly generated ship position.**
   - **Assets:** Original `.png` assets copied to `/public/images`. - *Done*.

   **Phase 1B: Klunkstr Target Features (To be added)**
   - **Custom Physics:**
     - Planetary Gravity: Attraction based on planet size. Low power orbits possible.
     - Projectile Timeout: Remove projectiles after ~750ms.
     - Collision Handling: Destroy projectiles on planet impact. Handle ship hits (win condition based on Klunkstr rules).
     - Last Shot Trace: Render previous shot path.
   - **Klunkstr Gameplay:**
     - Turn-Based Gameplay: 60-second turns, simultaneous resolution.
     - Game Structure: Best of 3 rounds, 5 shots/round, Sudden Death.
     - Levels: Multiple maps, moving planets, gas giants.
     - HP System: Resource for abilities (100 HP start).
     - Abilities (Cost 25 HP): Triple Shot, Explosive Arrow, Lead Tipped (Max 3 total, 1 of each type per match).
     - Vulnerability Mechanic: Triggered after >= 2 ability uses.
     - Win Conditions: Instant win (Standard/Lead), or win if target Vulnerable (Triple/Explosive).
     - Level Visualization: Show moving planet paths.
   - **Multiplayer & Nostr:**
     - Nostr Integration: NDK setup, `nostr-login`, profile display.
     - Matchmaking: DM (`kind:4`) challenges (`ChallengeHandler.tsx`).
     - Turn Sync: Send/receive moves (`kind:30079`).
     - Client-Side Simulation: Run physics based on received moves.
   - **Wagering (Mandatory):**
     - NUT-18 backend service integration.
     - Frontend flow for request/payment.
   - **Visuals & UX:**
     - Render original assets for planets, ships, projectiles.
     - Sci-Fi mechanical contraption theme (2D sprites/vectors).
     - Dynamic Camera (panning/zooming on canvas).
     - Finalized UI Controls layout.
     - Tutorials, tooltips, PWA setup.

**3. Tech Stack:**
   - **Frontend Framework:** React (v18.3.1) with TypeScript (v5.6.2)
   - **Build Tool:** Vite
   - **PWA Plugin:** `vite-plugin-pwa` (For installability, fullscreen/landscape preferences)
   - **Styling:** Tailwind CSS (v3.4.13) (For UI overlays)
   - **Physics Engine:** `matter-js` (for 2D physics simulation, including gravity). Implementing AoE effects will require additional logic outside direct Matter.js physics (e.g., detecting collision type, applying damage in an area).
   - **2D Rendering:** HTML Canvas API within a React component (`GameRenderer.tsx`).
   - **Nostr Client Library:** `@nostr-dev-kit/ndk` (Core library).
     - **Initialization:** NDK is instantiated as a singleton in `main.tsx`. Connection is managed by a custom hook (`useNDKInit`) in `App.tsx`.
     - **Instance Access:** The initialized `ndk` instance is passed down through component props (`App` -> `GameScreen` -> `PlayerHUD` -> `UserProfileDisplay`) to components/hooks that need it (e.g., `ndk.fetchProfile`).
   - **Nostr Login Helper:** `nostr-login` (Provides UI modal and manages `window.nostr` for NIP-07/NIP-46 authentication).
   - **State Management:** Component state/prop drilling.
   - **Nostr Relays:** Default list of common relays (e.g., `wss://relay.damus.io`, `wss://nos.lol`, `wss://relay.primal.net`), user-configurable preferred.
   - **Backend Service:** Required for handling NUT-18 requests and eCash escrow.
     - Language/Framework: TBD (e.g., Node.js/TypeScript, Python, Go)
     - Needs: Nostr client capabilities (DM handling), Cashu client library (e.g., `cashu-ts`) for mint API interaction (token verification, melting/minting for payout).
   - **eCash Wallet Requirement:** Users need NUT-18 compatible Cashu wallets.

**4. File Structure (Finalized for Initial Gameplay):**
   ```
   /public
     /images # Sprites, backgrounds for 2D rendering
   /src
     /components
       /game
         - GameScreen.tsx       # Hosts HTML Canvas via GameRenderer, orchestrates game logic/state
         - GameRenderer.tsx     # Manages the HTML Canvas, drawing loop, rendering game objects (planets, launchers, projectiles)
         # - EffectsRenderer.tsx  # Future: Handles visual effects (explosions, AoE, trails) on the canvas
         # - GameViewManager.tsx  # Future: Manages panning/zooming logic for the 2D view
       /ui_overlays # UI elements positioned over the canvas
         - PlayerHUD.tsx        # 2D overlay for player info
         - AimingInterface.tsx  # 2D overlay for aiming controls (Joystick placeholder, Power slider)
         - ActionButtons.tsx    # 2D overlay for ability arc and Fire button
         - HpDisplay.tsx        # Integrated into PlayerHUD
         # - HealthBar.tsx        # Part of PlayerHUD
         - UserProfileDisplay.tsx # Used within PlayerHUD
         # - AbilityUsageTrackerUI.tsx # Future: Optional visual indicator
         # - LevelCompleteModal.tsx # Future
         # - GameOverModal.tsx      # Future
       /lobby # Added Lobby directory
         - LobbyScreen.tsx    # NEW: Screen shown after login, before game starts. Handles challenges, practice mode entry.
         # ... Potentially other lobby-related components
       /dms
         - ChallengeList.tsx    # Shows incoming/outgoing challenges (Potentially integrated into LobbyScreen or kept separate)
         - ChallengeModal.tsx   # For sending/viewing challenge DMs (Potentially integrated into LobbyScreen)
         - ChallengeHandler.tsx # Handles sending/receiving challenge DMs (Kind 4) - Used by LobbyScreen
       # /lfg # Deferred
         # ...
       /payment # Deferred
         # - PaymentRequestDisplay.tsx
         # - PaymentStatusIndicator.tsx
       # /abilities # Components integrated into ui_overlays
         # ...
       /ui # Common UI elements (if needed beyond overlays)
         # - Button.tsx
         # - Modal.tsx
         # - Tooltip.tsx
         - TutorialPopup.tsx
     /services
       - physicsService.ts    # Wrapper around Matter.js setup, simulation steps, event handling
       - levelService.ts      # Loads level data (planet positions, types, movement)
     /types
       - nostr.ts             # Nostr event kinds, tags, profile structure (Leverage NDK types)
       - game.ts              # Game state, player, level, move types
     /assets
       # SVGs, images for sci-fi theme
     - App.tsx                # Main application router/layout. Handles login state and renders LobbyScreen or GameScreen.
     - main.tsx               # Entry point (Renders App)
     - index.css              # Tailwind base styles/imports
     /hooks
       - useNDKInit.ts        # Custom hook to manage singleton NDK connection state
   tsconfig.json
   tailwind.config.js
   vite.config.ts
   package.json
   README.md
   Planning.md
   Build.md
   Gameplay.md
   roadmap.md
   ```

**5. Setup Commands:**
   ```bash
   # 1. Create Vite project
   pnpm create vite@latest klunkstr --template react-ts
   cd klunkstr

   # 2. Install dependencies
   pnpm install tailwindcss@3.4.13 postcss autoprefixer
   pnpm install @nostr-dev-kit/ndk matter-js @types/matter-js
   pnpm install nostr-login # Added nostr-login
   # Removed ndk-hooks as primarily using direct NDK calls
   # Add zustand later if needed for state

   # 2b. Install PWA Plugin
   pnpm install -D vite-plugin-pwa

   # 3. Initialize Tailwind CSS
   pnpm exec tailwindcss init -p

   # 4. Configure Tailwind template paths in tailwind.config.js
   #    content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],

   # 5. Add Tailwind directives to src/index.css
   #    @tailwind base; @tailwind components; @tailwind utilities;

   # 6. Install dev dependencies (if needed, e.g., specific linters/formatters)
   pnpm install -D prettier eslint ... # Configure as desired

   # 7. Run the dev server
   pnpm run dev

   # Backend setup commands TBD (will include installing Nostr/Cashu libs)
   ```

**6. Normie UX Considerations:**
   - **Onboarding:** First launch shows a modal explaining Nostr connection, **Cashu wallet requirement (NUT-18 compatible)**, mandatory pre-paid wagering via NUT-18 requests, and basic game rules.
   - **Tooltips:** Hover tooltips on buttons (Fire, Abilities) and key UI elements (Timer, Score).
   - **Clear Feedback:** **2D Visual cues** (sprite changes, effects on canvas) for successful connection, finding opponent, **receiving payment request, payment sent/verified**, turn start/end, hits, misses, **ability activation**, **AoE effects**, winner declaration, **payout received**.
   - **Payment Flow:** Clear display of the NUT-18 `creq...` payment request, potentially with a copy button or QR code. Clear indication of payment status (waiting, sent, verified by service). Clear notification when payout is received.
   - **Ability UI:** Intuitive way to select abilities during aiming phase (buttons arc around Fire button), clearly showing HP cost, current HP, disabling used abilities, and indicating total usage count.

**7. Decisions Logged:**
   - Tech Stack: Vite, React, TS, TailwindCSS, **HTML Canvas for 2D Rendering**, `matter-js`. - *Confirmed*.
   - Rendering: **2D rendering via HTML Canvas.** Logic/Physics are 2D. - *Confirmed*.
   - Nostr Lib: `@nostr-dev-kit/ndk`, `nostr-login`. - *Confirmed*.
   - **Strategy Shift:** Decided to **first replicate original Slingshot core mechanics** (gravity, basic collisions, aiming feel) before adding Klunkstr features (HP, abilities, turns, Nostr). - *New*.
   - **Assets:** Copied original PNG assets to `/public/images`. - *Done*.
   - **Initial Physics:** `matter-js` engine setup in `GameRenderer`, world gravity disabled. Static planets added. - *Done*.
   - **Firing:** Implemented basic projectile firing mechanism connecting `GameScreen` UI to `GameRenderer.fireProjectile`. - *Done*.
   - **Dependency Fix:** Resolved `nostr-tools` conflict. - *Done*.
   - **Nostr Login:** Using `nostr-login`. - *Done*.
   - State Mgt: Component state/prop drilling. - *Confirmed*.
   - Klunkstr Gameplay Rules (Target): Turn-based (60s), Best of 3, 5 shots/round, Sudden Death, HP for abilities, Vulnerability. - *Defined*. 
   - Klunkstr Abilities (Target): Triple Shot, Explosive Arrow, Lead Tip (Cost 25HP, Max 3 total, 1x each type). - *Defined*.
   - Matchmaking (Target): DM challenges (`kind:4`). LFG (`kind:1`) deferred. - *Confirmed*.
   - Wagering (Target): Mandatory NUT-18 via backend. - *Confirmed*.
   - UX (Target): Sci-Fi 2D, Final Controls Layout, Mobile-First PWA. - *Confirmed*.
   - PWA Strategy: Adopted `vite-plugin-pwa`. - *Configured*.
   - NDK Setup: Singleton + custom hook pattern, manual fetching. - *Done*.
   - Lobby Flow: Added dedicated `LobbyScreen.tsx` shown after login, before game. Handles challenges (via `ChallengeHandler`). Will house practice mode entry point. - *Updated*.
   - Viewport & Positioning: Implemented wider virtual viewport (1200x600) and random initial placement for ships/planets with minimum distance constraints. - *Done*.

**8. Comments & Education:**
   - `@nostr-dev-kit/ndk` provides a comprehensive toolkit...
   - The application uses a **singleton pattern** for NDK...
   - **NDK Instance Propagation:** Components needing NDK receive it via props...
   - `@nostr-dev-kit/ndk-hooks` can still be used, but pass `ndk` explicitly...
   - Using `kind:1` notes... (Deferred).
   - `kind:4` (`NDKKind.EncryptedDirectMessage`) is used for challenges...
   - `kind:30079` (custom ephemeral kind) is used for game moves...
   - `Matter.js` allows simulating 2D physics...
   - Client-side simulation ensures consistency...
   - **Planet Path Pre-calculation** required...
   - **NUT-18 Payment Requests** require backend...
   - **Backend Service** acts as trusted intermediary...
   - `nostr-login` simplifies authentication...
   - **Matchmaking** relies on out-of-band pubkey exchange...
   - **UI Components:** `AimingInterface.tsx` handles left controls (Joystick/Power). `ActionButtons.tsx` handles right controls (Ability arc/Fire). `GameScreen.tsx` positions these components.
   - **Last Shot Trace:** Implement rendering of the previous shot's path.
   - **Level Loading:** Basic random level generation (place planets).
     - ~~Implement random generation of ship starting positions (within side zones, min separation enforced).~~ - *Done*.
     - ~~Implement random generation of planet positions (respecting min distance from ships and other planets).~~ - *Done*.
     - ~~Implement wider aspect ratio (1200x600) for the game's virtual coordinate system.~~ - *Done*.
   - **Phase 1B: Klunkstr Rules & Features:**
     - Implement HP system, Ability selection/effects, Vulnerability, Sudden Death.
     - Implement Klunkstr win conditions.
     - Implement turn structure (timer, state changes).
     - Add Gas Giants, moving planets.
   - **Phase 2: Nostr Multiplayer & Wagering:**
     - **Challenge Flow:** Refine `LobbyScreen` UI for listing/accepting challenges... 
     - **Wagering (NUT-18):** Define/Implement Backend Service API...
     - **Turn Sync:** Implement sending/receiving moves (`kind:30079`)...

**9. Next Steps:**
   - **Phase 1A: Original Slingshot Replica (Current Focus):**
     - **Physics:** Implement custom planetary gravity (attraction based on size) in `GameRenderer` loop. Apply force to projectiles. - *Done*
     - **Collisions:** Implement basic collision handling (destroy projectile on planet hit). Detect ship hits. - *Immediate Next*
     - **Projectile Timeout:** Remove projectiles after ~750ms. - *Immediate Next*
     - **Visuals:** Render original assets (`.png`) for planets, ships, projectiles on the canvas instead of basic shapes.
     - **Last Shot Trace:** Implement rendering of the previous shot's path.
     - **Level Loading:** Basic random level generation (place planets).
   - **Phase 1B: Klunkstr Rules & Features:**
     - Implement HP system, Ability selection/effects, Vulnerability, Sudden Death.
     - Implement Klunkstr win conditions.
     - Implement turn structure (timer, state changes).
     - Add Gas Giants, moving planets.
   - **Phase 2: Nostr Multiplayer & Wagering:**
     - **Challenge Flow:** Refine `LobbyScreen` UI for listing/accepting challenges... 
     - **Wagering (NUT-18):** Define/Implement Backend Service API...
     - **Turn Sync:** Implement sending/receiving moves (`kind:30079`)...
   - **Phase 3: Polish:**
     - Visuals (sprites, animations, effects), Sound, Error Handling, Tutorials...

--- 