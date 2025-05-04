import { useState, useCallback, useRef, useEffect } from 'react';
// import { nip19 } from 'nostr-tools'; // Removed unused import
// import { nip19 } from 'nostr-tools'; // Still useful for npub encoding
import NDK, { NDKNip07Signer, NDKUser } from '@nostr-dev-kit/ndk'; // Removed NDKNip46Signer, NDKEvent, NDKSubscription, NDKPrivateKeySigner
import { useNDKInit } from './useNDKInit'; // Import the custom NDK init hook
// Persistence functions removed as per user request
// import { idb } from '../utils/idb';
import { NostrConnectSignerWrapper } from '../lib/applesauce-nip46/wrapper.ts'; // Corrected path

// Define constants (similar to App.tsx)
// NSEC_APP_HEX_PUBKEY removed as it's no longer used as a default
// const DEFAULT_NIP46_BUNKER_IDENTIFIER = 'nsec.app'; // Switch back to nsec.app for testing
// const DEFAULT_NIP46_BUNKER_IDENTIFIER = 'nostr.mom'; // Try nostr.mom
// const DEFAULT_NIP46_BUNKER_IDENTIFIER = 'npub1a5ve7g6q34lepmrns7c6jcrat93w4cd6lzayy89cvjsfzzwnyc4s6a66d8'; // Try bunker npub directly
const DEFAULT_NIP46_BUNKER_IDENTIFIER = 'bunker://ed199f5e5ad67c6c907b0ac31fb28f3a3d199783d80886312b2984198f9aae8c?relay=wss%3A%2F%2Frelay.nsec.app'; // Default to a full bunker URI
// const NIP46_CONNECT_TIMEOUT = 75000; // Removed unused variable
const LOCALSTORAGE_NIP46_BUNKER_URI = 'nip46_bunker_uri'; // Store the full bunker URI

export type LoginMethod = 'none' | 'nip07' | 'nip46';
// Update Nip46Status type to include the new mobile state
export type Nip46Status = 'idle' | 'connecting' | 'connected' | 'failed' | 'disconnected' | 'waiting_for_scan' | 'waiting_for_mobile_approval';

export interface UseAuthReturn {
    ndk: NDK | undefined;
    isNdkReady: boolean; // From useNDKInit
    ndkConnectionError: Error | null; // From useNDKInit
    currentUser: NDKUser | null;
    currentUserNpub: string | null;
    isLoggedIn: boolean;
    loginMethod: LoginMethod; // Keep this to know which method initiated login
    nip46AuthUrl: string | null; // Add back for QR code URI
    nip46Status: Nip46Status;
    authError: Error | null;
    loginWithNip07: () => Promise<void>;
    initiateNip46Login: (bunkerUri?: string) => Promise<void>; // Bunker URI flow
    initiateNip46QrCodeLogin: () => Promise<void>; // New QR Code flow
    initiateNip46MobileDeepLinkLogin: () => Promise<void>; // <-- Add new function type
    logout: () => Promise<void>;
    cancelNip46LoginAttempt: () => void; // May need adjustment or removal if not applicable to wrapper
}

