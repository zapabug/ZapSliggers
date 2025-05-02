import { useState, useCallback, useRef, useEffect } from 'react';
// import { nip19 } from 'nostr-tools'; // Removed unused import
// import { nip19 } from 'nostr-tools'; // Still useful for npub encoding
import NDK, { NDKNip07Signer, NDKUser } from '@nostr-dev-kit/ndk'; // Removed NDKNip46Signer, NDKEvent, NDKSubscription, NDKPrivateKeySigner
import { useNDKInit } from './useNDKInit'; // Import the custom NDK init hook
// Persistence functions removed as per user request
// import { idb } from '../utils/idb';
import { NostrConnectSignerWrapper } from '../lib/applesauce-nip46/wrapper'; // Corrected path

// Define constants (similar to App.tsx)
// NSEC_APP_HEX_PUBKEY removed as it's no longer used as a default
// const DEFAULT_NIP46_BUNKER_IDENTIFIER = 'nsec.app'; // Switch back to nsec.app for testing
// const DEFAULT_NIP46_BUNKER_IDENTIFIER = 'nostr.mom'; // Try nostr.mom
// const DEFAULT_NIP46_BUNKER_IDENTIFIER = 'npub1a5ve7g6q34lepmrns7c6jcrat93w4cd6lzayy89cvjsfzzwnyc4s6a66d8'; // Try bunker npub directly
const DEFAULT_NIP46_BUNKER_IDENTIFIER = 'bunker://ed199f5e5ad67c6c907b0ac31fb28f3a3d199783d80886312b2984198f9aae8c?relay=wss%3A%2F%2Frelay.nsec.app'; // Default to a full bunker URI
// const NIP46_CONNECT_TIMEOUT = 75000; // Removed unused variable
const LOCALSTORAGE_NIP46_BUNKER_URI = 'nip46_bunker_uri'; // Store the full bunker URI

export type LoginMethod = 'none' | 'nip07' | 'nip46';
// Simplified NIP-46 Status for wrapper flow
export type Nip46Status = 'idle' | 'connecting' | 'connected' | 'failed' | 'disconnected'; // Renamed 'requesting' to 'connecting'

export interface UseAuthReturn {
    ndk: NDK | undefined;
    isNdkReady: boolean; // From useNDKInit
    ndkConnectionError: Error | null; // From useNDKInit
    currentUser: NDKUser | null;
    currentUserNpub: string | null;
    isLoggedIn: boolean;
    loginMethod: LoginMethod;
    // nip46AuthUrl: string | null; // Removed, wrapper handles URI internally for connection
    nip46Status: Nip46Status;
    authError: Error | null;
    loginWithNip07: () => Promise<void>;
    initiateNip46Login: (bunkerUri?: string) => Promise<void>; // Parameter is now bunker URI
    logout: () => Promise<void>;
    cancelNip46LoginAttempt: () => void; // May need adjustment or removal if not applicable to wrapper
}

