# Zapsliggers Project Layout

This document provides an overview of the Zapsliggers project structure, key components, and custom hooks as currently implemented.

## Directory Structure

```
src/
├── App.css             # Main application styles
├── App.tsx             # Main application component, routing, global state (Uses useAuth)
├── assets/             # Static assets (images, fonts - if any)
├── components/
│   ├── ChallengeHandler.tsx # Handles Nostr DM challenge logic (Uses manual NDK subscribe/publish)
│   ├── game/
│   │   ├── GameRenderer.tsx # Renders game state onto Canvas (Accepts physicsHandles, shotTracerHandlers, settings, aimStates from useGameLogic)
│   │   └── GameScreen.tsx   # Main PvP game view container (Uses useGameLogic hook with mainSettings, passes props down)
│   ├── lobby/
│   │   └── LobbyScreen.tsx  # Main lobby component
│   ├── screens/
│   │   ├── PracticeScreen.tsx # Main Practice mode view container (Uses useGameLogic hook with practiceSettings)
│   │   └── DeveloperSandboxScreen.tsx # Dev testing screen (Uses useGameLogic hook with customSettings)
│   └── ui_overlays/
│       ├── ActionButtons.tsx # Fire button, Ability buttons (Accepts props from useGameLogic/settings)
│       ├── AimingInterface.tsx # Joystick, Power slider
│       ├── PlayerHUD.tsx     # Displays player info (Uses UserProfileDisplay, accepts maxHp prop)
│       └── UserProfileDisplay.tsx # Fetches and displays Nostr profile info (Uses manual ndk.fetchProfile)
├── config/             # Configuration files
│   └── gameSettings.ts   # Defines GameSettingsProfile interface and exports settings profiles (main, practice, custom)
├── docs/               # Project documentation (like this file)
│   ├── Build.md
│   ├── Gameplay.md
│   ├── Gamemodes.md    # Describes different game modes and their settings
│   ├── layout.md       # This file
│   ├── Planning.md
│   ├── testGameplay.md # Test plan for multiplayer sync
│   └── roadmap.md
├── hooks/              # Custom React hooks
│   ├── useAuth.ts      # Centralized Auth Hook: Manages NDK initialization (via useNDKInit), login state (NIP-07/NIP-46), and provides NDK instance/auth details to the app.
│   ├── useNDKInit.ts   # Internal Hook: Initializes and manages the NDK singleton instance connection state (used by useAuth).
│   ├── useShotTracers.ts # Manages state and logic for active/historical projectile trails (passed to GameRenderer via useGameLogic)
│   ├── useMatterPhysics.ts    # Encapsulates Matter.js engine setup & physics loop (Accepts GameSettingsProfile)
│   ├── useDynamicViewport.ts  # Manages dynamic camera panning/zooming (Used by GameRenderer)
│   ├── useGameInitialization.ts # Handles initial random placement of ships/planets (Accepts GameSettingsProfile, **Used by useGameLogic**)
│   ├── useGameAssets.ts       # Handles loading game image assets (Used by GameRenderer)
│   └── useGameLogic.ts       # **Encapsulates core game state/logic:** Calls init/physics hooks, manages player states, turns, rounds, scores, aiming, abilities, hit detection. Handles basic Nostr sync for multiplayer fire actions.
├── index.css           # Global styles, Tailwind directives
├── lib/                # Copied or external libraries adapted for the project
│   └── applesauce-nip46/ # Implementation of NIP-46 based on Applesauce signer code
│       ├── wrapper.ts       # NDKSigner wrapper for the Applesauce NostrConnectSigner
│       ├── nostr-connect-signer.ts # Core NIP-46 connection/request logic
│       ├── simple-signer.ts # Helper for local keypair generation
│       ├── helpers.ts       # Utility functions (crypto, promises)
│       └── types.ts         # Shared types for NIP-46 implementation
├── main.tsx            # Application entry point, NDK singleton instance creation
├── ndk.ts              # NDK singleton instance export (Potentially related to useNDKInit)
├── screens/            # Contains full-screen components like PracticeScreen
├── services/           # Services (e.g., for potential future backend interaction)
├── types/              # TypeScript type definitions
│   └── game.ts         # Game-specific types
├── utils/              # Utility functions
│   └── mobileDetection.ts # Detects mobile browser environment
└── vite-env.d.ts       # Vite environment types
```

## Key Components & Responsibilities

*   **`App.tsx`**:
    *   Top-level component managing UI routing and global state via the `useAuth` hook.
    *   Retrieves NDK instance, auth status, and current user from `useAuth`.
    *   Renders different screens (`Login`, `Lobby`, `Practice`, `Game`) based on state.
    *   Passes necessary props (`ndk`, `currentUser`) down to child components.
*   **`main.tsx`**:
    *   Creates the global NDK singleton instance (`ndkInstance`) with explicit relays.
    *   Renders the root `App` component.
*   **`src/config/gameSettings.ts`**:
    *   Defines the `GameSettingsProfile` interface and exports settings profiles (main, practice, custom).
*   **`src/components/screens/GameScreen.tsx`**: Main container for the multiplayer game view. Uses `useGameLogic` to manage state and passes necessary props (`physicsHandles`, `shotTracerHandlers`, `settings`, `aimStates`, player state, etc.) to `GameRenderer`, `PlayerHUD`, and `ActionButtons`.
*   **`src/components/screens/PracticeScreen.tsx`**: Container for the single-player practice mode. Uses `useGameLogic` with practice settings.
*   **`src/hooks/useGameLogic.ts`**: Central hook managing the game lifecycle, player states, turn logic, rounds, scoring, aiming, ability usage, hit detection. Initializes physics and level via other hooks (`useMatterPhysics`, `useGameInitialization`, `useShotTracers`). Handles basic Nostr synchronization for fire actions in multiplayer mode.