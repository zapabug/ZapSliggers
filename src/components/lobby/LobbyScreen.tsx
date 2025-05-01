import React from 'react';
import NDK, { NDKUser } from '@nostr-dev-kit/ndk';
import { ChallengeHandler } from '../ChallengeHandler';

interface LobbyScreenProps {
    ndk: NDK;
    currentUser: NDKUser;
    onChallengeAccepted: (opponentPubkey: string) => void;
    onBackToMenu: () => void;
}

const LobbyScreen: React.FC<LobbyScreenProps> = ({ 
    ndk, 
    currentUser, 
    onChallengeAccepted, 
    onBackToMenu
}) => {
    
    return (
        <div className="w-full h-full flex flex-col items-center justify-start pt-4 p-4 text-white bg-gray-800 overflow-y-auto">
            <div className="w-full flex justify-start mb-4">
                <button 
                    onClick={onBackToMenu}
                    className="px-4 py-2 rounded font-semibold text-white bg-gray-600 hover:bg-gray-700 transition-colors focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-opacity-50 shadow-md"
                >
                    &larr; Back to Menu
                </button>
            </div>

            <h1 className="text-3xl font-bold mb-6">Multiplayer Lobby</h1>

            <div className="mb-6 p-4 bg-gray-700 rounded-lg shadow-md w-full max-w-md">
                 <p className="text-lg text-gray-300 mb-1">
                    Logged In As:
                 </p>
                 <p className="text-sm font-mono text-purple-300 break-all">
                    {currentUser.pubkey}
                 </p>
            </div>

            <div className="w-full max-w-lg p-4 bg-gray-700 rounded-lg shadow-md">
                <h2 className="text-xl font-semibold mb-4 text-center">Challenge Players</h2>
                <ChallengeHandler 
                    ndk={ndk} 
                    loggedInPubkey={currentUser.pubkey} 
                    onChallengeAccepted={onChallengeAccepted} 
                />
            </div>
        </div>
    );
};

export default LobbyScreen; 