export const useAuth = (): UseAuthReturn => {
    // Get NDK instance and connection state from our custom hook
    const { ndkInstance: ndk, isReady: isNdkReady, connectionError: ndkConnectionError } = useNDKInit();

    const [currentUser, setCurrentUser] = useState<NDKUser | null>(null);
    const [loginMethod, setLoginMethod] = useState<LoginMethod>('none');
    // const [nip46AuthUrl, setNip46AuthUrl] = useState<string | null>(null); // Removed
    const [nip46Status, setNip46Status] = useState<Nip46Status>('idle');
    const [authError, setAuthError] = useState<Error | null>(null);
    const [isLoggedInState, setIsLoggedInState] = useState<boolean>(false); // Add state for login status

    // Ref to hold the current NIP-46 signer instance if needed for cancellation
    const nip46SignerRef = useRef<NostrConnectSignerWrapper | null>(null);
    const nip46AbortControllerRef = useRef<AbortController | null>(null); // For potential cancellation

    const isLoggedIn = isLoggedInState; // Use state variable
    const currentUserNpub = currentUser ? currentUser.npub : null;

    // --- Cleanup NIP-46 ---
    const cleanupNip46 = useCallback((clearPersistence = false) => {
        console.log("[useAuth] Cleaning up NIP-46 state (wrapper flow).");

        // Cancel any ongoing connection attempt
        if (nip46AbortControllerRef.current) {
             console.log("[useAuth] Aborting NIP-46 connection attempt.");
             nip46AbortControllerRef.current.abort();
             nip46AbortControllerRef.current = null;
        }

        // Disconnect the signer if it exists and is connected
        if (nip46SignerRef.current?.isConnected) {
            console.log("[useAuth] Disconnecting NIP-46 signer wrapper.");
            // Assuming the wrapper has a disconnect method
            nip46SignerRef.current.disconnect?.(); // Use optional chaining if unsure
        }
        nip46SignerRef.current = null; // Clear the ref

        // Clear signer if it was the wrapper instance
        if (ndk?.signer instanceof NostrConnectSignerWrapper) {
            console.log("[useAuth] Clearing NDK NIP-46 wrapper signer.");
            ndk.signer = undefined;
        }

        // setNip46AuthUrl(null); // Removed
        setNip46Status('idle');
        setIsLoggedInState(false); // Ensure logged out on cleanup
        setCurrentUser(null); // Clear user too

        if (clearPersistence) {
            console.log("[useAuth] Clearing NIP-46 persistence (wrapper flow).");
            try {
                localStorage.removeItem(LOCALSTORAGE_NIP46_BUNKER_URI);
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
        setIsLoggedInState(false); // Set logged out state
        cleanupNip46(true); // Clear NIP-46 state AND persistence
        // Persistence removed
        // Clear signer from NDK if it wasn't NIP-46 (e.g., NIP-07)
        if (ndk?.signer && !(ndk.signer instanceof NostrConnectSignerWrapper)) {
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
        // Ensure NIP-46 is cleaned up before attempting NIP-07
        cleanupNip46(true); // Clear NIP-46 state AND persistence

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
            setIsLoggedInState(true); // Set logged in state
        } catch (error) {
            console.error("[useAuth] NIP-07 login failed:", error);
            setAuthError(error instanceof Error ? error : new Error("NIP-07 login failed or rejected."));
            setLoginMethod('none'); // Reset login method
            setIsLoggedInState(false); // Set logged out state
            if (ndk) ndk.signer = undefined; // Clear failed signer
        }
    }, [ndk, isNdkReady, isLoggedIn, cleanupNip46]);

    // --- NIP-46 Login (Using Wrapper) ---
    const initiateNip46Login = useCallback(async (bunkerUriParam?: string) => { // Parameter is now optional bunker URI
        if (!ndk || !isNdkReady) {
            setAuthError(new Error("NDK not ready for NIP-46."));
            return;
        }
        if (nip46Status === 'connecting' || nip46Status === 'connected') {
            console.warn("[useAuth] NIP-46 login already in progress or connected.");
            return;
        }

        // Default to the constant if no URI is provided
        const targetBunkerUri = bunkerUriParam?.trim() || DEFAULT_NIP46_BUNKER_IDENTIFIER;
        console.log(`[useAuth] Initiating NIP-46 login with wrapper for bunker URI: ${targetBunkerUri}`);

        cleanupNip46(); // Clean previous attempts but keep persistence
        setLoginMethod('nip46');
        setNip46Status('connecting'); // Update status
        setAuthError(null);
        // setNip46AuthUrl(null); // Removed

        // Create an AbortController for potential cancellation
        const abortController = new AbortController();
        nip46AbortControllerRef.current = abortController;

        try {
            console.log("[useAuth] Attempting NIP-46 connection with wrapper using URI:", targetBunkerUri);

            // Instantiate the wrapper using the static helper
            // Pass the AbortSignal to the wrapper options if it supports it
            // (Assuming the wrapper's options accept a signal, adjust if not)
            const signerOptions = {
                ndk,
                signal: abortController.signal, // Pass signal
                // You might need to pass logger or other options here if wrapper supports them
            };
            const signer = await NostrConnectSignerWrapper.fromBunkerURI(targetBunkerUri, signerOptions);
            nip46SignerRef.current = signer; // Store the signer instance

            // Check if the operation was aborted during the connection attempt
             if (abortController.signal.aborted) {
                console.log("[useAuth] NIP-46 connection attempt aborted.");
                // cleanupNip46 handles status reset etc.
                return; // Exit early
            }

            if (signer.isConnected) {
                console.log("[useAuth] NIP-46 Wrapper connected successfully. Remote pubkey:", signer.remotePubkey);
                ndk.signer = signer;
                const user = await signer.user(); // Get user AFTER connection is confirmed

                // Persist bunker URI for potential auto-reconnection on refresh
                try {
                    localStorage.setItem(LOCALSTORAGE_NIP46_BUNKER_URI, targetBunkerUri);
                } catch (e) {
                    console.warn("Failed to persist NIP-46 bunker URI:", e);
                }

                setCurrentUser(user);
                setIsLoggedInState(true); // Use useState setter
                setLoginMethod('nip46');
                setNip46Status('connected');
                setAuthError(null); // Clear previous errors
            } else {
                // This path might not be reachable if fromBunkerURI throws on failure
                console.error("[useAuth] NostrConnectSignerWrapper failed to connect but didn't throw.");
                throw new Error("NostrConnectSignerWrapper failed to connect.");
            }

        } catch (error: unknown) { // Use unknown type
             const errorMessage = error instanceof Error ? error.message : String(error);
             if (error instanceof Error && error.name === 'AbortError') {
                console.log("[useAuth] NIP-46 connection explicitly aborted by user.");
                // Status is reset in cleanupNip46 called by cancelNip46LoginAttempt
            } else {
                console.error("[useAuth] NIP-46 connection using wrapper failed:", error);
                setAuthError(new Error(errorMessage || "Failed to connect via NIP-46."));
                setNip46Status('failed');
                cleanupNip46(true); // Clear everything on failure, including persistence
            }

        } finally {
             // Clear the AbortController ref once the operation completes or fails
             nip46AbortControllerRef.current = null;
             // setLoading(false); // If using a general loading state
        }
    }, [ndk, isNdkReady, nip46Status, cleanupNip46]);

    // --- Cancel NIP-46 ---
    const cancelNip46LoginAttempt = useCallback(() => {
        console.log("[useAuth] Attempting to cancel NIP-46 login...");
        if (nip46AbortControllerRef.current) {
            nip46AbortControllerRef.current.abort(); // Signal abortion
        }
        // cleanupNip46 will handle resetting state etc.
        cleanupNip46(); // Reset state, clear persistence explicitly if desired on cancel
         setAuthError(new Error("NIP-46 connection cancelled by user.")); // Provide feedback
         // Nip46Status is reset within cleanupNip46
    }, [cleanupNip46]);

    // --- Reconnect Logic (Example - Needs Integration) ---
    useEffect(() => {
        // Attempt to reconnect using persisted NIP-46 URI on initial load if NDK is ready
        const reconnect = async () => {
            if (ndk && isNdkReady && !isLoggedIn && loginMethod === 'none') {
                try {
                    const persistedBunkerUri = localStorage.getItem(LOCALSTORAGE_NIP46_BUNKER_URI);
                    if (persistedBunkerUri) {
                        console.log("[useAuth] Found persisted NIP-46 bunker URI. Attempting reconnect:", persistedBunkerUri);
                        setLoginMethod('nip46'); // Indicate attempt
                        setNip46Status('connecting');
                        await initiateNip46Login(persistedBunkerUri); // Use the main login function
                        // Status ('connected' or 'failed') will be set by initiateNip46Login
                    }
                } catch (e) {
                    console.error("[useAuth] Failed to read persisted NIP-46 URI or reconnect:", e);
                    // Clear potentially invalid persisted data
                    localStorage.removeItem(LOCALSTORAGE_NIP46_BUNKER_URI);
                    setLoginMethod('none');
                    setNip46Status('idle');
                    setIsLoggedInState(false); // Ensure logged out
                }
            }
        };
        reconnect();
        // Run only once when NDK becomes ready
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [ndk, isNdkReady /* trigger only when NDK is ready */]);

    // --- Return Auth State and Functions ---
    return {
        ndk,
        isNdkReady,
        ndkConnectionError,
        currentUser,
        currentUserNpub,
        isLoggedIn,
        loginMethod,
        // nip46AuthUrl, // Removed
        nip46Status,
        authError,
        loginWithNip07,
        initiateNip46Login,
        logout,
        cancelNip46LoginAttempt,
    };
};

// Cleaned up extra comments from previous edit