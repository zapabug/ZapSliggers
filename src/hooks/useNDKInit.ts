import { useState, useEffect, useRef } from 'react';
import ndk from '../ndk'; // Import the singleton instance
import NDK, { NDKPool, NDKRelay } from '@nostr-dev-kit/ndk';

interface UseNDKInitReturn {
  isReady: boolean;
  connectionError: Error | null;
  ndkInstance: NDK; // Return the instance for convenience
  connectedRelayCount: number; // Expose the count
}

/**
 * Hook to initialize the singleton NDK instance connection.
 * Manages connection state (ready, error).
 * Ensures connection is attempted only once on mount.
 * Provides an 'isReady' flag that becomes true ONLY when at least one relay is connected.
 */
export const useNDKInit = (): UseNDKInitReturn => {
  // Connection attempt state isn't strictly needed anymore with the new logic
  // const [isAttemptingConnection, setIsAttemptingConnection] = useState<boolean>(true);
  const [isReady, setIsReady] = useState<boolean>(false);
  const [connectionError, setConnectionError] = useState<Error | null>(null);
  const [connectedRelayCount, setConnectedRelayCount] = useState<number>(0);
  const listenersAttached = useRef<boolean>(false); // Combined listener attachment flag

  // Helper to update state based on connected relays
  const updateReadyState = (pool: NDKPool) => {
    const count = pool.connectedRelays().length;
    setConnectedRelayCount(count);
    setIsReady(count > 0);
    if (count > 0) {
      setConnectionError(null); // Clear error once connected
    }
    // console.log(`[useNDKInit] Relay count update: ${count}, isReady: ${count > 0}`);
  };

  useEffect(() => {
    let isMounted = true; // Prevent state updates on unmounted component

    // Define handlers in the useEffect scope so they are accessible by cleanup
    const handleRelayConnect = (relay: NDKRelay) => {
        console.log(`[useNDKInit] Relay CONNECTED: ${relay.url}`);
        if (isMounted) {
            updateReadyState(ndk.pool);
        }
    };

    const handleRelayDisconnect = (relay: NDKRelay) => {
        console.warn(`[useNDKInit] Relay DISCONNECTED: ${relay.url}`);
        if (isMounted) {
            // Update count after a short delay to allow potential quick reconnects
            // and prevent flickering if multiple relays disconnect at once
            setTimeout(() => {
                if (isMounted) updateReadyState(ndk.pool);
            }, 100);
        }
    };

    const handleRelayNotice = (relay: NDKRelay, notice: string) => {
         console.warn(`[useNDKInit] Relay NOTICE from ${relay.url}: ${notice}`);
    }

    const setupNDKListeners = () => {
      if (listenersAttached.current) return; // Attach only once

      console.log('useNDKInit: Setting up NDK listeners...');

      // Initial state check
      updateReadyState(ndk.pool);

      // Attach listeners (handlers are defined outside now)
      ndk.pool.on("relay:connect", handleRelayConnect);
      ndk.pool.on("relay:disconnect", handleRelayDisconnect);
      ndk.pool.on("notice", handleRelayNotice);
      listenersAttached.current = true;
      console.log('useNDKInit: Attached relay status listeners (connect, disconnect, notice).');

      // Attempt connection after listeners are set up
      console.log('useNDKInit: Attempting NDK connection...');
      ndk.connect().catch((error) => {
          console.error('useNDKInit: Error during ndk.connect():', error);
          if (isMounted) {
              setConnectionError(error instanceof Error ? error : new Error('Failed to connect NDK'));
              setIsReady(false); // Ensure ready is false on connection error
              setConnectedRelayCount(0);
          }
          // Note: Don't cleanup listeners here, connection might recover
      });
    };

    setupNDKListeners();

    return () => {
      isMounted = false;
      // Remove listeners on unmount
      if (listenersAttached.current) {
          console.log('useNDKInit: Cleaning up relay status listeners.');
          // Pass the specific handler functions to off()
          ndk.pool.off("relay:connect", handleRelayConnect);
          ndk.pool.off("relay:disconnect", handleRelayDisconnect);
          ndk.pool.off("notice", handleRelayNotice);
          listenersAttached.current = false;
      }
      // Singleton NDK is not disconnected here.
    };
  }, []); // Runs once on mount

  return { isReady, connectionError, ndkInstance: ndk, connectedRelayCount };
}; 