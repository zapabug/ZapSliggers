# Nostr Slingshot: Gameplay Mechanics
# Klunkstr: Gameplay Mechanics

*(Inspired by the original Slingshot game located at `/home/jq/gitshit/slingshot`, which can be run with `PYTHONPATH=src python3 src/bin/slingshot`)*

This document outlines the core gameplay loop and dynamics for Nostr Slingshot, focusing on the player experience.
This document outlines the core gameplay loop and dynamics for Klunkstr, focusing on the player experience.

**Current Status (Implementation):** Basic UI structure exists (`GameScreen`, `PlayerHUD`, `AimingInterface`, `ActionButtons`). `matter-js` engine initialized in `GameRenderer` with random positioning. Ship rotation/power controls functional. Projectile firing functional. Custom planetary gravity, basic collisions, projectile timeout, dynamic camera zoom, NIP-07 login, and `LobbyScreen`/`ChallengeHandler` are functional. Aiming state synchronization across turns implemented. **Active projectile trails (solid line) and historical shot traces (last 10 shots, dashed lines) implemented via `useShotTracers` hook.** Klunkstr rules (HP, abilities, etc.), turns, full asset rendering, and practice mode logic are **not yet implemented.**

**1. Core Concept:**
   - A 2-player, turn-based space artillery game with physics-based projectiles affected by planet gravity.
   - Built for mobile-first experience, suitable for meetups.
   - Mandatory pre-paid wagering using eCash (NUT-18).

**2. Game Structure:**
   - **Format:** Best of 3 rounds. The first player to win 2 rounds wins the match.
   - **Rounds:** Each round consists of a maximum of 5 turns (shots) per player. If no winner is decided after 5 turns, a "Sudden Death" phase occurs (see Section 3.D).
   - **Levels:** Multiple levels with varying planet layouts and potentially moving planets. Levels are randomly generated or selected for each **round**.
     - **Planet Placement:** Planets are generated randomly within a central zone (currently the middle 80%) of the virtual game area, respecting minimum distances from ships and other planets.
   - **Initial Ship Placement:** Ships are placed randomly within designated left/right starting zones at the beginning of each round, ensuring a minimum separation distance between them.
   - **Pre-Game State:** After login, players land in the `LobbyScreen`. From here they can manage challenges (via DMs) or initiate a single-player practice mode.
   - **Planet Types & Gravity:**
     - **Standard Planets:** Solid bodies. Projectiles are destroyed on impact.
     - **Gas Giants:** Larger, less dense appearance. Projectiles pass through the outer layers but are destroyed if they hit the solid "core" (a smaller central hitbox).
     - **Gravity Strength:** A planet's gravitational pull is proportional to its size/dimensions (larger planets pull harder) and is randomized within level-defined limits.

