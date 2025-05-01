import React from 'react';
import NDK, { NDKUser } from '@nostr-dev-kit/ndk';
import { ChallengeHandler } from '../ChallengeHandler';
import { QRCodeCanvas } from 'qrcode.react';

interface LobbyScreenProps {
    ndk: NDK;
    currentUser: NDKUser;
    onChallengeAccepted: (opponentPubkey: string, matchId: string) => void;
    onBackToMenu: () => void;
}

const LobbyScreen: React.FC<LobbyScreenProps> = ({ 
    ndk, 
    currentUser, 
    onChallengeAccepted, 
    onBackToMenu
}) => {
    const userNpub = currentUser.npub;
    const nostrUri = userNpub ? `nostr:${userNpub}` : '';
    
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

            <div className="mb-6 p-4 bg-gray-700 rounded-lg shadow-md w-full max-w-md text-center">
                 <p className="text-lg text-gray-300 mb-2">
                    Your Nostr ID (Share this!)
                 </p>
                 <p className="text-sm font-mono text-purple-300 break-all mb-4 select-all" title="Click to select">
                    {userNpub || 'Could not get npub'}
                 </p>
                 <div className="flex justify-center">
                    <div className="bg-white p-2 rounded-md inline-block">
                        {nostrUri ? (
                             <QRCodeCanvas value={nostrUri} size={128} />
                        ) : (
                            <p className="text-red-500 text-xs">Could not generate QR code</p> 
                        )}
                    </div>
                 </div>
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