import React, { useState, useCallback, useEffect } from 'react';
import NDK, { NDKEvent, NDKKind, NDKFilter, NDKSubscription } from '@nostr-dev-kit/ndk';

interface ChallengePayload {
    type: 'challenge';
}

interface ChallengeHandlerProps {
    loggedInPubkey: string | null;
    ndk: NDK;
    onChallengeAccepted?: (opponentPubkey: string) => void;
}

export function ChallengeHandler({ loggedInPubkey, ndk, onChallengeAccepted }: ChallengeHandlerProps) {
    const [recipientPubkey, setRecipientPubkey] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [sentChallengeId, setSentChallengeId] = useState<string | null>(null);
    const [incomingChallenges, setIncomingChallenges] = useState<NDKEvent[]>([]);

    useEffect(() => {
        if (!loggedInPubkey || !ndk) {
            setIncomingChallenges([]);
            return;
        }

        const challengeFilter: NDKFilter = {
            kinds: [NDKKind.EncryptedDirectMessage],
            '#p': [loggedInPubkey],
        };

        console.log('[ChallengeHandler] Subscribing to DMs with filter:', challengeFilter);
        const sub: NDKSubscription = ndk.subscribe([challengeFilter], { closeOnEose: false });

        sub.on('event', (event: NDKEvent) => {
            console.log('[ChallengeHandler] Received potential DM event:', event.encode());
            event.decrypt().then(() => {
                try {
                    const payload: ChallengePayload = JSON.parse(event.content);
                    if (payload.type === 'challenge') {
                        console.log(`[ChallengeHandler] Valid challenge ${event.encode()} from ${event.pubkey} received:`, payload);
                        setIncomingChallenges(prevChallenges => {
                            if (prevChallenges.some(c => c.encode() === event.encode())) {
                                return prevChallenges;
                            }
                            return [...prevChallenges, event];
                        });
                    } else {
                        console.log(`[ChallengeHandler] DM ${event.encode()} is not a challenge:`, payload);
                    }
                } catch {
                    console.log(`[ChallengeHandler] DM ${event.encode()} content not valid JSON or not challenge payload.`);
                }
            }).catch(err => {
                console.error(`[ChallengeHandler] Failed to decrypt DM ${event.encode()}:`, err);
            });
        });

        sub.on('eose', () => {
             console.log('[ChallengeHandler] DM subscription EOSE received.');
        });

        sub.start();
        console.log('[ChallengeHandler] DM subscription started.');

        return () => {
            console.log('[ChallengeHandler] Stopping DM subscription.');
            sub.stop();
            setIncomingChallenges([]);
        };

    }, [ndk, loggedInPubkey]);

    const handleSendChallenge = useCallback(async () => {
        if (!ndk || !loggedInPubkey) {
            setError("NDK not ready or user not logged in.");
            return;
        }
        if (!recipientPubkey) {
            setError("Recipient pubkey is required.");
            return;
        }

        setError(null);
        setSentChallengeId(null);

        try {
            const challengePayload: ChallengePayload = { type: 'challenge' };
            const event = new NDKEvent(ndk);
            event.kind = NDKKind.EncryptedDirectMessage;
            event.content = JSON.stringify(challengePayload);
            event.tags = [['p', recipientPubkey]];

            await event.encrypt(ndk.getUser({hexpubkey: recipientPubkey}));
            await event.publish();

            console.log("Challenge sent, event ID:", event.encode());
            setSentChallengeId(event.encode());
        } catch (e) {
            console.error("Failed to send challenge:", e);
            setError(`Failed to send challenge: ${e instanceof Error ? e.message : String(e)}`);
        }
    }, [ndk, loggedInPubkey, recipientPubkey]);

    return (
        <div>
            <h2>Challenge a Player</h2>
            <input
                type="text"
                value={recipientPubkey}
                onChange={(e) => setRecipientPubkey(e.target.value)}
                placeholder="Enter opponent's npub or hex pubkey"
                className="text-black p-1 mr-2"
            />
            <button onClick={handleSendChallenge} disabled={!recipientPubkey || !loggedInPubkey} className="px-3 py-1 bg-blue-600 rounded hover:bg-blue-700 disabled:opacity-50">
                Send Challenge
            </button>
            {error && <p className="text-red-500 mt-1">Error: {error}</p>}
            {sentChallengeId && <p className="text-green-500 mt-1">Challenge sent! Event ID: {sentChallengeId}</p>}

            <h2 className="mt-4">Incoming Challenges</h2>
            {loggedInPubkey ? (
                incomingChallenges.length > 0 ? (
                    <ul className="list-disc pl-5 mt-2">
                        {incomingChallenges.map(event => (
                            <li key={event.encode()} className="text-sm mb-1 flex justify-between items-center">
                                <span>
                                    Challenge from: {event.pubkey} 
                                    {/* <span className="text-xs text-gray-500">(ID: {event.id})</span> */}
                                </span>
                                <button 
                                    onClick={() => {
                                        console.log(`Accepting challenge from ${event.pubkey}`);
                                        // Call the callback if it exists
                                        onChallengeAccepted?.(event.pubkey);
                                    }}
                                    className="ml-2 px-2 py-0.5 bg-green-600 rounded hover:bg-green-700 text-xs disabled:opacity-50"
                                    disabled={!onChallengeAccepted} // Disable if callback not provided
                                >
                                    Accept
                                </button>
                            </li>
                        ))}
                    </ul>
                ) : (
                    <p className="text-gray-400 mt-2">No incoming challenges.</p>
                )
            ) : (
                 <p className="text-gray-400 mt-2">Log in to see incoming challenges.</p>
            )}
        </div>
    );
} 