**3. Turn Flow (Simultaneous Turns - Approx. 60s):**
   - **A. Aiming Phase:**
     - Both players aim concurrently within the turn timer.
     - UI provides a simple aiming indicator (e.g., line/vector showing direction and power magnitude).
     - UI is presented as overlays on the main game screen, including aiming controls (sliders/joystick), ability selectors, and player HUDs.
     - **No real-time simulated trajectory preview** is shown during aiming.
     - The static traces of the player's **last 10 shots** remain visible as visual references (see "Last Shot Trace").
     - Players finalize and submit their `{ angle, power }` move before the timer ends (or via a "Ready" confirmation). (Submission uses Nostr `kind:30079` in the full game).
   - **B. Resolution Phase:**
     - Occurs once both players have submitted their moves or the timer expires.
     - **Simultaneous Firing:** Both players' projectiles are added to the `Matter.js` physics simulation at the same time step.
     - **Visuals:**
       - Projectiles have distinct colors/trails (e.g., P1 Blue, P2 Red).
       - **Active Trail:** A solid colored line follows the projectile as it flies. *(Goal: Change to particle/smoke effect)*.
       - Abilities may alter projectile appearance.
     - **Simulation:** The physics engine runs, calculating projectile paths under the influence of planetary gravity (acting towards planet centers).
     - **Collision Detection:** Hits (projectile-ship), misses (projectile-planet, off-screen) are detected. Scores/health updated. Projectiles are removed upon collision/exit.
     - **Path Recording:** The sequence of positions for each projectile during this phase is recorded *(handled by `useShotTracers` hook)*.
     - **World Update:** Any moving planets update their positions according to their predefined paths for the next turn.
   - **C. Post-Resolution / Next Turn Prep:**
     - **Last Shot Trace:** The recorded paths from the **last 10 completed shots for each player** are rendered as static, dashed visual traces on the **2D canvas**. These traces persist across turns, serving as an aiming guide. *(Implementation uses `useShotTracers` hook and state management)*.
     - Round/Game State Check: Determine if the round or match has ended based on shots taken or win conditions.
     - The next Aiming Phase begins.
   - **D. Sudden Death Phase (End of Round 5 if no winner):**
     - **Activation:** Occurs automatically after the 5th turn's resolution if no player won.
     - **Projectile Behavior (5th Turn Projectiles Only):**
       - **Boundary Interaction:** Projectiles **bounce** off play area boundaries instead of being removed.
       - **Planet Interaction:** Projectiles **bounce** off Standard Planets and Gas Giant Cores instead of being removed. They still pass through Gas Giant outer layers.
     - **Ship Gravity Activation:** Both player ships begin exerting their own gravitational pull on the bouncing projectiles.
     - **Winning Condition:** The simulation continues. The *first* player whose ship is hit by *any* bouncing projectile **loses the round**.

**4. Key Dynamics:**
   - **Simultaneous Turns:** Both players act within the same time window, adding tension and removing first-player advantage within a turn.
   *   **Center-Point Gravity:** Projectiles curve towards the center of planets based on their mass/gravity strength.
   - **Last Shot Trace:** Aiming relies on referencing the outcomes of previous shots (up to the last 10 per player, shown as dashed lines).
   - **Client-Side Simulation:** Each client runs the *same* physics simulation locally using the confirmed moves received via Nostr, ensuring consistent outcomes if inputs and starting conditions are identical.
   - **Moving Planets:** Add dynamic challenge, requiring players to anticipate future positions (aided by predicted path display at round start).
   - **Randomized Gravity:** Adds replayability to levels.
   - **Sudden Death:** Creates a chaotic end-phase for drawn rounds.

**5. Power-ups & Special Mechanics:**
   - **Health Points (HP):** Players have a health pool, reduced by opponent hits.
   - **HP for Power-ups:** During the Aiming Phase, players can spend a fixed amount of their current HP to activate specific power-ups/abilities for their upcoming shot or turn.
   - **Usage Limits:** Each specific power-up/ability type can only be used **once per player per match**. A player can use a maximum of **3 power-ups/abilities in total** per match.
   - **Projectile Collision Default:** Normally, player projectiles pass through each other (no projectile-projectile collision).
   - **Available Abilities (Cost HP, Examples):**
     - **1. Diamond Tip Arrow:**
       - **Activation:** Select during Aiming Phase.
       - **Effect:** The activated projectile can collide with the opponent's standard projectile.
       - **Collision Result:** The opponent's projectile is deflected. The Diamond Tip projectile continues on its original path, unaffected by the projectile collision (but still affected by gravity).
       - **Visuals:** Diamond Tip projectile should be visually distinct.
     - **2. Triple Shot Arrow:**
       - **Activation:** Select during Aiming Phase (Likely higher cost).
       - **Effect:** Fires three projectiles simultaneously in a narrow spread. Each deals reduced damage.
       - **Use:** Increases hit probability, area denial.
     - **3. Explosive Arrow:**
       - **Activation:** Select during Aiming Phase.
       - **Effect:** Deals standard damage on direct hit. Creates an Area of Effect (AoE) explosion upon any impact (planet, terrain). If the explosion occurs near the opponent, they take AoE damage.
       - **Use:** Area denial, damaging opponents near cover.
       - **Visuals:** Visually distinct projectile (e.g., glowing tip), explosion effect on impact.
     - **4. Lead Tipped Arrow:**
       - **Activation:** Select during Aiming Phase.
       - **Effect:** Projectile is significantly more affected by gravity, enabling tighter turns around planets. Standard damage.
       - **Use:** High-skill trick shots around obstacles.
       - **Visuals:** Darker/heavier arrow appearance.

