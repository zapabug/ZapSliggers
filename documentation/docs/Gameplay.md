# Zapsliggers: Gameplay Mechanics

This document outlines the core gameplay loop and dynamics for Zapsliggers.

**Current Status (Implementation):**
*   Core game state management and logic handlers (aim, fire, abilities, hit detection, round structure, scoring) extracted to `useGameLogic` hook.
*   `PracticeScreen` uses `useGameLogic` in `'practice'` mode. ***Status: Needs testing after refactor.*** Expected: Provides a turn-based local gameplay loop on a **2D Canvas** featuring:
    *   Best of 3 rounds format.
    *   Scoring based on round wins.
    *   HP tie-breaker if scores are tied after 3 rounds.
    *   Alternating starting player each round.
    *   Opponent profile display based on a predefined Npub.
    *   Keyboard controls updated: Left/Right for angle, Up/Down for power. Player 2 controls inverted.
*   `GameScreen` uses `useGameLogic` in `'multiplayer'` mode. **Successfully refactored and builds.** Allows simultaneous local control (each player controls their assigned ship). **Basic network sync for fire actions (`kind:30079`, `GameActionEvent` type) implemented within `useGameLogic` (publishing local fire, subscribing to/processing opponent's fire).**
*   Physics engine (`matter-js` via `useMatterPhysics` hook, called by `useGameLogic`) handles custom planetary gravity, collisions, projectile timeout, and dynamic viewport.
*   Random level generation (`useGameInitialization` hook, called by `useGameLogic`) places ships and planets/Sliggers.
*   Aiming controls (**Left/Right for angle, Up/Down for power** via UI/keyboard) and firing are functional (routed via `useGameLogic`). `setShipAim` in physics hook used.
*   Active/Historical shot tracers (`useShotTracers` hook, state managed by `useGameLogic`) are displayed.
*   Basic Zapsliggers rules are partially implemented within `useGameLogic`: HP system used as ability resource, ability selection UI/logic works, standard hits trigger win callback.
*   Nostr login (`useAuth`) is implemented.
*   Lobby screen (`LobbyScreen`) displays user ID and hosts the challenge component.
*   Nostr Challenge/Acceptance handshake (`ChallengeHandler`) via DMs (`kind:4`) successfully transitions both players to `GameScreen`.
*   **Remaining Implementation Focus:**
    *   **Testing:** Verify `PracticeScreen` functionality post-refactor. **Test basic multiplayer sync.**
    *   Nostr Network Synchronization for `GameScreen`: **Refine/complete action sync (aiming?), implement strict turn structure, sync collision results/game state.**
    *   Full Zapsliggers Rules: Ability effects (Splitter, Gravity, Plastic implementation), round/match win conditions (including Vulnerability), Sudden Death mechanics.
    *   Wagering: Payment integration (Cashu via Agent).
    *   Visuals: Rendering actual ship/planet sprites, particle effects.
    *   Testing: Especially network play reliability, mobile login, and rule interactions.

**1. Core Concept (Zapsliggers Target):**
   - A 2-player, turn-based space artillery game with **2D physics-based projectiles** affected by planet gravity.
   - Built for mobile-first experience, suitable for meetups. Rendered on an **HTML Canvas**.
   - Mandatory pre-paid wagering using eCash (NUT-18).

**2. Game Structure:**
   - **Format:** Best of 3 rounds. First player to win 2 rounds wins the match.
   - **Rounds:** Max 5 turns (shots) per player. Unresolved rounds go to Sudden Death.
   - **Levels:** Randomly generated planet layouts per round.
   - **Initial Ship Placement:** Randomly placed in side zones, facing each other.
   - **Pre-Game State:** Login -> `LobbyScreen` (Challenge/Practice).
   - **Planet Types & Gravity:**
     - Standard Planets: Solid, destroy projectiles. Spawn using factor-based centering horizontally, full initial view height vertically. Gravity based on `GRAVITY_CONSTANT` and `radius^2` proxy (requires tuning).
     - **Sliggers**: Special planets with unique attraction/repulsion physics based on `coreRadius` and factors (`SLIGGER_ATTRACTION/REPULSION_FACTOR`). Spawn randomly in edge zones outside initial view using `SLIGGER_BORDER_PADDING`. Destroy projectiles on collision. *(Logic implemented, requires tuning)*.
     - Gravity Strength: Controlled by `GRAVITY_CONSTANT` in settings.

**3. Turn Flow (Target: Simultaneous Turns - Approx. 60s):**
   - **A. Aiming Phase (Practice Mode: Turn-based, Multiplayer Mode: Simultaneous Local Input):**
     - Players aim concurrently.
     - Controls: Rotate ship (**Keyboard Left/Right**, Joystick), adjust Power (**Keyboard Up/Down**, Slider), select Ability (Buttons), Fire (Spacebar/Button). Aiming updates sent to `useGameLogic` which calls `physicsHandles.setShipAim`.
     - No trajectory preview.
     - Last 10 shot traces visible.
     - (Future: Submit move via Nostr `kind:30079` before timer ends).
   - **B. Resolution Phase (Currently Local/Immediate per Client):**
     - (Future: Triggered after both players submit moves or timer expires).
     - **Practice:** Projectile added for current player via `useGameLogic`. Turn switches after shot resolves. Collision detection determines round winner based on HP reduction (or self-hit). Logic within `useGameLogic` handles scoring, round advancement, tie-breakers, and alternating starting player.
     - **Multiplayer (Current):**
        - **Local Fire:** When local player fires, `useGameLogic` optimistically fires the projectile locally via `physicsHandles.fireProjectile`. It also publishes a `kind:30079` `GameActionEvent` (containing aim, power, ability) via Nostr and immediately switches the local turn to the opponent.
        - **Remote Fire:** `useGameLogic` subscribes to opponent's `kind:30079` events. When an opponent's 'fire' `GameActionEvent` is received, it updates the opponent's state (aim, HP cost), triggers their shot locally via `physicsHandles.fireProjectile`, and switches the local turn back to the player.
        - **Simulation:** **Physics simulation and collision results are currently calculated independently on each client.** A hit on one screen doesn't affect the other directly.
     - **Visuals:** Distinct projectile colors/trails. Ability visuals TBD. Active trail (solid line). *(Goal: Particles)*.
     - **Collision Detection (Local Implementation):**
       - Self-Hit: Instant round loss.
       - Opponent Hit (Standard): Triggers win callback (Target: Instant round win).
       - Opponent Hit (Ability): Triggers win callback (TEMP: Always wins round). Target: Win round *only if opponent is Vulnerable*.
       - Planet/Sligger Hit: Projectile removed.
       - Off-Screen / Timeout (45s): Projectile removed.
     - **Path Recording:** Handled by `useShotTracers`.
     - **World Update:** (Future: Moving planets update position).
   - **C. Post-Resolution / Next Turn Prep (Practice Mode / Future Multiplayer):**
     - Last 10 shot traces rendered.
     - **Practice:** Next turn starts after projectile resolves.
     - (Future: Check round/match win conditions based on Zapsliggers rules. Start next turn timer or proceed to Sudden Death/End Match).
   - **D. Sudden Death Phase (Target - End of Round 5 if no winner):**
     - Projectiles bounce off boundaries and planets.
     - Ships exert gravity.
     - First player hit loses the round.

**4. Key Dynamics:**
   - Simultaneous Turns (Target).
   *   Center-Point Gravity: Tuned force based on effective planet radius.
   - Last Shot Trace: Key aiming aid.
   - Client-Side Simulation (Target for Multiplayer): Ensure consistency.
   - Moving Planets (Future): Add dynamic challenge.
   - Randomized Gravity: Adds replayability.
   - Sudden Death (Target): Chaotic end-phase.

**5. Power-ups & Special Mechanics (Zapsliggers Target):**
   - **HP System:** Resource for abilities (start 100 HP).
   - **Ability Activation Cost:** 25 HP.
   - **Usage Limits:** Max 3 total abilities per player per *match*, max 1 of each *type* (`splitter`, `gravity`, `plastic`).
   - **Vulnerability:** Player becomes Vulnerable after using >= 2 abilities in a match.
   - **Available Abilities (Target Effects):**
     - **Splitter:** Splits into 3 fragments after ~1.5s.
     - **Gravity (Magnetic):** Attracted towards opponent ship.
     - **Plastic:** Less affected by planet gravity, higher air friction.
   - **Win Conditions:**
      - Standard Projectile Hit: Instant round win.
      - Ability Projectile Hit: Win round *only if opponent is Vulnerable*.
      - Self-Hit: Instant round loss.

**6. Specific Interactions (Target):**
   - Based on Zapsliggers win conditions (See 5).

**7. Visual Presentation & Camera:**
   - **Rendering:** 2D physics/logic, rendered onto **HTML Canvas**.
   - **Ship Appearance:** Currently triangles (Blue/Red). (Target: Sprites).
   - **Aspect Ratio Handling:** Letterboxing/Pillarboxing to maintain 2400x1200 virtual aspect ratio.
   - **Camera Control:** Dynamic pan/zoom implemented (`useDynamicViewport`).
   - **Player Orientation:** Ships rotate directly based on input.
   - **Aesthetic:** Sci-Fi mechanical contraption (Da Vinci/Trebuchet) via 2D sprites/vectors.
   - **Future Enhancement:** 2D sprite animations.

**8. Additional Notes:**
   - Focus on balance, replayability, mobile-first.
   - Nostr Communication (Target): Moves via `kind:30079`, Challenges via `kind:4`.
   - Wagering (Target): Mandatory NUT-18.