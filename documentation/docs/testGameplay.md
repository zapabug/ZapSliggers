'use strict';
# Testing Current Gameplay (Simple Multiplayer)

This document describes how to test the current, simplified multiplayer functionality as of the `useGameLogic` refactor, focusing on the Nostr challenge handshake and the basic synchronization of fire actions using `kind:30079` events.

**Goal:** Verify the Nostr challenge handshake transitions players to the `GameScreen`, that each player controls their assigned ship locally, and that **fire actions initiated by one player are sent via Nostr (`kind:30079`) and successfully received and simulated by the opponent.**

**Prerequisites:**

*   Two separate devices or browser profiles/windows.
*   Two distinct Nostr accounts, accessible via NIP-07 extension or a NIP-46 compatible mobile signer (e.g., Amber) or bunker.
*   Access to the running Zapsliggers application on both instances.
*   Know the `npub` or hex `pubkey` of the other player.
*   **Developer Console:** Open the browser's developer console on **both** instances to monitor logs.
*   **(Recommended):** Manually fix any remaining lint errors in `src/hooks/useGameLogic.ts` before testing.

**Test Procedure:**

1.  **Login:** Both users log in to Zapsliggers.
2.  **Navigate to Lobby:** Both users navigate to the Multiplayer Lobby.
3.  **Initiate Challenge (User 1):** User 1 enters User 2's ID and clicks "Send Challenge".
4.  **Accept Challenge (User 2):** User 2 accepts the incoming challenge.
5.  **Transition to Game:**
    *   **Check:** Both User 1 and User 2 automatically transition to the `GameScreen`.
6.  **Verify Initial State & Subscription:**
    *   Observe ship colors/positions (Player 0 typically Blue/Left, Player 1 Red/Right based on sorted pubkeys).
    *   **Check (Console - Both Users):** Look for `[useGameLogic] Subscribing to game actions:` log. Verify the filter details (`kinds: [30079]`, `#j: [matchId]`, `authors: [opponentPubkey]`) are correct for *their specific opponent*.
7.  **Verify Control & Fire Action Sync (Player 1 Fires):**
    *   Wait for User 1's turn (`currentPlayerIndex === User 1's myPlayerIndex`).
    *   **User 1:** Use controls to aim and fire.
    *   **Check (User 1 Console):**
        *   Look for `[useGameLogic] Publishing game action:` log. Verify the `eventPayload` (type: 'game_action', action.type: 'fire', matchId, senderPubkey, turnIndex, action details).
        *   Look for `[useGameLogic] Fire event published successfully.` or any publish errors.
        *   Look for `[useGameLogic] Turn switched to P... after publishing fire event.` log.
    *   **Check (User 2 Console):**
        *   Look for `[useGameLogic] Received game event:` log.
        *   Verify received `content` matches User 1's payload.
        *   Look for logs related to processing the event (updating aim state, applying HP cost if ability used).
        *   Look for `[useGameLogic] Turn switched to P... after receiving opponent move.` log.
    *   **Check (User 2 Screen):** Did User 1's projectile appear and simulate reasonably (given local physics)?
8.  **Verify Control & Fire Action Sync (Player 2 Fires):**
    *   Wait for User 2's turn (`currentPlayerIndex === User 2's myPlayerIndex`).
    *   **User 2:** Use controls to aim and fire.
    *   **Check (User 2 Console):** Look for publishing logs.
    *   **Check (User 1 Console):** Look for receiving logs.
    *   **Check (User 1 Screen):** Did User 2's projectile appear and simulate reasonably?

**Expected Outcome & Known Limitations:**

*   **Success:** Both players transition to the game screen. Each player can independently aim *their own* assigned ship. When a player fires, the projectile appears on **both** clients due to Nostr event synchronization (`kind:30079`), and ability costs are deducted locally. **Console logs confirm the publishing and receiving of `GameActionEvent` payloads.**
*   **Limitation (Partial Network Sync):** Only the initial 'fire' action (aim, power, ability) is synchronized. The *results* of that action (projectile movement, collisions, damage, win conditions) are still simulated **independently** on each client based on that initial data. A hit on User 1's screen **will not** currently register on User 2's screen or affect their game state beyond the initial projectile launch.
*   **Limitation (Local Win Condition):** Hitting the opponent ship *in your local simulation* will trigger the win condition callback (`onGameEnd`) locally, likely returning you to the menu. This won't affect the other player's screen.