**6. Specific Interactions:**
   - **Diamond Tip vs. Standard Arrow:** Diamond Tip deflects Standard Arrow; Diamond Tip path unaffected.

**7. Visual Presentation & Camera:**
   - **Rendering:** Game logic and physics are 2D, but the visual presentation is rendered in **3D** (using libraries like `three.js` / `react-three-fiber`). This allows for more engaging visuals and cinematic camera movements.
   - **Camera Control (Resolution Phase):**
     - The 3D camera dynamically adjusts focus and zoom after shots are fired.
     - **Focus:** Camera tends to frame/focus on the player currently taking more damage or at lower health.
     - **Zoom:** Camera zooms out automatically if projectiles travel far outside the main play area to maintain visibility.
   - **Player Orientation:** Player ships/launchers maintain a fixed orientation throughout the match, always facing the opponent's starting position. Aiming adjustments rotate the weapon/launcher part, not the base.
   - **Aesthetic:** Sci-Fi theme, but visually inspired by intricate mechanical contraptions (like futuristic Da Vinci machines or trebuchets) rather than sleek minimalism.
   - **Future Enhancement (Animation):** Add detailed 3D animations for the launcher contraption, potentially showing a stylized figure or mechanism going through the motions of loading (e.g., adding gunpowder, placing projectile) and reloading after firing. (Pinned for later implementation).

**8. Additional Notes:**
   - **Gameplay Balance:** The game is designed to be balanced between players, with no inherent advantage to starting first or second.
   - **Replayability:** Levels are designed to be replayable, with different layouts and gravity strengths each time.
   - **Game Length:** Each round is designed to be completed within a reasonable time frame, with a maximum of 3 rounds per match.
   - **Game Over:** The game ends when one player reaches 0 health or the match reaches the best-of-3 series win condition.
   - **Game Rules:** The game rules are designed to be clear and consistent, with no hidden rules or unfair advantages.
   - **Game Design:** The game design is inspired by classic space games and modern artillery games, with a focus on physics-based gameplay and strategic planning.
   - **Game Development:** The game is developed using modern game development tools and libraries, with a focus on performance and visual quality.
   - **Game Testing:** The game is tested extensively to ensure that it is balanced and fun to play.
   - **Game Updates:** The game is updated regularly to add new levels, power-ups, and other features.
   - **Game Community:** The game has a growing community of players and developers, with a focus on collaboration and shared learning.
   - **Model Placeholders:** Created basic geometry placeholders for launchers (ship-like) and planets (sphere + ring). Added aiming rotation to launcher model.
   - **UI Refinements:** Improved AimingInterface with sliders. Fixed PlayerHUD profile loading.
   - **App Layout:** Refined main layout in App.tsx.

# Klunkstr: Gameplay Mechanics

*(Inspired by the original Slingshot game located at `/home/jq/gitshit/slingshot`, which can be run with `PYTHONPATH=src python3 src/bin/slingshot`)*

This document outlines the core gameplay loop and dynamics for **Klunkstr**.
**Note:** The initial development phase focuses on first replicating the simpler core mechanics of the *original* Slingshot game (attraction gravity based on planet size, projectiles destroyed on planet impact, no aiming preview, short projectile lifespan) using the modern tech stack. The specific Klunkstr rules detailed below (HP system, abilities, Vulnerability, Sudden Death, etc.) will be layered on top of this foundation.

