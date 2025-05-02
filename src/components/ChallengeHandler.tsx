import React, { useState, useCallback, useEffect, useRef } from 'react';
import { nip19 } from 'nostr-tools';
import NDK, { NDKEvent, NDKKind, NDKFilter, NDKSubscription, NDKSigner } from '@nostr-dev-kit/ndk';

// Define interface for expected wrapper structure
type Nip04CapableWrapper = { nip04: { decrypt: (pubkey: string, ciphertext: string) => Promise<string>; encrypt: (pubkey: string, plaintext: string) => Promise<string>; } };
// NIP-07 doesn't expose methods on the signer object itself, but globally via window.nostr
// type Nip04CapableStandard = { decrypt: (pubkey: string, ciphertext: string) => Promise<string>; encrypt: (pubkey: string, plaintext: string) => Promise<string>; };

function hasNip04Wrapper(signer: NDKSigner): signer is NDKSigner & Nip04CapableWrapper {
    return signer &&
           'nip04' in signer &&
           // eslint-disable-next-line @typescript-eslint/no-explicit-any
           typeof (signer as any).nip04?.decrypt === 'function' &&
           // eslint-disable-next-line @typescript-eslint/no-explicit-any
           typeof (signer as any).nip04?.encrypt === 'function';
}

// Updated Guard: Check for global window.nostr NIP-04 capability
function hasNip04StandardGlobal(): boolean {
    if (typeof window === 'undefined' || !window.nostr) {
        return false;
    }
    const nip04 = window.nostr.nip04;
    return typeof nip04 === 'object' &&
           nip04 !== null &&
           typeof nip04.decrypt === 'function' &&
           typeof nip04.encrypt === 'function';
}

// Type Guard for NIP-44 support (Likely only on wrapper)
// Define interface for expected structure
type Nip44Capable = { nip44: { decrypt: (pubkey: string, ciphertext: string) => Promise<string>; encrypt: (pubkey: string, plaintext: string) => Promise<string>; } };
function hasNip44(signer: NDKSigner): signer is NDKSigner & Nip44Capable {
    return signer &&
           'nip44' in signer &&
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
           typeof (signer as any).nip44?.decrypt === 'function' &&
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
           typeof (signer as any).nip44?.encrypt === 'function';
}

interface ChallengePayload {
    type: 'challenge';
}

interface AcceptPayload {
    type: 'accept';
}

interface ChallengeHandlerProps {
    loggedInPubkey: string | null;
    ndk: NDK;
    onChallengeAccepted: (opponentPubkey: string, matchId: string) => void;
    recipientNpubOrHex: string;
    setRecipientNpubOrHex: (value: string) => void;
}

