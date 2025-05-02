# Vibe Coding Build Log

## LLD 1: Klunkstr (Current State)

**1. Goal:**
   - Complete the Klunkstr game: A turn-based, 2-player online space artillery game **rendered in 2D on HTML Canvas** using `matter-js` for physics.
   - Players shoot projectiles affected by planet gravity (scaling with size) to hit their opponent.
   - Implement Nostr integration for login (`nostr-login`), matchmaking (DMs `kind:4`), and potentially turn communication (`kind:30079`).
   - Implement mandatory wagering using NUT-18 via a backend service.
   - Test and refine, particularly mobile login and overall UX.
   - **Game NPub** `npub10nxjs7e4vh7a05a0qz8u7x4kdtlq6nk5lugeczddk5l40x5kdysqt2e96x`

**2. Features:**
   **Current Implementation (Local Klunkstr Core + Basic Sync):**
   - **Rendering:** 2D rendering on HTML Canvas via `GameRenderer.tsx`. Uses `useGameAssets` for loading. Placeholder shapes currently drawn. Adaptive camera/viewport implemented (`useDynamicViewport`).
   - **Physics (`useMatterPhysics`):** `matter-js` engine running. World gravity disabled. Tuned planetary gravity implemented (force based on effective radius scaling with planet size). Basic projectile-planet/boundary collisions handled. Projectile timeout functional (45s).
   - **Level Setup (`useGameInitialization`):** Random initial placement of ships (in side zones) and planets (in central zone) respecting distance constraints. Wider virtual viewport (2400x1200).
   - **Controls & Firing:** Aiming (rotation/power via UI/keyboard) and firing implemented (`GameScreen` / `PracticeScreen` -> `useGameLogic` -> `GameRenderer`).
   - **Aiming Aids (`useShotTracers`):** Historical shot traces (last 10) and active projectile trails rendered.
   - **Klunkstr Rules (Partial):** Basic HP system implemented (as resource). Ability selection UI/logic functional (`ActionButtons`/`useGameLogic`). Standard projectile hits trigger round win callback in `useGameLogic`.
   - **Practice Mode:** Full practice mode implemented (`PracticeScreen` + `useGameLogic`): turn-based, best-of-3 rounds, scoring, HP tie-breaker, alternating start player, opponent Npub display. - *Done*.
   - **Authentication (`useAuth`):** NIP-07/NIP-46/nsec login logic implemented.
   - **Lobby (`LobbyScreen`, `LobbyPlayground`):** Basic lobby structure exists with interactive playground.
   - **Challenges (`ChallengeHandler`):** Basic Nostr DM challenge sending/receiving implemented.
   - **Multiplayer Sync (Basic):** Fire actions synchronized via Nostr events (`kind:30079`) using `useGameLogic` and `useSubscribe`.

   **Target Features (To Be Implemented/Completed):**
   - **Visuals:** Render actual sprites/assets for ships, planets, projectiles, effects.
   - **Klunkstr Gameplay:** Implement ability *effects* (Splitter, Gravity, Plastic). Implement full win conditions (based on HP/Vulnerability). Implement Vulnerability state. Enforce match-level ability limits (3 total, 1/type). Implement turn structure (timer, 5-shot limit), round scoring (Best of 3), and Sudden Death mechanics.
   - **Advanced Levels:** Add Gas Giants, moving planets.
   - **Nostr Integration:** Full matchmaking flow (Accept/Reject challenges). **Refine/Complete Turn/State synchronization (`kind:30079`)**. Robust error handling.
   - **Wagering (Mandatory):** NUT-18 backend service integration (API definition, frontend flow, verification).
   - **UX:** Finalize UI controls, add tutorials/tooltips, refine PWA behavior.
   - **Testing:** Thorough testing, especially mobile login flows.

**3. Tech Stack:**
   - **Frontend Framework:** React (v18.3.1) with TypeScript (v5.6.2)
   - **Build Tool:** Vite
   - **PWA Plugin:** `vite-plugin-pwa`
   - **Styling:** Tailwind CSS (v3.4.13)
   - **Physics Engine:** `matter-js` (via `useMatterPhysics` hook)
   - **2D Rendering:** HTML Canvas API (via `GameRenderer.tsx`)
   - **Nostr Client Library:** `@nostr-dev-kit/ndk` (via `useNDKInit` hook)
   - **Authentication:** Custom `useAuth` hook (Handles NIP-07 and NIP-46 via integrated Applesauce signer code).
   - **State Management:** Component state/prop drilling, React hooks.
   - **Nostr Relays:** Default list, user-configurable preferred.
   - **Backend Service:** Required for NUT-18.
   - **eCash Wallet Requirement:** Users need NUT-18 compatible Cashu wallets.

**4. File Structure:** *(Refer to `layout.md` for the most up-to-date structure)*

