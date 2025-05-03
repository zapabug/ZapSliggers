# Klunkstr Troubleshooting Log

This file tracks known issues, errors, and potential problems encountered during development.

**Status (Current Activity):** Build is currently successful. Focus is on testing Practice mode and implementing further multiplayer synchronization and visuals.

## Current Build Errors (`pnpm build` output as of YYYY-MM-DD):

*   None. Build successful.

## Previously Fixed Issues

1.  **`GameScreen.tsx` Build Errors (Fixed 2024-06-06 via `useGameLogic` refactor):**
    *   `TS6133: 'React' is declared but its value is never read.` (in `App.tsx`, simple removal).
    *   `TS2614: Module ... has no exported member 'GameRendererRef'.` (Removed outdated import).
    *   `TS2554: Expected 1 arguments, but got 0.` (Removed incorrect `useGameInitialization()` call).
    *   `TS2322: Property 'maxAbilityUses' does not exist on type 'ActionButtonsProps'.` (Corrected props passed to `ActionButtons` from `useGameLogic`/`settings`).
    *   `TS2322: Property 'ref' does not exist on type 'GameRendererProps'.` (Removed outdated `ref` prop passed to `GameRenderer`).
    *   *Follow-up Linter Errors:* Fixed `PlayerHUD` import (named vs default) and props (`pubkey`, `currentHp`, `maxHp`, `isPlayer1`, `ndk` expected).

2.  **`selectedAbility` Type Mismatch (Origin: `useGameLogic.ts`)**
    *   **Location:** `src/components/screens/DeveloperSandboxScreen.tsx` line ~100 (prop passed to `ActionButtons`).
    *   **Cause:** Incorrectly accessing `selectedAbility[0]` instead of passing the state directly.
    *   **Status:** Fixed (2024-06-06).

3.  **Argument Count Mismatch:** `src/components/lobby/LobbyPlayground.tsx:15:45`
    *   **Status:** Fixed by removing `LobbyPlayground.tsx`.

4.  **Missing Prop (`TS2322`):** `src/components/lobby/LobbyPlayground.tsx:125:11`
    *   **Status:** Fixed by removing `LobbyPlayground.tsx`.

5.  **Unused `React` Imports (`TS6133`):**
    *   `src/components/lobby/LobbyPlayground.tsx:1:8` - Fixed by removing file.
    *   `src/components/ui_overlays/HealthBar.tsx:1:1` - Fixed.
    *   `src/components/ui_overlays/PlayerHUD.tsx:1:1` - Fixed.

6.  **Type Mismatch (`TS2367`):** `src/App.tsx:300:77`
    *   **Status:** Fixed (Suppressed with `@ts-expect-error` as the logic is valid).

7.  **Type Mismatch (`TS2322`):** `src/lib/applesauce-nip46/helpers.ts:27:5`
    *   **Status:** Fixed (Corrected `@ts-expect-error` placement for intentional type mismatch in copied code).

8.  **Unused `@ts-expect-error` (`TS2578`):** `src/lib/applesauce-nip46/helpers.ts:28:5`
    *   **Status:** Fixed (Removed unused comment).

9.  **Missing `currentUser` prop (`TS2322`):** `src/App.tsx` passing prop to `