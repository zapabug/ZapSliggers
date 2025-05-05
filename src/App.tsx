import { useState, useEffect, useRef } from 'react'
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
// Removed unused import
// import { ChallengeHandler } from './components/ChallengeHandler'; 
// Import LobbyScreen
import LobbyScreen from './components/lobby/LobbyScreen';
// Import the new screen components from the correct location
// import MainMenuScreen from './components/MainMenuScreen'; // Commented out - File missing
import PracticeScreen from './components/screens/PracticeScreen'; // Corrected import path
import { isMobileDevice } from './utils/mobileDetection'; // <-- Import the utility
import DeveloperSandboxScreen from './components/screens/DeveloperSandboxScreen'; // Import the new screen
import { NDKUser, NDKEvent, NDKKind, NDKFilter, NDKSubscription } from '@nostr-dev-kit/ndk'; // Import NDKUser for type checking
// Import game settings
import { /* gameSettings, */ practiceSettings, sandboxSettings } from './config/gameSettings'; // Removed unused gameSettings import

// Remove local relay definition
// const explicitRelayUrls = [...] 

// Removed AppProps interface
// interface AppProps { ... }

// Remove unused nsec.app bunker npub
// const NSEC_APP_NPUB = 'npub1nsecausdtexskg4qfk7aezkh56z7n5h2u5epf79cyz34dl9s8jrsvc63kl';
// Define nsec.app hex pubkey
// const NSEC_APP_HEX_PUBKEY = '258c0814444344a9979816847bf9e371a8718e90bd51a777c7e952f41314a887';

// Removed unused mock opponent pubkey
// const MOCK_OPPONENT_PUBKEY = 'fa984bd7dbb282f07e16e7ae87b26a2a7b9b90b7246a44771f0cf5ae58018f52';

// Define the Developer Npub and derive the Pubkey
const DEV_NPUB = "npub10nxjs7e4vh7a05a0qz8u7x4kdtlq6nk5lugeczddk5l40x5kdysqt2e96x";
let DEV_PUBKEY: string | null = null;
try {
    const devUser = new NDKUser({ npub: DEV_NPUB });
    DEV_PUBKEY = devUser.pubkey;
    if (!DEV_PUBKEY) {
        console.error("CRITICAL ERROR: Failed to derive developer pubkey from npub.");
    }
} catch (error) {
    console.error("CRITICAL ERROR: Failed to instantiate NDKUser for developer npub:", error);
}

// Define view states
type AppView = 'login' | 'connecting_ndk' | 'menu' | 'practice' | 'lobby' | 'game' | 'dev_sandbox';

