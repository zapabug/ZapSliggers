
Okay, here is the content of `solution.md` as I remember it from our earlier discussion:

# Debugging Summary: Projectile NaN/Visibility Issue

## Problem Description

After introducing changes related to Gas Giant planets (initially modeled with overlapping inner/outer bodies), projectiles fired by players became invisible immediately. Console logging revealed that the projectile's physics state (`position` and `velocity`) was turning into `NaN` (Not a Number) shortly after being added to the Matter.js world.

## Debugging Process Summary

1.  **Initial Suspects:** The Gas Giant implementation (overlapping static bodies, repulsion logic) and the dynamic camera (`useDynamicViewport`, which was causing separate zoom/freeze issues) were primary suspects.
2.  **Isolating Variables:**
    *   Disabling the dynamic camera fixed the zoom/freeze but **not** the projectile `NaN`/invisibility. A static renderer transform was implemented as a stable baseline.
    *   Various attempts to disable/simplify the Gas Giant inner core body, including switching to a single-body representation, did **not** resolve the `NaN` issue on their own, indicating a deeper problem.
3.  **Log Analysis:** Extensive `console.log` statements were added to trace the projectile lifecycle:
    *   `fireProjectile` (`useMatterPhysics.ts`): Confirmed valid initial position/velocity *before* adding to world.
    *   `updateProjectilesAndApplyGravity` (`useMatterPhysics.ts`): Revealed `NaN` appeared during the *first* physics update tick. Logging forces showed `Body.applyForce` was being called with `Infinity`.
    *   Gravity Calculation Inputs: Logging values just before the force calculation pinpointed `staticBody.mass` as being `Infinity`.
4.  **Root Cause Identified:** The fundamental issue was using `staticBody.mass` in the gravitational force formula: `baseGravityMagnitude = ... * staticBody.mass * ... / distanceSq`. Matter.js sets the `mass` of static bodies (`isStatic: true`) to `Infinity`. Multiplying by this infinite mass resulted in infinite forces, instantly corrupting the simulation state to `NaN`.

## Solution Implemented

The gravity calculation within the `updateProjectilesAndApplyGravity` function in `src/hooks/useMatterPhysics.ts` was modified:

*   It **stopped** using `staticBody.mass`.
*   It now retrieves the planet's radius from plugin data: `const planetRadius = staticBody.plugin?.ZapSlinggers?.radius;`
*   It uses `radius * radius` as a proxy for gravitational mass in the force formula:
    `const gravitationalMassProxy = planetRadius * planetRadius;`
    `const baseGravityMagnitude = scaleFactor * GRAVITY_CONSTANT * gravitationalMassProxy * projectileBody.mass / distanceSq;`

## Outcome

Replacing the infinite `staticBody.mass` with the finite `radius * radius` proxy resolved the infinite force calculation and the resulting `NaN` state. Projectiles are now visible and the core physics simulation is stable.

## Related Fixes During Debugging

*   Implemented a static rendering transform in `GameRenderer.tsx` as a workaround for dynamic camera instability.
*   Updated the collision handler (`handleCollisions` in `useMatterPhysics.ts`) to recognize the `planet_gas_outer` label used for the single-body Gas Giant representation.
*   Updated the renderer (`drawPlanet` in `GameRenderer.tsx`) to visually distinguish `planet_gas_outer` bodies.

## Next Steps (Post-Fix)

*   Investigate and address the reported "weirdness" in game physics/visuals.
*   Tune `GRAVITY_CONSTANT` and the gravity formula (e.g., `radius` vs `radius*radius`) if needed, now that gravity is radius-based.
*   Re-implement Gas Giant repulsion logic mathematically using the single-body approach.
*   Re-evaluate enabling the dynamic camera.

## Explanation of Calculation Differences (`solution.md` Addendum)

1.  **The Problematic Approach (Using `staticBody.mass`):**
    *   **Calculation:** `Force ~ GRAVITY_CONSTANT * staticBody.mass * projectileBody.mass / distanceSq`
    *   **Why it Broke:** In Matter.js, static bodies (`isStatic: true`) have `mass` set to `Infinity`. Multiplying the force equation by infinity resulted in `Infinity` forces, which immediately broke the physics simulation and led to `NaN` (Not a Number) values for position and velocity.
    *   **Result:** Projectiles disappeared instantly.

