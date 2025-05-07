import { useState, useCallback, useEffect, useRef } from 'react';
import { nip19 } from 'nostr-tools';
import NDK, { NDKEvent, NDKKind, NDKFilter, NDKSubscription, NDKSigner } from '@nostr-dev-kit/ndk';

// Define interface for expected wrapper structure
type Nip04CapableWrapper = { nip04: { decrypt: (pubkey: string, ciphertext: string) => Promise<string>; encrypt: (pubkey: string, plaintext: string) => Promise<string>; } };

interface StoredChallenge {
    recipientPubkey: string;
    eventId: string;
    timestamp: number;
}

interface ChallengeHandlerProps {
    ndk: NDK;
    loggedInPubkey: string;
    onChallengeAccepted: (opponentPubkey: string, matchId: string) => void;
    recipientNpubOrHex: string;
    setRecipientNpubOrHex: (value: string) => void;
}

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

// --- Constants ---
const CHALLENGE_EXPIRY_MS = 3 * 60 * 1000;
const LOCALSTORAGE_KEY = 'Zapslingers_active_sent_challenge';

export default function ChallengeHandler({
    ndk,
    loggedInPubkey,
    onChallengeAccepted,
    recipientNpubOrHex,
    setRecipientNpubOrHex
}: ChallengeHandlerProps) {
    const [error, setError] = useState<string | null>(null);
    const [activeSentChallenge, setActiveSentChallenge] = useState<StoredChallenge | null>(null); // Use StoredChallenge type
    const [activeReceivedChallenge, setActiveReceivedChallenge] = useState<{ challengerPubkey: string, eventId: string } | null>(null);
    const sentChallengeTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const receivedChallengeTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const subscriptionRef = useRef<NDKSubscription | null>(null);
    const activeSentChallengeRef = useRef(activeSentChallenge); // ADD: Ref for timeout check
    const activeReceivedChallengeRef = useRef(activeReceivedChallenge); // <-- ADD Ref

    // ADD: Effect to keep ref updated
    useEffect(() => {
        activeSentChallengeRef.current = activeSentChallenge;
    }, [activeSentChallenge]);

    // <-- ADD Effect to keep received challenge ref updated
    useEffect(() => {
        activeReceivedChallengeRef.current = activeReceivedChallenge;
    }, [activeReceivedChallenge]);

    const clearSentChallengeState = useCallback(() => {
        if (sentChallengeTimeoutRef.current) {
            clearTimeout(sentChallengeTimeoutRef.current);
            sentChallengeTimeoutRef.current = null;
        }
        setActiveSentChallenge(null);
        try {
            localStorage.removeItem(LOCALSTORAGE_KEY);
        } catch (e) {
            console.error("[ChallengeHandler] Failed to remove item from localStorage:", e);
        }
    }, []);

    const clearReceivedChallengeState = useCallback(() => {
        if (receivedChallengeTimeoutRef.current) {
            clearTimeout(receivedChallengeTimeoutRef.current);
            receivedChallengeTimeoutRef.current = null;
        }
        setActiveReceivedChallenge(null);
    }, []);

    const clearTimeouts = useCallback(() => {
        // Only clear refs, state/localStorage handled by specific clear functions
        if (sentChallengeTimeoutRef.current) clearTimeout(sentChallengeTimeoutRef.current);
        if (receivedChallengeTimeoutRef.current) clearTimeout(receivedChallengeTimeoutRef.current);
        sentChallengeTimeoutRef.current = null;
        receivedChallengeTimeoutRef.current = null;
    }, []);

    // --- Effect to Load Pending Challenge on Mount ---
    useEffect(() => {
        console.log("[ChallengeHandler] Mount Effect: Checking for pending sent challenge...");
        let restoredChallenge: StoredChallenge | null = null;
        try {
            const storedData = localStorage.getItem(LOCALSTORAGE_KEY);
            console.log(`[ChallengeHandler] Raw data from localStorage for ${LOCALSTORAGE_KEY}:`, storedData);
            if (storedData) {
                const challenge: StoredChallenge = JSON.parse(storedData);
                console.log("[ChallengeHandler] Parsed challenge data:", challenge);
                // Basic validation
                if (challenge && challenge.recipientPubkey && challenge.eventId && challenge.timestamp) {
                    const timeElapsed = Date.now() - challenge.timestamp;
                     console.log(`[ChallengeHandler] Time elapsed since challenge sent: ${timeElapsed}ms`);
                    if (timeElapsed < CHALLENGE_EXPIRY_MS) {
                        const remainingTime = CHALLENGE_EXPIRY_MS - timeElapsed;
                        console.log(`[ChallengeHandler] Found VALID pending challenge ${challenge.eventId}. Restoring with ${remainingTime.toFixed(0)}ms remaining.`);
                        // setActiveSentChallenge(challenge); // Defer setting state
                        restoredChallenge = challenge;

                        // Restart expiry timer
                        sentChallengeTimeoutRef.current = setTimeout(() => {
                            console.log(`[ChallengeHandler] Restored sent challenge ${challenge.eventId} expired.`);
                            clearSentChallengeState();
                        }, remainingTime);
                    } else {
                        console.log(`[ChallengeHandler] Found EXPIRED pending challenge ${challenge.eventId}. Clearing storage.`);
                        localStorage.removeItem(LOCALSTORAGE_KEY);
                    }
                } else {
                     console.warn("[ChallengeHandler] Invalid data structure found in localStorage. Clearing.", challenge);
                     localStorage.removeItem(LOCALSTORAGE_KEY);
                }
            } else {
                 console.log("[ChallengeHandler] No pending challenge data found in localStorage.");
            }
        } catch (e) {
            console.error("[ChallengeHandler] Failed to load or parse challenge from localStorage:", e);
            localStorage.removeItem(LOCALSTORAGE_KEY); // Clear potentially corrupt data
        }

        // Set state outside the main try-catch, only if a valid challenge was found
        if (restoredChallenge) {
            setActiveSentChallenge(restoredChallenge);
             console.log("[ChallengeHandler] Restored challenge state set.");
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []); // Run only on mount
    // --- END Load Effect ---

    // WRAP handleDMEvent in useCallback
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
            console.log(`[ChallengeHandler] DM Event ${event.encode()} Tags:`, JSON.stringify(event.tags), "Found t-tag:", challengeTag);

            // <-- Use refs instead of state variables here
            const currentActiveSentChallenge = activeSentChallengeRef.current;
            const currentActiveReceivedChallenge = activeReceivedChallengeRef.current;

            if (currentActiveSentChallenge && event.pubkey === currentActiveSentChallenge.recipientPubkey && challengeTag && challengeTag[1] === currentActiveSentChallenge.eventId) {
                const isAcceptMessage = (payload && payload.type === 'accept') || content.toLowerCase() === 'accept';
                if (isAcceptMessage) {
                    console.log(`[ChallengeHandler] Received ACCEPTANCE ${event.encode()} for our challenge ${currentActiveSentChallenge.eventId} from ${event.pubkey}`);
                    const opponentPubkey = currentActiveSentChallenge.recipientPubkey;
                    const matchIdentifier = currentActiveSentChallenge.eventId;
                    clearSentChallengeState(); // Clear state AND localStorage
                    onChallengeAccepted(opponentPubkey, matchIdentifier);
                    return;
                }
            }

            const isChallengeMessage = (payload && payload.type === 'challenge') || content.toLowerCase() === 'challenge';
            if (isChallengeMessage && !challengeTag) {
                // <-- Use ref here
                if (!currentActiveSentChallenge && !currentActiveReceivedChallenge) {
                    console.log(`[ChallengeHandler] Received new CHALLENGE ${event.encode()} from ${event.pubkey}`);
                    clearReceivedChallengeState(); // Clear any lingering received timeout

                    const newReceivedChallenge = { challengerPubkey: event.pubkey, eventId: event.encode() };
                    setActiveReceivedChallenge(newReceivedChallenge);

                    receivedChallengeTimeoutRef.current = setTimeout(() => {
                        console.log(`[ChallengeHandler] Incoming challenge ${event.encode()} expired.`);
                        // Only clear if it's still the active one
                        setActiveReceivedChallenge(current => (current?.eventId === newReceivedChallenge.eventId ? null : current));
                        receivedChallengeTimeoutRef.current = null;
                    }, CHALLENGE_EXPIRY_MS);
                } else {
                     // <-- Use ref here (optional, for logging consistency)
                    console.log(`[ChallengeHandler] Ignoring new challenge ${event.encode()} while already in an active challenge state (Sent: ${!!currentActiveSentChallenge}, Received: ${!!currentActiveReceivedChallenge}).`);
                }
                return;
            }

        } catch (err) {
            console.error(`[ChallengeHandler] Failed to process DM ${event.encode()}:`, err);
        }
    }, [
        // Add ALL dependencies read inside handleDMEvent
        loggedInPubkey,
        ndk,
        // activeSentChallenge, // REMOVE
        // activeReceivedChallenge, // REMOVE
        clearSentChallengeState, // Keep (stable callback)
        onChallengeAccepted,     // Keep (prop)
        clearReceivedChallengeState // Keep (stable callback)
    ]);

    // WRAP handleEose in useCallback (even though it does nothing now, good practice)
    const handleEose = useCallback(() => {
         // console.log('[ChallengeHandler] DM subscription EOSE received.');
    }, []);

    // Now subscribeToDMs should be stable if its dependencies are stable
    const subscribeToDMs = useCallback(() => {
        if (!loggedInPubkey || !ndk) return null;
        console.log("[ChallengeHandler][subscribeToDMs] CALLED. loggedInPubkey:", loggedInPubkey);

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

    }, [ndk, loggedInPubkey, handleDMEvent, handleEose]); // Dependencies are now stable callbacks

    // --- Main Subscription Effect ---
    useEffect(() => {
        console.log("[ChallengeHandler][Main Effect RUNNING] loggedInPubkey:", loggedInPubkey, "subscribeToDMs changed:", subscribeToDMs !== subscriptionRef.current?.on);
        subscribeToDMs(); // Call subscribe, it handles the ref internally

        const cleanup = () => {
            console.log('[ChallengeHandler] Main Effect Cleanup: Stopping final DM subscription and clearing state.');
            subscriptionRef.current?.stop(); // Stop the ref'd subscription on unmount
            subscriptionRef.current = null;
            clearSentChallengeState();
            clearReceivedChallengeState();
        };

        return cleanup;
    // Dependencies now include stable callbacks
    // We trigger via subscribeToDMs callback identity if needed, but mainly via loggedInPubkey change
    }, [loggedInPubkey, subscribeToDMs, clearSentChallengeState, clearReceivedChallengeState]);
    // --- End Main Subscription Effect ---

    // Restore Manual Refresh Handler and related useEffect
    const handleManualRefresh = useCallback(() => {
        console.log("[ChallengeHandler] Manual refresh triggered.");
        subscribeToDMs(); // Re-subscribe (stops previous sub inside)
    }, [subscribeToDMs]);

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
            const sentTimestamp = Date.now();

            console.log(`Challenge sent to ${recipientHexPubkey}, event ID: ${sentEventId}`);
            const newChallenge: StoredChallenge = { // Use StoredChallenge type
                 recipientPubkey: recipientHexPubkey,
                 eventId: sentEventId,
                 timestamp: sentTimestamp
            };

            // Clear any previous state *before* setting new state
            clearSentChallengeState();
            clearReceivedChallengeState();

            setActiveSentChallenge(newChallenge);
            setRecipientNpubOrHex('');

            // --- Save to localStorage ---
            try {
                localStorage.setItem(LOCALSTORAGE_KEY, JSON.stringify(newChallenge));
                 console.log(`[ChallengeHandler] Saved challenge ${sentEventId} to localStorage.`);
            } catch (e) {
                console.error("[ChallengeHandler] Failed to save challenge to localStorage:", e);
                // Don't necessarily error out the whole process, but log it.
            }
            // --- End Save ---

            // --- Start expiry timer ---
            sentChallengeTimeoutRef.current = setTimeout(() => {
                console.log(`[ChallengeHandler] Sent challenge ${sentEventId} expired.`);
                // Check if the expiring challenge is still the active one before clearing state & localStorage
                // Use the ref here to avoid dependency array issue
                if (activeSentChallengeRef.current?.eventId === sentEventId) {
                    clearSentChallengeState();
                }
                sentChallengeTimeoutRef.current = null;
            }, CHALLENGE_EXPIRY_MS);

        } catch (e) {
            console.error("Failed to send challenge:", e);
            setError(`Failed to send challenge: ${e instanceof Error ? e.message : String(e)}`);
            clearSentChallengeState(); // Also clear potential localStorage if send fails partially
        }
    }, [
        ndk,
        loggedInPubkey,
        recipientNpubOrHex,
        // activeSentChallenge, // REMOVE: No longer needed, use ref in timeout
        // activeReceivedChallenge, // No longer needed directly, check before calling
        setRecipientNpubOrHex,
        // clearTimeouts, // Use specific clear functions now
        clearSentChallengeState,
        clearReceivedChallengeState,
        // activeSentChallenge // FIX: Re-add activeSentChallenge as it IS read in the timeout callback -- REMOVE AGAIN
    ]);

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

            clearReceivedChallengeState(); // Clear received state AND timeout
            const matchIdentifier = originalChallengeId;
            const opponent = challengerPubkey;
            onChallengeAccepted(opponent, matchIdentifier);

        } catch (e) {
            console.error("Failed to send acceptance:", e);
            setError(`Failed to send acceptance: ${e instanceof Error ? e.message : String(e)}`);
        }
    }, [ndk, loggedInPubkey, activeReceivedChallenge, onChallengeAccepted, clearReceivedChallengeState]);

    const handleDismissChallenge = useCallback(() => {
        if (!activeReceivedChallenge) return; // Prevent multiple calls
        console.log(`[ChallengeHandler] Dismissing incoming challenge: ${activeReceivedChallenge?.eventId}`);
        clearReceivedChallengeState();
        // setActiveReceivedChallenge(null); // Done by clearReceivedChallengeState
    }, [activeReceivedChallenge, clearReceivedChallengeState]);

    const canInteract = loggedInPubkey && !activeSentChallenge && !activeReceivedChallenge;
    const isWaitingForAcceptance = !!activeSentChallenge;
    const hasIncomingChallenge = !!activeReceivedChallenge;

    return (
        <div className="p-4 border rounded border-gray-600">
            {/* Restore Manual Refresh Button and surrounding div */}
             <div className="flex justify-between items-center mb-3">
                 <h2 className="text-xl font-semibold">Challenge a Player</h2>
                 {loggedInPubkey && (
                     <button
                        onClick={handleManualRefresh}
                        className="px-3 py-1 bg-gray-600 rounded hover:bg-gray-500 text-sm"
                     >
                         Refresh DMs
                     </button>
                 )}
             </div>

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
                    Challenge sent to {activeSentChallenge?.recipientPubkey ? nip19.npubEncode(activeSentChallenge.recipientPubkey).substring(0, 12) + '...' : '...'}. Waiting for acceptance.
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
