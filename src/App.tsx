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
// Import the new screen components
import MainMenuScreen from './components/screens/MainMenuScreen';
import PracticeScreen from './components/screens/PracticeScreen';

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
  // State for NIP-46 input
  const [bunkerUriInput, setBunkerUriInput] = useState('');
  // State for opponent pubkey when game starts
  const [opponentPubkey, setOpponentPubkey] = useState<string | null>(null); 

  // --- Effects to manage view transitions based on NDK and Auth state --- 
  useEffect(() => {
    if (!isNdkReady) {
      setCurrentView('connecting_ndk');
    } else if (!isLoggedIn) {
      // NDK is ready, but user not logged in -> show login options
      setCurrentView('login');
    } else if (isLoggedIn && currentView === 'login') {
      // Just logged in -> go to menu
      setCurrentView('menu');
    } else if (!isLoggedIn && currentView !== 'login' && currentView !== 'connecting_ndk') {
      // Logged out from somewhere else? -> Force back to login
      setCurrentView('login');
    }
    // Add dependencies? Needs careful thought to avoid loops.
    // Maybe only trigger on isNdkReady and isLoggedIn changes?
  }, [isNdkReady, isLoggedIn, currentView]);

  // --- Event Handlers for Navigation/Login --- 
  const handleNip46Login = () => {
      if (!bunkerUriInput.trim()) return;
      initiateNip46Login(bunkerUriInput.trim());
  };

  const handleSelectPractice = () => {
      if (isLoggedIn) setCurrentView('practice');
  };

  const handleSelectMultiplayer = () => {
      if (isLoggedIn) setCurrentView('lobby');
  };

  const handleBackToMenu = () => {
      setCurrentView('menu');
  };

  const handleChallengeAccepted = (opponent: string) => {
      console.log(`[App] Starting multiplayer game against: ${opponent}`);
      setOpponentPubkey(opponent);
      setCurrentView('game');
  };

  const handleGameEnd = () => {
      console.log("[App] Multiplayer game ended, returning to menu."); // Go back to menu after game
      setOpponentPubkey(null);
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
        // Reordered NIP-46 state checks slightly to potentially help linter

        // NIP-46 Connecting state
        if (loginMethod === 'nip46' && nip46Status === 'connecting') {
            return (
                <div className="w-full h-full flex flex-col items-center justify-center">
                    <p className="text-xl text-gray-400">Connecting via NIP-46...</p>
                    {authError && <p className="text-red-500 text-xs mt-2">{authError.message}</p>}
                </div>
            );
        }
        // NIP-46 QR Code / Waiting state
        else if (loginMethod === 'nip46' && nip46Status === 'waiting' && nip46AuthUrl) {
             return (
                <div className="w-full h-full flex flex-col items-center justify-center p-4 text-center">
                    <p className="mb-4 text-lg">Scan with your Nostr app or copy:</p>
                    <div className="bg-white p-4 rounded-lg mb-4"><QRCodeCanvas value={nip46AuthUrl} size={256} /></div>
                    <input type="text" readOnly value={nip46AuthUrl} className="w-full max-w-md p-2 border border-gray-600 rounded bg-gray-800 text-white text-xs mb-2 break-all" onClick={(e) => (e.target as HTMLInputElement).select()} />
                    <button onClick={() => navigator.clipboard.writeText(nip46AuthUrl!)} className="px-4 py-2 rounded font-semibold text-white transition-colors bg-blue-600 hover:bg-blue-700 mb-4">Copy Code</button>
                    <p className="text-gray-400">Waiting for connection...</p>
                    {authError && <p className="text-red-500 text-xs mt-2">{authError.message}</p>}
                </div>
            );
        }
        // Default Login Options (NIP-07 / NIP-46 Input)
        else {
            return (
                <div className="flex flex-col items-center justify-center p-8 bg-gray-800 rounded-lg shadow-xl space-y-6 w-full max-w-md">
                    <h1 className="text-3xl font-bold text-purple-400 mb-4">Klunkstr Login</h1>
                    {window.nostr ? (
                        <button onClick={loginWithNip07} className="w-full px-6 py-3 rounded font-semibold text-white transition-colors bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-opacity-50">Login with Extension (NIP-07)</button>
                    ) : (
                        <p className="text-sm text-gray-400 text-center">Nostr extension not detected. Use NIP-46 below.</p>
                    )}
                    <div className="w-full border-t border-gray-600 my-4"></div>
                    <p className="text-center text-gray-300">Or connect with a remote signer (NIP-46):</p>
                    <input type="text" placeholder="Paste your bunker://... URI here" value={bunkerUriInput} onChange={(e) => setBunkerUriInput(e.target.value)} className="w-full p-3 border border-gray-600 rounded bg-gray-700 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500" />
                    <button onClick={handleNip46Login} disabled={!bunkerUriInput.trim() || nip46Status === 'connecting' || nip46Status === 'waiting'} className="w-full px-6 py-3 rounded font-semibold text-white transition-colors bg-blue-600 hover:bg-blue-700 disabled:bg-gray-500 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50">Connect with Bunker URI</button>
                    {authError && <p className="text-red-500 text-sm mt-4 text-center">Login Failed: {authError.message}</p>}
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
        return (
            <MainMenuScreen 
                currentUser={currentUser} 
                onSelectPractice={handleSelectPractice}
                onSelectMultiplayer={handleSelectMultiplayer}
            />
        );
    }

    // 4. Practice Screen
    // Assumes currentView will only be 'practice' if logged in
    if (currentView === 'practice') {
        return <PracticeScreen onBackToMenu={handleBackToMenu} />;
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
    if (currentView === 'game' && opponentPubkey) {
        // Add null checks just in case
        if (!currentUser || !ndk) return <div>Loading game...</div>;
        return (
            <GameScreen 
                localPlayerPubkey={currentUser.pubkey} 
                opponentPubkey={opponentPubkey} 
                ndk={ndk} 
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
