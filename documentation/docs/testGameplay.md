'use strict';
# Testing Current Gameplay (Simple Multiplayer)

This document describes how to test the current, simplified multiplayer functionality as of the `useGameLogic` refactor.

**Goal:** Verify the Nostr challenge handshake and that each player controls their assigned ship locally after entering the `GameScreen`.

**Prerequisites:**

*   Two separate devices or browser profiles/windows.
*   Two distinct Nostr accounts, accessible via NIP-07 extension or a NIP-46 compatible mobile signer (e.g., Amber) or bunker.
*   Access to the running Zapslingers application on both instances.
*   Know the `npub` or hex `pubkey` of the other player.

**Test Procedure:**

1.  **Login:** Both users log in to Zapslingers using the provided options (NIP-07 button, or NIP-46 button which triggers QR/deeplink). Authentication is managed by the `useAuth` hook.
2.  **Navigate to Lobby:** Both users navigate from the Main Menu (shown after successful login) to the Multiplayer Lobby.
3.  **Initiate Challenge (User 1):**
    *   User 1 enters User 2's `npub` or hex `pubkey` into the input field in the "Challenge Players" section.
    *   User 1 clicks "Send Challenge".
    *   User 1 should see a "Challenge sent... Waiting for acceptance" message.
4.  **Accept Challenge (User 2):**
    *   User 2 should see an "Incoming challenge from: [User 1 npub]" message appear in their Lobby screen.
    *   User 2 clicks the "Accept Challenge" button.
5.  **Transition to Game:**
    *   **Both** User 1 and User 2 should automatically transition from the `LobbyScreen` to the `GameScreen`.
6.  **Verify Control & Basic Sync:**
    *   Observe the ship colors/positions. Based on the `useGameLogic` implementation (sorting pubkeys), the user whose pubkey comes first alphabetically will be Player 0 (typically Blue, left side), and the other will be Player 1 (typically Red, right side).
    *   **User 1:** Use the keyboard controls (**Left/Right arrows for aim angle, Up/Down arrows for power**, spacebar for fire, number keys for abilities) or UI elements. Verify that only the ship assigned to Player 0 responds to User 1's *aiming* input.
    *   **User 2:** Use the keyboard controls or UI elements. Verify that only the ship assigned to Player 1 responds to User 2's *aiming* input.
    *   **User 1 Fires:** User 1 uses the spacebar or Fire button. Verify the projectile appears on **both** User 1's and User 2's screens. Verify HP cost is deducted locally if an ability was used.
    *   **User 2 Fires:** User 2 uses the spacebar or Fire button. Verify the projectile appears on **both** User 2's and User 1's screens. Verify HP cost is deducted locally if an ability was used.
    *   Check that the `ActionButtons` UI (HP cost, ability availability) reflects the state of the locally controlled ship.

**Expected Outcome & Known Limitations:**

*   **Success:** Both players transition to the game screen. Each player can independently aim *their own* assigned ship using local controls. When a player fires, the projectile appears on **both** clients due to basic Nostr event synchronization (`kind:30079`), and ability costs are deducted locally.
*   **Limitation (Partial Network Sync):** While fire actions are synchronized, the *results* of those actions (projectile movement, collisions, damage, win conditions) are still simulated **independently** on each client. A hit on User 1's screen will not register on User 2's screen.
*   **Limitation (Local Win Condition):** Hitting the opponent ship *in your local simulation* will trigger the win condition callback (`onGameEnd`) locally, likely returning you to the menu. This won't affect the other player's screen.

This test confirms the Nostr challenge flow (using manual NDK calls in `ChallengeHandler`), the mapping of local controls, and the basic **network synchronization of fire actions** within the `GameScreen` using the `useGameLogic` hook (which also uses manual NDK calls) in `'multiplayer'` mode.

## Troubleshooting Mobile DM Sending Failures

If challenges or acceptances sent *from* a mobile device (especially using NIP-46) are not received by the opponent, even though the mobile app logs suggest the event was created/encrypted, investigate the following:

1.  **Mobile Relay Connections:**
    *   Check the mobile browser's developer console. Are there errors related to WebSocket disconnections or failures to connect to specific relays?
    *   Ensure both clients share at least one reliable, common relay that permits Kind 4 DMs. Mobile network instability can make relay connections less reliable.

2.  **Mobile Signer Status (NIP-46):**
    *   Is the mobile signer app (e.g., Amber, Nostr Wallet Connect) still running in the foreground or background? Mobile OS can aggressively close apps.
    *   Did the connection between Zapslingers and the signer app time out or get closed by the OS? Check the console for NIP-46 related errors (`NostrConnectSignerWrapper` logs, connection closed messages).
    *   Try keeping the signer app active in the foreground when sending the DM.

3.  **Detailed Mobile Console Logs:**
    *   When sending a challenge/acceptance from mobile, look closely at the console logs *immediately following* the "Manual NIP-04 encryption... successful" message.
    *   Are there any errors related to `event.publish()`, the specific signer (`NostrConnectSignerWrapper`), or WebSocket communication right after attempting to publish? NDK's publish is often fire-and-forget, but errors might still surface.

4.  **Verify Event on Relays:**
    *   After the mobile app logs that the challenge/acceptance was sent, copy the logged `nevent` ID.
    *   Use an external Nostr client or block explorer (like `astral.ninja`, `nostree.me`, `nos.social`) to search for that specific `nevent` ID on the relays you have configured in Zapslingers.
    *   Does the event appear on *any* of the relays shortly after sending? If not, the publish definitely failed. If it appears on some but not others, it indicates relay propagation issues.

5.  **Signer Comparison (If Possible):**
    *   If you can use a NIP-07 extension in your mobile browser, try logging in via NIP-07 on mobile and sending a challenge. Does it arrive? This helps isolate if the problem is specific to the NIP-46 signing path on mobile.
