# Klunkstr 🎮 - A Nostr Artillery Game

Klunkstr is a 2-player, turn-based artillery game built on the Nostr protocol, where players compete using physics-based projectiles influenced by planetary gravity. The game features mandatory pre-paid wagering using eCash (NUT-18) and is designed for a mobile-first experience, perfect for meetups or online challenges.

Inspired by classic artillery games and the original Python Slingshot, Klunkstr is developed with React, Vite, TypeScript, Matter.js (for 2D physics), and the Nostr Development Kit (NDK).

## ✨ Core Gameplay Features

*   **Physics-Based Combat:** Launch projectiles influenced by planetary gravity. Master trajectory and timing!
*   **Turn-Based & Simultaneous:** Players aim and submit moves within a time limit, with shots resolving simultaneously.
*   **Nostr Integration:** Uses Nostr for identity (NIP-07/NIP-46 via `nostr-login`), direct message challenges (`kind:4`), and potentially move synchronization (`kind:30079`).
*   **Mandatory eCash Wagering:** Utilizes NUT-18 Payment Requests for secure, pre-paid game entry via a backend service.
*   **Unique Klunkstr Rules:**
    *   **HP as Resource:** Spend HP (starting at 100 per match) to activate powerful abilities (Max 3 per match, 1 of each type).
    *   **Vulnerability:** Become vulnerable after using 2+ abilities, making you susceptible to one-hit KOs from certain attacks.
    *   **Abilities:** Employ tactics with Triple Shot, Explosive Arrow, or Lead Tipped projectiles.
    *   **Sudden Death:** Drawn rounds trigger a chaotic finale with bouncing projectiles and ship gravity.
*   **Dynamic Levels:** Randomly generated levels with varying planet layouts (including Gas Giants) and gravity strengths ensure replayability.
*   **Shot Tracers:** Visualize your last 10 shots as dashed lines to help refine your aim. Active projectiles have solid trails.
*   **Mobile-First & PWA:** Designed for responsive play on mobile devices and installable as a Progressive Web App (PWA).
*   **2D Canvas Rendering:** Crisp visuals rendered on an HTML Canvas.

## 🚀 Getting Started

1.  **Clone the repository:**
    ```bash
    git clone <your-repo-url>
    cd klunkstr
    ```
2.  **Install dependencies:**
    ```bash
    npm install
    # or yarn install or pnpm install
    # Note: Uses pnpm overrides for nostr-tools version compatibility
    ```
3.  **Run the development server:**
    ```bash
    npm run dev
    # or yarn dev or pnpm dev
    ```
    Open your browser to the URL provided by Vite (usually `http://localhost:5173`).

## 🔧 Development Status & Roadmap

The project is currently focused on **Phase 1A: Replicating Original Slingshot Core Mechanics** using the web stack (React/TS/Canvas/Matter.js) as a foundation.

*   ✅ Basic Matter.js physics, projectile firing, planetary gravity, collisions, timeouts implemented.
*   ✅ Random level generation (ships/planets), wider viewport, dynamic camera zoom.
*   ✅ Active and historical shot tracers implemented.
*   🚧 Rendering original game assets on canvas.
*   🚧 Full Klunkstr rules (HP, Abilities, Vulnerability, Turns, Rounds).
*   🚧 PWA configuration (icons needed).

**Next Phases:**

*   **Phase 2:** Nostr Multiplayer (DM challenges, move sync) & NUT-18 Wagering Backend integration.
*   **Phase 3:** Polish (Visuals, SFX, Error Handling, Onboarding).

*(See `src/docs/roadmap.md` for detailed status)*

## Nostr Integration Notes

*   **NDK Singleton:** NDK is initialized via `useNDKInit` hook.
*   **Authentication:** Handled by `nostr-login` library (NIP-07/NIP-46).
*   **Matchmaking:** Planned via `kind:4` Direct Messages between players.
*   **Wagering:** Requires a backend service implementing NUT-18 for mandatory eCash payment requests and escrow.
*   **Local-First Simulation:** Game physics runs client-side based on move data exchanged via Nostr, ensuring consistency.

## Tech Stack 🥞

*   [React](https://reactjs.org/)
*   [Vite](https://vitejs.dev/)
*   [TypeScript](https://www.typescriptlang.org/)
*   [@nostr-dev-kit/ndk](https://github.com/nostr-protocol/ndk)
*   [nostr-login](https://github.com/nostrband/nostr-login)
*   [Matter.js](https://brm.io/matter-js/) (2D Physics)
*   [Tailwind CSS](https://tailwindcss.com/)
*   [vite-plugin-pwa](https://vite-pwa-org.netlify.app/)

---

_Klunkstr embraces decentralization and leverages the power of the Nostr protocol for identity and communication, combined with Cashu eCash for sovereign value exchange._
