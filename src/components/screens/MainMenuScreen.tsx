import React from 'react';
import { NDKUser } from '@nostr-dev-kit/ndk';

interface MainMenuScreenProps {
    currentUser: NDKUser;
    onSelectPractice: () => void;
    onSelectMultiplayer: () => void;
}

const MainMenuScreen: React.FC<MainMenuScreenProps> = ({
    currentUser,
    onSelectPractice,
    onSelectMultiplayer
}) => {
    const userName = currentUser.profile?.displayName || currentUser.profile?.name || currentUser.npub.substring(0, 12);

    return (
        <div className="w-full h-full flex flex-col items-center justify-center p-4 md:p-8 bg-gray-800 text-white">
            <h1 className="text-3xl md:text-4xl font-bold mb-4">Zapsliggers</h1>
            <p className="text-lg md:text-xl text-gray-300 mb-8 md:mb-10">Welcome, {userName}!</p>

            <div className="space-y-5 md:space-y-6 w-full max-w-xs md:max-w-sm">
                <button 
                    onClick={onSelectPractice}
                    className="w-full px-6 py-3 md:py-4 rounded font-semibold text-white text-base md:text-lg transition-colors bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-opacity-50 shadow-lg"
                >
                    Practice Mode
                </button>

                <button 
                    onClick={onSelectMultiplayer}
                    className="w-full px-6 py-3 md:py-4 rounded font-semibold text-white text-base md:text-lg transition-colors bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50 shadow-lg"
                >
                    Multiplayer
                </button>
            </div>

            {/* Optional: Add Logout button here later? */}
        </div>
    );
};

export default MainMenuScreen; 