'use strict';
# Testing Current Gameplay (Simple Multiplayer)

This document describes how to test the current, simplified multiplayer functionality as of the `useGameLogic` refactor.

**Goal:** Verify the Nostr challenge handshake and that each player controls their assigned ship locally after entering the `GameScreen`.

**Prerequisites:**

*   Two separate devices or browser profiles/windows.
*   Two distinct Nostr accounts (e.g., logged in via NIP-07 extension or NIP-46 signer on each instance).
*   Access to the running Klunkstr application on both instances.
*   Know the `npub` or hex `pubkey` of the other player.

**Test Procedure:**

1.  **Login:** Both users log in to Klunkstr using their respective Nostr accounts.
2.  **Navigate to Lobby:** Both users navigate from the Main Menu to the Multiplayer Lobby.
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

This test confirms the Nostr challenge flow, the mapping of local controls, and the basic **network synchronization of fire actions** within the `GameScreen` using the `useGameLogic` hook in `'multiplayer'` mode.
