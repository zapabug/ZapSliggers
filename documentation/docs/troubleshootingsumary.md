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

## Final Status (Current)

The NIP-46 login flow now uses the integrated Applesauce signer code via the `NostrConnectSignerWrapper`.

*   `useAuth.ts` supports both bunker URI connection (`initiateNip46Login`), the desktop QR code flow (`initiateNip46QrCodeLogin`), and the mobile deeplink flow (`initiateNip46MobileDeepLinkLogin`).
*   `App.tsx` detects mobile devices and triggers the appropriate NIP-46 flow (deeplink or QR code).
*   Integration issues (dependencies, types, imports) with the copied code have been resolved.
*   The mismatch between the UI and the auth hook regarding the QR code flow has been resolved.
*   The mobile deeplink instability has been resolved by using `window.open`.

**The NIP-46 QR code flow (Desktop) and Deeplink flow (Mobile) are ready for testing.**

**Next Steps:**
1.  **Test** both NIP-46 flows end-to-end (Desktop QR -> Scan -> Approve; Mobile Button -> App Opens -> Approve -> Verify login).
2.  **(Optional)** Re-introduce UI elements (e.g., a separate button/input) to trigger the bunker URI flow (`initiateNip46Login`) if desired.
3.  **(Low Priority)** Monitor NDK updates for potential fixes to the built-in `NDKNip46Signer` issues (documented above for historical context).