**Current Status (Implementation):**
*   Basic UI structure exists (`LobbyScreen`, `GameScreen`, `PlayerHUD`, `AimingInterface`, `ActionButtons`).
*   `LobbyScreen` now hosts `LobbyPlayground`, providing an interactive single-player simulation based on the current simplified gameplay.
*   `matter-js` engine initialized in `GameRenderer` and `useMatterPhysics` with random positioning.
*   Ship rotation/aiming/firing functional in both `LobbyPlayground` and `GameScreen`.
*   Custom planetary gravity, basic projectile-planet/boundary collisions, projectile timeout, dynamic camera zoom are functional (`useMatterPhysics`).
*   NIP-07 login integrated.
*   `ChallengeHandler` handles basic DM challenges.
*   Active/historical shot traces functional (`useShotTracers`).
*   **Klunkstr Rules Progress:**
    *   **Implemented Abilities:** `splitter`, `gravity`, `plastic` projectiles are selectable and have physics effects implemented in `useMatterPhysics`.
    *   **HP System:** HP (`playerHp` state) functions as player health, reduced on hit. Initial HP is 100.
    *   **Ability Selection/UI:** Logic exists in `GameScreen.tsx` and `ActionButtons.tsx` for selecting abilities. Abilities can only be used once per turn (UI disabled after selection).
    *   **Round Win Condition:** Logic implemented in `GameScreen.tsx`:
        *   Standard projectile hit deals 100 damage (instant win/knockout).
        *   Ability projectile hit deals 50 damage.
        *   Hitting yourself results in an instant round loss.
        *   A round ends when a player's HP reaches 0 or below due to damage.
    *   Match structure (Best of 3 rounds score tracking) implemented.
*   **Remaining Implementation:**
    *   **Target Klunkstr Rules (If Pursued):** Refactor HP to be solely an ability resource, implement ability costs, implement match-level ability limits (3 total, 1 per type), implement Vulnerability state, and implement the associated target win conditions.
    *   Physics effects for Gas Giants (pass-through outer layer).
    *   Turn limits per round (currently unlimited, target is 5 per player).
    *   Sudden Death phase mechanics (if round ends without winner).
    *   Full asset rendering (using sprites/better visuals instead of basic shapes).
    *   Practice mode button functionality.
    *   Nostr integration for game state synchronization (`kind:30079` moves) and the public lobby/payment flow.
    *   NUT-18 wagering integration.

**1. Core Concept (Klunkstr Target):**
   - A 2-player, turn-based space artillery game with **2D physics-based projectiles** affected by planet gravity.
   - Built for mobile-first experience, suitable for meetups. Rendered on an **HTML Canvas**.
   - Mandatory pre-paid wagering using eCash (NUT-18).

**2. Game Structure:**
   - **Format:** Best of 3 rounds. The first player to win 2 rounds wins the match.
   - **Rounds:** Each round consists of a maximum of 5 turns (shots) per player. If no winner is decided after 5 turns, a "Sudden Death" phase occurs (see Section 3.D).
   - **Levels:** Multiple levels with varying planet layouts and potentially moving planets. Levels are randomly generated or selected for each **round**.
   - **Initial Ship Placement:** Ships are placed randomly within designated left/right starting zones at the beginning of each round, ensuring a minimum separation distance between them. **Ships initially face each other (Player 1 points right, Player 2 points left).**
   - **Pre-Game State:** After login, players land in the `LobbyScreen`. From here they can manage challenges (via DMs) or initiate a single-player practice mode.
   - **Planet Types & Gravity:**
     - **Standard Planets:** Solid bodies. Projectiles are destroyed on impact.
     - **Gas Giants:** Larger, less dense appearance. Projectiles pass through the outer layers but are destroyed if they hit the solid "core" (a smaller central hitbox).
     - **Gravity Strength:** A planet's gravitational pull is proportional to its size/dimensions (larger planets pull harder) and is randomized within level-defined limits.

