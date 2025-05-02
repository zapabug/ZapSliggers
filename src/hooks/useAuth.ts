import { useState, useCallback, useRef, useEffect } from 'react';
// import { nip19 } from 'nostr-tools'; // Removed unused import
// import { nip19 } from 'nostr-tools'; // Still useful for npub encoding
import NDK, { NDKNip07Signer, NDKNip46Signer, NDKUser, NDKPrivateKeySigner, NDKEvent, NDKSubscription } from '@nostr-dev-kit/ndk'; // Removed unused NostrEvent
import { useNDKInit } from './useNDKInit'; // Import the custom NDK init hook
// Persistence functions removed as per user request
// import { idb } from '../utils/idb';

// Define constants (similar to App.tsx)
// NSEC_APP_HEX_PUBKEY removed as it's no longer used as a default
// const DEFAULT_NIP46_BUNKER_IDENTIFIER = 'nsec.app'; // Switch back to nsec.app for testing
// const DEFAULT_NIP46_BUNKER_IDENTIFIER = 'nostr.mom'; // Try nostr.mom
const DEFAULT_NIP46_BUNKER_IDENTIFIER = 'npub1a5ve7g6q34lepmrns7c6jcrat93w4cd6lzayy89cvjsfzzwnyc4s6a66d8'; // Try bunker npub directly
const NIP46_CONNECT_TIMEOUT = 75000; // 75 seconds
const LOCALSTORAGE_NIP46_PUBKEY = 'nip46_signer_pubkey';
const LOCALSTORAGE_NIP46_TEMP_NSEC = 'nip46_temp_nsec';

export type LoginMethod = 'none' | 'nip07' | 'nip46';
// Simplified NIP-46 Status for manual flow
export type Nip46Status = 'idle' | 'requesting' | 'connected' | 'failed' | 'disconnected';

export interface UseAuthReturn {
    ndk: NDK | undefined;
    isNdkReady: boolean; // From useNDKInit
    ndkConnectionError: Error | null; // From useNDKInit
    currentUser: NDKUser | null;
    currentUserNpub: string | null;
    isLoggedIn: boolean;
    loginMethod: LoginMethod;
    nip46AuthUrl: string | null;
    nip46Status: Nip46Status;
    authError: Error | null;
    loginWithNip07: () => Promise<void>;
    initiateNip46Login: (bunkerIdentifier?: string) => Promise<void>;
    logout: () => Promise<void>;
    cancelNip46LoginAttempt: () => void;
}

