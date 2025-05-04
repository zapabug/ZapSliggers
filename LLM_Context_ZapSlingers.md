# LLM Context Dump: ZapSlingers Project

**Date:** YYYY-MM-DD HH:MM

**Objective:** Provide a comprehensive context package for the ZapSlingers project, suitable for onboarding an LLM or developer.

**1. Project Goal & Core Concept:**

ZapSlingers is a 2-player, turn-based steampunk space artillery game. It features physics-based projectiles influenced by standard planets and unique **Sliggers** (special planets, typically placed at map edges, with distinct attraction/repulsion zones), rendered on an HTML Canvas. The game emphasizes a physics-grounded steampunk aesthetic, utilizes Nostr for matchmaking and basic gameplay communication, and is designed with a mobile-first approach.

**2. Planning & Decision Summary (See @<documentation/docs/Planning.md> for full history):**

*   **Origin:** Branched from the "Zapsliggers" concept.
*   **Initial Ideas:** Explored a viewer-interaction feature using Nostr zaps for a "streaming chaos" mode (Deferred to future enhancement).
*   **Theme Evolution:**
    *   Initial: Standard space artillery.
    *   Explored: Steampunk vs. Cyberpunk contrast.
    *   Explored: Steampunk Cosmic Pirates with whirlpools (Deemed too arcadey).
    *   **Final Theme:** Steampunk Contraptions vs. Space Physics (Planets & Gas Giants).
*   **Key Mechanic Decisions:**
    *   **Sliggers (Formerly Gas Giants):** Implemented as single physics bodies with conditional attraction/repulsion logic based on distance from the core. Spawn randomly in designated edge zones, separate from standard planets in the central area. *(Physics logic pending in `useMatterPhysics.ts`, Initialization logic pending in `useGameInitialization.ts`)*.
    *   **Boundaries:** Destructive by default, with a configurable setting (`gameSettings.ts`) to enable bouncing for sandbox/future modes.
    *   **Abilities:** Final names chosen: `ZapSplits` (Splitter), `Magnetar` (Gravity/Magnetic), `Gyro` (Plastic). HP (25) cost and usage limits (3 total/1 per type per match) remain.
    *   **UX:** No intro pop-up, no tooltips. Added explicit end-of-round score display (e.g., "1 - 0").

**3. Final Low-Level Design (LLD):**

*   The **definitive LLD (LLD 1)** detailing the target state, features, tech stack, file structure, setup, and implementation notes is located in:
    *   @<documentation/docs/Build.md>

**4. Essential Supporting Documentation Files (@<link> format):**

To provide full context, ensure the system processes the following links along with this summary and @<documentation/docs/Build.md>:

*   @<documentation/docs/Planning.md> : Complete history of the brainstorming and decision-making process.
*   @<documentation/docs/Gameplay.md> : Describes the original core game mechanics, rules, and systems.
*   @<documentation/docs/Gamemodes.md> : Outlines the different game modes/screens.
*   @<documentation/docs/layout.md> : **Crucial** for understanding the existing project structure, key components, and custom hooks.

**(Optional but potentially helpful):**

*   @<documentation/docs/useAuth.md> / @<documentation/docs/useNDKInit.md> : Detailed specifics of the Nostr authentication flow.
*   (Consider linking the actual code file `@<src/config/gameSettings.ts>` if your system supports linking code files)

**5. Instructions for LLM/Developer:**

1.  Start with this `LLM_Context_ZapSlingers.md` overview.
2.  Refer to @<documentation/docs/Build.md> for the detailed **target LLD**.
3.  Consult @<documentation/docs/Planning.md> to understand the rationale behind decisions.
4.  Use @<documentation/docs/layout.md> to understand the existing code structure and component responsibilities.
5.  Use @<documentation/docs/Gameplay.md> and @<documentation/docs/Gamemodes.md> for foundational rules and mode descriptions.
6.  Implement features according to the LLD, placing code within the structure outlined in @<documentation/docs/layout.md>. Modify hooks like `useMatterPhysics` (for **Sligger** attraction/repulsion) and `useGameInitialization` (for **Sligger** placement and labeling) as specified in the LLD and `solutions.md` plan.

--- 