This test confirms the Nostr challenge flow, the mapping of local controls, and the basic **network synchronization of fire actions (`kind:30079`)** within the `GameScreen` using the `useGameLogic` hook.

## Troubleshooting Nostr Game Events (Kind 30079)

If 'fire' actions (or future game events) are not being received or processed correctly:

1.  **Relay Connections:**
    *   Check both consoles for WebSocket errors. Ensure both clients share at least one reliable, common relay that permits `Kind 30079`.
2.  **Publish Failure (Sender):**
    *   Did the sender see `Failed to publish fire event:` in their console?
    *   Check NIP-07/NIP-46 signer status (running? connected?).
3.  **Subscription Filter (Receiver):**
    *   In the receiver's console log (`Subscribing to game actions:`), verify:
        *   `kinds:` includes `30079`.
        *   `#j:` tag matches the current `matchId`.
        *   `authors:` contains the correct `opponentPubkey`.
4.  **Event Verification on Relays (Advanced):**
    *   Copy the `eventPayload` logged by the sender.
    *   Use an external Nostr client/explorer to search for `kind: 30079` events tagged with `#j <matchId>` from the sender's pubkey on shared relays.
    *   Did the event appear? If not, publish failed. If on some relays but not others, indicates propagation issues.
5.  **Event Processing Logic (Receiver):**
    *   Did the receiver log `Failed to parse game event:`? Check payload against `GameActionEvent` type.
    *   Trace `handleIncomingEvent` in `useGameLogic`. Is it correctly identifying the turn? Updating state? Calling `fireProjectile`? Switching the turn back?

## Troubleshooting Mobile DM Sending Failures

If challenges or acceptances sent *from* a mobile device (especially using NIP-46) are not received by the opponent, even though the mobile app logs suggest the event was created/encrypted, investigate the following:

1.  **Mobile Relay Connections:**
    *   Check the mobile browser's developer console. Are there errors related to WebSocket disconnections or failures to connect to specific relays?
    *   Ensure both clients share at least one reliable, common relay that permits Kind 4 DMs. Mobile network instability can make relay connections less reliable.

2.  **Mobile Signer Status (NIP-46):**
    *   Is the mobile signer app (e.g., Amber, Nostr Wallet Connect) still running in the foreground or background? Mobile OS can aggressively close apps.
    *   Did the connection between Zapsliggers and the signer app time out or get closed by the OS? Check the console for NIP-46 related errors (`NostrConnectSignerWrapper` logs, connection closed messages).
    *   Try keeping the signer app active in the foreground when sending the DM.

3.  **Detailed Mobile Console Logs:**
    *   When sending a challenge/acceptance from mobile, look closely at the console logs *immediately following* the "Manual NIP-04 encryption... successful" message.
    *   Are there any errors related to `event.publish()`, the specific signer (`NostrConnectSignerWrapper`), or WebSocket communication right after attempting to publish? NDK's publish is often fire-and-forget, but errors might still surface.

4.  **Verify Event on Relays:**
    *   After the mobile app logs that the challenge/acceptance was sent, copy the logged `nevent` ID.
    *   Use an external Nostr client or block explorer (like `astral.ninja`, `nostree.me`, `nos.social`) to search for that specific `nevent` ID on the relays you have configured in Zapsliggers.
    *   Does the event appear on *any* of the relays shortly after sending? If not, the publish definitely failed. If it appears on some but not others, it indicates relay propagation issues.

5.  **Signer Comparison (If Possible):**
    *   If you can use a NIP-07 extension in your mobile browser, try logging in via NIP-07 on mobile and sending a challenge. Does it arrive? This helps isolate if the problem is specific to the NIP-46 signing path on mobile.


**events are time stamped up on receaval of projectile path animate ship as if it was real time but only use nostr, (idea if users install pwa they need only to connect to nostr for a semi live play)
 theres no ui for any settings for now!
not even sandbox all settings are to be changed within code it self
app will be minimal installable pwa only  Sertain npubs will have access to the snadboxmode, and it will likely be used a a test base for custom rules for turnaments or challenges***