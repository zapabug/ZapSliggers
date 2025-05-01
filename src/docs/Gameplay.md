# Klunkstr: Gameplay Mechanics

This document outlines the core gameplay loop and dynamics for Klunkstr.

**Current Status (Implementation):**
*   Core gameplay loop for local play is functional on a **2D Canvas**.
*   Physics engine (`matter-js` via hooks) handles custom planetary gravity (size-based), basic collisions (planet/boundary), projectile timeout, and dynamic viewport.
*   Random level generation (`useGameInitialization`) places ships and planets.
*   Aiming controls (rotation/power via UI/keyboard) and firing are functional.
*   Active/Historical shot tracers (`useShotTracers`) are displayed.
*   Basic Klunkstr rules are partially implemented: HP system used as ability resource, ability selection UI/logic works, standard hits trigger win callback.
*   Nostr login (`useAuth`) is implemented.
*   Lobby screen with interactive playground (`LobbyScreen`/`LobbyPlayground`) exists.
*   Basic challenge handling (`ChallengeHandler`) via Nostr DMs implemented.
*   **Remaining Implementation Focus:** Full Klunkstr rules (ability effects, win conditions, turns, Sudden Death), Nostr integration (matchmaking flow, turn sync), payment integration (NUT-18), rendering actual assets, and testing (especially mobile login).

**1. Core Concept (Klunkstr Target):**
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
     - Standard Planets: Solid, destroy projectiles.
     - Gas Giants (Future): Pass-through outer layers, solid core.
     - Gravity Strength: Proportional to effective planet size, randomized per level.

**3. Turn Flow (Target: Simultaneous Turns - Approx. 60s):**
   - **A. Aiming Phase (Currently Local/Untimed):**
     - Players aim concurrently.
     - Controls: Rotate ship (Keyboard Up/Down, Joystick), adjust Power (Keyboard Left/Right, Slider), select Ability (Buttons), Fire (Spacebar/Button).
     - No trajectory preview.
     - Last 10 shot traces visible.
     - (Future: Submit move via Nostr `kind:30079` before timer ends).
   - **B. Resolution Phase (Currently Local/Immediate):**
     - (Future: Triggered after both players submit moves or timer expires).
     - Projectiles added to simulation simultaneously.
     - **Visuals:** Distinct projectile colors/trails. Ability visuals TBD. Active trail (solid line). *(Goal: Particles)*.
     - **Simulation:** Physics engine calculates paths under planetary gravity.
     - **Collision Detection (Current Implementation):**
       - Self-Hit: Instant round loss.
       - Opponent Hit (Standard): Triggers win callback (Target: Instant round win).
       - Opponent Hit (Ability): Triggers win callback (Target: Win round if opponent Vulnerable).
       - Planet Hit (Standard/Gas Core): Projectile removed.
       - Off-Screen / Timeout (45s): Projectile removed.
     - **Path Recording:** Handled by `useShotTracers`.
     - **World Update:** (Future: Moving planets update position).
   - **C. Post-Resolution / Next Turn Prep:**
     - Last 10 shot traces rendered.
     - (Future: Check round/match win conditions based on Klunkstr rules. Start next turn timer or proceed to Sudden Death/End Match).
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

**5. Power-ups & Special Mechanics (Klunkstr Target):**
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
   - Based on Klunkstr win conditions (See 5).

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