2.  **The Current Fix (Using `radius^2` as Proxy):**
    *   **Calculation:** `Force ~ GRAVITY_CONSTANT * (planetRadius * planetRadius) * projectileBody.mass / distanceSq`
    *   **Why it Works:** It replaces the infinite `mass` with a finite value derived from the planet's size (`radius^2`). This prevents the `Infinity` calculation and allows the simulation to run without producing `NaN` values.
    *   **Side Effects ("Weirdness"):**
        *   **Tuning:** The `GRAVITY_CONSTANT` (currently `0.35`) was likely chosen arbitrarily or based on the old, broken calculation. It's almost certainly not tuned correctly for a gravity force proportional to `radius^2`. This likely makes gravity feel too weak, too strong, or just *different* than intended, causing projectiles to seem too fast or slow.
        *   **Scaling:** Gravity now scales quadratically with the planet's radius. A planet twice as wide has four times the pull. This might differ from the intended "feel".

## Plan for Proper Gravity/Repulsion Calculation (Single Body Gas Giants)

Here's a step-by-step plan to implement the desired mechanics, building on the current stable state (single-body Gas Giants, radius-based gravity fix):

**Goal:**
*   Standard planets have tunable, radius-based attraction.
*   Gas Giants (`planet_gas_outer`) have radius-based attraction *outside* their core and strong, limited-range repulsion *inside* their core.

**Steps:**

1.  **Tune Standard Planet Gravity (using `radius^2`):**
    *   **Action:** In Practice or Sandbox mode, focus *only* on standard planets (temporarily disable Gas Giant generation or ignore them).
    *   Adjust the `GRAVITY_CONSTANT` value in `src/config/gameSettings.ts`.
    *   Test firing projectiles repeatedly near standard planets of different sizes.
    *   **Goal:** Find a `GRAVITY_CONSTANT` value that makes the gravitational pull feel "right" for standard planets, where the force scales with `radius * radius`. Get this baseline feeling correct first.

2.  **Implement Gas Giant Mathematical Repulsion:**
    *   **Target File:** `src/hooks/useMatterPhysics.ts` -> `updateProjectilesAndApplyGravity` function.
    *   **Locate Logic:** Find the section processing forces for planets (`forEach(staticBody => ...)`).
    *   **Modify `planet_gas_outer` Case:**
        *   Retrieve `planetRadius` and `coreRadius` from `staticBody.plugin.ZapSlinggers`. Add checks to ensure they exist.
        *   Calculate `distance` (square root of `distanceSq`).
        *   **Conditional Force:**
            *   `if (distance < coreRadius)`:
                *   Calculate the standard **attractive** force magnitude *as if* it were pulling (`baseGravityMagnitude = GRAVITY_CONSTANT * (planetRadius * planetRadius) * projectileBody.mass / distanceSq`).
                *   Calculate the **repulsive** force magnitude (e.g., `repulsionMagnitude = 3 * baseGravityMagnitude`).
                *   Calculate the final repulsive force vector: `netForce = Vector.mult(Vector.normalise(distanceVector), -repulsionMagnitude)` (note the negative sign).
                *   *(Optional: Implement Max Range)* If repulsion should only happen within a certain absolute range *as well* as within the core, add that check here. (e.g., `if (distance < coreRadius && distance < MAX_REPULSION_RANGE)`).
            *   `else`: (Outside core radius)
                *   Calculate the standard **attractive** force magnitude: `baseGravityMagnitude = GRAVITY_CONSTANT * (planetRadius * planetRadius) * projectileBody.mass / distanceSq`.
                *   Calculate the attractive force vector: `netForce = Vector.mult(Vector.normalise(distanceVector), baseGravityMagnitude)`.
        *   Apply the calculated `netForce` using `Body.applyForce`.

3.  **Refine and Tune Gas Giant Forces:**
    *   **Test:** Use Practice/Sandbox mode with Gas Giants enabled.
    *   **Tune Repulsion Strength:** Adjust the multiplier (e.g., the `3` in `3 * baseGravityMagnitude`) until the repulsion feels appropriately strong. Consider making this multiplier a constant in `gameSettings.ts` (e.g., `GAS_GIANT_REPULSION_FACTOR`).
    *   **Tune Repulsion Range:** If a maximum absolute range for repulsion is desired beyond just being inside the `coreRadius`, define it in settings and add the check to the logic in Step 2.
    *   **Verify "No AoE Damage":** Confirm that projectiles hitting the `planet_gas_outer` body are simply removed (as implemented in the updated `handleCollisions`) and don't trigger damage or scoring unless that's desired later.

4.  **Final Testing:** Test interactions with both standard planets and Gas Giants together. Ensure projectiles behave predictably and the desired slingshot/repulsion effects occur with Gas Giants.

**Note on AoE:** The term "AoE" usually refers to area-of-effect *damage*. Gravity and repulsion are inherently area-of-effect *forces*. The plan assumes you meant no damage on collision, which the current collision handler ensures.
