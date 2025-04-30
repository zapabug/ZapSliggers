import React, { useState, useEffect, useCallback } from 'react'
// Remove imports from ndk-hooks
// import { useNDK, useNDKInit } from '@nostr-dev-kit/ndk-hooks'
// Import NDKNip46Signer
import { NDKNip46Signer } from '@nostr-dev-kit/ndk'
// Remove the direct import of NDK instance
// import { ndkInstance } from './main.tsx'; 
// Import the custom hook
import { useNDKInit } from './hooks/useNDKInit';
import './App.css'
// Remove unused ChallengeHandler import
// import { ChallengeHandler } from './components/ChallengeHandler'
// Remove unused PlayerHUD import
// import { PlayerHUD } from './components/ui_overlays/PlayerHUD'
import GameScreen from './components/game/GameScreen'
// import { NostrLogin } from 'nostr-login';
// Import QRCode component
import { QRCodeCanvas } from 'qrcode.react';
import { NDKUserProfile } from '@nostr-dev-kit/ndk'
import { NDKNip07Signer } from '@nostr-dev-kit/ndk';
// Remove unused import
// import { useNDK } from './hooks/useNDK'; 
import { ChallengeHandler } from './components/ChallengeHandler'; 

// Remove local relay definition
// const explicitRelayUrls = [...] 

// Removed AppProps interface
// interface AppProps { ... }

// Remove unused nsec.app bunker npub
// const NSEC_APP_NPUB = 'npub1nsecausdtexskg4qfk7aezkh56z7n5h2u5epf79cyz34dl9s8jrsvc63kl';
// Define nsec.app hex pubkey
const NSEC_APP_HEX_PUBKEY = '258c0814444344a9979816847bf9e371a8718e90bd51a777c7e952f41314a887';

interface AppState {
  ndkAvailable: boolean;
  connectionError: Error | null;
  loginMethod: 'none' | 'nip07' | 'nip46'; // Track login method
  nip46Uri: string | null; // Store the bunker URI
  nip46Status: 'idle' | 'generating' | 'waiting' | 'connecting' | 'failed'; // Track NIP-46 connection state
  player1Pubkey: string;
  gameActive: boolean; // Added to control game rendering
}

// Mock opponent pubkey for GameScreen
const MOCK_OPPONENT_PUBKEY = 'fa984bd7dbb282f07e16e7ae87b26a2a7b9b90b7246a44771f0cf5ae58018f52'; // Example pubkey (atlas)

