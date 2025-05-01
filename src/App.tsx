import React, { useState, useEffect } from 'react'
// Use the standard hooks from the library
// import { useNDK, useNDKInit } from '@nostr-dev-kit/ndk-hooks'
// Import NDKNip46Signer
// import { NDKNip46Signer } from '@nostr-dev-kit/ndk'
// Import the singleton NDK instance
// import { ndkInstance } from './main'; // Likely not needed if useNDKInit finds it
// Import the custom useAuth hook (which includes useNDKInit)
import { useAuth } from './hooks/useAuth'
import './App.css'
// Remove unused ChallengeHandler import
// import { ChallengeHandler } from './components/ChallengeHandler'
// Remove unused PlayerHUD import
// import { PlayerHUD } from './components/ui_overlays/PlayerHUD'
import GameScreen from './components/game/GameScreen'
// import { NostrLogin } from 'nostr-login';
// Import QRCode component
import { QRCodeCanvas } from 'qrcode.react';
// import { NDKUserProfile, NDKNip07Signer, NDKNip46Signer } from '@nostr-dev-kit/ndk'
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
// const NSEC_APP_HEX_PUBKEY = '258c0814444344a9979816847bf9e371a8718e90bd51a777c7e952f41314a887';

// Mock opponent pubkey for GameScreen
const MOCK_OPPONENT_PUBKEY = 'fa984bd7dbb282f07e16e7ae87b26a2a7b9b90b7246a44771f0cf5ae58018f52'; // Example pubkey (atlas)