**5. Setup Commands:** *(Seems up-to-date)*
   ```bash
   # 1. Create Vite project
   pnpm create vite@latest klunkstr --template react-ts
   cd klunkstr

   # 2. Install dependencies
   pnpm install tailwindcss@3.4.13 postcss autoprefixer
   pnpm install @nostr-dev-kit/ndk matter-js @types/matter-js
   pnpm install nostr-login # Added nostr-login
   # Dependencies for copied Applesauce NIP-46 code (buffer, nanoid) installed separately
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

**6. Normie UX Considerations:** *(Seems up-to-date)*
   - **Onboarding:** First launch shows a modal explaining Nostr connection, **Cashu wallet requirement (NUT-18 compatible)**, mandatory pre-paid wagering via NUT-18 requests, and basic game rules.
   - **Tooltips:** Hover tooltips on buttons (Fire, Abilities) and key UI elements (Timer, Score).
   - **Clear Feedback:** **2D Visual cues** (sprite changes, effects on canvas) for successful connection, finding opponent, **receiving payment request, payment sent/verified**, turn start/end, hits, misses, **ability activation**, **AoE effects**, winner declaration, **payout received**.
   - **Payment Flow:** Clear display of the NUT-18 `creq...` payment request, potentially with a copy button or QR code. Clear indication of payment status (waiting, sent, verified by service). Clear notification when payout is received.
   - **Ability UI:** Intuitive way to select abilities during aiming phase (buttons arc around Fire button), clearly showing HP cost, current HP, disabling used abilities, and indicating total usage count.

**7. Decisions Logged:**
   - Tech Stack: Vite, React, TS, TailwindCSS, HTML Canvas, `matter-js`. - *Confirmed*.
   - Rendering: 2D rendering via HTML Canvas. - *Confirmed*.
   - Nostr Lib: `@nostr-dev-kit/ndk`. - *Confirmed*.
   - Physics Engine: `matter-js` abstracted via hooks. - *Done*.
   - Initial Level/Physics Setup: Random placement, custom gravity, basic collisions, projectile timeout implemented via hooks. - *Done*.
   - Aiming/Firing/Controls: Functional. - *Done*.
   - Aiming Aids: Shot tracers implemented. - *Done*.
   - Authentication: Handled by `useAuth` hook. - *Done* (Now uses Applesauce NIP-46 wrapper).
   - NDK Setup: Singleton + `useNDKInit` hook. Manual fetching/subscriptions used where needed. - *Done*.
   - State Mgt: Component state/prop drilling. - *Confirmed*.
   - Klunkstr Gameplay Rules (Target): Defined (Turn-based, Bo3, 5 shots/round, HP/Abilities, Vuln, Sudden Death). - *Confirmed Target*
   - Klunkstr Abilities (Target): Defined (Splitter, Gravity, Plastic - Cost/Limits TBD based on final HP implementation). - *Confirmed Target*
   - Matchmaking (Target): DM challenges (`kind:4`). - *Confirmed Target*
   - Wagering (Target): Mandatory NUT-18 via backend. - *Confirmed Target*
   - UX (Target): Sci-Fi 2D (Canvas), Final Controls Layout, Mobile-First PWA. - *Confirmed Target*
   - PWA Strategy: Adopted `vite-plugin-pwa`. - *Configured*
   - Lobby Flow: Dedicated `LobbyScreen` with `LobbyPlayground`. - *Done*.
   - Viewport & Positioning: Implemented wider virtual viewport, random placement, adaptive camera zoom. - *Done*.
   - Gravity Tuning: Implemented effectiveRadius calculation. - *Done*.
   - HP/Ability Logic: Basic resource management and selection UI implemented. - *Done*
   - Practice Mode Logic: Implemented best-of-3 rounds, scoring, HP tie-breaker, alternating start. - *Done*

**8. Comments & Education:** *(Generally accurate, focusing on NDK/Matter.js/Nostr concepts)*
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
   - **NIP-46:** Implemented using a custom wrapper around copied Applesauce signer code. 
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
   - **Shot Tracers:** `useShotTracers` hook manages state for active/historical traces. `useState` for historical traces ensures re-renders, while `useRef` for active trails avoids unnecessary renders tied to Matter.js bodies. `GameRenderer` uses a ref (`latestTracesRef`) updated via `useEffect` to access the latest historical state in the `renderLoop` closure.

**9. Next Steps:**
   - **Integration & Testing (Current Focus):**
     - **Visuals:** Render actual sprites/assets in `GameRenderer`. - *Immediate Next*
     - **Nostr Login:** Test and debug NIP-46 QR code login flow (`useAuth` with Applesauce wrapper) thoroughly on mobile devices.
     - **Matchmaking:** Implement full challenge accept/reject flow in `ChallengeHandler`/`LobbyScreen`.
     - **Wagering:** Define/Implement Backend Service API and frontend integration.
     - **Turn/State Sync:** Refine/complete synchronization of game state (collisions, turns, aiming?) using `kind:30079`.
   - **Klunkstr Gameplay Completion:**
     - Implement ability physics effects.
     - Implement full win conditions (HP/Vulnerability based).
     - Implement Vulnerability state logic.
     - Enforce ability usage limits.
     - Implement turn timer and limits.
     - Implement Sudden Death mechanics.
   - **Polish:**
     - Add Gas Giants, moving planets.
     - Visual polish (animations, effects), Sound, Error Handling, Tutorials.

--- 