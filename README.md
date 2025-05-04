# ZapSlinggers 🎮 - Nostr Artillery Fun!

ZapSlinggers is a 2-player space artillery game built on Nostr. Challenge your friends, lob projectiles around planets, and maybe win some sats!

We're using React, Vite, TypeScript, Matter.js for physics, and NDK for all things Nostr. It's designed mobile-first, so play anywhere!

## ✨ What's Cool About It?

*   **Physics Fun:** Launch projectiles that curve around planets. Bank shots ftw!
*   **Nostr Powered:** Uses Nostr for logins (`nostr-login`), challenges (DMs), and syncing game actions (`kind:30079`).
*   **eCash Wagering (Planned):** Put your sats where your mouth is! Mandatory NUT-18 wagers via a backend are planned.
*   **ZapSlinggers Rules (Work in Progress):**
    *   Spend HP on abilities (Max 3 per match).
    *   Abilities like Splitter, Gravity, and Plastic are coming soon.
    *   Sudden Death mode planned for tie rounds.
*   **Dynamic Levels:** Random planets and gravity keep things fresh.
*   **Shot Tracers:** See your last 10 shots to dial in your aim.
*   **Keyboard Controls:** Aim with Left/Right arrows, set power with Up/Down.
*   **PWA Ready:** Install it on your device.

## 🚀 Getting Started

1.  Clone the repo: `git clone <your-repo-url> && cd ZapSlinggers`
2.  Install deps: `pnpm install`
3.  Run dev server: `pnpm run dev`

## 🔧 Current Status

We've got the core local gameplay loop working, including practice mode (best-of-3 rounds, scoring, etc.) and basic multiplayer where firing actions are synced over Nostr.

**What's Working:**
*   Physics, Firing, Gravity, Collisions
*   Random Level Generation
*   Shot Tracers
*   Practice Mode Logic
*   Nostr Login (`nostr-login`)
*   DM Challenges (`kind:4`)
*   Basic Fire Sync (`kind:30079`)
*   Updated Keyboard Controls

**What's Next:**
*   🎨 **Visuals:** Replacing placeholders with actual game sprites!
*   룰 **ZapSlinggers Rules:** Implementing ability effects, vulnerability, turns, sudden death.
*   🔗 **Multiplayer Sync:** Fully sync game state (collisions, turns, etc.).
*   💰 **Wagering:** Building the NUT-18 backend.
*   🔧 **Polish:** PWA setup, UI tweaks, testing.

*(See `src/docs/` for more details)*

## Nostr Notes

*   Uses NDK singleton pattern + `useNDKInit`.
*   Uses `ndk-hooks` for subscriptions like game actions.
*   Matchmaking is currently peer-to-peer via DMs (`kind:4`).
*   Game actions use ephemeral `kind:30079`.
*   Physics simulation runs client-side; sync currently only triggers actions.

## Tech Stack 🥞

*   [React](https://reactjs.org/)
*   [Vite](https://vitejs.dev/)
*   [TypeScript](https://www.typescriptlang.org/)
*   [@nostr-dev-kit/ndk](https://github.com/nostr-protocol/ndk)
*   [@nostr-dev-kit/ndk-hooks](https://github.com/nostr-protocol/ndk)
*   [nostr-login](https://github.com/nostrband/nostr-login)
*   [Matter.js](https://brm.io/matter-js/) (2D Physics)
*   [Tailwind CSS](https://tailwindcss.com/)
*   [vite-plugin-pwa](https://vite-pwa-org.netlify.app/)

---

_Built with Nostr and love (and maybe some eCash)._
