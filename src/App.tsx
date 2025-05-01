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
// Removed unused import
// import { ChallengeHandler } from './components/ChallengeHandler'; 
// Import LobbyScreen
import LobbyScreen from './components/lobby/LobbyScreen';
// Import the new screen components from the correct location
// import MainMenuScreen from './components/MainMenuScreen'; // Commented out - File missing
import PracticeScreen from './components/screens/PracticeScreen'; // Corrected import path

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

// Define view states
type AppView = 'login' | 'connecting_ndk' | 'menu' | 'practice' | 'lobby' | 'game';

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
      // If we were previously connecting or logging in, move to menu
      if (currentView === 'connecting_ndk' || currentView === 'login') {
          console.log(`[View Effect] Logged in and NDK ready (from ${currentView}), setting view to menu`);
          setCurrentView('menu');
      } 
      // Otherwise, stay in the current logged-in view (menu, practice, lobby, game)
      // This else block handles the case where we are already logged in and in a valid state.
      // It prevents resetting the view to 'menu' unnecessarily if the effect re-runs.
       else {
           console.log(`[View Effect] Logged in and NDK ready, staying in current view: ${currentView}`);
       }
    }
  }, [isNdkReady, isLoggedIn, currentView]); // Dependencies seem correct now

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

  const handleBackToMenu = () => {
      setCurrentView('menu');
      setOpponentPubkey(null); // Clear opponent on back
      setMatchId(null);      // Clear match ID on back
  };

  const handleChallengeAccepted = (opponent: string, confirmedMatchId: string) => {
      console.log(`[App] Starting multiplayer game against: ${opponent}, Match ID: ${confirmedMatchId}`);
      setOpponentPubkey(opponent);
      setMatchId(confirmedMatchId); // Store the match ID
      setCurrentView('game');
  };

  const handleGameEnd = () => {
      console.log("[App] Multiplayer game ended, returning to menu."); // Go back to menu after game
      setOpponentPubkey(null);
      setMatchId(null); // Clear match ID on game end
      setCurrentView('menu');
  };

  // --- Render Logic --- 
  const renderContent = () => {
    console.log(`[App Render] View: ${currentView}, NDK Ready: ${isNdkReady}, Logged In: ${isLoggedIn}, NIP46 Status: ${nip46Status}`);

    // 1. NDK Connecting
    if (currentView === 'connecting_ndk') {
      return (
        <div className="flex items-center justify-center h-full w-full">
          {ndkConnectionError 
            ? `Error connecting to Nostr relays: ${ndkConnectionError.message}` 
            : 'Connecting to Nostr relays...'}
        </div>
      );
    }

    // 2. Login View (Handles NIP-07 button, NIP-46 input/QR/Connecting)
    if (currentView === 'login') {
        // --- NIP-46 Flow States ---

        // NIP-46 Connecting state (After scan approval)
        if (loginMethod === 'nip46' && nip46Status === 'connecting') {
            return (
                <div className="w-full h-full flex flex-col items-center justify-center p-4">
                    <p className="text-xl text-gray-400">Connecting via NIP-46...</p>
                    {authError && <p className="text-red-500 text-xs mt-2">{authError.message}</p>}
                </div>
            );
        }
        // NIP-46 QR Code / Waiting state (After clicking 'Connect with Mobile')
        else if (loginMethod === 'nip46' && nip46Status === 'waiting' && nip46AuthUrl) {
             return (
                // Center content, add padding for mobile
                <div className="w-full h-full flex flex-col items-center justify-center p-4 sm:p-6 text-center">
                    <p className="mb-4 text-lg">Scan with your Nostr mobile app (like Amber, Nostore, etc.):</p>
                    {/* QR Code display with white background */}
                    <div className="bg-white p-3 sm:p-4 rounded-lg mb-4 inline-block">
                        <QRCodeCanvas value={nip46AuthUrl} size={200} className="sm:w-64 sm:h-64 w-48 h-48" /> { /* Responsive size */}
                    </div>
                     {/* Input to show/copy the URL - make it smaller on mobile */}
                    <input 
                        type="text" 
                        readOnly 
                        value={nip46AuthUrl} 
                        className="w-full max-w-xs sm:max-w-md p-2 border border-gray-600 rounded bg-gray-800 text-white text-[10px] sm:text-xs mb-2 break-all" 
                        onClick={(e) => (e.target as HTMLInputElement).select()} 
                        title="Click to select URI"
                    />
                    {/* Copy Button */} 
                    <button 
                        onClick={() => navigator.clipboard.writeText(nip46AuthUrl!)} 
                        className="px-4 py-2 rounded font-semibold text-white transition-colors bg-blue-600 hover:bg-blue-700 mb-4 text-sm sm:text-base"
                    >
                        Copy URI
                    </button>
                    <p className="text-gray-400 text-sm">Waiting for connection...</p>
                    {authError && <p className="text-red-500 text-xs mt-2">{authError.message}</p>}
                </div>
            );
        }
        // --- Default Login Options Screen ---
        else {
            return (
                // Center the login box, responsive padding and width. Use flex-col on small screens.
                <div className="w-full min-h-screen flex flex-col sm:flex-row items-center justify-center p-4"> {/* Changed to min-h-screen, flex-col default */}
                    <div className="flex flex-col items-center justify-center p-6 sm:p-8 bg-gray-800 rounded-lg shadow-xl space-y-4 sm:space-y-6 w-full max-w-md"> {/* Adjusted max-w, consistent padding */}
                        <h1 className="text-2xl sm:text-3xl font-bold text-purple-400 mb-4 text-center">Klunkstr Login</h1>
                        
                        {/* NIP-07 Section - Explain if unavailable */} 
                        {window.nostr ? (
                            <button 
                                onClick={loginWithNip07} 
                                className="w-full px-6 py-3 rounded font-semibold text-white transition-colors bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-opacity-50"
                            >
                                Login with Browser Extension (NIP-07)
                            </button>
                        ) : (
                            <div className="text-center w-full p-3 bg-gray-700 rounded">
                                 <p className="text-sm text-gray-400">
                                    Nostr Browser Extension (NIP-07) not detected.
                                 </p>
                                 <p className="text-xs text-gray-500 mt-1">
                                    (Mobile browsers usually don't support extensions. Use NIP-46 below.)
                                 </p>
                             </div>
                        )}
                        
                        {/* Separator */} 
                        <div className="w-full border-t border-gray-600 my-2"></div>
                        
                        {/* NIP-46 Section - Simplified Button */} 
                        <p className="text-center text-gray-300 text-sm sm:text-base"> {/* Adjusted text size */}
                            Connect using a mobile signing app:
                        </p>
                        <button 
                            // Directly initiate flow, passing empty string to signal QR generation (assumption)
                            onClick={() => initiateNip46Login('')} 
                            disabled={nip46Status === 'connecting' || nip46Status === 'waiting'} 
                            className="w-full px-4 sm:px-6 py-2 sm:py-3 rounded font-semibold text-white transition-colors bg-blue-600 hover:bg-blue-700 disabled:bg-gray-500 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50 text-sm sm:text-base" /* Adjusted padding/text */
                        >
                            Connect with Mobile App (NIP-46)
                        </button>
                        
                        {/* Removed manual bunker URI input for simplicity 
                        <p className="text-center text-gray-300">Or connect with a remote signer (NIP-46):</p>
                        <input type="text" placeholder="Paste your bunker://... URI here" value={bunkerUriInput} onChange={(e) => setBunkerUriInput(e.target.value)} className="w-full p-3 border border-gray-600 rounded bg-gray-700 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500" />
                        <button onClick={handleNip46Login} disabled={!bunkerUriInput.trim() || nip46Status === 'connecting' || nip46Status === 'waiting'} className="w-full px-6 py-3 rounded font-semibold text-white transition-colors bg-blue-600 hover:bg-blue-700 disabled:bg-gray-500 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50">Connect with Bunker URI</button>
                        */} 

                        {authError && <p className="text-red-500 text-xs sm:text-sm mt-4 text-center">Login Failed: {authError.message}</p>} {/* Adjusted text size */}
                    </div>
                </div>
            );
        }
    }

    // --- Views accessible only when logged in --- 
    // Removed redundant check, useEffect should ensure currentView is correct
    // if (!isLoggedIn || !currentUser || !ndk) {
    //     console.warn("[App Render] Trying to render authed view but not logged in!");
    //     return <div className="flex items-center justify-center h-full w-full">Redirecting to login...</div>;
    // }

    // 3. Main Menu
    // Assumes currentView will only be 'menu' if logged in
    if (currentView === 'menu') {
        // Add null check for currentUser just in case, although useEffect should prevent this
        if (!currentUser) return <div>Loading user...</div>;
        // Temporarily render placeholder instead of missing component
        return (
            <div className="p-4">
                <h2 className="text-xl">Main Menu (Placeholder)</h2>
                <p>User: {currentUser.npub}</p>
                <button onClick={handleSelectPractice} className="mt-2 px-4 py-2 bg-blue-600 rounded mr-2">Practice (WIP)</button>
                <button onClick={handleSelectMultiplayer} className="mt-2 px-4 py-2 bg-green-600 rounded">Multiplayer Lobby</button>
            </div>
        );
        /* Commented out - Missing component
        return (
            <MainMenuScreen 
                currentUser={currentUser} 
                onSelectPractice={handleSelectPractice}
                onSelectMultiplayer={handleSelectMultiplayer}
            />
        );
        */
    }

    // 4. Practice Screen
    // Assumes currentView will only be 'practice' if logged in
    if (currentView === 'practice') {
        // Add null checks just in case
        if (!currentUser || !ndk) return <div>Loading practice...</div>;
        // Render the actual PracticeScreen component
        return <PracticeScreen 
            ndk={ndk} 
            currentUser={currentUser} 
            onBackToMenu={handleBackToMenu} 
        />;
    }

    // 5. Multiplayer Lobby Screen
    // Assumes currentView will only be 'lobby' if logged in
    if (currentView === 'lobby') {
        // Add null checks just in case
        if (!currentUser || !ndk) return <div>Loading lobby...</div>;
        return (
            <LobbyScreen 
                ndk={ndk}
                currentUser={currentUser}
                onChallengeAccepted={handleChallengeAccepted}
                onBackToMenu={handleBackToMenu}
            />
        );
    }

    // 6. Game Screen
    // Assumes currentView will only be 'game' if logged in
    if (currentView === 'game' && opponentPubkey && matchId) {
        // Add null checks just in case
        if (!currentUser || !ndk) return <div>Loading game...</div>;
        return (
            <GameScreen 
                localPlayerPubkey={currentUser.pubkey} 
                opponentPubkey={opponentPubkey} 
                ndk={ndk} 
                matchId={matchId}
                onGameEnd={handleGameEnd}
            />
        );
    }

    // Fallback for unexpected states
    console.error(`[App Render] Reached unexpected state: View=${currentView}, LoggedIn=${isLoggedIn}`);
    return <div className="flex items-center justify-center h-full w-full">Unexpected application state.</div>;
  };

  return (
    // Ensure the main div takes full screen and prevents overflow
    <div className="relative h-dvh w-screen bg-gray-900 text-white flex flex-col overflow-hidden">

      {/* Main Content Area */} 
      <div className="flex-grow w-full h-full"> {/* Use flex-grow to fill remaining space */}
        {renderContent()}
      </div>
    </div>
  )
}

export default App