**3. Turn Flow (Simultaneous Turns - Approx. 60s):**
   - **A. Aiming Phase:**
     - Both players aim concurrently within the turn timer.
     - **Aiming Controls:** Players rotate their ship directly using **keyboard arrow keys (Up/Down)** or the **on-screen joystick (drag)**. Power is adjusted using **keyboard arrow keys (Left/Right)** or the **power slider**. (`GameScreen.tsx`, `AimingInterface.tsx`).
     - **Firing:** Players fire by pressing **Spacebar** or the **Fire button**. The projectile is launched straight forward from the ship's current orientation with the selected power. (`ActionButtons.tsx`, `GameScreen.tsx`).
     - **No real-time simulated trajectory preview** is shown during aiming.
     - The static traces of the player's **last 10 shots** remain visible as visual references (see "Last Shot Trace").
     - Players finalize and submit their `{ power }` move (angle is implicit in ship rotation) and chosen ability (if any) before the timer ends. (Nostr submission TBD).
   - **B. Resolution Phase:**
     - Occurs once both players have submitted their moves or the timer expires.
     - **Simultaneous Firing:** Both players' projectiles are added to the `Matter.js` physics simulation at the same time step.
     - **Visuals:**
       - Projectiles have distinct colors/trails. Abilities may alter projectile appearance.
       - **Active Trail:** A solid colored line follows the projectile as it flies. *(Goal: Change to particle/smoke effect)*.
     - **Simulation:** The physics engine runs, calculating projectile paths under the influence of planetary gravity (acting towards planet centers, strength based on size).
     - **Collision Detection (Current Implementation):**
       - **Self-Hit:** Player whose projectile hits their own ship instantly loses the round.
       - **Opponent Hit (Standard Projectile):** Deals 100 damage. If opponent HP drops to 0 or below, firing player wins the round.
       - **Opponent Hit (Ability Projectile - `splitter`, `gravity`, `plastic`):** Deals 50 damage. If opponent HP drops to 0 or below, firing player wins the round.
       - **Planet Hit (Standard Planet / Gas Giant Core):** Projectile is destroyed and removed. *(Implemented)*.
       - **Planet Hit (Gas Giant Outer Layers):** *(Logic TBD - Currently destroys projectile)*.
       - **Off-Screen / Timeout:** Projectile is removed after 45 seconds or if it leaves a very large boundary. *(Implemented)*.
       - **Projectile-Projectile:** Default pass-through.
     - **Path Recording:** The sequence of positions for each projectile during this phase is recorded *(handled by `useShotTracers` hook)*.
     - **World Update:** Any moving planets update their positions.
   - **C. Post-Resolution / Next Turn Prep:**
     - **Last Shot Trace:** The recorded paths from the **last 10 completed shots for each player** are rendered as static, dashed visual traces on the **2D canvas**. These traces persist across turns, serving as an aiming guide. *(Implementation uses `useShotTracers` hook and state management)*.
     - **Round/Game State Check:** Determine if the round or match has ended based on win conditions (knockout or self-hit). If Turn 5 ends with no winner (Turn limit TBD), proceed to Sudden Death (TBD). Otherwise, start the next Aiming Phase.
   - **D. Sudden Death Phase (End of Round 5 if no winner):**
     - **Activation:** Occurs automatically after the 5th turn's resolution if no player won.
     - **Projectile Behavior (5th Turn Projectiles Only):**
       - **Boundary Interaction:** Projectiles **bounce** off play area boundaries instead of being removed.
       - **Planet Interaction:** Projectiles **bounce** off Standard Planets and Gas Giant Cores instead of being removed. They still pass through Gas Giant outer layers.
     - **Ship Gravity Activation:** Both player ships begin exerting their own gravitational pull on the bouncing projectiles.
     - **Winning Condition:** The simulation continues. The *first* player whose ship is hit by *any* bouncing projectile **loses the round**.

**4. Key Dynamics:**
   - **Simultaneous Turns:** Both players act within the same time window.
   *   **Center-Point Gravity:** Projectiles curve towards planet centers. Strength scales with an effective radius (base radius plus a bonus factor related to planet size) making larger planets slightly more influential at range. Gravity weakens with distance (`~ effectiveRadius / Distance^2`).
   - **Last Shot Trace:** Aiming relies on referencing the outcomes of previous shots (up to the last 10 per player, shown as dashed lines).
   - **Client-Side Simulation:** Ensures consistent outcomes based on Nostr-communicated moves.
   - **Moving Planets:** Add dynamic challenge.
   - **Randomized Gravity:** Adds replayability.
   - **Sudden Death:** Creates a chaotic end-phase for drawn rounds.

