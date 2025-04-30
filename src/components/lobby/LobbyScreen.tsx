import React from 'react';
import NDK from '@nostr-dev-kit/ndk';
import { ChallengeHandler } from '../ChallengeHandler'; // Corrected path again
import LobbyPlayground from './LobbyPlayground'; // Import the new component

interface LobbyScreenProps {
    loggedInPubkey: string;
    ndk: NDK;
    onChallengeAccepted: (opponentPubkey: string) => void;
    // Add other props as needed, e.g., onStartPracticeMode
}

const LobbyScreen: React.FC<LobbyScreenProps> = ({ 
    loggedInPubkey, 
    ndk, 
    onChallengeAccepted 
}) => {
    
    const handleStartPractice = () => {
        console.log('Practice Mode button clicked (currently disabled)');
        // Implement practice mode logic here later
    };

    return (
        <div className="w-full h-full flex flex-col items-center justify-start pt-10 p-4 text-white bg-gray-800 overflow-y-auto">
            <h1 className="text-3xl font-bold mb-6">Klunkstr Lobby</h1>

            <div className="w-full max-w-4xl h-96 mb-6">
                <LobbyPlayground />
            </div>

            <div className="mb-6 p-4 bg-gray-700 rounded-lg shadow-md w-full max-w-md">
                 <p className="text-lg text-gray-300 mb-1">
                    Logged In As:
                 </p>
                 <p className="text-sm font-mono text-purple-300 break-all">
                    {loggedInPubkey}
                 </p>
            </div>

            <div className="mb-6">
                <button 
                    className="px-6 py-3 rounded font-semibold text-white bg-green-600 hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
                    onClick={handleStartPractice}
                    disabled // Enable later when practice mode is implemented
                >
                    Practice Mode (Coming Soon)
                </button>
            </div>

            <div className="w-full max-w-lg p-4 bg-gray-700 rounded-lg shadow-md">
                {/* Render Challenge Handler */}
                <ChallengeHandler 
                    ndk={ndk} 
                    loggedInPubkey={loggedInPubkey} 
                    onChallengeAccepted={onChallengeAccepted} 
                />
            </div>
        </div>
    );
};

export default LobbyScreen; 