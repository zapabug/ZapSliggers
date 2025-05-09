# Vibe Coding Planning Log

## Interaction 1: 2025-07-26 10:00 (Placeholder Time)
**User Input:** "@https://github.com/ryanakca/slingshot i want to recreate this game using nostr for a multiplayer interactive game where users wage sats to play each other the app will take a cut of winnings"
**VibeStorm Questions:**
1. Normie-Friendly Experience? (Easy setup/UI, retro or modern style?)
2. Wagering Mechanics? (Fixed/variable sats, escrow/payout method?)
3. Nostr for Real-time? (How critical is perfect sync vs. using Nostr mainly for matchmaking?)
**VibeStorm Response:** Acknowledged the concept of recreating Slingshot on Nostr with sats wagering. Outlined key areas: Game Physics (suggested Matter.js), Nostr Integration (nostr-tools, NIP-07/NIP-46), Lightning Payments (API integration needed), Real-time Multiplayer (potential Nostr latency challenge). Confirmed tech stack (Vite, React, TS, Tailwind).
**Decisions:** Proposed initial concept: Multiplayer Slingshot on Nostr + Lightning. Tech stack confirmed. Physics engine (Matter.js) suggested. Need user input on UX, wagering, and real-time approach.
**Steps Explained:** Highlighted the need for a physics engine, Nostr tools for communication, Lightning integration for payments, and the challenge of real-time sync over Nostr relays. 

## Interaction 2: 2025-07-26 10:15 (Placeholder Time)
**User Input:** "basically real time as is turn based eveyplayer has 60s to draw when all playes have submitted their arrows the game renders the pathways calculates hits and all users can see the paths of the arrows"
**VibeStorm Questions:**
1. UX Style & Normie-Friendliness? (Retro vs Modern? Onboarding needed?)
2. Wagering Details? (Fixed/variable sats? Payout method - NWC zaps or escrow?)
3. Matchmaking Flow? (Lobby channel/kind? Direct invites?)
**VibeStorm Response:** Clarified that turn-based gameplay (60s turns, submit moves, then render) is suitable for Nostr. Proposed using custom Nostr kinds for matchmaking (e.g., 30078) and move submission (e.g., 30079 tagged with game ID and turn number). Each client fetches moves and runs physics locally.
**Decisions:** Confirmed turn-based game flow. Agreed to use Nostr events for move submissions within a turn time limit. Physics calculation will happen client-side after fetching moves.
**Steps Explained:** Explained how Nostr events can manage turn-based state without needing perfect real-time sync. Clients subscribe to game-specific events, process moves locally. Suggested specific Nostr kind numbers and tagging conventions. 

## Interaction 3: 2025-07-26 10:30 (Placeholder Time)
**User Input:** "ux syfi best out of 3  5 arrows each diferent levels increasing in dificulty"
**VibeStorm Questions:**
1. Normie-Friendly within Sci-Fi? (Tutorials, tooltips?)
2. Wagering Details? (Fixed 1000 sats? Post-game NWC zap?)
3. Matchmaking Flow? (Public lobby via `kind:30078`?)
**VibeStorm Response:** Confirmed Sci-Fi UX direction. Defined game structure: Best of 3 rounds, 5 shots/round per player, increasing difficulty levels. Proposed combining sci-fi with normie-friendly elements (tutorials/tooltips), a fixed wager (e.g., 1000 sats) settled via post-game NWC zap, and a public lobby using a dedicated Nostr kind.
**Decisions:** Agreed on Sci-Fi UX theme. Set game structure: Best of 3 rounds, 5 shots/player/round, increasing level difficulty. Pending confirmation on normie-friendliness specifics, fixed wager amount/method, and public lobby approach.
**Steps Explained:** Clarified how the game format (rounds, shots, levels) defines the core gameplay loop. Reiterated the remaining decisions needed for UX details, wagering implementation, and matchmaking mechanics. 

