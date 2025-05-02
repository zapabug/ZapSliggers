# NIP-46 Login Troubleshooting Summary (Klunkstr)

## Initial Problem (Using NDKNip46Signer)

The NIP-46 login flow ("Connect with Mobile App") using NDK's built-in `NDKNip46Signer` was not working as expected. When initiated (typically by providing a NIP-05 identifier like `nsec.app`), the connection often failed. Debugging revealed several issues:

*   **Key Finding 1 (NDK v2.14.x):** Logs often showed NDK subscribing to the bunker relay (`wss://relay.nsec.app`) but immediately receiving EOSE, with no `ndk:publish` log, indicating the initial encrypted NIP-46 request event was likely never sent.
*   **Key Finding 2 (NDK v2.13.x & v2.14.x):** NDK incorrectly attempted NIP-05 lookups even when `NDKNip46Signer` was initialized with a direct `npub` (decoded to hex) or hex public key identifier, leading to CORS errors and `Error: Bunker pubkey not set`.
*   Various attempts to align with potentially working patterns (like `tvapp`'s NDK v2.13.2 usage) failed to resolve these core issues with `NDKNip46Signer`.

## Current Approach: Integrate Applesauce Signer Code

Due to the persistent issues with `NDKNip46Signer`, the strategy shifted to integrating a known working NIP-46 implementation directly into the project:

1.  **Code Copied:** The relevant NIP-46 signer code (`NostrConnectSigner`, `SimpleSigner`, helpers) was copied from the `applesauce-signers` library into `src/lib/applesauce-nip46/`.
2.  **NDK Wrapper Created:** A new class, `NostrConnectSignerWrapper` (`src/lib/applesauce-nip46/wrapper.ts`), was created to act as an adapter. It implements the `NDKSigner` interface required by NDK, while internally managing an instance of the copied `NostrConnectSigner`.
3.  **Integration into `useAuth`:** The `useAuth` hook (`src/hooks/useAuth.ts`) was refactored to use `NostrConnectSignerWrapper` instead of `NDKNip46Signer`.

## Applesauce Integration Issues & Resolutions

Integrating the copied code revealed several minor issues, which have been addressed:

*   **Missing Dependencies:** `buffer` and `nanoid` packages were required by the copied code and were installed using `pnpm install`.
*   **TypeScript Errors (`createDefer`):** Type mismatches in the `createDefer` helper function (copied from `applesauce-core`) were resolved by adjusting the `Deferred<T>` type definition in `src/lib/applesauce-nip46/helpers.ts`.
*   **Module Resolution:** An initial "Cannot find module" error for the `wrapper.ts` import in `useAuth.ts` was resolved by explicitly adding the `.ts` extension to the import path, likely due to tooling cache or configuration specifics.
*   **Method Mismatch:** A type error occurred because `useAuth.ts` initially tried to call `.disconnect()` on the wrapper, but the correct method name is `.close()`. This was corrected.

## Refactoring `useAuth` and `App.tsx` for QR Code Flow

After integrating the wrapper, the NIP-46 button in `App.tsx` (intended for the generic QR code flow) stopped working because:
1.  The refactored `useAuth` initially only implemented the bunker URI connection flow (`NostrConnectSignerWrapper.fromBunkerURI`).
2.  `App.tsx` still contained outdated logic expecting a `nip46AuthUrl` and a `'requesting'` status from `useAuth`, which were no longer provided.

This mismatch was resolved by:

1.  Adding a passthrough `getNostrConnectURI` method to `NostrConnectSignerWrapper`.
2.  Creating a new function `initiateNip46QrCodeLogin` in `useAuth.ts`. This function instantiates `NostrConnectSignerWrapper` directly (without auto-connecting), calls `getNostrConnectURI` to generate the `nostrconnect://` URI, updates state (`nip46AuthUrl`, `nip46Status = 'waiting_for_scan'`), and then uses `blockUntilReady()` to wait for the connection after the user scans the QR code.
3.  Updating `App.tsx` to call `initiateNip46QrCodeLogin` and restoring the QR code display logic, checking for the `'waiting_for_scan'` status.

## Fixing Mobile Deeplink Flow

After implementing the QR code flow, a separate flow was added for mobile devices to improve UX:
1.  **Goal:** Instead of showing a QR code on mobile, directly trigger the user's installed mobile signer app using the `nostrconnect://` URI (deeplink).
2.  **Implementation:**
    *   Added a mobile detection utility (`src/utils/mobileDetection.ts`).
    *   Created a new function `initiateNip46MobileDeepLinkLogin` in `useAuth.ts`.
    *   Updated the NIP-46 button in `App.tsx` to call the appropriate function based on `isMobileDevice()`.
    *   Added UI state in `App.tsx` to show a "Waiting for mobile approval..." message.
3.  **Problem:** Initial tests using `window.location.href = authUrl;` to trigger the deeplink caused some mobile signers (e.g., Amber) to crash or close prematurely, even though the connection worked via desktop QR scan.
4.  **Resolution:** Changed the deeplink trigger method in `initiateNip46MobileDeepLinkLogin` from `window.location.href = authUrl;` to `window.open(authUrl, '_blank');`. This alternative method appears to handle the intent to launch the external app more reliably across mobile environments.

## DM Encryption/Decryption Failures (Kind 4)

**Problem:**
After successfully logging in (especially via NIP-46 using the `NostrConnectSignerWrapper`), the application failed to either decrypt incoming Kind 4 DMs (challenges) or encrypt outgoing Kind 4 DMs (challenges/acceptances). Errors like `Failed to decrypt event` or `Failed to encrypt event` appeared in the console, originating from NDK's internal methods (`_NDKEvent.decrypt`, `_NDKEvent.encrypt`).

**Troubleshooting Steps:**

1.  **Signer Verification:** Confirmed via logging that `ndk.signer` was correctly assigned to the active signer instance (`NDKNip07Signer` or `NostrConnectSignerWrapper`) and reported as connected when the errors occurred.
2.  **NDK vs. Signer Call:** Added detailed logging inside the `NostrConnectSignerWrapper` and the underlying `nostr-connect-signer.ts` code. Determined that NDK was failing *before* attempting to call the signer's `encrypt` or `decrypt` methods.
3.  **Input Verification:** Checked that `NDKUser` objects passed to `event.encrypt` were valid and contained the necessary public keys. Confirmed `ndk.signer.pubkey` was accessible.
4.  **NIP Format Analysis:** Logged the raw `event.content` of incoming DMs. Discovered that messages sent from a user logged in via the NIP-46 wrapper were **NIP-44** encrypted, while messages from a NIP-07 user were **NIP-04** encrypted.

**Root Cause:**
NDK's built-in `event.decrypt()` method seems to primarily expect NIP-04 format for Kind 4 DMs and failed internally when encountering NIP-44 ciphertext. Similarly, NDK's `event.encrypt()` also failed internally when the NIP-46 wrapper signer was active.

**Resolution:**

The solution involved completely bypassing NDK's default `event.encrypt` and `event.decrypt` methods for Kind 4 DMs within `ChallengeHandler.tsx`:

1.  **Manual Decryption:**
    *   Implemented logic to check the format of the incoming `event.content` (`.includes("?iv=")`).
    *   Created type guards (`hasNip04`, `hasNip44`) to check the capabilities of the *currently active* `ndk.signer`.
    *   Dynamically called either `signer.nip04.decrypt` or `signer.nip44.decrypt` based on the content format and signer capabilities.
    *   *Note:* Required adding public `nip04` and `nip44` getters to `NostrConnectSignerWrapper` to expose the underlying methods. Persistent linter warnings about `as any` casts inside the type guards were noted but ignored as functionally correct.
2.  **Manual Encryption:**
    *   Modified `handleSendChallenge` and `handleAcceptChallenge`.
    *   Manually encrypted the JSON payload using `signer.nip04.encrypt` (preferring the standard NIP for DMs).
    *   Set the resulting ciphertext directly to `event.content`.
    *   Called `event.publish()` without calling `event.encrypt()`.

This manual handling ensures correct encryption/decryption regardless of the sender's NIP choice or the user's login method (NIP-07 or NIP-46).

## Further Fixes and Improvements (Post-Initial NIP-46 Integration)

Following the initial integration of the Applesauce NIP-46 signer and manual DM handling, several additional issues were identified and resolved:

1.  **NIP-07 DM Handling (`ChallengeHandler.tsx`):**
    *   **Problem:** The manual NIP-04 decryption/encryption logic initially failed when using a NIP-07 browser extension signer. NDK's `signer.decrypt`/`encrypt` methods were called, but they didn't correctly pass the peer public key to the extension, causing a "second arg must be public key" error from the extension.
    *   **Resolution:** The type guards (`hasNip04StandardGlobal`) and the corresponding logic were updated to detect NIP-07 capability by checking for `window.nostr.nip04`. When detected, the code now directly calls `window.nostr.nip04.decrypt` or `window.nostr.nip04.encrypt`, passing the required peer pubkey and ciphertext/plaintext, thus bypassing the problematic NDK signer methods for this specific case.

2.  **Challenge Management (`ChallengeHandler.tsx`):**
    *   **Problem:** Users could get stuck if they received a challenge they didn't want to accept, and challenges persisted indefinitely.
    *   **Resolution:**
        *   Added a "Dismiss" button to the incoming challenge UI.
        *   Implemented a `handleDismissChallenge` function.
        *   Added a 3-minute `setTimeout` expiry for both sent (`activeSentChallenge`) and received (`activeReceivedChallenge`) challenges. Expired challenges automatically clear the state.
        *   Ensured timeouts are properly managed (created and cleared) during the component lifecycle and upon challenge resolution (accept/dismiss/expiry).

3.  **NDK Connection State (`useNDKInit.ts`):**
    *   **Problem:** The hook previously set `isReady` to `true` on the first relay connection and didn't reliably track subsequent disconnections, potentially leading to issues on unstable (e.g., mobile) networks where the app might think NDK is ready even if all relays have dropped.
    *   **Resolution:** Refactored the hook to actively track the number of connected relays using `ndk.pool.on('relay:connect')` and `ndk.pool.on('relay:disconnect')`. The `isReady` state is now dynamically set based on whether the `connectedRelayCount` is greater than zero, providing a more accurate representation of NDK's readiness.

4.  **DM Subscription Robustness (`ChallengeHandler.tsx`):**
    *   **Problem:** Potential for missed DMs (challenges/acceptances) if the WebSocket connection dropped temporarily and wasn't re-established quickly by NDK.
    *   **Resolution:** Implemented a periodic refresh mechanism using `setInterval` (every 30 seconds). The interval stops the existing DM subscription and creates a new one with a `since` filter looking back 5 minutes, increasing the likelihood of catching recently missed events.

5.  **GameScreen Aim State (`GameScreen.tsx`):**
    *   **Problem:** A `TypeError: currentAim is undefined` occurred because the component incorrectly tried to access a non-existent `currentAim` state variable, whereas the `useGameLogic` hook actually returns an array `aimStates`.
    *   **Resolution:** Corrected the component to destructure `aimStates` from `useGameLogic`. Updated the logic (especially the `useEffect` dependency array and props passed to `AimingInterface`) to correctly use `aimStates[myPlayerIndex]` to access the local player's angle and power.

6.  **Community Relay Added (`ndk.ts`):**
    *   Added the community/game relay `wss://relay.degmods.com` to the default `explicitRelayUrls` list used for NDK initialization.

## Final Status (Current)

The NIP-46 login flow now uses the integrated Applesauce signer code via the `NostrConnectSignerWrapper`.

*   `useAuth.ts` supports both bunker URI connection (`initiateNip46Login`), the desktop QR code flow (`initiateNip46QrCodeLogin`), and the mobile deeplink flow (`initiateNip46MobileDeepLinkLogin`).
*   `App.tsx` detects mobile devices and triggers the appropriate NIP-46 flow (deeplink or QR code).
*   Integration issues (dependencies, types, imports) with the copied code have been resolved.
*   The mismatch between the UI and the auth hook regarding the QR code flow has been resolved.
*   The mobile deeplink instability has been resolved by using `window.open`.

**The NIP-46 QR code flow (Desktop) and Deeplink flow (Mobile) are ready for testing.**

**Next Steps:**
1.  **Thorough Testing:** Retest both NIP-07 and NIP-46 login flows, challenge sending/receiving/accepting/dismissing/expiring, and basic gameplay functionality on both desktop and mobile.
2.  **Multiplayer Synchronization:** Continue development and testing of the core multiplayer state synchronization logic within `useGameLogic` (handling `fire` and `shotResolved` events from opponents).
3.  **UI Polish:** Refine UI elements, add loading/disabled states where appropriate (e.g., action buttons during opponent's turn).
4.  **(Low Priority)** Revisit linter errors in copied Applesauce code (`applesauce_nip46_integration_issues.md`) if desired.