function App() { 
  const { ndk, isReady, connectionError: ndkConnectionError } = useNDKInit(); // Rename connectionError

  const [appState, setAppState] = useState<AppState>({
    ndkAvailable: isReady,
    connectionError: ndkConnectionError, // Use renamed error
    loginMethod: 'none',
    nip46Uri: null,
    nip46Status: 'idle',
    player1Pubkey: '',
    gameActive: false, // Start inactive
  });
  
  // Update app state based on NDK init hook
  useEffect(() => {
      setAppState(prev => ({
          ...prev,
          ndkAvailable: isReady,
          connectionError: ndkConnectionError,
          // Reset login status if NDK connection drops/reconnects without pubkey
          player1Pubkey: isReady ? prev.player1Pubkey : '',
          gameActive: isReady ? prev.gameActive : false,
          loginMethod: isReady ? prev.loginMethod : 'none',
          nip46Status: isReady ? prev.nip46Status : 'idle',
          nip46Uri: isReady ? prev.nip46Uri : null,
      }));
  }, [isReady, ndkConnectionError]);

  // Fetch bunker profile when NDK is ready
  useEffect(() => {
    if (isReady && ndk) {
      console.log('[App Effect] NDK ready, fetching bunker profile...');
      // Get User object and fetch profile
      const bunkerUser = ndk.getUser({ hexpubkey: NSEC_APP_HEX_PUBKEY });
      bunkerUser.fetchProfile()
        .then((profile: NDKUserProfile | null) => { // Add type
          if (profile) {
            console.log('[App Effect] Bunker profile fetched:', profile);
          } else {
            console.warn('[App Effect] Bunker profile not found via fetch.');
          }
        })
        .catch((err: Error) => { // Add type
          console.error('[App Effect] Error fetching bunker profile:', err);
        });
    }
  }, [isReady, ndk]);

  // Function to initiate NIP-46 login
  const initiateNip46Login = useCallback(async () => {
    if (!ndk || appState.nip46Status !== 'idle') return;

    console.log('Initiating NIP-46 login...');
    setAppState(prev => ({ ...prev, loginMethod: 'nip46', nip46Status: 'generating', connectionError: null }));

    try {
      // Use the HEX pubkey instead of the npub
      console.log('[NIP46] Creating NDKNip46Signer instance...');
      const signer = new NDKNip46Signer(ndk, NSEC_APP_HEX_PUBKEY);
      console.log('[NIP46] Signer instance created:', signer);
      
      // Listen for the auth URL
      console.log('[NIP46] Attaching authUrl listener...');
      signer.on("authUrl", (url) => {
        console.log(`[NIP46] Received authUrl event: ${url}`);
        setAppState(prev => ({ ...prev, nip46Uri: url, nip46Status: 'waiting' }));
      });
      console.log('[NIP46] Attached authUrl listener.');
      
      // Listen for connection success
      console.log('[NIP46] Attaching connect listener...');
      signer.on("connect", async () => {
          console.log("[NIP46] Received connect event!");
          ndk.signer = signer;
          const user = await signer.user();
          console.log(`NIP-46 User: ${user.npub}`);
          // Revert: Set gameActive true on login
          setAppState(prev => ({ 
              ...prev, 
              player1Pubkey: user.pubkey, 
              gameActive: true, // Set gameActive back to true
              nip46Status: 'connecting',
              loginMethod: 'nip46', 
              connectionError: null,
          }));
          // Revert setTimeout logic, just clear status/uri
          setAppState(prev => ({ ...prev, nip46Status: 'idle', nip46Uri: null }));
      });
      console.log('[NIP46] Attached connect listener.');
      
      // Listen for disconnect or errors
      console.log('[NIP46] Attaching disconnect listener...');
      signer.on("disconnect", () => {
          console.log("[NIP46] Received disconnect event.");
          // Reset relevant state if disconnected unexpectedly
          if (appState.player1Pubkey) { // Only reset if we were actually logged in
             setAppState(prev => ({ 
                 ...prev, 
                 player1Pubkey: '', 
                 gameActive: false, 
                 loginMethod: 'none',
                 nip46Status: 'idle',
                 nip46Uri: null,
                 connectionError: new Error("NIP-46 disconnected.")
             }));
          }
      });
      console.log('[NIP46] Attached disconnect listener.');

      // REMOVE the call to blockUntilReady
      // await signer.blockUntilReady(); 
      console.log('[NIP46] blockUntilReady call removed/skipped.');

    } catch (error) {
      console.error("NIP-46 Initialization failed:", error);
      setAppState(prev => ({ 
          ...prev, 
          nip46Status: 'failed', 
          connectionError: error instanceof Error ? error : new Error("NIP-46 failed to initialize.") 
      }));
    }
  }, [ndk, appState.nip46Status, appState.player1Pubkey]); // Added appState.player1Pubkey dependency

  // Attempt Login Effect (NIP-46 ONLY for testing)
  useEffect(() => {
    // Log when the effect runs and its dependencies
    console.log('[Login Effect] Running. Deps:', { isReady, ndk: !!ndk, player1Pubkey: appState.player1Pubkey, loginMethod: appState.loginMethod });

    // Only attempt login if NDK is ready AND we are not already logged in AND login method is 'none'
    if (!isReady || !ndk || appState.player1Pubkey || appState.loginMethod !== 'none') {
      console.log('[Login Effect] Condition not met, exiting.', { 
        isReady, 
        hasNdk: !!ndk, 
        hasPubkey: !!appState.player1Pubkey, 
        loginMethod: appState.loginMethod 
      });
      return; 
    }

    // Directly initiate NIP-46
    // console.log('[Login Effect] Condition met. Attempting NIP-46 login directly...');
    // initiateNip46Login();

    // Original logic: Try NIP-07 first
    const attemptLogin = async () => {
      // Try NIP-07 first
      if (window.nostr) {
        console.log('Attempting NIP-07 login...');
        setAppState(prev => ({ ...prev, loginMethod: 'nip07' }));
        try {
           console.log('Checking for window.nostr:', window.nostr); // Keep the check
           // No need for explicit check now, try/catch handles it
           // if (!window.nostr) { ... } 

          const nip07signer = new NDKNip07Signer();
          ndk.signer = nip07signer;
          // Give the extension a moment? Might help sometimes.
          await new Promise(resolve => setTimeout(resolve, 100)); 
          const user = await nip07signer.user(); // This triggers the extension prompt
          const pubkey = user.pubkey;
          console.log(`NIP-07 Got user ${user.npub}`);
          console.log('NIP-07 Signer set on NDK instance');
          // Revert: Set gameActive true on login
          setAppState(prev => ({ 
              ...prev, 
              player1Pubkey: pubkey, 
              gameActive: true, // Set gameActive back to true
              loginMethod: 'nip07', 
              connectionError: null 
          }));
          console.log(`NIP-07 Signer set, state updated, pubkey: ${pubkey}`);
          // Re-add return to exit flow after NIP-07 success
          return; 

        } catch (error) {
          console.error('NIP-07 login failed or user rejected:', error);
          // NIP-07 failed, clear connection error related to it and proceed to NIP-46
          setAppState(prev => ({ ...prev, connectionError: null, loginMethod: 'none' })); 
        }
      } else {
          console.log('window.nostr not found.');
      }

      // If NIP-07 failed or wasn't available, initiate NIP-46
      console.log('Falling back to NIP-46...');
      initiateNip46Login();
    };

    attemptLogin();
  }, [isReady, ndk, appState.player1Pubkey, appState.loginMethod, initiateNip46Login]); // Added dependencies

  // useEffect for logging state changes
  useEffect(() => {
    console.log('App State Change:', { 
      ndkAvailable: isReady, 
      connectionError: appState.connectionError, // Use state's error
      player1Pubkey: appState.player1Pubkey, 
      gameActive: appState.gameActive,
      loginMethod: appState.loginMethod,
      nip46Status: appState.nip46Status,
      nip46Uri: appState.nip46Uri,
    });
  }, [isReady, appState]); // Depend on full appState object

  // Conditional rendering based on isReady from NDK hook
  if (!isReady) {
    console.log('[App Render] NDK not yet ready.');
    // Optionally show connection error message
    return (
      <div className="flex items-center justify-center h-screen w-screen bg-gray-900 text-white">
        {appState.connectionError // Check state for error
          ? `Error connecting to Nostr relays: ${appState.connectionError.message}` 
          : 'Connecting to Nostr relays...'}
      </div>
    );
  }

  // NDK is ready, proceed with rendering the rest of the app
  console.log('[App Render] NDK is ready. Checking state:',
    {
      ndk: !!ndk,
      player1Pubkey: appState.player1Pubkey,
      gameActive: appState.gameActive,
      loginMethod: appState.loginMethod,
      nip46Status: appState.nip46Status,
    }
  );

  return (
    // Ensure the main div takes full screen and prevents overflow
    <div className="relative h-dvh w-screen bg-gray-900 text-white flex flex-col overflow-hidden">

      {/* Main Content Area */} 
      <div className="flex-grow w-full h-full"> {/* Use flex-grow to fill remaining space */}
        {(() => {
          // 1. Show Game if logged in and game is active
          if (appState.player1Pubkey && appState.gameActive) {
            console.log('[App Render] Showing GameScreen');
            return (
              <GameScreen 
                localPlayerPubkey={appState.player1Pubkey} 
                opponentPubkey={MOCK_OPPONENT_PUBKEY} 
                ndk={ndk!} // NDK is guaranteed to be ready here
              />
            );
          } 
          // REMOVED INLINE LOBBY STATE - Will be handled by LobbyScreen component
          // else if (appState.player1Pubkey && !appState.gameActive) { ... } 

          // Show NIP-46 QR Code if waiting for connection (Adjusted condition number)
          else if (appState.loginMethod === 'nip46' && appState.nip46Status === 'waiting' && appState.nip46Uri) {
              console.log('[App Render] Showing NIP-46 QR Code');
              return (
                <div className="w-full h-full flex flex-col items-center justify-center p-4 text-center">
                    <p className="mb-4 text-lg">Scan with your Nostr app (e.g., Damus, Amethyst) or copy the code:</p>
                    <div className="bg-white p-4 rounded-lg mb-4">
                        <QRCodeCanvas value={appState.nip46Uri} size={256} />
                    </div>
                    <input 
                        type="text" 
                        readOnly 
                        value={appState.nip46Uri} 
                        className="w-full max-w-md p-2 border border-gray-600 rounded bg-gray-800 text-white text-xs mb-2 break-all" 
                        onClick={(e) => (e.target as HTMLInputElement).select()} // Select text on click
                    />
                    <button 
                        onClick={() => navigator.clipboard.writeText(appState.nip46Uri!)}
                        className="px-4 py-2 rounded font-semibold text-white transition-colors bg-blue-600 hover:bg-blue-700 mb-4"
                    >
                        Copy Code
                    </button>
                    <p className="text-gray-400">Waiting for connection...</p>
                     {appState.connectionError && <p className="text-red-500 text-xs mt-2">{appState.connectionError.message}</p>}
                </div>
              );
          }
          // Show NIP-46 "Connecting..." or "Generating..." message (Adjusted condition number)
          else if (appState.loginMethod === 'nip46' && (appState.nip46Status === 'connecting' || appState.nip46Status === 'generating')) {
              console.log('[App Render] Showing NIP-46 Connecting/Generating Status');
               return (
                   <div className="w-full h-full flex flex-col items-center justify-center">
                      <p className="text-xl text-gray-400">
                          {appState.nip46Status === 'generating' ? 'Generating connection code...' : 'Connecting via NIP-46...'}
                      </p>
                      {appState.connectionError && <p className="text-red-500 text-xs mt-2">{appState.connectionError.message}</p>}
                   </div>
               );
          }
          // Show NIP-07 "Trying extension..." or Initial state (Adjusted condition number)
          else if (appState.loginMethod === 'nip07' || appState.loginMethod === 'none') {
             console.log('[App Render] Showing Initial/NIP-07 Login State');
             return (
                <div className="w-full h-full flex flex-col items-center justify-center">
                   <p className="text-xl text-gray-400 mb-4">
                     {appState.loginMethod === 'nip07' ? 'Attempting login with browser extension (NIP-07)...' : 'Preparing login...'}
                   </p>
                    {/* Optional: Keep a button to manually trigger NIP-46 if NIP-07 hangs? */}
                    {/* <button onClick={initiateNip46Login} disabled={appState.nip46Status !== 'idle'} className="...">Login with Nostr App (NIP-46)</button> */}
                   {appState.connectionError && <p className="text-red-500 text-xs mt-2">{appState.connectionError.message}</p>}
                </div>
              );
          }
          // Fallback / Original "Waiting for Challenge" (Adjusted condition number)
          else { 
            console.log('[App Render] Showing Waiting for Challenge State (Fallback) - SHOULD NOT REACH if logged in');
            return (
              <div className="w-full h-full flex flex-col items-center justify-center text-center p-4">
                  <p className="text-xl text-gray-400 mb-4">Fallback State (Logged In, Game Inactive?)</p>
                  {/* This should ideally not be reached if LobbyScreen handles the logged-in-but-inactive state */} 
                  {ndk && appState.player1Pubkey && <ChallengeHandler 
                                ndk={ndk} 
                                loggedInPubkey={appState.player1Pubkey} 
                                // No callback needed here, as LobbyScreen handles it
                             />}
                   {appState.connectionError && <p className="text-red-500 text-xs mt-2">{appState.connectionError.message}</p>}
              </div>
            );
          }
        })()}
      </div>
    </div>
  )
}

export default App