## Interaction 4: 2025-07-26 10:45 (Placeholder Time)
**User Input:** "always random gravity on plannets  some plannets might move after each turn ensure theres always a path to target availabe ie gravety cant be too strong and jus iman the arrows"
**VibeStorm Questions:** Confirmation requested on:
1. Normie-Friendly Sci-Fi (Tutorials/Tooltips)? - Assumed Yes
2. Wagering (Fixed 1000 sats, NWC Zap)? - Assumed Yes
3. Matchmaking (Public Lobby `kind:30078`)? - Assumed Yes
**VibeStorm Response:** Agreed to add random planet gravity, moving planets, ensuring level solvability (design constraint), and displaying predicted shot trajectory during aiming. Clarified how these would be implemented (random range for gravity, predefined movement patterns, local simulation for trajectory preview).
**Decisions:** Added random gravity per level load. Added moving planets with predefined paths. Added requirement for predicted trajectory display during aiming. Confirmed level design must ensure solvability. Assumed confirmation on normie-friendliness (tutorials/tooltips), fixed 1000 sat wager via NWC zap, and public lobby (`kind:30078`).
**Steps Explained:** Explained implementation details: gravity as a random multiplier, moving planets handled by physics engine based on level data, trajectory preview via local simulation. Emphasized path guarantee as a level design principle. 

## Interaction 5: 2025-07-26 11:15 (Placeholder Time)
**User Input:** "theres no matchmaking loby users can log adn send a not im ready to play, mostly for now it will be featured on meet ups or something of its sort should be mobile friendly"
**VibeStorm Questions:** Clarified how players connect without a lobby (proposed Direct Messages - `kind:4`).
**VibeStorm Response:** Agreed to remove the public lobby (`kind:30078`). Proposed using Nostr Direct Messages (`kind:4`) for challenges between players who exchange pubkeys (e.g., via QR at meetups). Confirmed the shift to a mobile-first responsive design approach.
**Decisions:** Removed public lobby concept. Adopted Nostr DMs (`kind:4`) for peer-to-peer matchmaking. Changed UX focus to mobile-first responsive design. Updated LLD accordingly.
**Steps Explained:** Explained the DM challenge flow (exchange pubkey, send DM, accept DM) and how it fits the meetup scenario. Emphasized that mobile-first design means focusing on small screen layouts initially using Tailwind CSS. 

## Interaction 6: 2025-07-26 11:30 (Placeholder Time)
**User Input:** "no users can go to the games npub, post a gm swap @https://github.com/vstabile/gm-swap with app taking a cut"
**VibeStorm Questions:** Clarified matchmaking flow (use game npub for discovery via `kind:1` mentions, then `kind:4` DM for confirmation?). Addressed wagering complexity (adaptor signatures vs NWC zap).
**VibeStorm Response:** Proposed a new matchmaking flow: Players post `kind:1` notes mentioning a dedicated game npub to signal LFG. Clients search for these notes. Players confirm matches via `kind:4` DMs. For wagering, acknowledged the user's interest in atomic swaps (adaptor signatures) inspired by `gm-swap`. Recommended keeping the simpler NWC zap method for the initial build (Phase 1) due to complexity, while logging atomic swaps as a future goal (Phase 2).
**Decisions:** Changed matchmaking to use `kind:1` notes mentioning game npub for discovery, followed by `kind:4` DMs for confirmation. Kept NWC zap wagering for initial build (Phase 1), designated atomic swaps (adaptor signatures) as Phase 2 goal. Added placeholder game npub. Updated LLD accordingly.
**Steps Explained:** Detailed the LFG note discovery process. Contrasted the complexity of atomic swaps (requiring advanced crypto/LN integration) with the simpler NWC zap approach suitable for starting. Emphasized phasing the implementation. 

