import { useState, useCallback, useRef } from 'react';
// import { nip19 } from 'nostr-tools'; // Still useful for npub encoding
import NDK, { NDKNip07Signer, NDKNip46Signer, NDKUser } from '@nostr-dev-kit/ndk';
import { useNDKInit } from './useNDKInit'; // Import the custom NDK init hook
// Persistence functions removed as per user request
// import { idb } from '../utils/idb';

// Define constants (similar to App.tsx)
// NSEC_APP_HEX_PUBKEY removed as it's no longer used as a default
const NIP46_CONNECT_TIMEOUT = 75000; // 75 seconds

export type LoginMethod = 'none' | 'nip07' | 'nip46';
export type Nip46Status = 'idle' | 'generating' | 'waiting' | 'connecting' | 'connected' | 'failed' | 'disconnected';

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
    initiateNip46Login: (bunkerIdentifier: string) => Promise<void>;
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

    const nip46SignerRef = useRef<NDKNip46Signer | null>(null); // Ref to store the signer instance during connection
    const nip46TimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null); // Use ReturnType for better typing

    const isLoggedIn = !!currentUser;
    const currentUserNpub = currentUser ? currentUser.npub : null;

    // --- Cleanup NIP-46 --- 
    const cleanupNip46 = useCallback(() => {
        console.log("[useAuth] Cleaning up NIP-46 state.");
        if (nip46TimeoutRef.current) clearTimeout(nip46TimeoutRef.current);
        if (nip46SignerRef.current) {
            nip46SignerRef.current.removeAllListeners(); // Clean up listeners
        }
        // Only clear NDK signer if it IS the NIP-46 signer we were managing
        if (ndk?.signer && ndk.signer === nip46SignerRef.current) {
            ndk.signer = undefined;
            console.log("[useAuth] Cleared NDK signer (was NIP-46).");
        }
        nip46SignerRef.current = null;
        setNip46AuthUrl(null);
        setNip46Status('idle');
    }, [ndk]);

    // --- Logout --- 
    const logout = useCallback(async () => {
        console.log("[useAuth] Logging out...");
        setCurrentUser(null);
        setLoginMethod('none');
        setAuthError(null);
        cleanupNip46();
        // Persistence removed
        // try { ... clear persisted data ... } catch ...
        // Clear signer from NDK (if not already cleared by cleanupNip46)
        if (ndk?.signer) {
            ndk.signer = undefined;
             console.log("[useAuth] Cleared NDK signer on logout.");
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
            // Clear any previous NIP-46 state
            cleanupNip46();
        } catch (error) {
            console.error("[useAuth] NIP-07 login failed:", error);
            setAuthError(error instanceof Error ? error : new Error("NIP-07 login failed or rejected."));
            setLoginMethod('none'); // Reset login method
            if (ndk) ndk.signer = undefined; // Clear failed signer
            // Should we automatically try NIP-46 here? Or let the UI decide?
            // For now, just report the error.
        }
    }, [ndk, isNdkReady, isLoggedIn, cleanupNip46]);

    // --- NIP-46 Login --- 
    const initiateNip46Login = useCallback(async (bunkerIdentifier: string) => {
        if (!ndk || !isNdkReady) {
             setAuthError(new Error("NDK not ready for NIP-46."));
             return;
        }
        if (nip46Status !== 'idle' && nip46Status !== 'failed' && nip46Status !== 'disconnected') {
            console.warn("[useAuth] NIP-46 login already in progress or connected.");
            return;
        }
        
        console.log(`[useAuth] Initiating NIP-46 login for ${bunkerIdentifier}...`);
        cleanupNip46(); // Clean previous attempts
        setLoginMethod('nip46');
        setNip46Status('connecting');
        setAuthError(null);

        try {
            const signer = new NDKNip46Signer(ndk, bunkerIdentifier);
            nip46SignerRef.current = signer; // Store ref

            signer.on("authUrl", (url) => {
                console.log(`[useAuth] NIP-46 Auth URL: ${url}`);
                setNip46AuthUrl(url);
                setNip46Status('waiting');
                // Set timeout for user approval
                if (nip46TimeoutRef.current) clearTimeout(nip46TimeoutRef.current);
                nip46TimeoutRef.current = setTimeout(() => {
                    console.warn("[useAuth] NIP-46 connection timed out by user.");
                    setAuthError(new Error("NIP-46 connection timed out. Please try again."));
                    cleanupNip46();
                }, NIP46_CONNECT_TIMEOUT);
            });

            signer.on("connect", async () => {
                console.log("[useAuth] NIP-46 connected!");
                if (nip46TimeoutRef.current) clearTimeout(nip46TimeoutRef.current);
                ndk.signer = signer; // Set the NDK signer
                const user = await signer.user();
                console.log(`[useAuth] NIP-46 logged in as: ${user.npub}`);
                setCurrentUser(user);
                setLoginMethod('nip46');
                setNip46Status('connected');
                setNip46AuthUrl(null); // Clear auth URL
                // Persistence removed
                // try { ... save remotePubkey ... } catch ...
            });

            signer.on("disconnect", () => {
                console.log("[useAuth] NIP-46 disconnected.");
                setAuthError(new Error("NIP-46 signer disconnected."));
                // Don't call logout(), just clear NIP-46 state
                setCurrentUser(null); // Assume logout on disconnect
                setLoginMethod('none');
                cleanupNip46();
                setNip46Status('disconnected');
                 // Clear persisted data? Maybe not automatically.
                 // idb.clearNip46RemotePubkeyFromDb();
            });

            // Initiate the connection process
            console.log("[useAuth] Triggering NIP-46 connection implicitly via signer.user()...");
            // Calling user() should trigger the connection and 'authUrl' event if needed.
            signer.user().then(() => {
                // We don't necessarily need the user object here, 
                // the 'connect' event listener handles the successful login state update.
                console.log("[useAuth] NIP-46 signer.user() promise resolved (connect event handles login state)");
            }).catch(err => {
                // Handle potential errors if user() itself fails before connection
                // (though most errors should come through connect/disconnect listeners)
                console.error("[useAuth] NIP-46 signer.user() initial call failed:", err);
                // Set error only if not already handled by disconnect listener
                if (nip46Status !== 'disconnected') { 
                    setAuthError(err instanceof Error ? err : new Error("NIP-46 connection failed during initiation."));
                    setNip46Status('failed');
                    cleanupNip46();
                }
            });

        } catch (error) {
            console.error("[useAuth] NIP-46 connection failed:", error);
            setAuthError(error instanceof Error ? error : new Error("NIP-46 connection failed."));
            setNip46Status('failed');
            cleanupNip46();
        }
    }, [ndk, isNdkReady, isLoggedIn, nip46Status, cleanupNip46]);

    // --- Cancel NIP-46 --- 
    const cancelNip46LoginAttempt = useCallback(() => {
         console.log("[useAuth] Cancelling NIP-46 attempt.");
         setAuthError(null);
         cleanupNip46();
         setLoginMethod('none'); // Reset login method
    }, [cleanupNip46]);

    // --- Initialization Effect (Removed persistence check) --- 
    // useEffect(() => {
    //     if (isNdkReady && ndk && !isLoggedIn) {
    //         // Potential place for other init logic if needed
    //     }
    // }, [isNdkReady, ndk, isLoggedIn]);

    // Ensure initiateNip46Login is stable for effects/callbacks that might depend on it
    const stableInitiateNip46Login = useCallback(initiateNip46Login, [ndk, isNdkReady, isLoggedIn, nip46Status, cleanupNip46]);

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
        initiateNip46Login: stableInitiateNip46Login, // Use the stable callback
        logout,
        cancelNip46LoginAttempt,
    };
}; 