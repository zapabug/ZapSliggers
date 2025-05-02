# Klunkstr Project Layout

This document provides an overview of the Klunkstr project structure, key components, and custom hooks as currently implemented.

## Directory Structure

```
src/
├── App.css             # Main application styles
├── App.tsx             # Main application component, routing, global state (Uses useAuth)
├── assets/             # Static assets (images, fonts - if any)
├── components/
│   ├── ChallengeHandler.tsx # Handles Nostr DM challenge logic (Uses manual NDK calls)
│   ├── game/
│   │   ├── GameRenderer.tsx # Renders game state onto Canvas (Uses physics/viewport/init/tracer/asset hooks)
│   │   └── GameScreen.tsx   # Main PvP game view container (Uses useGameLogic hook)
│   ├── lobby/
│   │   ├── LobbyScreen.tsx  # Screen shown after login (Hosts ChallengeHandler)
│   │   └── LobbyPlayground.tsx # Standalone interactive single-player simulation (not used by LobbyScreen currently)
│   ├── screens/        # Contains full-screen components like PracticeScreen
│   │   └── PracticeScreen.tsx # Main Practice mode view container (Uses useGameLogic hook)
│   └── ui_overlays/
│       ├── ActionButtons.tsx # Fire button, Ability buttons
│       ├── AimingInterface.tsx # Joystick, Power slider
│       ├── PlayerHUD.tsx     # Displays player info (Uses UserProfileDisplay)
│       └── UserProfileDisplay.tsx # Fetches and displays Nostr profile info (Uses manual NDK calls)
├── docs/               # Project documentation (like this file)
│   ├── Build.md
│   ├── Gameplay.md
│   ├── layout.md       # This file
│   ├── Planning.md
│   └── roadmap.md
├── hooks/              # Custom React hooks
│   ├── useAuth.ts      # Manages NIP-07 and NIP-46 login state. Uses the custom `NostrConnectSignerWrapper` from `src/lib/applesauce-nip46` for NIP-46 connections, supporting both direct bunker URI connection and a generic QR code flow (`nostrconnect://`). Includes NDK initialization via `useNDKInit`.
│   ├── useNDKInit.ts   # Initializes and manages the NDK singleton instance connection
│   ├── useShotTracers.ts # Manages state and logic for active/historical projectile trails
│   ├── useMatterPhysics.ts    # Encapsulates Matter.js engine setup & physics loop
│   ├── useDynamicViewport.ts  # Manages dynamic camera panning/zooming
│   ├── useGameInitialization.ts # Handles initial random placement of ships/planets
│   ├── useGameAssets.ts       # Handles loading game image assets
│   └── useGameLogic.ts       # Encapsulates core game state (players, level, aim, abilities) and logic handlers (fire, aim, select ability, hit detection, round/match win condition). Parameterized by `mode` ('practice'/'multiplayer'). Practice mode includes turn-based logic, best-of-3 rounds, scoring, HP tie-breaker, and alternating start player.
├── index.css           # Global styles, Tailwind directives
├── lib/                # Copied or external libraries adapted for the project
│   └── applesauce-nip46/ # Implementation of NIP-46 based on Applesauce signer code
│       ├── wrapper.ts       # NDKSigner wrapper for the Applesauce NostrConnectSigner
│       ├── nostr-connect-signer.ts # Core NIP-46 connection/request logic
│       ├── simple-signer.ts # Helper for local keypair generation
│       ├── helpers.ts       # Utility functions (crypto, promises)
│       └── types.ts         # Shared types for NIP-46 implementation
├── main.tsx            # Application entry point, NDK instance creation
├── ndk.ts              # NDK singleton instance export (Potentially related to useNDKInit)
├── screens/            # Contains full-screen components like PracticeScreen
├── services/           # Services (e.g., for potential future backend interaction)
├── types/              # TypeScript type definitions
│   └── game.ts         # Game-specific types
└── vite-env.d.ts       # Vite environment types
```

## Key Components & Responsibilities

*   **`App.tsx`**:
    *   Initializes NDK via `useAuth` -> `useNDKInit`.
    *   Handles the overall application state (login status, active screen: Login, Menu, Practice, Lobby, Game).
    *   Uses the `useAuth` hook to manage login state and UI.
    *   Renders `PracticeScreen`, `LobbyScreen`, or `GameScreen` based on state and passes necessary props (ndk, currentUser, callbacks).
*   **`main.tsx`**:
    *   Creates the global NDK singleton instance (`ndkInstance`) with explicit relays.
    *   Renders the root `App` component.
*   **`LobbyScreen.tsx` (`src/components/lobby/`)**:
    *   Displayed after successful login (when user selects Multiplayer from Menu).
    *   Displays user's Nostr ID (npub/QR).
    *   Contains the `ChallengeHandler` component for managing Nostr challenges.
    *   Calls back to `App.tsx` (`onChallengeAccepted`) when a challenge is confirmed.
*   **`PracticeScreen.tsx` (`src/components/screens/`)**:
    *   Container for the practice game mode.
    *   Uses the `useGameLogic` hook with `mode: 'practice'`.
    *   Implements turn-based gameplay using the hook's state and handlers.
    *   Renders `GameRenderer` and UI overlays.
*   **`GameScreen.tsx` (`src/components/game/`)**:
    *   Container for the active PvP game match (entered via challenge acceptance).
    *   Uses the `useGameLogic` hook with `mode: 'multiplayer'`.
    *   Implements simultaneous local control (each player controls their determined ship based on pubkey).
    *   Connects UI to state/handlers provided by `useGameLogic`.
*   **`GameRenderer.tsx` (`src/components/game/`)**:
    *   Core canvas rendering component.
    *   Uses `useMatterPhysics`, `useDynamicViewport`, `useShotTracers`, and `useGameAssets` hooks.
    *   Receives level data (initial positions) as a prop.
    *   Handles drawing game elements (ships, planets, projectiles, background, traces) using loaded assets.
    *   Exposes control methods (`fireProjectile`, `setShipAim`) via `useImperativeHandle`.
    *   Calls back (`onPlayerHit`) when a projectile hits a player body.
*   **`ChallengeHandler.tsx` (`src/components/`)**:
    *   Manages the two-way Nostr DM (`kind:4`) challenge/acceptance handshake.
    *   Uses passed `ndk` prop and `loggedInPubkey`.
    *   Calls `onChallengeAccepted(opponentPubkey, matchId)` on successful handshake completion.
*   **UI Overlay Components (`src/components/ui_overlays/`)**:
    *   Provide interactive elements layered on the game canvas.
    *   `PlayerHUD` receives pubkey/state, uses `UserProfileDisplay` internally.
    *   `UserProfileDisplay` uses manual NDK calls (`ndk.fetchProfile()`) to fetch Nostr profile.
    *   `AimingInterface` displays/updates aim angle/power.
    *   `ActionButtons` displays/handles ability selection and firing trigger.

## Custom Hooks (`src/hooks/`)

*   **`useAuth.ts`**: Manages NIP-07 and NIP-46 login state. Uses the custom `NostrConnectSignerWrapper` from `src/lib/applesauce-nip46` for NIP-46 connections, supporting both direct bunker URI connection and a generic QR code flow (`nostrconnect://`). Includes NDK initialization via `useNDKInit`.
*   **`useNDKInit.ts`**: Manages NDK connection state (used internally by `useAuth`).
*   **`useGameLogic.ts`**: Encapsulates core game state (players, level, aim, abilities) and logic handlers (fire, aim, select ability, hit detection, round/match win condition). Parameterized by `mode` ('practice'/'multiplayer'). Practice mode includes turn-based logic, best-of-3 rounds, scoring, HP tie-breaker, and alternating start player.
*   **`useShotTracers.ts`**: Manages state and logic for active/historical projectile trails.
*   **`useMatterPhysics.ts`**: Abstracts Matter.js setup and core physics loop.
*   **`useDynamicViewport.ts`**: Abstracts dynamic camera/zoom logic.
*   **`useGameInitialization.ts`**: Handles initial random placement of ships/planets.
*   **`useGameAssets.ts`**: Abstracts game image asset loading.

*Note: The `src/screens/` directory seems redundant or unused. Key screens like `PracticeScreen` are in `src/components/screens/`.* 