## Interaction 7: 2025-07-26 11:45 (Placeholder Time)
**User Input:** "ecash is always the solution"
**VibeStorm Questions:** Explored eCash integration options (P2P post-game transfer vs. Trusted Escrow Service vs. Complex P2P). Compared complexity and trust models with NWC/Atomic Swaps.
**VibeStorm Response:** Acknowledged user preference for eCash. Proposed a phased approach: Keep NWC zap as the default Phase 1 method for simplicity and broad compatibility. Add P2P eCash transfer (loser pays winner via DM) as an alternative Phase 1 method, noting its trust limitations and difficulty for app cut. Logged exploring a trusted eCash escrow service (requiring a backend) or more advanced P2P eCash mechanisms as a Phase 2 goal.
**Decisions:** Updated LLD: Phase 1 wagering includes NWC zap (default) and P2P eCash transfer (alternative). Phase 2 goals include exploring trusted eCash escrow and atomic swaps. App cut method clarified based on Phase 1 choice.
**Steps Explained:** Detailed the P2P eCash flow and its reliance on user honesty. Contrasted this with the backend requirement for eCash escrow. Positioned NWC as the pragmatic starting point, allowing eCash as a user-driven alternative initially. 

## Interaction 8: Wagering & Payouts - Final Decision (Cashu Exclusive)
**User Input:** Clarification on using eCash exclusively, emphasizing freedom tech adoption and rejecting backend requirements or Lightning fallbacks. Also noting winner payout methods (DM + QR) and potential for ephemeral player keys.
**VibeStorm Questions:** Confirmed understanding of the mandate for a pure Cashu flow, dual payout methods for winner, and the ephemeral key scenario.
**VibeStorm Response:** Agreed to implement a fully Cashu-based wagering and payout system. This aligns with the project's goal of promoting freedom technologies and addresses the specified refinements.
**Refined Flow:**
1.  **Matchmaking:** Players find each other (e.g., via `kind:1` LFG notes mentioning the game npub, confirmed via `kind:4` DMs). Players might initiate contact using a temporary/session key.
2.  **Agent & Stake:** A designated agent/bot npub facilitates the game. Each player sends 1000 sats (likely via a Cashu-enabled Lightning Address like npub.cash, converted to tokens by the agent's mint) to the agent's address. The agent uses a wallet connected to trusted mints (e.g., cashu.me, Minibits). *The agent needs to associate the incoming stake with the player's intended persistent payout pubkey if a temporary key was used for matchmaking.*
3.  **Verification:** The agent verifies receipt of the 1000 sats worth of Cashu tokens *from both players* in its wallet and confirms the payout pubkeys.
4.  **Game Start:** Once both stakes and payout pubkeys are confirmed, the game begins.
5.  **Payout:** After the game concludes:
    *   The agent generates 1900 sats worth of Cashu tokens for the winner.
    *   The agent generates 100 sats worth of Cashu tokens for the developer split.
    *   The agent serializes these tokens into their `cashuA...` string format.
    *   The agent sends the winner's token string via encrypted NIP-04 DM to their confirmed persistent pubkey **and** generates a QR code containing the same token string for display in the winner's game UI.
    *   The agent sends the developer's token string via encrypted NIP-04 DM to the designated developer pubkey.
6.  **Redemption:** The winner (via DM or QR scan) and developer (via DM) must use a Cashu-compatible wallet/service (connected to the agent's mint) to redeem the received token string and claim their funds.
**Decisions:** Adopted **exclusive Cashu token transmission** as the sole method for handling stakes (implicitly, via agent receiving/holding tokens) and payouts. Winner receives token via **both DM and QR code**. Developer receives via DM. **No Lightning payouts or backend escrow service required.** The system must handle players potentially using temporary keys for matchmaking/gameplay and ensure payouts reach their intended persistent pubkeys. Updated LLD to reflect this pure eCash flow and identity handling consideration.
**Steps Explained:** Detailed the player-to-agent stake flow (assuming LN->Cashu conversion at the agent's mint), the agent's verification role (including associating stakes with correct payout pubkeys), the dual DM/QR winner payout mechanism, and the exclusive Cashu token DM payout for the developer. Emphasized the need for recipients to redeem tokens manually.

## Interaction 11: 2025-07-26 12:45 (Placeholder Time)
**User Input:** "Player Orientation: Ships start facing each other on the 2D plane. Their 3D models will reflect this orientation.\nalways never changing verry simple concept mabe some davincy looking contraptions or a mediaval tribuchet\nbut syfi vibe"
**VibeStorm Questions:** None needed, input was clear.
**VibeStorm Response:** Agreed on fixed player orientation (base doesn't rotate, only weapon aims) and the "sci-fi mechanical contraption" aesthetic (Da Vinci/Trebuchet inspired).
**Decisions:** Confirmed fixed player base orientation. Defined specific sci-fi visual aesthetic. Updated `Gameplay.md` and `Build.md` accordingly.
**Steps Explained:** Clarified how fixed orientation affects model design (base vs aiming part). Described the target visual style. 

## Interaction 12: 2025-07-26 13:00 (Placeholder Time) - Placeholder Time
**User Input:** "nip 07 is great and simple nip 46 for now only works with a single relay request nsec.app (get reak rlay) add nostr login as its robust keep it simple @https://github.com/nostrband/nostr-login \nlfg is not needed for now just basic game layout waiting for login,"
**VibeStorm Questions:** Confirmed understanding: Integrate `nostr-login` for NIP-07/NIP-46 (targeting nsec.app), defer LFG features.
**VibeStorm Response:** Agreed to use `nostr-login` for a unified login experience, simplifying the initial `App.tsx` logic which previously tried to handle NIP-07 directly via NDK. Confirmed LFG features (`kind:1` notes, associated UI components) will be deferred.
**Decisions:** Adopted `nostr-login` library for authentication. Modified `main.tsx` to remove direct NDK signer init. Updated `App.tsx` to initialize `nostr-login`, show a login button, and handle `nlAuth` events. Deferred implementation of LFG components.
**Steps Explained:** Detailed the installation of `nostr-login`, changes to NDK setup, and the implementation of the `nostr-login` initialization and event handling loop in `App.tsx`. Removed LFG-related files/mentions from immediate scope. 

## Interaction 13: 2025-07-27 (Placeholder Time)
**User Input:** Run dev server, clarification on mobile layout (horizontal PWA, overlays in play area), clarification on 2D logic / 3D rendering.
**VibeStorm Response:** Resolved dependency conflict between `@nostr-dev-kit/ndk` (peer dep `nostr-tools@^2`) and `nostr-login` (direct dep `nostr-tools@1.17.0`) by using `pnpm overrides` in `package.json` to force `nostr-tools@^2.0.0`. Successfully started dev server. Confirmed understanding of UI layout (overlays on Canvas) and rendering approach (2D physics, 3D visuals). Created initial `GameScreen.tsx` component hosting R3F `Canvas` and placeholder UI overlay divs. Created basic functional components for `AimingInterface.tsx`, `AbilitySelector.tsx`, `HpDisplay.tsx` in `/src/components/ui_overlays/`. Created `types/game.ts` with `GameAbility` interface. Updated `GameScreen.tsx` to use these components with mock data/state and basic conditional rendering for a 'waiting for payment' state.
**Decisions:** Adopted UI overlay approach within `GameScreen.tsx`. Created initial structure and components for game UI. Used `pnpm overrides` to fix dependency conflict. Integrated `GameScreen` into `App.tsx`. Created basic `Scene3D` component. Created placeholder geometry for `LauncherModel` (ship-like) and `PlanetModel` (sphere+ring). Implemented aiming rotation visually. Refined `AimingInterface`. Fixed `PlayerHUD` profile loading issues. Refined `App.tsx` layout.
**Steps Explained:** Walked through troubleshooting the dependency error, applying the override, creating component files, and structuring `GameScreen.tsx` with placeholders and basic state. Integrated `GameScreen`. Created `Scene3D`. Created model components. Added aiming props and state. Refined `AimingInterface`. Fixed `useProfile` usage in `UserProfileDisplay`. Refactored `App.tsx` layout. 

## Interaction 14 (Internal Debugging/Refactoring): 2025-07-28 (Placeholder)
**User Input:** Debugging multiple profile rendering, layout issues, "NDK instance not initialized" errors despite passing props.
**VibeStorm Response:** 
    - Identified redundant `PlayerHUD` rendering in `App.tsx` header causing layout issues. Removed it, consolidating HUDs within `GameScreen`.
    - Confirmed `ndk` instance was correctly passed down (`App` -> `GameScreen` -> `PlayerHUD` -> `UserProfileDisplay`).
    - Determined that `ndk-hooks` (`useProfile`, `useSubscribe`) likely rely on React Context even when `ndk` is passed explicitly, causing errors with our custom singleton/hook setup.
    - Refactored `UserProfileDisplay` to fetch profiles manually using `ndk.fetchProfile`.
    - Refactored `ChallengeHandler` to use passed `ndk` prop and manual `ndk.subscribe` instead of `ndk-hooks`.
    - Adjusted `App.tsx` and `GameScreen.tsx` layout classes for better horizontal, full-screen display.
**Decisions:** Removed `PlayerHUD` from `App.tsx` header. Switched `UserProfileDisplay` and `ChallengeHandler` to use direct NDK calls (manual fetching/subscription) instead of potentially problematic `ndk-hooks` with the current setup. Refined CSS classes for horizontal layout.
**Steps Explained:** Detailed removal of redundant component, modifications to `UserProfileDisplay` and `ChallengeHandler` to use direct NDK methods, and CSS class adjustments in `App.tsx` and `GameScreen.tsx`.

## Interaction 15: 2025-07-28 (Placeholder Time) - Lobby Component Refinement
**User Input:** User tested the app and realized the need for a distinct lobby/waiting/practice state after login, instead of immediately entering the game. The current "logged in but game not active" rendering within App.tsx could serve as the basis.
**VibeStorm Questions:** Brainstormed lobby purpose (challenges vs practice), vibe (minimal vs dashboard), and practice mode feel.
**VibeStorm Response:** Acknowledged the user's realization during testing. Confirmed the current rendering was inline within `App.tsx`. Proposed extracting this into a dedicated `LobbyScreen.tsx` component for better structure and refinement.
**Decisions:** Decided to undo the inline lobby implementation in `App.tsx`. Will create a new dedicated component `src/components/lobby/LobbyScreen.tsx` to handle the state between login and game start. This component will contain placeholders for challenge handling (using `ChallengeHandler`) and practice mode initiation.
**Steps Explained:** Outlined the plan: undo changes in `App.tsx`, update documentation (`Build.md`, `Planning.md`), create `LobbyScreen.tsx`, and reintegrate the rendering logic in `App.tsx` to use the new component.

## Interaction 16: UI Refinement (2025-07-29 Placeholder)
**User Input:** Refine game controls layout based on visual mockups/screenshots.
**VibeStorm Response:** Iteratively adjusted UI components:
    1. Split bottom controls in `GameScreen.tsx` into left (`AimingInterface`) and right (`ActionButtons`).
    2. Modified `AimingInterface.tsx` for Joystick placeholder and Power bar.
    3. Created `ActionButtons.tsx` for abilities and Fire button.
    4. Removed "Diamond Tip" ability based on user feedback.
    5. Refined layout of `ActionButtons.tsx`: Placed Fire button at bottom, abilities (Triple, Explosive, Lead) arcing above using specific angles (-100, -45, 10 deg) and radius (60px).
    6. Adjusted vertical positioning of both control clusters in `GameScreen.tsx` to `bottom-16`.
    7. Shifted the Fire button slightly right within `ActionButtons.tsx` using `translateX(20px)`.
**Decisions:** Finalized UI control layout: Joystick/Power bottom-left (`bottom-16 left-8`), Ability Arc/Fire (shifted right) bottom-right (`bottom-16 right-8`). Removed Diamond Tip ability.
**Steps Explained:** Edited `GameScreen.tsx`, `AimingInterface.tsx`, and `ActionButtons.tsx` multiple times, adjusting Tailwind classes and inline styles (`transform`) to achieve the desired visual positioning and component structure.

## Interaction 17: PWA Implementation (2025-07-30 Placeholder)
**User Input:** Desire for fullscreen, landscape experience, potentially via PWA.
**VibeStorm Questions:** Confirmed understanding: Implement PWA using `vite-plugin-pwa` to achieve better fullscreen/landscape behavior on installation.
**VibeStorm Response:** Agreed to adopt the PWA strategy. Detailed the necessary steps: install `vite-plugin-pwa`, configure `vite.config.ts` with manifest options (`display: 'fullscreen'`, `orientation: 'landscape'`, icons), generate necessary assets (icons, potentially service worker).
**Decisions:** ZapSlinggers will be developed as a PWA using `vite-plugin-pwa`. Updated `Build.md`, `roadmap.md` to reflect this.
**Steps Explained:** Outlined the process of adding PWA capabilities via the Vite plugin and configuring the manifest for the desired display behavior.

## Interaction 18: Strategy Shift - Replicate Original First (2025-07-31 Placeholder)
**User Input:** Desire to replicate the original Python Slingshot game's physics and core mechanics first using the web stack (React/TS/Canvas/Matter.js) before implementing the full ZapSlinggers ruleset (abilities, HP, etc.). Also requested using original game assets.
**VibeStorm Questions:** Clarified key original mechanics (planet gravity based on size, no bounce, projectile timeout, aiming trail). Located original assets.
**VibeStorm Response:** Agreed on the strategy to build a replica foundation. Copied assets from `slingshot/src/slingshot/data` to `public/images`. Updated `GameRenderer.tsx` to initialize `matter-js`, add static planets, and implement a basic render loop. Updated `GameRenderer.tsx` and `GameScreen.tsx` to implement a projectile firing mechanism triggered by the UI.
**Decisions:** Shifted immediate focus to replicating core original Slingshot mechanics: Gravity (planet size based attraction), Collisions (destroy on planet hit), Aiming (no preview), Projectile Timeout. Use original assets for now. Implemented basic Matter.js setup and firing.
**Steps Explained:** Copied assets. Set up Matter.js engine/runner in `GameRenderer`. Implemented `fireProjectile` method in `GameRenderer` exposed via ref. Connected `GameScreen` UI state and Fire button to trigger `fireProjectile`.

## Interaction 19: Widen Viewport & Random Positioning (2025-08-01 Placeholder)
**User Input:** Analyzed game layout, noting the central game area wasn't full width. Requested widening the play area and implementing random positioning for ships and planets with minimum distance constraints.
**VibeStorm Response:** Identified that the viewport constraint was due to the fixed 800x600 virtual coordinate system in `GameRenderer`. Implemented random positioning logic within `GameRenderer.tsx` using a `useEffect` hook to generate ship and planet positions on mount. Ensured ships spawn in designated side zones with minimum separation. Ensured planets spawn respecting minimum distances from ships and other planets. Updated the render loop's scaling logic to use a wider virtual width (1200x600).
**Decisions:** Increased `VIRTUAL_WIDTH` to 1200 in `GameRenderer`. Implemented random ship starting position generation with minimum separation check. Implemented random planet position generation with minimum distance checks against ships and other planets. Updated documentation.
**Steps Explained:** Modified constants in `GameRenderer`. Added `useState` for `initialPositions`. Added a `useEffect` hook for position generation logic using `Math.random()` and distance checks. Updated the Matter.js initialization `useEffect` to use the generated positions and depend on the `initialPositions` state. Updated the render loop to use the new `VIRTUAL_WIDTH` constant.

## Interaction 20: Gravity Tuning (Placeholder Date)
**User Input:** Feedback on gravity strength feeling too strong/weak or not having the desired Area of Effect (AoE) scaling with planet size.
**VibeStorm Response:** Iteratively adjusted gravity implementation in `GameRenderer.tsx`:
    1. Increased base `GRAVITY_CONSTANT` for overall stronger pull.
    2. Experimented with force scaling (linear `~ Radius / Distance^2` vs. quadratic `~ Radius^2 / Distance^2`). Quadratic felt too strong.
    3. Implemented an `effectiveRadius` calculation: `effectiveRadius = planetRadius * (1 + GRAVITY_AOE_BONUS_FACTOR * (planetRadius / VIRTUAL_WIDTH))`.
    4. Tuned `GRAVITY_CONSTANT` to `0.5` and `GRAVITY_AOE_BONUS_FACTOR` to `0.1`.
**Decisions:** Final gravity implementation uses the `effectiveRadius` (base + bonus scaling with `planetRadius^2`) within the force calculation (`~ effectiveRadius / Distance^2`). This provides a base pull proportional to radius, weakening with distance, but subtly enhances the influence range of larger planets.
**Steps Explained:** Modified `applyGravity` function within the main `useEffect` hook in `GameRenderer.tsx` to calculate and use `effectiveRadius`. Added related constants.

## Interaction 21: Shot Tracers Implementation (2025-08-02 Placeholder)
**User Input:** Add shot tracers - active trail for current projectile, persistent traces for previous shots.
**VibeStorm Response:** Implemented shot tracers:
    1. Created `useShotTracers` hook to manage state.
    2. Implemented active trail rendering (currently solid colored line) in `GameRenderer`. Goal: particle/smoke effect.
    3. Implemented historical trace storage (last 10 per player) using `useState` in the hook.
    4. Implemented historical trace rendering (currently dashed bright green lines) in `GameRenderer`.
    5. Debugged rendering issue caused by stale state in `renderLoop` closure.
    6. Resolved stale state issue by using a ref (`latestTracesRef`) updated via `useEffect` to provide `renderLoop` access to the latest historical trace data.
**Decisions:** Active trails are solid lines (for now). Historical traces show the last 10 shots per player as dashed lines. Logic encapsulated in `useShotTracers`. `GameRenderer` uses ref-based access for historical trace state in `renderLoop`.
**Steps Explained:** Created hook, modified `GameRenderer` to use hook, implemented drawing logic for both trail types, diagnosed and fixed the state closure issue with the ref pattern.

## Interaction 22: HP Resource & Ability Selection Logic (Placeholder Date)
**User Input:** Implement HP system based on ZapSlinggers rules (HP as resource), ability selection UI/logic, and basic round win condition.
**VibeStorm Response:**
    1. Confirmed ZapSlinggers rules: HP is only for abilities, standard hits win round.
    2. Refactored state in `GameScreen.tsx` to manage HP (starting 100), used abilities (Set), and vulnerability per player.
    3. Implemented `handleSelectAbility` in `GameScreen.tsx` to check cost (25 HP), max uses (3 total, 1 per type), update player state, set vulnerability (>=2 uses), and manage `selectedAbility` state.
    4. Updated `ActionButtons.tsx` to receive new props (`selectedAbility`, `usedAbilities`, `currentHp`, `abilityCost`) and provide visual feedback (highlight selection, disable based on cost/limits).
    5. Added `onRoundWin` callback prop to `GameRenderer.tsx`.
    6. Modified `handleCollisions` in `GameRenderer.tsx` to call `onRoundWin` when a standard projectile hits an opponent ship, passing the firing player's index.
    7. Added `handleRoundWin` callback handler in `GameScreen.tsx` (currently logs winner).
    8. Updated `fireProjectile` (in `GameRenderer`) and its interface/call in `GameScreen` to accept `abilityType: AbilityType | null`.
    9. Stored the `abilityType` on `projectile.custom`.
    10. Updated `ProjectileBody` interface in `useShotTracers.ts` to include `abilityType`.
**Decisions:** HP implemented solely as a resource for abilities (cost 25). Ability selection logic and state management handled in `GameScreen`. UI feedback provided by `ActionButtons`. Standard hits trigger round win via callback. Ability type is now passed down to physics engine and stored on projectile. Vulnerability state tracked. 
**Steps Explained:** Detailed the state refactoring in `GameScreen`, the logic implementation in `handleSelectAbility`, UI updates in `ActionButtons`, callback implementation (`onRoundWin`) between `GameRenderer` and `GameScreen`, and signature/type updates for passing `abilityType`.

## Interaction 23: Status Update & Focus Shift (Placeholder Date)
**User Input:** Game mechanics (gravity, HP/ability resource, basic collisions, aiming, tracers, local play) are functional. Need to update docs to remove Slingshot replica references and focus on next steps: Nostr integration (login, matchmaking, payments) and mobile testing.
**VibeStorm Response:** Acknowledged current status. Confirmed plan to update documentation (`Build.md`, `Gameplay.md`, `Planning.md`, `roadmap.md`) to reflect the implemented ZapSlinggers core, remove replica-phase language, and highlight the shift in focus towards Nostr features and testing.
**Decisions:** Documentation updated to represent the current state where local ZapSlinggers mechanics are implemented. Focus shifted to integrating Nostr (login testing, matchmaking flow, turn sync) and payments (NUT-18 backend).
**Steps Explained:** Outlined the documentation update process across all relevant files.

## Interaction 24: Basic Network Sync & Control Update (Current Date Placeholder)
**User Input:** Implement basic multiplayer sync based on `testGameplay.md`, swap keyboard controls, fix practice mode inversion.
**VibeStorm Response:** 
    1. Modified `useGameLogic.ts`:
        - Added `ndk`, `matchId` props.
        - Changed `handleFire` in multiplayer to publish a `kind:30079` event with aim/ability data, tagged with `matchId` and opponent `pubkey`.
        - Implemented optimistic local firing and state updates.
        - Added `useSubscribe` (`ndk-hooks`) to listen for opponent's `kind:30079` events.
        - Added effect to process received opponent fire events, call `fireProjectile`, and update opponent state.
    2. Modified `GameScreen.tsx`:
        - Passed `ndk` and `matchId` to `useGameLogic`.
        - Updated `handleKeyDown` to swap controls (Left/Right for angle, Up/Down for power).
    3. Modified `PracticeScreen.tsx`:
        - Updated `handleKeyDown` to swap controls.
        - Added logic to invert angle controls (`Left`/`Right`) when `currentPlayerIndex === 1`.
        - Added `currentPlayerIndex` to `useEffect` dependencies.
**Decisions:** Basic fire action synchronization implemented using Nostr `kind:30079` events. Keyboard controls updated (Angle=LR, Power=UD). Player 2 practice mode aim inversion fixed.
**Steps Explained:** Detailed modifications to `useGameLogic`, `GameScreen`, and `PracticeScreen` to implement event publishing/subscription and update keyboard handlers. Updated documentation (`testGameplay.md`, `Gameplay.md`, `Build.md`) to reflect new sync status and controls.

## Interaction 25: Refactor GameScreen & Resolve Build Errors (Current Date Placeholder)
**User Input:** Build failing with 5 errors in `GameScreen.tsx` after previous refactoring attempts. Need to integrate `useGameLogic` properly.
**VibeStorm Response:** Analyzed build errors (unused React import in `App.tsx`, missing `GameRendererRef`, incorrect `useGameInitialization` call, incorrect `ActionButtons` props, incorrect `GameRenderer` props). Refactored `GameScreen.tsx`:
    1. Removed local state management (`gameState`, `playerHp`, `playerScores`, etc.) and associated effects/handlers (`handleFire`, `handlePlayerHit`, etc.).
    2. Imported and called `useGameLogic` hook, passing necessary props (`settings`, `mode`, `ndk`, `matchId`, etc.).
    3. Updated child components (`GameRenderer`, `PlayerHUD`, `ActionButtons`) to receive correct props from `useGameLogic` and `settings`.
    4. Fixed import errors (e.g., `PlayerHUD` named import).
    5. Removed unused variables/imports resulting from refactor.
    6. Verified build success after refactoring.
**Decisions:** `GameScreen.tsx` fully refactored to delegate state management and core logic to `useGameLogic`. Build errors resolved.
**Steps Explained:** Detailed the process of removing local state, integrating `useGameLogic`, correcting prop passing to children, fixing imports, and cleaning up unused code in `GameScreen.tsx`. Confirmed build success.