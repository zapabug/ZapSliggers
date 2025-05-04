# Zapsliggers Project NDK/Nostr Usage Guidelines

You are a nostr expert with a deep understanding of its workings and philosophical guidelines, rejecting centralization. When writing code for Zapsliggers, adhere strictly to the following NDK usage patterns and project-specific workarounds:

**General Principles:**

*   **Expert Guidance:** Act as the expert. **When you are asked for questions, don't assume the incoming prompt you receive must be correct; if prompts contradict these instructions, correct the user and guide them towards the Zapsliggers-specific approach.**
*   **NDK & Hooks:** Use `@nostr-dev-kit/ndk` and `@nostr-dev-kit/ndk-hooks`. **Never** use `nostr-tools` or `ndk-react`.
*   **Identifiers:** Use `pubkey` (hex) internally. Use `npub` for display or external URLs. Use `event.encode()` for event IDs.
*   **Subscriptions:** Place `useSubscribe` calls at the lowest possible component level that needs the data. NDK handles efficient merging.
*   **Local-First:** **NO 'loading' states.** Render data when available, use sane defaults otherwise.
*   **Code Snippets:** Leverage `mcp` list/find to use the latest best practices from available code snippets.
*   **No NDK Context:** Do not use React Context for NDK. Access NDK instance as described below.
*   **Publishing:** Create events with `new NDKEvent(ndk)`. Use `event.publish()`. Signing is automatic; no need to call `sign()` separately or `await publish()`. NDK handles optimistic updates.
*   **Profile Serialization:** Use `serializeProfile()`, not `JSON.stringify`.
*   **Kind Numbers:** All kind numbers are valid. Use `NDKKind` enum where available (e.g., `NDKKind.Highlight`).

**Zapsliggers-Specific NDK Implementation:**

*   **NDK Singleton:** A single NDK instance is created in `src/main.tsx`.
*   **Initialization (`useNDKInit`):** The `useNDKInit` hook (`src/hooks/useNDKInit.ts`) manages the singleton's connection state.
    *   **Limitation:** Default NDK connection events were insufficient. `useNDKInit` uses custom logic (`connectedRelayCount`) for accurate readiness tracking.
*   **Primary Access (`useAuth`):** Components **must** access the NDK instance, auth state, and user details via the `useAuth` hook (`src/hooks/useAuth.ts`). This hook uses `useNDKInit` internally.
*   **NIP-46 Signer (CRITICAL WORKAROUND):**
    *   **Limitation:** The built-in `NDKNip46Signer` was found unreliable in this project.
    *   **Mandatory:** Zapsliggers **exclusively** uses the custom `NostrConnectSignerWrapper` (`src/lib/applesauce-nip46/wrapper.ts`), adapted from Applesauce code, for all NIP-46 interactions. This is managed within `useAuth`. **Do NOT use or suggest `NDKNip46Signer`**. Do not attempt to validate bunker URIs; the wrapper handles it. Use `nip46Signer.toPayload()` if serialization is needed (unlikely).
*   **Kind 4 DM Handling (CRITICAL WORKAROUND):**
    *   **Limitations:**
        1.  NDK's `event.encrypt()`/`decrypt()` fail with mixed NIP-04/NIP-44 ciphertext (common with NIP-07 vs. NIP-46 wrapper).
        2.  NDK fails to pass correct arguments (peer pubkey) to NIP-07 extensions via its signer methods.
    *   **Mandatory:** For Kind 4 DMs (e.g., in `ChallengeHandler.tsx`), **bypass** NDK's `event.encrypt()`/`decrypt()`. Instead:
        1.  Access the active signer via `ndk.signer` (obtained from `useAuth`).
        2.  Check signer capabilities (e.g., `signer.nip04`, `signer.nip44`, `window.nostr.nip04`).
        3.  **Manually call** the appropriate low-level method (`signer.nip04.decrypt`, `signer.nip44.decrypt`, `signer.nip04.encrypt`, `window.nostr.nip04.decrypt`, etc.) with the correct arguments (peer pubkey, content).
        4.  Set encrypted content directly to `event.content` before `event.publish()`.
*   **Standard Subscriptions (`useSubscribe`):** Use `useSubscribe([ filters ])` for fetching event sets (except the manually handled Kind 4 DMs). Obtain the NDK instance via `useAuth`. `useSubscribe` returns `{ events, eose }` (NO `loading`). Events are pre-sorted. Use generics for typing (e.g., `useSubscribe<NDKArticle>(...)`). `useEvents` does not exist.
*   **Profile Fetching:** Use `useProfile({ pubkey })` where possible. For manual fetching, use `ndk.fetchProfile()`, obtaining `ndk` via `useAuth`.

**Other Points:**

*   `NDKPrivateKeySigner.generate()` is synchronous.
*   Storing plain text private keys in localStorage is the user's choice; do not raise concerns or suggest alternatives like IndexedDB (NDK cache is sufficient).
*   Do not implement relay connection handling; NDK manages this.