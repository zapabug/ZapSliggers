# NIP-46 Login Troubleshooting Summary (Klunkstr)

## Initial Problem

The NIP-46 login flow ("Connect with Mobile App") was not working as expected. When initiated, the UI would show a "Connecting..." state, but the `authUrl` event (containing the `bunker://` URI for the QR code) was never received by the `useAuth.ts` hook, preventing the user from authenticating.

## Troubleshooting Steps & Findings

1.  **Initial Code Review & Snippets:** Compared the code in `Klunkstr/src/hooks/useAuth.ts` with provided snippets. Identified that the project used the "identifier-first" NIP-46 flow (`new NDKNip46Signer(ndk, identifier)`).
2.  **Dependency Check (`nostr-tools`):** Verified `nostr-tools` version.
3.  **Refactor Attempt 1 (Manual URI):** Attempted manual `bunker://` URI generation; faced issues with `nostr-tools` exports and NDK event emission. **Reverted.**
4.  **Standard NDK Flow Confirmation:** Confirmed the simpler `new NDKNip46Signer(ndk, targetIdentifier)` initialization was being used. **Problem persisted.**
5.  **Investigate Relay Connectivity:** Ensured standard public relays (`damus.io`, `nos.lol`, etc.) were correctly configured in `src/ndk.ts` and NDK was connecting to them via `useNDKInit.ts`. **Problem persisted.**
6.  **Test Different Bunker (`nostr.mom`):** Initial attempt failed due to NIP-05 lookup error.
7.  **Revert to `nsec.app`:** Problem persisted.
8.  **Enable NDK Debug Logging (`debug` library):**
    *   **Key Finding 1 (NDK v2.14.4):** Logs revealed NDK subscribed to the bunker relay (`wss://relay.nsec.app`) but immediately received EOSE. **No `ndk:publish` log** was found, indicating the initial encrypted NIP-46 request event was likely never sent over common relays.
9.  **Refactor `useAuth.ts` (Identifier-First):** Refactored `initiateNip46Login` to rely purely on NDKNip46Signer event listeners (`authUrl`, `connect`, `disconnect`) instead of explicit `connect()`/`user()` calls after instantiation.
10. **NDK Version Testing:**
    *   Tested NDK `v2.14.4` (Original): Failed (Key Finding 1).
    *   Upgraded to NDK `v2.14.5`: Failed (Same immediate EOSE, no publish log).
    *   Downgraded to NDK `v2.13.3`: Failed (Same immediate EOSE, no publish log).
11. **Identifier Testing (NDK v2.13.3):**
    *   Used `nsec.app` (NIP-05): Failed (Presumably Key Finding 1 issue).
    *   Used `nostr.mom` (NIP-05): Failed (Presumably Key Finding 1 issue, or previous NIP-05 lookup failure).
    *   Used direct `npub` identifier (`npub13z...k36g`): Failed due to `Invalid checksum` error in `nostr-tools` (`nip19.decode` in workaround). Corrected `npub` provided by user.
    *   Used *corrected* `npub` identifier (via workaround to decode to hex): **Failed.** Logs showed NDK incorrectly attempted NIP-05 lookup (`https://[npub]/.well-known/...`) resulting in CORS error and `Error: Bunker pubkey not set`.
    *   Used direct **hex** public key identifier (`ed199f...`): **Failed.** Logs showed NDK *still* incorrectly attempted NIP-05 lookup (`https://[hexkey]/.well-known/...`) resulting in CORS error and `Error: Bunker pubkey not set`.
12. **Key Finding 2 (NDK v2.13.3 & v2.14.x):** NDK incorrectly attempts NIP-05 lookup even when `NDKNip46Signer` is initialized with a direct `npub` (decoded to hex) or hex public key identifier. It should recognize these formats and use the key directly.
10. **Test Removing `debug` Flag:** Removed the `debug: ndkDebug` option from the NDK constructor in `src/ndk.ts` to eliminate a potential minor difference from `tvapp`. **Result:** No change; the same "Bunker pubkey not set" error occurred, confirming the debug flag was not the cause.
11. **Detailed `tvapp` (`v2.13.2`) Post-Handshake Analysis:** Examined the `tvapp/src/hooks/useAuth.ts` code more closely to see how it instantiated and used `NDKNip46Signer` *after* confirming the NIP-46 connection.
    *   **Finding 1:** `tvapp` uses `new NDKNip46Signer(ndk, remotePubkeyHex, undefined)` to instantiate the signer, passing `undefined` as the third argument (local user/signer).
    *   **Finding 2:** `tvapp` does not explicitly call `signer.blockUntilReady()` or `signer.connect()` after instantiation; it assigns the signer to `ndk.signer` and relies on implicit readiness.
12. **Mimic `tvapp` Post-Handshake Logic in Klunkstr (`latest` NDK):** Modified `Klunkstr/src/hooks/useAuth.ts`:
    *   Changed `NDKNip46Signer` instantiation to pass `undefined` as the third argument.
    *   Removed the explicit `await finalSigner.blockUntilReady()` call.
    *   **Result:** Tested with NDK `latest` (`~v2.14.5`). The **same error** (`Error: Bunker pubkey not set` due to failed NIP-05 lookup) occurred, indicating the bug persists in newer NDK versions even with this instantiation pattern.
13. **Pin Klunkstr NDK Version to Match `tvapp`:** Modified `Klunkstr/package.json` to set `@nostr-dev-kit/ndk`: `"^2.13.2"`. User instructed to run `npm install` or `yarn install` to apply the version change.

## Final Status (Updated)

The NIP-46 login flow is currently **pending final test results** after aligning Klunkstr with `tvapp`'s successful pattern:

*   Manual NIP-46 handshake implemented.
*   Standard `nostrconnect://` URI generation fixed.
*   `NDKNip46Signer` instantiation modified (`undefined` 3rd argument).
*   Explicit `blockUntilReady()` call removed.
*   NDK version pinned to `^2.13.2` (matching `tvapp`).

The core hypothesis remains that a bug exists within NDK involving incorrect NIP-05 lookups when `NDKNip46Signer` is initialized with a hex pubkey. However, the exact combination of NDK `v2.13.2` and the modified instantiation pattern from `tvapp` needs final verification in the Klunkstr environment.

If this final attempt fails, the NIP-46 flow is **blocked** by the NDK bug.

**Next Steps:**
1.  **(Pending)** Test NIP-46 login in Klunkstr after running `npm install` with NDK pinned to `^2.13.2`.
2.  **If Still Failing:** Report Bug to NDK (as previously detailed).
3.  **Monitor NDK Updates.**
4.  **Rely on NIP-07** (understanding its limitations for mobile context).