function App() { 
  // Initialize ndk-hooks with the singleton instance
  // Call useNDKInit directly at the top level of the component
  // useNDKInit();

  // Use the main authentication hook
  const {
    ndk,
    isNdkReady,
    ndkConnectionError,
    currentUser,
    isLoggedIn,
    loginMethod,
    nip46AuthUrl,
    nip46Status,
    authError,
    loginWithNip07,
    initiateNip46Login,
    // logout, // Not currently used in UI?
    // cancelNip46LoginAttempt, // Not currently used in UI?
  } = useAuth();

  // Get the ndk instance via the hook
  // const { ndk } = useNDK();
  // TODO: Replace isReady and ndkConnectionError logic
  // const isReady = !!ndk; // Basic readiness check - assumes ndk is available when initialized
  // const ndkConnectionError = null; // Placeholder - need proper error handling

  // Local UI state (e.g., whether game screen is active)
  // We might still need this if `isLoggedIn` doesn't automatically mean the game starts.
  const [gameActive, setGameActive] = useState(false);
  
  // Effect to automatically attempt login when NDK is ready and user isn't logged in
  useEffect(() => {
    console.log("[App Login Trigger Effect] Check:", { isNdkReady, isLoggedIn, loginMethod });
    if (isNdkReady && !isLoggedIn && loginMethod === 'none') {
      console.log("[App Login Trigger Effect] NDK Ready, not logged in. Attempting login...");
      // Try NIP-07 first, then NIP-46 (logic is inside useAuth)
      const attemptAutoLogin = async () => {
        try {
          // Log before attempting NIP-07
          console.log("[App Login Trigger Effect] Trying NIP-07...");
          await loginWithNip07();
          // If loginWithNip07 succeeds, isLoggedIn becomes true, stopping further attempts.
          // If it fails, useAuth handles the error state, we might need to check authError here?
          // Or assume NIP-46 should be tried regardless of NIP-07 failure reason (current useAuth logic)?
        } catch { // Error handled within useAuth, catch block still needed syntactically
          console.log("[App Login Trigger Effect] NIP-07 failed or unavailable, trying NIP-46...");
          // The error is already handled within useAuth, just proceed
        }

        // Check if logged in *after* NIP-07 attempt
        // Need to re-evaluate isLoggedIn state here, potentially by reading it from useAuth again?
        // Or rely on the next render cycle?
        // Simplification: If loginMethod is still 'none' after NIP-07 attempt, try NIP-46
        // This assumes loginWithNip07 resets method to 'none' on failure.
        // Let's check the current state from useAuth again or just call NIP46.
        // Calling initiateNip46Login might be simpler if useAuth prevents duplicate attempts.
        if (loginMethod === 'none') { // Check if NIP-07 failed to set method
           console.log("[App Login Trigger Effect] NIP-07 likely failed/unavailable, initiating NIP-46...");
           initiateNip46Login(); // Use default bunker pubkey
        }
      };
      attemptAutoLogin();
    }
  }, [isNdkReady, isLoggedIn, loginMethod, loginWithNip07, initiateNip46Login]);

  // Effect to start the game once logged in
  useEffect(() => {
    if (isLoggedIn && !gameActive) {
      console.log("[App Game Start Effect] Logged in, starting game...");
      setGameActive(true);
    } else if (!isLoggedIn && gameActive) {
       console.log("[App Game Start Effect] Logged out, stopping game...");
       setGameActive(false); // Stop game if user logs out
    }
  }, [isLoggedIn, gameActive]);

  // Conditional rendering based on isReady from NDK hook
  if (!isNdkReady) {
    console.log('[App Render] NDK not yet ready.');
    // Optionally show connection error message
    return (
      <div className="flex items-center justify-center h-screen w-screen bg-gray-900 text-white">
        {ndkConnectionError 
          ? `Error connecting to Nostr relays: ${ndkConnectionError.message}` 
          : 'Connecting to Nostr relays...'}
      </div>
    );
  }

  // NDK is ready (according to custom hook), proceed with rendering the rest of the app
  console.log('[App Render] NDK is ready. Checking state:',
    {
      ndk: !!ndk,
      isLoggedIn,
      currentUserNpub: currentUser?.npub,
      gameActive,
      loginMethod,
      nip46Status,
      authError: authError?.message,
    }
  );

  return (
    // Ensure the main div takes full screen and prevents overflow
    <div className="relative h-dvh w-screen bg-gray-900 text-white flex flex-col overflow-hidden">

      {/* Main Content Area */} 
      <div className="flex-grow w-full h-full"> {/* Use flex-grow to fill remaining space */}
        {(() => {
          // A. Show Game if logged in and game is active
          if (isLoggedIn && currentUser && gameActive) {
            console.log('[App Render] Showing GameScreen');
            return (
              <GameScreen 
                localPlayerPubkey={currentUser.pubkey} 
                opponentPubkey={MOCK_OPPONENT_PUBKEY} 
                ndk={ndk!} // NDK is guaranteed to be ready here
              />
            );
          } 
          // REMOVED INLINE LOBBY STATE - Will be handled by LobbyScreen component
          // else if (appState.player1Pubkey && !appState.gameActive) { ... } 

          // B. Show NIP-46 QR Code if waiting for connection
          else if (loginMethod === 'nip46' && nip46Status === 'waiting' && nip46AuthUrl) {
              console.log('[App Render] Showing NIP-46 QR Code');
              return (
                <div className="w-full h-full flex flex-col items-center justify-center p-4 text-center">
                    <p className="mb-4 text-lg">Scan with your Nostr app (e.g., Damus, Amethyst) or copy the code:</p>
                    <div className="bg-white p-4 rounded-lg mb-4">
                        <QRCodeCanvas value={nip46AuthUrl} size={256} />
                    </div>
                    <input 
                        type="text" 
                        readOnly 
                        value={nip46AuthUrl} 
                        className="w-full max-w-md p-2 border border-gray-600 rounded bg-gray-800 text-white text-xs mb-2 break-all" 
                        onClick={(e) => (e.target as HTMLInputElement).select()} // Select text on click
                    />
                    <button 
                        onClick={() => navigator.clipboard.writeText(nip46AuthUrl!)}
                        className="px-4 py-2 rounded font-semibold text-white transition-colors bg-blue-600 hover:bg-blue-700 mb-4"
                    >
                        Copy Code
                    </button>
                    <p className="text-gray-400">Waiting for connection...</p>
                     {authError && <p className="text-red-500 text-xs mt-2">{authError.message}</p>}
                </div>
              );
          }
          // C. Show NIP-46 "Connecting..." or "Generating..." message
          else if (loginMethod === 'nip46' && (nip46Status === 'connecting' || nip46Status === 'generating')) {
              console.log('[App Render] Showing NIP-46 Connecting/Generating Status');
               return (
                   <div className="w-full h-full flex flex-col items-center justify-center">
                      <p className="text-xl text-gray-400">
                          {nip46Status === 'generating' ? 'Generating connection code...' : 'Connecting via NIP-46...'}
                      </p>
                      {authError && <p className="text-red-500 text-xs mt-2">{authError.message}</p>}
                   </div>
               );
          }
          // D. Show Initial Login / NIP-07 Attempt State
          // This covers the initial state before login attempt, or during NIP-07 prompt
          else if (!isLoggedIn) { // Covers loginMethod 'none' or 'nip07' before success
             console.log('[App Render] Showing Initial/NIP-07 Login State');
             return (
                <div className="w-full h-full flex flex-col items-center justify-center">
                   <p className="text-xl text-gray-400 mb-4">
                     {loginMethod === 'nip07' ? 'Attempting login with browser extension (NIP-07)...' : 'Preparing login...'}
                   </p>
                    {/* Optional: Keep a button to manually trigger NIP-46 if NIP-07 hangs? */} 
                    {/* <button onClick={initiateNip46Login} disabled={appState.nip46Status !== 'idle'} className=">Login with Nostr App (NIP-46)</button> */} 
                   {authError && <p className="text-red-500 text-xs mt-2">{authError.message}</p>}
                </div>
              );
          }
          // E. Logged In, but Game Not Active (e.g., Lobby state)
          else if (isLoggedIn && currentUser && !gameActive) { 
            console.log('[App Render] Showing Logged In / Lobby State');
            return (
              <div className="w-full h-full flex flex-col items-center justify-center text-center p-4">
                  <p className="text-xl text-gray-400 mb-4">Logged In! Waiting for Opponent...</p>
                  {/* TODO: Add Lobby UI, replace ChallengeHandler if needed */} 
                  {ndk && <ChallengeHandler 
                                ndk={ndk} 
                                loggedInPubkey={currentUser.pubkey} 
                                // onChallengeAccepted={(opponentPubkey) => setGameActive(true)} // Example
                             />}
                   {authError && <p className="text-red-500 text-xs mt-2">{authError.message}</p>}
              </div>
            );
          } 
          // F. Fallback: Should not be reached
          else { 
            console.warn('[App Render] Reached unexpected fallback state', { isLoggedIn, gameActive, loginMethod, nip46Status });
            return (
              <div className="w-full h-full flex flex-col items-center justify-center text-center p-4">
                 <p className="text-xl text-gray-400 mb-4">Unexpected Application State</p>
                 {authError && <p className="text-red-500 text-xs mt-2">Auth Error: {authError.message}</p>}
                 {ndkConnectionError && <p className="text-red-500 text-xs mt-2">NDK Error: {ndkConnectionError.message}</p>}
              </div>
            );
          }
        })()}
      </div>
    </div>
  )
}

export default App