**5. Power-ups & Special Mechanics (Current Simple Implementation):**
   - **Health Points (HP):** Players start each **round** with 100 HP. HP is reduced by opponent hits. Reaching 0 HP results in a round loss.
   - **Ability Activation Cost:** None currently implemented.
   - **Usage Limits:** Abilities (`splitter`, `gravity`, `plastic`) can be selected once per turn. No match-level limits.
   - **Vulnerability:** Not implemented.
   - **Projectile Collision Default:** Projectiles pass through each other.
   - **Available Abilities (Current Implementation):** *(Selection logic in `GameScreen.tsx`, UI in `ActionButtons.tsx`, Physics in `useMatterPhysics.ts`)*
     - **1. Splitter Projectile:**
       - **Effect:** After a delay (~1.5s), the projectile splits into three smaller fragments.
       - **Damage on Hit:** 50 HP.
     - **2. Gravity Projectile (Magnetic):**
       - **Effect:** Attracted towards the opponent's ship within a certain range. Slightly increased air friction.
       - **Damage on Hit:** 50 HP.
     - **3. Plastic Projectile:**
       - **Effect:** Less affected by planetary gravity. Higher air friction.
       - **Damage on Hit:** 50 HP.

**6. Specific Interactions (Current Implementation):**
   - **Standard Projectile vs. Player:** Deals 100 damage. If HP <= 0, target loses round.
   - **Ability Projectile vs. Player:** Deals 50 damage. If HP <= 0, target loses round.
   - **Self-Hit:** Instantly lose the round.

**7. Visual Presentation & Camera:**
   - **Rendering:** 2D physics/logic, rendered directly onto an **HTML Canvas using 2D drawing APIs**. We will use sprites or simple shapes for planets, launchers, and projectiles. The virtual coordinate system uses a wider aspect ratio (2400x1200).
   - **Ship Appearance:** Ships are currently rendered as **simple triangles** (slightly larger than initial implementation) with distinct colors (Player 1 Blue, Player 2 Red). Placeholder sprites/models TBD.
   - **Aspect Ratio Handling:** The game view automatically adapts to different screen aspect ratios. It scales the 2400x1200 virtual view to fit the screen, adding black bars (letterboxing/pillarboxing) as necessary to maintain the intended aspect ratio and center the content.
   - **Camera Control (View Panning/Zoom):** Implemented basic dynamic view panning and zooming on the 2D canvas.
     - **Focus:** Pans/zooms to keep projectiles and ships within view.
     - **Zoom:** Zooms out automatically if projectiles/ships travel far apart. The view will always show at least 50% of the virtual game area (minimum zoom factor is 2x). The default view (when no projectiles are active) shows approximately 60% of the virtual area. The transition between zoom levels is smoothed (lerped).
   - **Player Orientation:** **Player ships rotate directly based on aiming input (keyboard/joystick).** They start facing each other. Projectiles are fired relative to the ship's current forward direction.
   - **Aesthetic:** Sci-Fi theme, visually inspired by intricate mechanical contraptions (Da Vinci/Trebuchet) translated into 2D sprites or vector art.
   - **Future Enhancement (Animation):** Add detailed 2D sprite animations.

**8. Additional Notes:**
   - **Balance:** Aimed for fairness.
   - **Replayability:** Random levels/gravity.
   - **Game Length:** Best of 3 rounds, max 5 turns + Sudden Death per round.
   - **Game Over:** Match ends when a player wins 2 rounds.
   - **Nostr Communication:** Moves via `kind:30079`.
   - **Wagering:** Mandatory NUT-18 pre-paid escrow.
   - **Model Placeholders:** Basic 2D shapes/sprites will be used initially (currently triangles for ships, circles for planets).
   - **UI Refinements:** `AimingInterface` provides a **functional joystick** for angle and a slider for power. `ActionButtons` provides fire/ability buttons. `PlayerHUD` displays info. Keyboard controls also available for aiming/power/firing.
   - **App Layout:** Horizontal full-screen view.