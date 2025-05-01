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
│   │   ├── GameRenderer.tsx # Renders game state onto Canvas (Uses physics/viewport/init/tracer hooks)
│   │   └── GameScreen.tsx   # Main PvP game view container (Orchestrates GameRenderer, UI Overlays, Game Logic)
│   ├── lobby/
│   │   ├── LobbyScreen.tsx  # Screen shown after login (Hosts LobbyPlayground, ChallengeHandler)
│   │   └── LobbyPlayground.tsx # Interactive single-player simulation for lobby
│   ├── screens/        # ??? (Unexpected directory - Needs review)
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
│   ├── useAuth.ts      # Manages NIP-07/NIP-46/nsec login state & settings persistence
│   ├── useNDKInit.ts   # Initializes and manages the NDK singleton instance connection
│   ├── useShotTracers.ts # Manages state and logic for active/historical projectile trails
│   ├── useMatterPhysics.ts    # Encapsulates Matter.js engine setup & physics loop
│   ├── useDynamicViewport.ts  # Manages dynamic camera panning/zooming
│   ├── useGameInitialization.ts # Handles initial random placement of ships/planets
│   ├── useGameAssets.ts       # Handles loading game image assets
├── index.css           # Global styles, Tailwind directives
├── main.tsx            # Application entry point, NDK instance creation
├── ndk.ts              # NDK singleton instance export (Potentially related to useNDKInit)
├── screens/            # ??? (Unexpected directory - Needs review, duplicates components/screens?)
├── services/           # Services (e.g., for potential future backend interaction)
├── types/              # TypeScript type definitions
│   └── game.ts         # Game-specific types
└── vite-env.d.ts       # Vite environment types
```

## Key Components & Responsibilities

*   **`App.tsx`**:
    *   Initializes NDK using `useNDKInit`.
    *   Handles the overall application state (login status, active screen).
    *   Uses the `useAuth` hook to manage login state and UI.
    *   Renders `LobbyScreen` or `GameScreen` based on state.
*   **`main.tsx`**:
    *   Creates the global NDK singleton instance (`ndkInstance`) with explicit relays.
    *   Renders the root `App` component.
*   **`LobbyScreen.tsx` (`src/components/lobby/`)**:
    *   Displayed after successful login.
    *   Hosts the `LobbyPlayground` component for an interactive waiting experience.
    *   Contains the `ChallengeHandler` component for managing Nostr challenges.
    *   Entry point for initiating challenges or practice mode (practice TBD).
*   **`LobbyPlayground.tsx` (`src/components/lobby/`)**:
    *   Provides an interactive, single-player version of the core game mechanics.
    *   Displayed within the `LobbyScreen` as a dynamic waiting room element.
    *   Uses `GameRenderer` and associated hooks.
*   **`GameScreen.tsx` (`src/components/game/`)**:
    *   Container for the active PvP game match.
    *   Integrates `GameRenderer` and UI overlay components.
    *   Manages game state (HP, abilities, etc.).
*   **`GameRenderer.tsx` (`src/components/game/`)**:
    *   Core canvas rendering component.
    *   Uses `useMatterPhysics`, `useDynamicViewport`, `useGameInitialization`, `useShotTracers`, and `useGameAssets` hooks to get physics state, viewport, initial positions, trace data, and loaded assets.
    *   Handles drawing game elements (ships, planets, projectiles, background, traces) using loaded assets.
    *   Exposes control methods (`fireProjectile`, `setShipAim`) via `useImperativeHandle`.
*   **`ChallengeHandler.tsx` (`src/components/`)**:
    *   Handles sending/receiving Nostr DM (`kind:4`) challenges.
    *   Uses passed `ndk` prop for manual subscriptions (`ndk.subscribe`).
*   **UI Overlay Components (`src/components/ui_overlays/`)**:
    *   Provide interactive elements layered on the game canvas.
    *   `PlayerHUD` uses `UserProfileDisplay`.
    *   `UserProfileDisplay` fetches Nostr profile data using direct `ndk.fetchProfile()`.

## Custom Hooks (`src/hooks/`)

*   **`useAuth.ts`**: Manages NIP-07/NIP-46/nsec login state & settings persistence.
*   **`useNDKInit.ts`**: Manages NDK connection state.
*   **`useShotTracers.ts`**: Handles logic and state for active/historical projectile trails.
*   **`useMatterPhysics.ts`**: Abstracts Matter.js setup and core physics loop.
*   **`useDynamicViewport.ts`**: Abstracts dynamic camera/zoom logic.
*   **`useGameInitialization.ts`**: Abstracts random level generation logic.
*   **`useGameAssets.ts`**: Abstracts game image asset loading.

*Note: Review the purpose of `src/screens/` and `src/components/screens/` directories.* 