// Define an interface for elements with potential fullscreen methods
interface FullscreenElement extends HTMLElement {
  webkitRequestFullscreen?: () => Promise<void>;
  mozRequestFullScreen?: () => Promise<void>; // Firefox prefix (optional)
  msRequestFullscreen?: () => Promise<void>; // IE/Edge prefix (optional)
}

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
    // loginMethod, // Still unused, keep removed
    nip46AuthUrl, // Add back
    nip46Status,
    authError,
    loginWithNip07,
    // initiateNip46Login, // Remove unused function for now
    initiateNip46QrCodeLogin, // Add new function
    initiateNip46MobileDeepLinkLogin, // <-- Need to add this function to useAuth
    cancelNip46LoginAttempt, // <-- Assuming useAuth exports this
  } = useAuth();

  // Get the ndk instance via the hook
  // const { ndk } = useNDK();
  // TODO: Replace isReady and ndkConnectionError logic
  // const isReady = !!ndk; // Basic readiness check - assumes ndk is available when initialized
  // const ndkConnectionError = null; // Placeholder - need proper error handling

  // State for the current view
  const [currentView, setCurrentView] = useState<AppView>('connecting_ndk'); 
  // State for NIP-46 input - REMOVED as we trigger QR flow directly
  // const [bunkerUriInput, setBunkerUriInput] = useState('');
  // State for opponent pubkey when game starts
  const [opponentPubkey, setOpponentPubkey] = useState<string | null>(null);
  // State for the unique identifier of the match (derived from the challenge event)
  const [matchId, setMatchId] = useState<string | null>(null);
  // Add new state for waiting status
  const [isWaitingForOpponent, setIsWaitingForOpponent] = useState<boolean>(false);
  // Add ref for subscription
  const readySubscriptionRef = useRef<NDKSubscription | null>(null);

  // --- Fullscreen Request Handler (Moved here) ---
  const handleRequestFullscreen = () => {
    const element = document.documentElement as FullscreenElement;
    if (element.requestFullscreen) {
      element.requestFullscreen();
    } else if (element.webkitRequestFullscreen) { // Safari
      element.webkitRequestFullscreen();
    // Optional: Add checks for other prefixes if needed
    // } else if (element.mozRequestFullScreen) { // Firefox
    //   element.mozRequestFullScreen();
    // } else if (element.msRequestFullscreen) { // IE/Edge
    //   element.msRequestFullscreen();
    } else {
      console.warn("Fullscreen API not supported by this browser.");
      // Optionally display a message to the user
    }
  };

  // --- Effects to manage view transitions based on NDK and Auth state --- 
  useEffect(() => {
    console.log(`[View Effect Check] NDK Ready: ${isNdkReady}, Logged In: ${isLoggedIn}, Current View: ${currentView}`);
    if (!isNdkReady) {
      // Always show connecting if NDK isn't ready
      if (currentView !== 'connecting_ndk') {
        console.log('[View Effect] NDK not ready, setting view to connecting_ndk');
        setCurrentView('connecting_ndk');
      }
    } else if (!isLoggedIn) {
      // NDK is ready, but user not logged in -> ensure login view
      if (currentView !== 'login') {
        console.log('[View Effect] NDK ready, not logged in, setting view to login');
        setCurrentView('login');
      }
    } else { // NDK is ready AND user is logged in
      // Determine if current user is the developer
      const isDeveloper = currentUser?.pubkey === DEV_PUBKEY;
      
      if (currentView === 'connecting_ndk' || currentView === 'login') {
          console.log(`[View Effect] Logged in and NDK ready (from ${currentView}), setting view to menu`);
          setCurrentView('menu');
      } 
      // --- Add check for dev sandbox access --- 
      // If trying to access dev_sandbox but not the developer, redirect to menu
      else if (currentView === 'dev_sandbox' && !isDeveloper) {
          console.warn('[View Effect] Non-developer attempting to access dev_sandbox. Redirecting to menu.');
          setCurrentView('menu');
      } 
      // --- End check ---
      else {
           console.log(`[View Effect] Logged in and NDK ready, staying in current view: ${currentView}`);
       }
    }
  }, [isNdkReady, isLoggedIn, currentView]); 

  // --- Event Handlers for Navigation/Login --- 
  // REMOVED handleNip46Login as the button now directly calls initiateNip46Login
  // const handleNip46Login = () => {
  //     if (!bunkerUriInput.trim()) return;
  //     initiateNip46Login(bunkerUriInput.trim());
  // };

  const handleSelectPractice = () => {
      if (isLoggedIn) setCurrentView('practice');
  };

  const handleSelectMultiplayer = () => {
      if (isLoggedIn) setCurrentView('lobby');
  };

  const handleSelectDevSandbox = () => {
      // Only allow navigation if logged in AND is the developer
      if (isLoggedIn && currentUser?.pubkey === DEV_PUBKEY) {
          setCurrentView('dev_sandbox');
      } else {
          console.warn("Attempted to navigate to dev sandbox without required permissions.");
          // Optionally redirect to menu or show a message
          setCurrentView('menu');
      }
  };

  const handleBackToMenu = () => {
      setCurrentView('menu');
      setOpponentPubkey(null); // Clear opponent on back
      setMatchId(null);      // Clear match ID on back
      setIsWaitingForOpponent(false); // Add this reset
  };

  // Define the new handler for when the user *accepts* a challenge
  const handleWaitingForOpponent = (opponent: string, confirmedMatchId: string) => {
      console.log(`[App] Waiting for opponent: ${opponent}, Match ID: ${confirmedMatchId}`);
      setOpponentPubkey(opponent);
      setMatchId(confirmedMatchId); // Store the match ID
      setIsWaitingForOpponent(true);
      setCurrentView('lobby'); // Ensure we are showing the lobby (which will display the waiting message)
  };

  // Modify the existing handler for when the *challenger* receives the acceptance DM
  const handleChallengeAccepted = (opponent: string, confirmedMatchId: string) => {
      console.log(`[App] Challenge accepted by: ${opponent}, Match ID: ${confirmedMatchId}. Entering waiting state.`);
      // Instead of navigating directly to game, trigger the waiting state
      handleWaitingForOpponent(opponent, confirmedMatchId);
      // setCurrentView('game'); // REMOVED - Navigation happens later
  };

  const handleGameEnd = () => {
      console.log("[App] Multiplayer game ended, returning to menu."); // Go back to menu after game
      setOpponentPubkey(null);
      setMatchId(null); // Clear match ID on game end
      setIsWaitingForOpponent(false); // Add this reset
      setCurrentView('menu');
  };

  const handleNip46Connect = () => {
    if (isMobileDevice()) {
      console.log("[App] Mobile device detected, initiating NIP-46 deeplink flow.");
      initiateNip46MobileDeepLinkLogin(); // Call the new mobile-specific function
    } else {
      console.log("[App] Desktop device detected, initiating NIP-46 QR code flow.");
      initiateNip46QrCodeLogin(); // Call the existing QR code function
    }
  };

  // --- ADD EFFECT FOR OPPONENT READY SUBSCRIPTION --- 
  useEffect(() => {
    // Ensure we are in the waiting state and have necessary info
    if (isWaitingForOpponent && ndk && matchId && opponentPubkey) {
      console.log(`[App] Entered waiting state. Subscribing to ready signals for match ${matchId} from opponent ${opponentPubkey}`);
      
      // Prevent duplicate subscriptions
      if (readySubscriptionRef.current) {
          console.log("[App] Cleaning up existing ready subscription before creating new one.");
          readySubscriptionRef.current.stop();
          readySubscriptionRef.current = null;
      }

      const subscriptionFilter: NDKFilter = {
        kinds: [30079 as NDKKind],
        authors: [opponentPubkey], // Only listen for the opponent's event
        '#t': [matchId], // Tagged with the specific match ID
        // Limit 1, since we only care about the first ready signal
        // We might receive duplicates if the opponent sends multiple, but we handle that below
        // limit: 1 
      };

      const handleOpponentReady = (event: NDKEvent) => {
        console.log(`[App] Received potential ready event from ${event.pubkey}:`, event.rawEvent());
        try {
          const payload = JSON.parse(event.content);
          // Check if it's the correct type and for the correct match (redundant check via filter, but safe)
          if (payload.type === 'player_ready' && event.tags.some(tag => tag[0] === 't' && tag[1] === matchId)) {
            console.log(`[App] Opponent ${opponentPubkey} is READY for match ${matchId}! Starting game.`);
            
            // Stop listening *before* changing state/view
            readySubscriptionRef.current?.stop(); 
            readySubscriptionRef.current = null; 

            setIsWaitingForOpponent(false); // Exit waiting state
            setCurrentView('game');       // Navigate to GameScreen
          } else {
            console.log(`[App] Received event ${event.id} is not the expected player_ready type or matchId.`);
          }
        } catch (e) {
          console.warn(`[App] Failed to parse content of ready event ${event.id}:`, e);
        }
      };

      console.log("[App] Creating ready subscription with filter:", JSON.stringify(subscriptionFilter));
      const sub = ndk.subscribe(subscriptionFilter, { closeOnEose: false }); // Keep open until explicitly stopped
      readySubscriptionRef.current = sub; // Store subscription reference

      sub.on('event', handleOpponentReady);

      sub.on('eose', () => {
        console.log(`[App] Ready subscription EOSE received for match ${matchId}. Still waiting...`);
        // Don't close here, wait for the event or explicit stop
      });

      sub.on('closed', () => {
        console.log(`[App] Ready subscription explicitly closed for match ${matchId}.`);
        // Ensure ref is cleared if closed externally, though we primarily control it
        if (readySubscriptionRef.current === sub) {
             readySubscriptionRef.current = null;
        }
      });
      
      // Cleanup function
      return () => {
        console.log(`[App] Cleaning up ready subscription for match ${matchId} (Effect dependencies changed or component unmounted).`);
        if (readySubscriptionRef.current === sub) { // Check if it's the same subscription we created
             sub.stop();
             readySubscriptionRef.current = null;
        }
      };
    } else if (!isWaitingForOpponent && readySubscriptionRef.current) {
         // If we exit the waiting state for any reason (e.g., back button), stop the subscription
         console.log("[App] Exited waiting state, stopping ready subscription.");
         readySubscriptionRef.current.stop();
         readySubscriptionRef.current = null;
    }
  // Dependencies: Only run when these specific values change
  }, [isWaitingForOpponent, ndk, matchId, opponentPubkey]); 
  // --- END EFFECT ---

  // --- Render Logic --- 
  // No longer using a function that returns different types
  // const renderContent = () => { ... };

  // --- Render Return --- 
  return (
      // Main container for the app
      <div className="w-full h-dvh overflow-hidden"> { /* Ensure full viewport height and hide overflow */ }
          { /* 1. NDK Connecting Overlay (if applicable) */ }
          {currentView === 'connecting_ndk' && (
              <div className="absolute inset-0 flex items-center justify-center h-full w-full bg-black bg-opacity-80 z-50 text-white">
                  {ndkConnectionError 
                      ? `Error connecting to Nostr relays: ${ndkConnectionError.message}` 
                      : 'Connecting to Nostr relays...'}
              </div>
          )}

          { /* 2. Login View (if applicable) */ }
          {currentView === 'login' && (
              // Reuse the existing Login view structure here
              // Center the login box, responsive padding and width. Use flex-col on small screens.
              <div className="w-full min-h-screen flex flex-col sm:flex-row items-center justify-center p-4 bg-gray-900"> { /* Added background */}
                  <div className="flex flex-col items-center justify-center p-6 sm:p-8 bg-gray-800 rounded-lg shadow-xl space-y-4 sm:space-y-6 w-full max-w-md"> {/* Adjusted max-w, consistent padding */}
                      <h1 className="text-2xl sm:text-3xl font-bold text-purple-400 mb-4 text-center">Zapsliggers Login</h1>
                      
                      {/* NIP-46 QR Code Display (Desktop Only) */}
                      {nip46Status === 'waiting_for_scan' && nip46AuthUrl && !isMobileDevice() && (
                          <div className="w-full flex flex-col items-center justify-center p-4 sm:p-6 text-center">
                              <p className="mb-4 text-lg">Scan with your Nostr mobile app:</p>
                              <div className="bg-white p-3 sm:p-4 rounded-lg mb-4 inline-block">
                                  <QRCodeCanvas value={nip46AuthUrl} size={200} className="sm:w-64 sm:h-64 w-48 h-48" />
                              </div>
                              <input 
                                  type="text" 
                                  readOnly 
                                  value={nip46AuthUrl} 
                                  className="w-full max-w-xs sm:max-w-md p-2 border border-gray-600 rounded bg-gray-800 text-white text-[10px] sm:text-xs mb-2 break-all" 
                                  onClick={(e) => (e.target as HTMLInputElement).select()} 
                                  title="Click to select URI"
                              />
                              <button 
                                  onClick={() => navigator.clipboard.writeText(nip46AuthUrl!)} 
                                  className="px-4 py-2 rounded font-semibold text-white transition-colors bg-blue-600 hover:bg-blue-700 mb-4 text-sm sm:text-base"
                              >
                                  Copy URI
                              </button>
                              <p className="text-gray-400 text-sm">Waiting for connection...</p>
                              {authError && <p className="text-red-500 text-xs mt-2">{authError.message}</p>}
                          </div>
                      )}
                      
                      {/* NIP-46 Waiting for Mobile App Approval */}
                      {nip46Status === 'waiting_for_mobile_approval' && (
                          <div className="w-full flex flex-col items-center justify-center p-4 sm:p-6 text-center">
                              <p className="text-lg mb-4">Check your Nostr mobile app</p>
                              <p className="text-gray-400 mb-4">Approve the connection request.</p>
                              <button 
                                  onClick={cancelNip46LoginAttempt} 
                                  className="px-4 py-2 rounded font-semibold text-white transition-colors bg-red-600 hover:bg-red-700 text-sm sm:text-base"
                              >
                                  Cancel
                              </button>
                              {authError && <p className="text-red-500 text-xs mt-4">{authError.message}</p>}
                          </div>
                      )}

                      {/* Default Login Options (Only show if not waiting for NIP46) */}
                      {nip46Status !== 'waiting_for_scan' && nip46Status !== 'waiting_for_mobile_approval' && (
                          <>
                              {window.nostr ? (
                                  <button 
                                      onClick={loginWithNip07} 
                                      className="w-full px-6 py-3 rounded font-semibold text-white transition-colors bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-opacity-50"
                                  >
                                      Login with Browser Extension (NIP-07)
                                  </button>
                              ) : (
                                  <div className="text-center w-full p-3 bg-gray-700 rounded">
                                      <p className="text-sm text-gray-400">Nostr Browser Extension (NIP-07) not detected.</p>
                                      <p className="text-xs text-gray-500 mt-1">(Mobile browsers usually don't support extensions. Use NIP-46 below.)</p>
                                  </div>
                              )}
                              <div className="w-full border-t border-gray-600 my-2"></div>
                              <p className="text-center text-gray-300 text-sm sm:text-base">Connect using a mobile signing app:</p>
                              <button 
                                  onClick={handleNip46Connect} 
                                  // @ts-expect-error - Assume these statuses are valid despite inferred type mismatch
                                  disabled={nip46Status === 'waiting_for_scan' || nip46Status === 'waiting_for_mobile_approval'} 
                                  className="w-full px-4 sm:px-6 py-2 sm:py-3 rounded font-semibold text-white transition-colors bg-blue-600 hover:bg-blue-700 disabled:bg-gray-500 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50 text-sm sm:text-base"
                              >
                                  Connect with Mobile App (NIP-46)
                              </button>
                              {authError && <p className="text-red-500 text-xs sm:text-sm mt-4 text-center">Login Failed: {authError.message}</p>}
                          </>
                      )}
                  </div>
              </div>
          )}

          { /* 3. Main Menu (Only if logged in and view is menu) */ }
          {isLoggedIn && currentUser && ndk && currentView === 'menu' && (
              // Determine if current user is the developer
              (() => { // IIFE to calculate isDeveloper locally
                const isDeveloper = currentUser?.pubkey === DEV_PUBKEY;
                return (
                  <div className="w-full h-full flex flex-col items-center justify-center p-4 space-y-4 bg-gray-900"> { /* Added background */}
                      <h1 className="text-3xl font-bold mb-6 text-purple-400">ZapSlingers</h1>
                      <button
                          onClick={handleRequestFullscreen}
                          className="mb-4 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded transition duration-150 ease-in-out"
                      >
                          Go Fullscreen
                      </button>
                      <button onClick={handleSelectPractice} className="w-48 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded transition duration-150 ease-in-out">Practice Mode</button>
                      <button onClick={handleSelectMultiplayer} className="w-48 px-4 py-2 bg-yellow-600 hover:bg-yellow-700 text-white rounded transition duration-150 ease-in-out">Multiplayer Lobby</button>
                      {isDeveloper && (
                          <button onClick={handleSelectDevSandbox} className="w-48 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded transition duration-150 ease-in-out">Developer Sandbox</button>
                      )}
                  </div>
                );
              })() // Immediately invoke the function
          )}

          { /* 4. Lobby Screen (Only if logged in and view is lobby) */ }
          {isLoggedIn && currentUser && ndk && currentView === 'lobby' && (
               <LobbyScreen 
                  key="lobby"
                  ndk={ndk} 
                  currentUser={currentUser} 
                  onChallengeAccepted={handleChallengeAccepted} 
                  onWaitingForOpponent={handleWaitingForOpponent}
                  onBack={handleBackToMenu}
               />
          )}

          { /* 5. Practice Screen (Only if logged in and view is practice) */ }
          {isLoggedIn && currentUser && ndk && currentView === 'practice' && (
              <PracticeScreen 
                  key="practice"
                  ndk={ndk} 
                  currentUser={currentUser} 
                  onBackToMenu={handleBackToMenu} 
                  settings={practiceSettings} // Pass specific settings
              />
          )}
          
          { /* 6. Developer Sandbox Screen (Only if logged in and view is dev_sandbox) */ }
          {isLoggedIn && currentUser && ndk && currentView === 'dev_sandbox' && (
               // Ensure user is actually the developer before rendering
               currentUser.pubkey === DEV_PUBKEY ? (
                  <DeveloperSandboxScreen 
                      key="dev_sandbox"
                      ndk={ndk} 
                      currentUser={currentUser} 
                      onBackToMenu={handleBackToMenu} 
                      settings={sandboxSettings} // Pass specific settings
                  />
               ) : (
                   // Fallback if somehow view state is wrong (should be handled by effect)
                   <div className="flex items-center justify-center h-full w-full text-red-500">Access Denied</div>
               )
          )}

          { /* 7. Game Screen (Only if logged in and view is game) */ }
          {isLoggedIn && currentUser && ndk && currentView === 'game' && (
              // Ensure opponent and matchId are set before rendering game
              opponentPubkey && matchId ? (
                  <GameScreen 
                      key="game"
                      ndk={ndk} 
                      localPlayerPubkey={currentUser.pubkey}
                      opponentPubkey={opponentPubkey} 
                      matchId={matchId}
                      onGameEnd={handleGameEnd}
                      onBackToMenu={handleBackToMenu}
                  />
              ) : (
                  // Fallback if state is wrong (shouldn't happen with correct logic)
                  <div className="flex items-center justify-center h-full w-full text-red-500">Error starting game: Missing opponent or match ID.</div>
              )
          )}

      </div>
  );
}

export default App;
