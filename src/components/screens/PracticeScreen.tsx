import React from 'react';
// Remove NDK imports again
// import NDK from '@nostr-dev-kit/ndk';
// import { NDKUser } from '@nostr-dev-kit/ndk';
import LobbyPlayground from '../lobby/LobbyPlayground'; // Import the playground

interface PracticeScreenProps {
    // Remove ndk prop again
    // Remove currentUser prop again
    onBackToMenu: () => void; // Callback to return to the main menu
}

const PracticeScreen: React.FC<PracticeScreenProps> = ({
    // Remove ndk from destructuring again
    // Remove currentUser from destructuring again
    onBackToMenu
}) => {

    return (
        <div className="w-full h-full flex flex-col items-center justify-start pt-4 p-4 text-white bg-gray-900 overflow-hidden">
            <div className="w-full flex justify-start mb-4">
                <button 
                    onClick={onBackToMenu}
                    className="px-4 py-2 rounded font-semibold text-white bg-gray-600 hover:bg-gray-700 transition-colors focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-opacity-50 shadow-md"
                >
                    &larr; Back to Menu
                </button>
            </div>
            
            <h1 className="text-2xl font-bold mb-4">Practice Mode</h1>

            {/* Render the Lobby Playground filling most of the space */} 
            <div className="flex-grow w-full max-w-6xl h-[calc(100%-100px)]"> {/* Adjust height as needed */} 
                <LobbyPlayground 
                     // Props are not needed as LobbyPlayground is self-contained
                />
            </div>
        </div>
    );
};

export default PracticeScreen; 