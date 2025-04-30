# Klunkstr Project Layout

This document provides an overview of the Klunkstr project structure, key components, and custom hooks (existing and planned) for LLM context.

## Directory Structure

```
src/
├── App.css             # Main application styles
├── App.tsx             # Main application component, routing, global state
├── assets/             # Static assets (images, fonts - if any)
├── components/
│   ├── ChallengeHandler.tsx # Handles Nostr DM challenge logic (Receiving, Accepting - WIP)
│   ├── game/
│   │   ├── GameRenderer.tsx # Renders the game state onto HTML Canvas (Physics, Drawing - Large file, target for refactoring)
│   │   └── GameScreen.tsx   # Main game view container, integrates Renderer and UI Overlays
│   ├── lobby/
│   │   └── LobbyScreen.tsx  # Screen shown after login, before game start (Challenge list, Practice entry)
│   └── ui_overlays/
│       ├── ActionButtons.tsx # Fire button, Ability buttons
│       ├── AimingInterface.tsx # Joystick, Power slider
│       ├── PlayerHUD.tsx     # Displays player info (npub, profile pic)
│       └── UserProfileDisplay.tsx # Fetches and displays Nostr profile info (Used by PlayerHUD)
├── docs/               # Project documentation (like this file)
│   ├── Build.md
│   ├── Gameplay.md
│   ├── layout.md       # This file
│   ├── Planning.md
│   └── roadmap.md
├── hooks/              # Custom React hooks
│   ├── useNDKInit.ts   # Initializes and manages the NDK singleton instance connection
│   ├── useShotTracers.ts # Manages state and logic for active/historical projectile trails
│   ├── useMatterPhysics.ts    # (Planned) Encapsulates Matter.js engine setup & physics loop
│   ├── useDynamicViewport.ts  # (Planned) Manages dynamic camera panning/zooming
│   ├── useGameInitialization.ts # (Planned) Handles initial random placement of ships/planets
│   ├── useGameAssets.ts       # (Planned) Handles loading game image assets
│   ├── useNostrLogin.ts       # (Planned) Encapsulates NIP-07/NIP-46 login flow & state
│   └── useChallengeHandler.ts # (Planned) Core Nostr subscription/state logic for challenges
├── index.css           # Global styles, Tailwind directives
├── main.tsx            # Application entry point, NDK instance creation
├── services/           # (Potential) For external API calls (e.g., NUT-18 backend)
├── types/              # TypeScript type definitions (e.g., game types)
│   └── game.ts
└── vite-env.d.ts       # Vite environment types
```

## Key Components & Responsibilities

*   **`App.tsx`**:
    *   Initializes NDK using `useNDKInit`.
    *   Handles the overall application state (login status, active screen).
    *   Manages login flow (NIP-07/NIP-46) - *Target for `useNostrLogin` hook*.
    *   Renders `LobbyScreen` or `GameScreen` based on state.
*   **`main.tsx`**:
    *   Creates the global NDK singleton instance (`ndkInstance`) with explicit relays.
    *   Renders the root `App` component.
*   **`LobbyScreen.tsx`**:
    *   Displayed after successful login.
    *   Will contain the `ChallengeHandler` component.
    *   Entry point for initiating challenges or practice mode.
*   **`GameScreen.tsx`**:
    *   Container for the active game session.
    *   Integrates `GameRenderer` (canvas) and UI overlay components (`PlayerHUD`, `AimingInterface`, `ActionButtons`).
    *   Manages game-related UI state (aiming angle, power).
    *   Manages core player state (HP, used abilities, vulnerability).
    *   Connects UI actions (fire, aim, select ability) to component logic and `GameRenderer` methods via refs/callbacks.
    *   Handles round win callbacks from `GameRenderer` (*Needs full win condition implementation*).
*   **`GameRenderer.tsx`**:
    *   The core canvas rendering component.
    *   Initializes and runs the Matter.js physics simulation (*Target for `useMatterPhysics`*).
    *   Handles drawing game elements (ships, planets, projectiles, background, traces).
    *   Includes collision detection logic (*Needs implementation for ship hits*).
    *   Manages dynamic viewport/camera (*Target for `useDynamicViewport`*).
    *   Generates initial level layout (*Target for `useGameInitialization`*).
    *   Uses `useShotTracers` hook (*Tracer rendering requires further debugging*).
    *   Exposes control methods (`fireProjectile`, `setShipAim`) via `useImperativeHandle`.
*   **`ChallengeHandler.tsx`**:
    *   Responsible for sending/receiving Nostr DMs (`kind:4`) for game challenges.
    *   Subscribes to relevant Nostr events (*Potential target for `useChallengeHandler` hook*).
*   **UI Overlay Components (`PlayerHUD`, `AimingInterface`, etc.)**:
    *   Provide the interactive elements layered on top of the game canvas.
    *   `PlayerHUD` uses `UserProfileDisplay`.
    *   `UserProfileDisplay` fetches Nostr profile data.

## Custom Hooks

*   **`useNDKInit`**: (Existing) Manages NDK connection state.
*   **`useShotTracers`**: (Existing) Handles logic and state for projectile trails (*Requires further debugging for rendering consistency*).
*   **`useMatterPhysics`**: (Planned) Abstract Matter.js setup and core physics loop.
*   **`useDynamicViewport`**: (Planned) Abstract dynamic camera/zoom logic.
*   **`useGameInitialization`**: (Planned) Abstract random level generation logic.
*   **`useGameAssets`**: (Planned) Abstract asset loading.
*   **`useNostrLogin`**: (Planned) Abstract NIP-07/NIP-46 login flow from `App.tsx`.
*   **`useChallengeHandler`**: (Planned) Abstract Nostr DM subscription/handling for challenges. 