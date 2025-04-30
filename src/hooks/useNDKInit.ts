import { useState, useEffect } from 'react';
import NDK from '@nostr-dev-kit/ndk';
// Import our singleton NDK instance
import { ndkInstance } from '../main';

interface NDKInitResult {
    ndk: NDK;
    isReady: boolean;
    connectionError: Error | null;
}

/**
 * Custom hook to manage the NDK connection state for the singleton instance.
 */
export const useNDKInit = (): NDKInitResult => {
    const [isReady, setIsReady] = useState(false);
    const [connectionError, setConnectionError] = useState<Error | null>(null);

    useEffect(() => {
        // Only attempt to connect if not already connected or ready
        // (Simple check; might need refinement based on NDK internal state if available)
        if (!isReady) {
            console.log('[useNDKInit] Attempting to connect NDK singleton...');
            
            // Add listener for the first successful relay connection
            const connectListener = () => {
                console.log('[useNDKInit] First relay connected, setting isReady to true.');
                setIsReady(true);
                setConnectionError(null); // Clear any previous error
                // Remove the listener once connected
                ndkInstance.pool.off('relay:connect', connectListener);
            };
            
            ndkInstance.pool.once('relay:connect', connectListener);

            // Attempt connection
            ndkInstance.connect()
                .then(() => {
                    console.log('[useNDKInit] NDK connect promise resolved.');
                    // Note: isReady is set by the listener, not the promise resolution
                    //       because connect() resolves even if no relays connect immediately.
                })
                .catch(err => {
                    console.error('[useNDKInit] NDK connection failed:', err);
                    setConnectionError(err instanceof Error ? err : new Error('NDK connection failed'));
                    setIsReady(false);
                });
            
            // Cleanup: Remove listener if component unmounts before connection
            return () => {
                 ndkInstance.pool.off('relay:connect', connectListener);
            };
        }
    }, []); // Run only once on mount

    return { ndk: ndkInstance, isReady, connectionError };
}; 