export function ChallengeHandler({
    loggedInPubkey,
    ndk,
    onChallengeAccepted,
    recipientNpubOrHex,
    setRecipientNpubOrHex
}: ChallengeHandlerProps) {
    const [error, setError] = useState<string | null>(null);
    const [activeSentChallenge, setActiveSentChallenge] = useState<{ opponentPubkey: string, eventId: string } | null>(null);
    const [activeReceivedChallenge, setActiveReceivedChallenge] = useState<{ challengerPubkey: string, eventId: string } | null>(null);
    const sentChallengeTimeoutRef = React.useRef<number | null>(null);
    const receivedChallengeTimeoutRef = React.useRef<number | null>(null);
    const subscriptionRef = useRef<NDKSubscription | null>(null);

    const clearTimeouts = useCallback(() => {
        if (sentChallengeTimeoutRef.current) {
            clearTimeout(sentChallengeTimeoutRef.current);
            sentChallengeTimeoutRef.current = null;
        }
        if (receivedChallengeTimeoutRef.current) {
            clearTimeout(receivedChallengeTimeoutRef.current);
            receivedChallengeTimeoutRef.current = null;
        }
    }, []);

    const handleDMEvent = useCallback(async (event: NDKEvent) => {
        if (!loggedInPubkey || event.pubkey === loggedInPubkey) return;

        console.log('[ChallengeHandler] Received potential DM event:', event.encode());
        try {
            const ciphertext = event.content;
            const isLikelyNip04 = ciphertext.includes("?iv=");
            let decryptedContent: string | undefined;

            const currentSigner = ndk?.signer;

            if (!currentSigner && !hasNip04StandardGlobal()) {
                console.warn("[ChallengeHandler] No active signer or NIP-04 capability found for decryption.");
                return;
            }

            if (isLikelyNip04) {
                console.log("[ChallengeHandler] Detected NIP-04 format. Checking signer capability...");
                if (currentSigner && hasNip04Wrapper(currentSigner)) {
                    console.log(`[ChallengeHandler] Attempting manual NIP-04 decrypt with Wrapper signer for sender ${event.pubkey}`);
                    decryptedContent = await currentSigner.nip04.decrypt(event.pubkey, ciphertext);
                    console.log("[ChallengeHandler] Manual NIP-04 decryption successful (Wrapper).");
                } else if (hasNip04StandardGlobal()) {
                    console.log(`[ChallengeHandler] Attempting manual NIP-04 decrypt with Standard NIP-07 (window.nostr) for sender ${event.pubkey}`);
                    if (!window.nostr?.nip04?.decrypt) throw new Error("window.nostr.nip04.decrypt not available");
                    decryptedContent = await window.nostr.nip04.decrypt(event.pubkey, ciphertext);
                    console.log("[ChallengeHandler] Manual NIP-04 decryption successful (Standard Global).");
                } else {
                    console.warn("[ChallengeHandler] Signer or environment does not support NIP-04 decryption.");
                    return;
                }
            } else {
                console.log("[ChallengeHandler] Detected non-NIP-04 format (assuming NIP-44). Checking signer capability...");
                if (currentSigner && hasNip44(currentSigner)) {
                    console.log(`[ChallengeHandler] Attempting manual NIP-44 decrypt with signer for sender ${event.pubkey}`);
                    decryptedContent = await currentSigner.nip44.decrypt(event.pubkey, ciphertext);
                    console.log("[ChallengeHandler] Manual NIP-44 decryption successful.");
                } else {
                    console.warn("[ChallengeHandler] Current signer does not support NIP-44 decryption for this content.");
                    return;
                }
            }

            if (decryptedContent === undefined) {
                console.warn("[ChallengeHandler] Decryption failed or did not produce content for event:", event.encode());
                return;
            }

            const content = decryptedContent.trim();
            let payload: ChallengePayload | AcceptPayload | null = null;
            try { payload = JSON.parse(content); } catch { /* Ignore if not JSON */ }

            const challengeTag = event.tags.find(t => t[0] === 't');

            const currentActiveSentChallenge = activeSentChallenge;
            const currentActiveReceivedChallenge = activeReceivedChallenge;

            if (currentActiveSentChallenge && event.pubkey === currentActiveSentChallenge.opponentPubkey && challengeTag && challengeTag[1] === currentActiveSentChallenge.eventId) {
                const isAcceptMessage = (payload && payload.type === 'accept') || content.toLowerCase() === 'accept';
                if (isAcceptMessage) {
                    console.log(`[ChallengeHandler] Received ACCEPTANCE ${event.encode()} for our challenge ${currentActiveSentChallenge.eventId} from ${event.pubkey}`);
                    clearTimeouts();
                    const opponentPubkey = currentActiveSentChallenge.opponentPubkey;
                    const matchIdentifier = currentActiveSentChallenge.eventId;
                    setActiveSentChallenge(null);
                    onChallengeAccepted(opponentPubkey, matchIdentifier);
                    return;
                }
            }

            const isChallengeMessage = (payload && payload.type === 'challenge') || content.toLowerCase() === 'challenge';
            if (isChallengeMessage && !challengeTag) {
                if (!currentActiveSentChallenge && !currentActiveReceivedChallenge) {
                    console.log(`[ChallengeHandler] Received new CHALLENGE ${event.encode()} from ${event.pubkey}`);
                    if (receivedChallengeTimeoutRef.current) clearTimeout(receivedChallengeTimeoutRef.current);

                    const newReceivedChallenge = { challengerPubkey: event.pubkey, eventId: event.encode() };
                    setActiveReceivedChallenge(newReceivedChallenge);

                    receivedChallengeTimeoutRef.current = setTimeout(() => {
                        console.log(`[ChallengeHandler] Incoming challenge ${event.encode()} expired.`);
                        setActiveReceivedChallenge(current => (current?.eventId === newReceivedChallenge.eventId ? null : current));
                        receivedChallengeTimeoutRef.current = null;
                    }, 3 * 60 * 1000);
                } else {
                    console.log(`[ChallengeHandler] Ignoring new challenge ${event.encode()} while already in an active challenge state.`);
                }
                return;
            }

        } catch (err) {
            console.error(`[ChallengeHandler] Failed to process DM ${event.encode()}:`, err);
        }
    }, [ndk, loggedInPubkey, clearTimeouts, onChallengeAccepted, activeSentChallenge, activeReceivedChallenge]);

    const handleEose = useCallback(() => {
         // console.log('[ChallengeHandler] DM subscription EOSE received.');
    }, []);

    const subscribeToDMs = useCallback(() => {
        if (!loggedInPubkey || !ndk) return null;

        subscriptionRef.current?.stop();
        console.log('[ChallengeHandler] Stopping previous DM subscription (if any).');

        const challengeFilter: NDKFilter = {
            kinds: [NDKKind.EncryptedDirectMessage],
            '#p': [loggedInPubkey],
            since: Math.floor(Date.now() / 1000) - (5 * 60)
        };

        console.log('[ChallengeHandler] Subscribing to DMs with filter:', challengeFilter);
        const newSub = ndk.subscribe([challengeFilter], { closeOnEose: false });

        newSub.on('event', handleDMEvent);
        newSub.on('eose', handleEose);

        console.log('[ChallengeHandler] New DM subscription created and listeners attached.');
        subscriptionRef.current = newSub;
        return newSub;

    }, [ndk, loggedInPubkey, handleDMEvent, handleEose]);

    useEffect(() => {
        console.log("[ChallengeHandler] Main Effect: Setting up initial DM subscription.");
        subscribeToDMs();

        return () => {
            console.log('[ChallengeHandler] Main Effect Cleanup: Stopping final DM subscription.');
            subscriptionRef.current?.stop();
            subscriptionRef.current = null;
            clearTimeouts();
        };
    }, [loggedInPubkey, subscribeToDMs, clearTimeouts]);

    useEffect(() => {
        if (!loggedInPubkey) return;

        console.log("[ChallengeHandler] Interval Effect: Setting up periodic refresh (30s).");
        const intervalId = setInterval(() => {
            console.log("[ChallengeHandler] Interval: Refreshing DM subscription...");
            subscribeToDMs();
        }, 30000);

        return () => {
            console.log("[ChallengeHandler] Interval Effect Cleanup: Clearing interval.");
            clearInterval(intervalId);
        };

    }, [loggedInPubkey, subscribeToDMs]);

    const handleSendChallenge = useCallback(async () => {
        const currentSigner = ndk?.signer;
        if (!ndk || !loggedInPubkey || !currentSigner) { setError("NDK not ready, user not logged in, or signer missing."); return; }
        if (!recipientNpubOrHex) { setError("Recipient pubkey is required."); return; }
        if (activeSentChallenge || activeReceivedChallenge) { setError("Please resolve the current challenge first."); return; }

        setError(null);
        clearTimeouts();

        let recipientHexPubkey: string;

        try {
            if (recipientNpubOrHex.startsWith('npub1')) {
                const decoded = nip19.decode(recipientNpubOrHex);
                if (decoded.type !== 'npub') throw new Error("Invalid npub format.");
                recipientHexPubkey = decoded.data;
            } else if (/^[0-9a-f]{64}$/i.test(recipientNpubOrHex)) {
                recipientHexPubkey = recipientNpubOrHex;
            } else {
                throw new Error("Invalid recipient pubkey format. Use npub or hex.");
            }

            if (recipientHexPubkey === loggedInPubkey) {
                 throw new Error("Cannot challenge yourself.");
            }

            const challengePayload: ChallengePayload = { type: 'challenge' };
            const event = new NDKEvent(ndk);
            event.kind = NDKKind.EncryptedDirectMessage;
            event.tags = [['p', recipientHexPubkey]];

            const payloadString = JSON.stringify(challengePayload);

            let encryptedContent: string;

            console.log(`[ChallengeHandler] Attempting manual NIP-04 encrypt (send challenge) for recipient ${recipientHexPubkey}`);
            if (currentSigner && hasNip04Wrapper(currentSigner)) {
                console.log("[ChallengeHandler] Using Wrapper NIP-04 encrypt...");
                encryptedContent = await currentSigner.nip04.encrypt(recipientHexPubkey, payloadString);
            } else if (hasNip04StandardGlobal()) {
                console.log("[ChallengeHandler] Using Standard NIP-07 (window.nostr) encrypt...");
                if (!window.nostr?.nip04?.encrypt) throw new Error("window.nostr.nip04.encrypt not available");
                encryptedContent = await window.nostr.nip04.encrypt(recipientHexPubkey, payloadString);
            } else {
                throw new Error("Current signer or environment does not support NIP-04 encryption.");
            }

            event.content = encryptedContent;
            console.log("[ChallengeHandler] Manual NIP-04 encryption (send challenge) successful.");

            await event.publish();
            const sentEventId = event.encode();

            console.log(`Challenge sent to ${recipientHexPubkey}, event ID: ${sentEventId}`);
            const newChallenge = { opponentPubkey: recipientHexPubkey, eventId: sentEventId };
            setActiveSentChallenge(newChallenge);
            setRecipientNpubOrHex('');

            sentChallengeTimeoutRef.current = setTimeout(() => {
                console.log(`[ChallengeHandler] Sent challenge ${sentEventId} expired.`);
                setActiveSentChallenge(current => (current?.eventId === sentEventId ? null : current));
                sentChallengeTimeoutRef.current = null;
            }, 3 * 60 * 1000);

        } catch (e) {
            console.error("Failed to send challenge:", e);
            setError(`Failed to send challenge: ${e instanceof Error ? e.message : String(e)}`);
            setActiveSentChallenge(null);
        }
    }, [ndk, loggedInPubkey, recipientNpubOrHex, activeSentChallenge, activeReceivedChallenge, setRecipientNpubOrHex, clearTimeouts]);

    const handleAcceptChallenge = useCallback(async () => {
        const currentSigner = ndk?.signer;
        if (!ndk || !loggedInPubkey || !activeReceivedChallenge || !currentSigner) {
            setError("Cannot accept challenge: Invalid state or signer missing.");
            return;
        }

        const { challengerPubkey, eventId: originalChallengeId } = activeReceivedChallenge;
        setError(null);

        try {
            const acceptPayload: AcceptPayload = { type: 'accept' };
            const event = new NDKEvent(ndk);
            event.kind = NDKKind.EncryptedDirectMessage;
            event.tags = [
                ['p', challengerPubkey],
                ['t', originalChallengeId]
            ];

            const payloadStringAccept = JSON.stringify(acceptPayload);

            let encryptedContentAccept: string;

            console.log(`[ChallengeHandler] Attempting manual NIP-04 encrypt (accept challenge) for recipient ${challengerPubkey}`);
            if (currentSigner && hasNip04Wrapper(currentSigner)) {
                console.log("[ChallengeHandler] Using Wrapper NIP-04 encrypt...");
                encryptedContentAccept = await currentSigner.nip04.encrypt(challengerPubkey, payloadStringAccept);
            } else if (hasNip04StandardGlobal()) {
                console.log("[ChallengeHandler] Using Standard NIP-07 (window.nostr) encrypt...");
                if (!window.nostr?.nip04?.encrypt) throw new Error("window.nostr.nip04.encrypt not available");
                encryptedContentAccept = await window.nostr.nip04.encrypt(challengerPubkey, payloadStringAccept);
            } else {
                throw new Error("Current signer or environment does not support NIP-04 encryption.");
            }
            event.content = encryptedContentAccept;
            console.log("[ChallengeHandler] Manual NIP-04 encryption (accept challenge) successful.");

            await event.publish();
            const acceptanceEventId = event.encode();
            console.log(`Acceptance sent to ${challengerPubkey} for challenge ${originalChallengeId}. Acceptance event ID: ${acceptanceEventId}`);

            clearTimeouts();
            const matchIdentifier = originalChallengeId;
            const opponent = challengerPubkey;
            setActiveReceivedChallenge(null);
            onChallengeAccepted(opponent, matchIdentifier);

        } catch (e) {
            console.error("Failed to send acceptance:", e);
            setError(`Failed to send acceptance: ${e instanceof Error ? e.message : String(e)}`);
        }
    }, [ndk, loggedInPubkey, activeReceivedChallenge, onChallengeAccepted, clearTimeouts]);

    const handleDismissChallenge = useCallback(() => {
        console.log(`[ChallengeHandler] Dismissing incoming challenge: ${activeReceivedChallenge?.eventId}`);
        clearTimeouts();
        setActiveReceivedChallenge(null);
    }, [activeReceivedChallenge, clearTimeouts]);

    const canInteract = loggedInPubkey && !activeSentChallenge && !activeReceivedChallenge;
    const isWaitingForAcceptance = !!activeSentChallenge;
    const hasIncomingChallenge = !!activeReceivedChallenge;

    return (
        <div className="p-4 border rounded border-gray-600">
            <h2 className="text-xl font-semibold mb-3">Challenge a Player</h2>

            {canInteract && (
                <div className="flex items-center space-x-2 mb-2">
                    <input
                        type="text"
                        value={recipientNpubOrHex}
                        onChange={(e) => setRecipientNpubOrHex(e.target.value)}
                        placeholder="Enter opponent's npub or hex pubkey"
                        className="flex-grow text-black p-2 border rounded"
                        disabled={!loggedInPubkey}
                    />
                    <button
                        onClick={handleSendChallenge}
                        disabled={!recipientNpubOrHex || !loggedInPubkey}
                        className="px-4 py-2 bg-blue-600 rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        Send Challenge
                    </button>
                </div>
            )}

            {error && <p className="text-red-500 mt-1 text-sm">Error: {error}</p>}

            {isWaitingForAcceptance && (
                <p className="text-yellow-400 mt-2">
                    Challenge sent to {activeSentChallenge?.opponentPubkey ? nip19.npubEncode(activeSentChallenge.opponentPubkey).substring(0, 12) + '...' : '...'}. Waiting for acceptance.
                </p>
            )}

            {hasIncomingChallenge && (
                 <div className="mt-4 p-3 bg-gray-700 rounded">
                     <p className="text-green-400 font-medium mb-2">
                         Incoming challenge from: {activeReceivedChallenge?.challengerPubkey ? nip19.npubEncode(activeReceivedChallenge.challengerPubkey).substring(0, 12) + '...' : '...'}
                     </p>
                     <div className="flex space-x-2">
                         <button
                             onClick={handleAcceptChallenge}
                             className="px-3 py-1 bg-green-600 rounded hover:bg-green-700 text-sm disabled:opacity-50"
                             disabled={!activeReceivedChallenge}
                         >
                             Accept
                         </button>
                         <button
                             onClick={handleDismissChallenge}
                             className="px-3 py-1 bg-red-600 rounded hover:bg-red-700 text-sm disabled:opacity-50"
                             disabled={!activeReceivedChallenge}
                         >
                             Dismiss
                         </button>
                     </div>
                 </div>
            )}

            {!loggedInPubkey && (
                 <p className="text-gray-400 mt-2">Log in to send or receive challenges.</p>
            )}
        </div>
    );
}
