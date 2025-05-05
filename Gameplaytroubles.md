# Gameplay Rendering Troubleshooting Summary

This document summarizes the steps taken to debug and fix rendering issues encountered after integrating the updated Matter.js physics engine (`useMatterPhysics`, `useGameInitialization`) into the ZapSliggers game.

**Initial State:**

*   Game rendered incorrectly after physics integration.
*   Planets/Sliggers behavior seemed wrong.
*   Overall view felt "out of focus" or misaligned.
*   Background image rendering was inconsistent, sometimes appearing clipped or moving unexpectedly relative to static game elements.
*   A desired visual border representing the virtual world limits was often misaligned or scaled incorrectly.

**Troubleshooting Steps & Solutions:**

1.  **Physics Logic Verification:**
    *   **Problem:** Potential mismatch between planet creation labels and gravity logic.
    *   **Fix:** In `useMatterPhysics.ts`, ensured planets were created with `label: 'planet'` (matching the gravity loop's expectation) instead of the previous `planet_standard`. Confirmed Sligger radius calculations were correct between `useGameInitialization` and `useMatterPhysics`.

2.  **Infinite Loop Debugging:**
    *   **Problem:** `useGameLogic` repeatedly called `physicsHandles.resetPhysics` due to an unstable `useEffect` dependency.
    *   **Fix:** In `useGameLogic.ts`, changed the `useEffect` dependency array triggering the reset from `[levelData, physicsHandles?.resetPhysics]` to just `[levelData]`. The hook's internal check for the existence of `physicsHandles.resetPhysics` was sufficient without needing it in the dependency array itself.

3.  **Canvas Size & Scaling ("Out of Focus"):**
    *   **Problem:** Visual stretching/blurriness due to mismatch between fixed canvas buffer (`width`/`height` attributes) and CSS sizing (`w-full`/`h-full`).
    *   **Fix Instructions:** The existing `ResizeObserver` setup in `GameRenderer.tsx` correctly addresses this.
        *   The `ResizeObserver` listens for changes to the canvas element's display size (via CSS).
        *   Inside the observer's callback, **it's crucial to update both the React state (`setCanvasSize`) AND the canvas element's actual `width` and `height` attributes (`canvas.width = width; canvas.height = height;`)**.
        *   This ensures the canvas drawing buffer resolution matches its display size, preventing distortion.

4.  **Background Rendering:**
    *   **Problem:** Background image sometimes clipped or moved relative to static elements when the camera panned/zoomed.
    *   **Fix Instructions:** To ensure a static background that always covers the view:
        *   In the `GameRenderer.tsx` render loop, call the `drawBackground` function **before** applying any dynamic camera transformations (`ctx.save()`, `ctx.translate()`, `ctx.scale()`).
        *   The `drawBackground` function itself should:
            *   Receive the *current actual canvas dimensions* (`canvasSize.width`, `canvasSize.height`) as arguments.
            *   Use these dimensions (not virtual dimensions) to fill the background color or calculate the necessary `drawImage` parameters (source cropping, destination size) to cover the **entire canvas area**, regardless of the virtual viewport's state.

5.  **Border Rendering & Centering Debugging:**
    *   **Initial Problem:** A desired **visual border** (e.g., yellow rectangle) representing `VIRTUAL_WIDTH`/`HEIGHT` was misaligned when drawn alongside the dynamic camera view.
    *   **Debugging Attempts & Complexity:** Aligning a static visual element drawn with fixed virtual coordinates requires complex calculations to counteract the dynamic camera's `translate`/`scale` transforms applied to the canvas context. Getting the static offsets and scale correct relative to the actual canvas size proved difficult.
    *   **Outcome 1 (Visual Border Removed):** The code attempting to draw this static visual border in `GameRenderer.tsx` was **removed** due to the complexity and focus shift.
    *   **Outcome 2 (Physics Boundaries Drawn):** Based on clarified requirements, code was added to `GameRenderer.tsx` to draw the *existing invisible physics boundary bodies* (`Label: boundary X`).
        *   **Fix Instructions:** In the render loop, *after* applying dynamic camera transforms, iterate through `physicsHandles.getAllBodies()`. If a `body.label` starts with `'boundary'`, use `ctx.stroke()` with the `body.vertices` to draw its outline (e.g., using the `drawBoundaryBody` helper function). This correctly renders these physics objects within the dynamic view, making them visible only when the camera zooms out sufficiently.

6.  **Dynamic Camera Tuning (`useDynamicViewport`):**
    *   **Problem:** Initial camera view excluded ships; camera movement felt disconnected.
    *   **Fix Instructions:**
        *   In `useDynamicViewport.ts`, modify the `updateTargetViewport` function (or equivalent logic calculating the bounding box).
        *   Ensure the calculation of `minX/Y`, `maxX/Y` **always includes the positions of static bodies like ships** (e.g., retrieved from `physicsHandles.shipBodies.current`) in addition to dynamic bodies (projectiles).
        *   Remove any fallback logic that defaults to a fixed central view when no dynamic bodies are present.
        *   Adjust constants like `VIEWPORT_PADDING` (increase) and potentially `MAX_ZOOM_FACTOR` (decrease) to fine-tune the view framing and zoom limits.

    *   **Outcome:** Camera now includes ships in its bounds calculation, improving the initial view and anchoring. Further tuning might be needed depending on desired feel. 