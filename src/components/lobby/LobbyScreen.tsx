import React, { useState } from 'react';
import NDK, { NDKUser } from '@nostr-dev-kit/ndk';
import { ChallengeHandler } from '../ChallengeHandler';
import { QRCodeCanvas } from 'qrcode.react';
import { QrReader, OnResultFunction } from 'react-qr-reader';
import { nip19 } from 'nostr-tools';

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
    
    const [recipientNpubOrHex, setRecipientNpubOrHex] = useState('');
    const [isScannerOpen, setIsScannerOpen] = useState(false);

    const handleScanResult: OnResultFunction = (result, error) => {
        if (result) {
            const scannedText = result.getText();
            console.log('Scanned QR Code:', scannedText);
            if (scannedText && scannedText.startsWith('nostr:npub1')) {
                const potentialNpub = scannedText.substring(6);
                try {
                    nip19.decode(potentialNpub);
                    setRecipientNpubOrHex(potentialNpub);
                    setIsScannerOpen(false);
                    console.log('Successfully parsed and set npub:', potentialNpub);
                } catch (e) {
                     console.error('Scanned text is not a valid npub:', scannedText, e);
                     alert('Scanned QR code does not contain a valid Nostr npub URI (nostr:npub1...). Try again.');
                }
            } else {
                 console.warn('Scanned text is not in the expected format (nostr:npub1...):', scannedText);
                 alert('Scanned QR code does not contain a valid Nostr npub URI (nostr:npub1...). Try again.');
            }
        }

        if (error) {
            if (error.name !== 'NotFoundException') {
                 console.error('QR Scanner Error:', error);
                 alert(`QR Scan Error: ${error.message}. Please ensure camera permissions are granted.`);
            }
        }
    };
    
    return (
        <div className="w-full h-full flex flex-col items-center justify-start pt-4 p-4 text-white bg-gray-800 overflow-y-auto">
            {isScannerOpen && (
                 <div 
                    className="fixed inset-0 bg-black bg-opacity-75 flex flex-col items-center justify-center z-50 p-4"
                    onClick={() => setIsScannerOpen(false)}
                 >
                    <div 
                        className="bg-white p-6 rounded-lg shadow-xl max-w-md w-full relative"
                        onClick={(e) => e.stopPropagation()}
                    >
                         <h3 className="text-xl font-semibold mb-4 text-gray-800 text-center">Scan Opponent's QR Code</h3>
                        <QrReader
                            onResult={handleScanResult}
                            constraints={{ facingMode: 'environment' }}
                            scanDelay={500}
                            containerStyle={{ width: '100%' }}
                            videoContainerStyle={{ paddingTop: '100%', position: 'relative' }}
                            videoStyle={{ 
                                position: 'absolute', 
                                top: 0, 
                                left: 0, 
                                width: '100%', 
                                height: '100%', 
                                objectFit: 'cover' 
                            }}
                        />
                        <button 
                            onClick={() => setIsScannerOpen(false)}
                            className="mt-4 w-full px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-opacity-50"
                        >
                            Cancel Scan
                        </button>
                    </div>
                 </div>
            )}

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
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-xl font-semibold">Challenge Players</h2>
                     <button
                         onClick={() => setIsScannerOpen(true)}
                         className="px-3 py-1 bg-purple-600 rounded hover:bg-purple-700 text-sm disabled:opacity-50"
                     >
                         Scan QR
                     </button>
                 </div>
                <ChallengeHandler 
                    ndk={ndk} 
                    loggedInPubkey={currentUser.pubkey} 
                    onChallengeAccepted={onChallengeAccepted} 
                    recipientNpubOrHex={recipientNpubOrHex}
                    setRecipientNpubOrHex={setRecipientNpubOrHex}
                />
            </div>
        </div>
    );
};

export default LobbyScreen; 