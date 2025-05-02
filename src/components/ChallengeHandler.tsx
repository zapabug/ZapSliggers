import React, { useState, useCallback, useEffect } from 'react';
import { nip19 } from 'nostr-tools';
import NDK, { NDKEvent, NDKKind, NDKFilter, NDKSubscription, NDKUser } from '@nostr-dev-kit/ndk';
import { NostrConnectSignerWrapper } from '../lib/applesauce-nip46/wrapper';

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

    useEffect(() => {
        if (!loggedInPubkey || !ndk) {
            setActiveReceivedChallenge(null);
            return;
        }

        const challengeFilter: NDKFilter = {
            kinds: [NDKKind.EncryptedDirectMessage],
            '#p': [loggedInPubkey],
            since: Math.floor(Date.now() / 1000) - 3600
        };

        console.log('[ChallengeHandler] Subscribing to DMs with filter:', challengeFilter);
        const sub: NDKSubscription = ndk.subscribe([challengeFilter], { closeOnEose: false });

        sub.on('event', async (event: NDKEvent) => {
            if (event.pubkey === loggedInPubkey) return;

            console.log('[ChallengeHandler] Received potential DM event:', event.encode());
            console.log('[ChallengeHandler] Incoming DM event content:', event.content);
            try {
                // Manual Decryption Attempt using NIP-44 via signer
                const nip46Signer = ndk.signer as NostrConnectSignerWrapper;

                if (!nip46Signer?.nip44?.decrypt) {
                    throw new Error("Signer does not support NIP-44 decryption.");
                }
                console.log(`[ChallengeHandler] Attempting manual NIP-44 decrypt with signer for sender ${event.pubkey}`);
                // NIP-44 decrypt requires the *other* party's pubkey
                const decryptedContent = await nip46Signer.nip44.decrypt(event.pubkey, event.content);
                console.log("[ChallengeHandler] Manual NIP-44 decryption successful.");

                // Use the manually decrypted content
                const content = decryptedContent.trim();
                let payload: ChallengePayload | AcceptPayload | null = null;
                try { payload = JSON.parse(content); } catch { /* Ignore if not JSON */ }

                const challengeTag = event.tags.find(t => t[0] === 't');

                if (activeSentChallenge && event.pubkey === activeSentChallenge.opponentPubkey && challengeTag && challengeTag[1] === activeSentChallenge.eventId) {
                    const isAcceptMessage = (payload && payload.type === 'accept') || content.toLowerCase() === 'accept';
                    if (isAcceptMessage) {
                        console.log(`[ChallengeHandler] Received ACCEPTANCE ${event.encode()} for our challenge ${activeSentChallenge.eventId} from ${event.pubkey}`);
                        const opponentPubkey = activeSentChallenge.opponentPubkey;
                        const matchIdentifier = activeSentChallenge.eventId;
                        setActiveSentChallenge(null);
                        onChallengeAccepted(opponentPubkey, matchIdentifier);
                        return;
                    }
                }

                const isChallengeMessage = (payload && payload.type === 'challenge') || content.toLowerCase() === 'challenge';
                if (isChallengeMessage && !challengeTag) {
                    if (!activeSentChallenge && !activeReceivedChallenge) {
                         console.log(`[ChallengeHandler] Received new CHALLENGE ${event.encode()} from ${event.pubkey}`);
                         setActiveReceivedChallenge({ challengerPubkey: event.pubkey, eventId: event.encode() });
                    } else {
                         console.log(`[ChallengeHandler] Ignoring new challenge ${event.encode()} while already in an active challenge state.`);
                    }
                    return;
                }

            } catch (err) {
                // Update error context
                console.error(`[ChallengeHandler] Failed to process DM ${event.encode()} (manual decrypt attempt):`, err);
            }
        });

        sub.on('eose', () => {
             console.log('[ChallengeHandler] DM subscription EOSE received.');
        });

        console.log('[ChallengeHandler] DM subscription created.');

        return () => {
            console.log('[ChallengeHandler] Stopping DM subscription.');
            sub.stop();
            setActiveSentChallenge(null);
            setActiveReceivedChallenge(null);
        };

    }, [ndk, loggedInPubkey, activeSentChallenge, onChallengeAccepted]);

    const handleSendChallenge = useCallback(async () => {
        if (!ndk || !loggedInPubkey) { setError("NDK not ready or user not logged in."); return; }
        if (!recipientNpubOrHex) { setError("Recipient pubkey is required."); return; }
        if (activeSentChallenge || activeReceivedChallenge) { setError("Already in an active challenge process."); return; }

        setError(null);
        setActiveSentChallenge(null);
        setActiveReceivedChallenge(null);

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
            event.content = JSON.stringify(challengePayload);
            event.tags = [['p', recipientHexPubkey]];

            const recipientUser: NDKUser | undefined = ndk.getUser({ hexpubkey: recipientHexPubkey });
             if (!recipientUser) {
                 console.warn("Could not immediately get recipient user object, proceeding with hexpubkey.");
             }

            console.log('[ChallengeHandler] Recipient NDKUser object:', recipientUser);
            try {
                if (ndk?.signer) {
                    console.log('[ChallengeHandler] Checking ndk.signer.pubkey synchronously:', ndk.signer.pubkey);
                } else {
                    console.warn('[ChallengeHandler] ndk.signer is undefined when checking pubkey (send challenge).');
                }
            } catch (e) {
                console.error('[ChallengeHandler] Error accessing ndk.signer.pubkey:', e);
            }
            await event.encrypt(recipientUser);
            await event.publish();
            const sentEventId = event.encode();

            console.log(`Challenge sent to ${recipientHexPubkey}, event ID: ${sentEventId}`);
            setActiveSentChallenge({ opponentPubkey: recipientHexPubkey, eventId: sentEventId });
            setRecipientNpubOrHex('');

        } catch (e) {
            console.error("Failed to send challenge:", e);
            setError(`Failed to send challenge: ${e instanceof Error ? e.message : String(e)}`);
            setActiveSentChallenge(null);
        }
    }, [ndk, loggedInPubkey, recipientNpubOrHex, activeSentChallenge, activeReceivedChallenge, setRecipientNpubOrHex]);

    const handleAcceptChallenge = useCallback(async () => {
        if (!ndk || !loggedInPubkey || !activeReceivedChallenge) {
            setError("Cannot accept challenge: Invalid state.");
            return;
        }

        const { challengerPubkey, eventId: originalChallengeId } = activeReceivedChallenge;
        setError(null);

        try {
            const acceptPayload: AcceptPayload = { type: 'accept' };
            const event = new NDKEvent(ndk);
            event.kind = NDKKind.EncryptedDirectMessage;
            event.content = JSON.stringify(acceptPayload);
            event.tags = [
                ['p', challengerPubkey],
                ['t', originalChallengeId]
            ];

            const challengerUser = ndk.getUser({ hexpubkey: challengerPubkey });

            console.log('[ChallengeHandler] Challenger NDKUser object:', challengerUser);
            try {
                if (ndk?.signer) {
                    console.log('[ChallengeHandler] Checking ndk.signer.pubkey synchronously:', ndk.signer.pubkey);
                } else {
                    console.warn('[ChallengeHandler] ndk.signer is undefined when checking pubkey (accept challenge).');
                }
            } catch (e) {
                console.error('[ChallengeHandler] Error accessing ndk.signer.pubkey:', e);
            }
            await event.encrypt(challengerUser);
            await event.publish();
            const acceptanceEventId = event.encode();
            console.log(`Acceptance sent to ${challengerPubkey} for challenge ${originalChallengeId}. Acceptance event ID: ${acceptanceEventId}`);

            const matchIdentifier = originalChallengeId;
            const opponent = challengerPubkey;
            setActiveReceivedChallenge(null);
            onChallengeAccepted(opponent, matchIdentifier);

        } catch (e) {
            console.error("Failed to send acceptance:", e);
            setError(`Failed to send acceptance: ${e instanceof Error ? e.message : String(e)}`);
        }
    }, [ndk, loggedInPubkey, activeReceivedChallenge, onChallengeAccepted]);

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
                    Challenge sent to {nip19.npubEncode(activeSentChallenge.opponentPubkey).substring(0, 12)}... Waiting for acceptance.
                </p>
            )}

            {hasIncomingChallenge && (
                 <div className="mt-4 p-3 bg-gray-700 rounded">
                     <p className="text-green-400 font-medium">
                         Incoming challenge from: {nip19.npubEncode(activeReceivedChallenge.challengerPubkey).substring(0, 12)}...
                     </p>
                     <button
                         onClick={handleAcceptChallenge}
                         className="mt-2 px-3 py-1 bg-green-600 rounded hover:bg-green-700 text-sm disabled:opacity-50"
                     >
                         Accept Challenge
                     </button>
                 </div>
            )}

            {!loggedInPubkey && (
                 <p className="text-gray-400 mt-2">Log in to send or receive challenges.</p>
            )}
        </div>
    );
} 