export const useAuth = (): UseAuthReturn => {
    // Get NDK instance and connection state from our custom hook
    const { ndkInstance: ndk, isReady: isNdkReady, connectionError: ndkConnectionError } = useNDKInit();

    const [currentUser, setCurrentUser] = useState<NDKUser | null>(null);
    const [loginMethod, setLoginMethod] = useState<LoginMethod>('none');
    const [nip46AuthUrl, setNip46AuthUrl] = useState<string | null>(null); // Add state for Auth URL
    const [nip46Status, setNip46Status] = useState<Nip46Status>('idle');
    const [authError, setAuthError] = useState<Error | null>(null);
    const [isLoggedInState, setIsLoggedInState] = useState<boolean>(false); // Add state for login status

    // Ref to hold the current NIP-46 signer instance (could be bunker or QR code flow)
    const nip46SignerRef = useRef<NostrConnectSignerWrapper | null>(null);
    const nip46AbortControllerRef = useRef<AbortController | null>(null); // For potential cancellation (bunker flow)
    // Ref to hold the temporary signer used ONLY for QR code generation/initial connection
    const tempNip46SignerRef = useRef<NostrConnectSignerWrapper | null>(null);

    const isLoggedIn = isLoggedInState; // Use state variable
    const currentUserNpub = currentUser ? currentUser.npub : null;

    // --- Cleanup NIP-46 (Needs to handle both flows) ---
    const cleanupNip46 = useCallback((clearPersistence = false) => {
        console.log("[useAuth] Cleaning up NIP-46 state.");

        // Cancel any ongoing connection attempt (bunker flow)
        if (nip46AbortControllerRef.current) {
             console.log("[useAuth] Aborting NIP-46 bunker connection attempt.");
             nip46AbortControllerRef.current.abort();
             nip46AbortControllerRef.current = null;
        }

        // Close the main signer (if connected)
        if (nip46SignerRef.current?.isConnected) {
            console.log("[useAuth] Closing main NIP-46 signer wrapper.");
            nip46SignerRef.current.close(); // Use close()
        }
        nip46SignerRef.current = null; // Clear the main ref

        // Close the temporary QR code signer (if it exists)
        if (tempNip46SignerRef.current) {
            console.log("[useAuth] Closing temporary NIP-46 QR signer wrapper.");
            tempNip46SignerRef.current.close(); // Use close()
            tempNip46SignerRef.current = null;
        }

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

    // --- New QR Code Login ---
    const initiateNip46QrCodeLogin = useCallback(async () => {
        if (!ndk || !isNdkReady) {
            setAuthError(new Error("NDK not ready for NIP-46."));
            return;
        }
        if (['connecting', 'connected', 'waiting_for_scan', 'waiting_for_mobile_approval'].includes(nip46Status)) {
            console.warn("[useAuth] NIP-46 login already in progress or connected.");
            return;
        }

        console.log("[useAuth] Initiating NIP-46 login with QR code...");

        cleanupNip46(); // Clean previous attempts
        setLoginMethod('nip46');
        setAuthError(null);
        // Set status immediately to prevent race conditions
        setNip46Status('waiting_for_scan'); 

        try {
            // 1. Create a temporary signer wrapper instance
            // We don't provide remote or bunkerUri, so it won't auto-connect.
            // It will generate its own internal SimpleSigner for this session.
            const tempSigner = new NostrConnectSignerWrapper({ ndk });
            tempNip46SignerRef.current = tempSigner; // Store ref immediately

            // 2. Generate the nostrconnect URI
            const metadata = { name: "ZapSlinggers" }; // Basic metadata
            const authUrl = tempSigner.getNostrConnectURI(metadata);
            console.log(`[useAuth QR Flow] Generated authUrl: ${authUrl}, Type: ${typeof authUrl}`);
            setNip46AuthUrl(authUrl);
            console.log("[useAuth] Generated NIP-46 Auth URL for QR code.");
            // Status is already 'waiting_for_scan'

            // 3. Wait for the user to scan and connect
            console.log("[useAuth] Waiting for QR code scan and connection...");
            // blockUntilReady waits for the userPromise to resolve, which happens
            // internally when the underlying NostrConnectSigner connects.
            const user = await tempSigner.blockUntilReady(); 
            
            // 4. Connection successful!
            console.log(`[useAuth] NIP-46 QR connection successful! User: ${user.npub}`);

            // Move temporary signer to main signer ref and set as NDK signer
            nip46SignerRef.current = tempSigner;
            tempNip46SignerRef.current = null; // Clear temp ref
            ndk.signer = tempSigner; 

            // Update auth state
            setCurrentUser(user);
            setIsLoggedInState(true);
            setLoginMethod('nip46');
            setNip46Status('connected');
            setNip46AuthUrl(null); // Clear the auth URL now that we're connected
            setAuthError(null);

            // --- Persist connection details? --- 
            // Unlike bunker URI, nostrconnect doesn't have an obvious single string
            // to persist for reconnect. We might need to store remote pubkey/relays 
            // if we want auto-reconnect for QR flow.
            // For now, skipping persistence for QR flow.
            console.log("[useAuth] QR flow connection complete. Persistence skipped for this method.");

        } catch (error: unknown) {
            console.error("[useAuth] NIP-46 QR connection failed:", error);
            setAuthError(error instanceof Error ? error : new Error("Failed to connect via NIP-46 QR code."));
            // Reset status fully on error
            cleanupNip46(); // Full cleanup, including setting status to idle
        }
    }, [ndk, isNdkReady, nip46Status, cleanupNip46]);

    // --- Mobile Deep Link Login ---
    const initiateNip46MobileDeepLinkLogin = useCallback(async () => {
        if (!ndk || !isNdkReady) {
            setAuthError(new Error("NDK not ready for NIP-46."));
            return;
        }
        if (['connecting', 'connected', 'waiting_for_scan', 'waiting_for_mobile_approval'].includes(nip46Status)) {
            console.warn("[useAuth] NIP-46 login already in progress or connected.");
            return;
        }

        console.log("[useAuth] Initiating NIP-46 mobile deeplink login...");

        cleanupNip46(); // Clean previous attempts
        setLoginMethod('nip46');
        setAuthError(null);
        // Set status immediately
        setNip46Status('waiting_for_mobile_approval'); 

        try {
            // 1. Create temporary signer wrapper (same as QR flow)
            const tempSigner = new NostrConnectSignerWrapper({ ndk });
            tempNip46SignerRef.current = tempSigner;

            // 2. Generate the nostrconnect URI (same as QR flow)
            const metadata = { name: "ZapSlinggers" }; // Basic metadata
            const authUrl = tempSigner.getNostrConnectURI(metadata);
            console.log("[useAuth] Generated NIP-46 Auth URL for mobile deeplink:", authUrl);

            // 3. Attempt to trigger the deeplink
            console.log("[useAuth] Attempting to open mobile deeplink using window.open...");
            // Try window.open instead of window.location.href
            const appWindow = window.open(authUrl, '_blank'); 
            if (!appWindow) {
                // Handle pop-up blocker or inability to open
                console.error("[useAuth] Failed to open deeplink window/tab. Pop-up blocker?");
                // Maybe provide fallback instructions here?
                setAuthError(new Error("Could not open signer app. Please ensure pop-ups are allowed or try manually copying the URI."));
                // Don't cleanup immediately, maybe user can still copy/paste?
                // Set status back? Or add a new status?
                setNip46Status('failed'); // Or a specific 'deeplink_failed' status?
                return; 
            }

            // 4. Wait for the user to approve in the mobile app and connect back
            console.log("[useAuth] Waiting for mobile app approval and connection...");
            // blockUntilReady waits for the userPromise to resolve via relay messages
            const user = await tempSigner.blockUntilReady(); 
            
            // 5. Connection successful!
            console.log(`[useAuth] NIP-46 mobile deeplink connection successful! User: ${user.npub}`);

            // Move temporary signer to main signer ref and set as NDK signer
            nip46SignerRef.current = tempSigner;
            tempNip46SignerRef.current = null;
            ndk.signer = tempSigner;

            // Update auth state
            setCurrentUser(user);
            setIsLoggedInState(true);
            setLoginMethod('nip46');
            setNip46Status('connected');
            // setNip46AuthUrl(null); // No URL was displayed
            setAuthError(null);

            // Skipping persistence for mobile deeplink flow (same as QR)
            console.log("[useAuth] Mobile deeplink flow connection complete. Persistence skipped.");

        } catch (error: unknown) {
            console.error("[useAuth] NIP-46 mobile deeplink connection failed:", error);
            setAuthError(error instanceof Error ? error : new Error("Failed to connect via NIP-46 mobile app."));
            // Reset status fully on error
            cleanupNip46(); // Full cleanup
        }
    }, [ndk, isNdkReady, nip46Status, cleanupNip46]);

    // --- Cancel NIP-46 (Needs adjustment?) ---
    // This currently only aborts the bunker URI flow. 
    // For QR flow, we might need to call close() on the temp signer?
    const cancelNip46LoginAttempt = useCallback(() => {
        console.log("[useAuth] Attempting to cancel NIP-46 login...");
        if (nip46AbortControllerRef.current) { // Bunker flow
            nip46AbortControllerRef.current.abort(); 
        } else if (tempNip46SignerRef.current) { // QR flow (before connection)
            // Close the temporary signer to stop listening
            tempNip46SignerRef.current.close();
            tempNip46SignerRef.current = null;
        } 
        // Cleanup resets state etc.
        cleanupNip46(); 
        setAuthError(new Error("NIP-46 connection cancelled by user.")); 
    }, [cleanupNip46]);

    // --- Return Auth State and Functions ---
    return {
        ndk,
        isNdkReady,
        ndkConnectionError,
        currentUser,
        currentUserNpub,
        isLoggedIn,
        loginMethod,
        nip46AuthUrl,
        nip46Status,
        authError,
        loginWithNip07,
        initiateNip46Login,
        initiateNip46QrCodeLogin,
        initiateNip46MobileDeepLinkLogin,
        logout,
        cancelNip46LoginAttempt,
    };
};

// Cleaned up extra comments from previous edit