export const useAuth = (): UseAuthReturn => {
    // Get NDK instance and connection state from our custom hook
    const { ndkInstance: ndk, isReady: isNdkReady, connectionError: ndkConnectionError } = useNDKInit();

    const [currentUser, setCurrentUser] = useState<NDKUser | null>(null);
    const [loginMethod, setLoginMethod] = useState<LoginMethod>('none');
    const [nip46AuthUrl, setNip46AuthUrl] = useState<string | null>(null);
    const [nip46Status, setNip46Status] = useState<Nip46Status>('idle');
    const [authError, setAuthError] = useState<Error | null>(null);

    // Refs for manual NIP-46 flow
    const nip46TempNsecRef = useRef<string | null>(null);
    const nip46SubscriptionRef = useRef<NDKSubscription | null>(null);
    const nip46TimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null); // Use ReturnType for better typing

    const isLoggedIn = !!currentUser;
    const currentUserNpub = currentUser ? currentUser.npub : null;

    // --- Cleanup NIP-46 --- 
    const cleanupNip46 = useCallback((clearPersistence = false) => {
        console.log("[useAuth] Cleaning up NIP-46 state.");
        if (nip46TimeoutRef.current) clearTimeout(nip46TimeoutRef.current);
        nip46TimeoutRef.current = null; // Clear the ref

        if (nip46SubscriptionRef.current) {
            console.log("[useAuth] Stopping NIP-46 subscription.");
            nip46SubscriptionRef.current.stop();
            nip46SubscriptionRef.current = null;
        }

        // Clear signer if it was NIP-46 derived from this hook's process
        if (ndk?.signer instanceof NDKNip46Signer) {
            // We might want a more robust check if other NIP-46 signers could exist
            console.log("[useAuth] Clearing NDK NIP-46 signer.");
            ndk.signer = undefined;
        }

        nip46TempNsecRef.current = null; // Clear temp key from memory
        setNip46AuthUrl(null);
        setNip46Status('idle');

        if (clearPersistence) {
            console.log("[useAuth] Clearing NIP-46 persistence.");
            try {
                localStorage.removeItem(LOCALSTORAGE_NIP46_PUBKEY);
                localStorage.removeItem(LOCALSTORAGE_NIP46_TEMP_NSEC);
            } catch (e) {
                console.error("Failed to clear NIP-46 localStorage:", e);
            }
        }
    }, [ndk]);

    // --- Logout --- 
    const logout = useCallback(async () => {
        console.log("[useAuth] Logging out...");
        setCurrentUser(null);
        setLoginMethod('none');
        setAuthError(null);
        cleanupNip46(true); // Clear NIP-46 state AND persistence
        // Persistence removed
        // try { ... clear persisted data ... } catch ...
        // Clear signer from NDK if it wasn't NIP-46 (e.g., NIP-07)
        if (ndk?.signer && !(ndk.signer instanceof NDKNip46Signer)) {
            ndk.signer = undefined;
             console.log("[useAuth] Cleared non-NIP-46 NDK signer on logout.");
        }
    }, [ndk, cleanupNip46]);

    // --- NIP-07 Login --- 
    const loginWithNip07 = useCallback(async () => {
        if (!ndk || !isNdkReady || isLoggedIn) return;
        console.log("[useAuth] Attempting NIP-07 login...");
        setLoginMethod('nip07');
        setAuthError(null);
        try {
            if (!window.nostr) {
                throw new Error("NIP-07 extension (window.nostr) not found.");
            }
            const nip07signer = new NDKNip07Signer();
            ndk.signer = nip07signer;
            // Small delay might help extension respond
            await new Promise(resolve => setTimeout(resolve, 150)); 
            const user = await nip07signer.user();
            console.log(`[useAuth] NIP-07 logged in as: ${user.npub}`);
            setCurrentUser(user);
            setLoginMethod('nip07');
            // Clear any previous NIP-46 state AND persistence
            cleanupNip46(true);
        } catch (error) {
            console.error("[useAuth] NIP-07 login failed:", error);
            setAuthError(error instanceof Error ? error : new Error("NIP-07 login failed or rejected."));
            setLoginMethod('none'); // Reset login method
            if (ndk) ndk.signer = undefined; // Clear failed signer
            // Should we automatically try NIP-46 here? Or let the UI decide?
            // For now, just report the error.
        }
    }, [ndk, isNdkReady, isLoggedIn, cleanupNip46]);

    // --- NIP-46 Login (Manual Handshake) ---
    const initiateNip46Login = useCallback(async (bunkerIdentifier?: string) => { // Make identifier optional
        if (!ndk || !isNdkReady) {
            setAuthError(new Error("NDK not ready for NIP-46."));
            return;
        }
        if (nip46Status === 'requesting' || nip46Status === 'connected') {
            console.warn("[useAuth] NIP-46 login already in progress or connected.");
            return;
        }

        // Default to the constant if no identifier is provided
        const targetBunker = bunkerIdentifier?.trim() || DEFAULT_NIP46_BUNKER_IDENTIFIER;
        console.log(`[useAuth] Initiating manual NIP-46 login for bunker: ${targetBunker}`);

        cleanupNip46(); // Clean previous attempts but keep persistence
        setLoginMethod('nip46');
        setNip46Status('requesting');
        setAuthError(null);

        try {
            // 1. Generate Temporary Local Keypair
            const localSigner = NDKPrivateKeySigner.generate();
            nip46TempNsecRef.current = localSigner.privateKey!; // Store nsec in ref
            const localPubkey = localSigner.pubkey; // Corrected property access
            console.log(`[useAuth] Generated temp local pubkey: ${localPubkey}`);

            // 2. Construct Bunker URI
            const relayUrls = ndk.explicitRelayUrls || [];
            if (relayUrls.length === 0) {
                throw new Error("No explicit relays configured in NDK for NIP-46 URI.");
            }

            // Define app metadata
            const appMetadata = { name: "Klunkstr" }; // Simple metadata
            const encodedMetadata = encodeURIComponent(JSON.stringify(appMetadata));

            // Use nostrconnect:// scheme and add metadata parameter
            let connectUrl = `nostrconnect://${localPubkey}?relay=${encodeURIComponent(relayUrls[0])}`;
            // Add additional relays if present
            relayUrls.slice(1).forEach(relay => {
                connectUrl += `&relay=${encodeURIComponent(relay)}`;
            });
            // Add the required metadata parameter
            connectUrl += `&metadata=${encodedMetadata}`;

            // Store the URI for QR code display
            console.log(`[useAuth] Generated NIP-46 Connect URI: ${connectUrl}`);
            setNip46AuthUrl(connectUrl); // Use the new variable name

            // 3. Subscribe to NIP-46 Responses
            console.log(`[useAuth] Subscribing for NIP-46 responses to temp pubkey: ${localPubkey}`);
            const sub = ndk.subscribe(
                [{ kinds: [24133], '#p': [localPubkey] }],
                { closeOnEose: false } // Keep listening until we get the response or timeout
            );
            nip46SubscriptionRef.current = sub;

            sub.on('event', async (event: NDKEvent) => {
                // --- Start Added Debug Logging ---
                console.log(`[useAuth Debug] NIP-46 'event' callback TRIGGERED. Current Status: ${nip46Status}. Event ID: ${event.id}, Kind: ${event.kind}, Author: ${event.pubkey}`);

                // Check if temporary nsec still exists (it should)
                if (!nip46TempNsecRef.current) {
                    console.error("[useAuth Debug] Event callback triggered, BUT temporary nsec is missing! Aborting processing.");
                    return; // Should not happen if called legitimately after initiateNip46Login
                }
                 // --- End Added Debug Logging ---

                try {
                    console.log("[useAuth] Received potential NIP-46 event (pre-decryption):", event.rawEvent()); // Log raw event first
                    // Basic validation - should be kind 24133
                    if (event.kind !== 24133) {
                         console.log(`[useAuth] Ignoring event ${event.id}, kind is not 24133.`);
                         return;
                    }

                    // Decrypt content (should be sent by the remote signer)
                    // Use the stored temporary signer
                    const localSigner = new NDKPrivateKeySigner(nip46TempNsecRef.current!);
                    console.log(`[useAuth] Attempting to decrypt event ${event.id} from ${event.pubkey} using temp key ${localSigner.pubkey}...`);
                    await event.decrypt(undefined, localSigner); // Decrypt using our temp key
                    console.log(`[useAuth] Event ${event.id} decrypted successfully.`);

                    const params = JSON.parse(event.content);
                    console.log("[useAuth] Decrypted NIP-46 response params:", params);

                    // Check if it's the 'connect' confirmation
                    if (params.result === 'ack' || params.method === 'connect') { // Allow 'ack' or explicit 'connect'
                        console.log("[useAuth] Received NIP-46 connect confirmation from:", event.pubkey);

                        // Stop listening
                        if (nip46SubscriptionRef.current) nip46SubscriptionRef.current.stop();
                        if (nip46TimeoutRef.current) clearTimeout(nip46TimeoutRef.current);

                        const remoteSignerPubkey = event.pubkey;
                        const tempNsec = nip46TempNsecRef.current; // Get nsec before clearing ref

                        if (!tempNsec) {
                             throw new Error("Temporary nsec lost before connection finalization.");
                        }

                        // Persist the necessary info
                        try {
                            localStorage.setItem(LOCALSTORAGE_NIP46_PUBKEY, remoteSignerPubkey);
                            localStorage.setItem(LOCALSTORAGE_NIP46_TEMP_NSEC, tempNsec);
                            console.log("[useAuth] Persisted NIP-46 remote pubkey and temp nsec.");
                        } catch (e) {
                             console.error("Failed to save NIP-46 details to localStorage:", e);
                             // Proceed without persistence? Or fail? For now, proceed.
                        }


                        // Instantiate the *actual* NDKNip46Signer
                        const finalSigner = new NDKNip46Signer(ndk, remoteSignerPubkey, undefined);
                        ndk.signer = finalSigner;

                        // Fetch user profile using the new signer (this should happen after signer is set)
                        console.log("[useAuth] Attempting to fetch user profile with NIP-46 signer...");
                        const user = await finalSigner.user();
                        console.log(`[useAuth] NIP-46 successfully connected and logged in as: ${user.npub}`);

                    setCurrentUser(user);
                    setLoginMethod('nip46');
                    setNip46Status('connected');
                        setNip46AuthUrl(null); // Clear URI
                        nip46TempNsecRef.current = null; // Clear temp key from memory after use

                    } else {
                        console.warn("[useAuth] Received non-connect NIP-46 response:", params);
                        // Handle other potential responses like errors if needed
                         if (params.error) {
                            throw new Error(`NIP-46 Error from Bunker: ${params.error}`);
                        }
                    }
                } catch (e) {
                    console.error("[useAuth] Error processing NIP-46 event:", e);
                    setAuthError(e instanceof Error ? e : new Error("Failed to process NIP-46 response."));
                    setNip46Status('failed');
                    cleanupNip46(true); // Clear persistence on error
                }
            });

            // 4. Set Timeout
            if (nip46TimeoutRef.current) clearTimeout(nip46TimeoutRef.current);
            nip46TimeoutRef.current = setTimeout(() => {
                console.warn("[useAuth] NIP-46 connection timed out waiting for response.");
                setAuthError(new Error("NIP-46 connection timed out. Please try again."))
                setNip46Status('failed');
                cleanupNip46(); // Clean up but keep persistence in case user approves late? Maybe clear? Let's clear.
                cleanupNip46(true);
            }, NIP46_CONNECT_TIMEOUT);

        } catch (error) {
            console.error("[useAuth] Failed to initiate NIP-46 manual handshake:", error);
            setAuthError(error instanceof Error ? error : new Error("NIP-46 connection setup failed."));
            setNip46Status('failed');
            cleanupNip46(true); // Clear persistence on setup error
        }
    }, [ndk, isNdkReady, nip46Status, cleanupNip46]);

    // --- Cancel NIP-46 --- 
    const cancelNip46LoginAttempt = useCallback(() => {
         console.log("[useAuth] Cancelling NIP-46 attempt.");
         setAuthError(null);
         cleanupNip46(); // Clean up state, keep persistence if user might still approve
         setLoginMethod('none'); // Reset login method
    }, [cleanupNip46]);

    // --- Initialization Effect (Check localStorage for NIP-46) ---
    useEffect(() => {
        if (ndk && isNdkReady && !isLoggedIn && loginMethod === 'none') { // Only run if ready and not already logged in
            console.log("[useAuth] Checking persistence for NIP-46 session...");
            try {
                const storedPubkey = localStorage.getItem(LOCALSTORAGE_NIP46_PUBKEY);
                const storedNsec = localStorage.getItem(LOCALSTORAGE_NIP46_TEMP_NSEC);

                if (storedPubkey && storedNsec) {
                    console.log(`[useAuth] Found persisted NIP-46 session for pubkey: ${storedPubkey}`);
                    setLoginMethod('nip46'); // Mark as NIP-46 login
                    setNip46Status('connected'); // Assume connected initially

                    // MODIFIED: Pass undefined as the 3rd argument like tvapp
                    const nip46Signer = new NDKNip46Signer(ndk, storedPubkey, undefined);
                    ndk.signer = nip46Signer;

                    // Attempt to fetch user immediately to confirm connection
                    console.log("[useAuth] Attempting to fetch user profile to confirm restored NIP-46 session...");
                    nip46Signer.user()
                        .then(user => {
                            console.log(`[useAuth] Successfully re-established NIP-46 session for: ${user.npub}`);
                            setCurrentUser(user);
                        })
                        .catch(err => {
                            console.error("[useAuth] Failed to re-establish persisted NIP-46 session:", err);
                            setAuthError(new Error("Failed to reconnect NIP-46 session. Please log in again."));
                            // Clear invalid persisted data and log out state
                            logout(); // Use logout to ensure full cleanup including persistence
                        });
                } else {
                    console.log("[useAuth] No persisted NIP-46 session found.");
                }
            } catch (e) {
                console.error("Error reading NIP-46 persistence:", e);
                // Potentially clear corrupted data?
                 localStorage.removeItem(LOCALSTORAGE_NIP46_PUBKEY);
                 localStorage.removeItem(LOCALSTORAGE_NIP46_TEMP_NSEC);
            }
        }
    }, [ndk, isNdkReady, isLoggedIn, loginMethod, logout]); // Added logout dependency for cleanup


    // Ensure initiateNip46Login is stable for effects/callbacks that might depend on it
    const stableInitiateNip46Login = useCallback(initiateNip46Login, [ndk, isNdkReady, nip46Status, cleanupNip46]);

    return {
        ndk,
        isNdkReady,
        ndkConnectionError,
        currentUser,
        currentUserNpub,
        isLoggedIn,
        loginMethod,
        nip46AuthUrl, // Renamed from nip46ConnectUri for consistency
        nip46Status,
        authError,
        loginWithNip07,
        initiateNip46Login: stableInitiateNip46Login, // Use stable version
        logout,
        cancelNip46LoginAttempt,
    };
}; 