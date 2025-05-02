# Klunkstr Project Layout

This document provides an overview of the Klunkstr project structure, key components, and custom hooks as currently implemented.

## Directory Structure

```
src/
├── App.css             # Main application styles
├── App.tsx             # Main application component, routing, global state (Uses useAuth)
├── assets/             # Static assets (images, fonts - if any)
├── components/
│   ├── ChallengeHandler.tsx # Handles Nostr DM challenge logic (Uses manual NDK subscribe/publish)
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
│       └── UserProfileDisplay.tsx # Fetches and displays Nostr profile info (Uses manual ndk.fetchProfile)
├── docs/               # Project documentation (like this file)
│   ├── Build.md
│   ├── Gameplay.md
│   ├── layout.md       # This file
│   ├── Planning.md
│   ├── testGameplay.md # Test plan for multiplayer sync
│   └── roadmap.md
├── hooks/              # Custom React hooks
│   ├── useAuth.ts      # Centralized Auth Hook: Manages NDK initialization (via useNDKInit), login state (NIP-07/NIP-46), and provides NDK instance/auth details to the app.
│   ├── useNDKInit.ts   # Internal Hook: Initializes and manages the NDK singleton instance connection state (used by useAuth).
│   ├── useShotTracers.ts # Manages state and logic for active/historical projectile trails
│   ├── useMatterPhysics.ts    # Encapsulates Matter.js engine setup & physics loop
│   ├── useDynamicViewport.ts  # Manages dynamic camera panning/zooming
│   ├── useGameInitialization.ts # Handles initial random placement of ships/planets
│   ├── useGameAssets.ts       # Handles loading game image assets
│   └── useGameLogic.ts       # Encapsulates core game state/logic. Multiplayer mode uses manual NDK subscribe/publish for basic turn sync.
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
*   **`LobbyScreen.tsx` (`src/components/lobby/`)**:
    *   Displayed after successful login.
    *   Contains the `ChallengeHandler` component for managing Nostr challenges.
    *   Receives `ndk` and `currentUser` as props.
*   **`PracticeScreen.tsx` (`src/components/screens/`)**:
    *   Container for the practice game mode.
    *   Receives `ndk` and `currentUser` as props.
    *   Uses the `useGameLogic` hook with `mode: 'practice'`.
*   **`GameScreen.tsx` (`src/components/game/`)**:
    *   Container for the active PvP game match.
    *   Receives `ndk`, `localPlayerPubkey`, `opponentPubkey`, `matchId` as props.
    *   Uses the `useGameLogic` hook with `mode: 'multiplayer'`.
*   **`GameRenderer.tsx` (`src/components/game/`)**:
    *   Core canvas rendering component.
    *   Independent of direct NDK usage.
*   **`ChallengeHandler.tsx` (`src/components/`)**:
    *   Manages the Nostr DM (`kind:4`) challenge handshake.
    *   Uses passed `ndk` prop for manual event publishing (`ndkEvent.publish()`) and subscription (`ndk.subscribe`).
*   **UI Overlay Components (`src/components/ui_overlays/`)**:
    *   `PlayerHUD`: Uses `UserProfileDisplay`.
    *   `UserProfileDisplay`: Uses passed `ndk` prop for manual profile fetching (`ndk.fetchProfile()`).
    *   `AimingInterface`, `ActionButtons`: Primarily UI, interact with `useGameLogic` state/handlers.

## Custom Hooks (`src/hooks/`)

*   **`useAuth.ts`**: The primary hook for authentication and NDK access. Initializes NDK (via `useNDKInit`), manages NIP-07 (`NDKNip07Signer`) and NIP-46 (`NostrConnectSignerWrapper`) signers/state, handles login/logout, and provides `ndk`, `currentUser`, `isLoggedIn`, etc., to the application.
*   **`useNDKInit.ts`**: Helper hook called by `useAuth`. Manages the NDK singleton connection state and provides the initialized `ndkInstance`.
*   **`useGameLogic.ts`**: Encapsulates game state/logic. Receives `ndk` prop for multiplayer mode to handle turn synchronization via manual NDK subscription (`ndk.subscribe`) and publishing (`ndkEvent.publish()`).
*   **`useShotTracers.ts`**: Manages shot trail state.
*   **`useMatterPhysics.ts`**: Abstracts Matter.js setup/loop.
*   **`useDynamicViewport.ts`**: Abstracts camera/zoom logic.
*   **`useGameInitialization.ts`**: Handles initial random placement.
*   **`useGameAssets.ts`**: Abstracts asset loading.

*Note: The `src/screens/` directory seems redundant or unused. Key screens like `PracticeScreen` are in `src/components/screens/`.* 