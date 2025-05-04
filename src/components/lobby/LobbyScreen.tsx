import React, { useState, useEffect } from 'react';
import NDK, { NDKUser } from '@nostr-dev-kit/ndk';
import { ChallengeHandler } from '../ChallengeHandler';
import { QRCodeCanvas } from 'qrcode.react';
import { Html5QrcodeScanner } from 'html5-qrcode';
import { nip19 } from 'nostr-tools';

interface LobbyScreenProps {
    ndk: NDK;
    currentUser: NDKUser;
    onChallengeAccepted: (opponentPubkey: string, matchId: string) => void;
    onBackToMenu: () => void;
}

const qrcodeRegionId = "qr-reader-container";

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
    const [showPermissionHelper, setShowPermissionHelper] = useState(false);
    const [scannerError, setScannerError] = useState<string | null>(null);

    useEffect(() => {
        let html5QrcodeScanner: Html5QrcodeScanner | null = null;

        const qrCodeSuccessCallback = (decodedText: string) => {
            console.log('Scanned QR Code:', decodedText);
            setScannerError(null);

            if (decodedText && decodedText.startsWith('nostr:npub1')) {
                const potentialNpub = decodedText.substring(6);
                try {
                    nip19.decode(potentialNpub);
                    setRecipientNpubOrHex(potentialNpub);
                    setIsScannerOpen(false);
                    console.log('Successfully parsed and set npub:', potentialNpub);
                } catch (e) {
                    console.error('Scanned text is not a valid npub:', decodedText, e);
                    setScannerError('Scanned QR code does not contain a valid Nostr npub URI (nostr:npub1...). Try again.');
                }
            } else {
                console.warn('Scanned text is not in the expected format (nostr:npub1...):', decodedText);
                setScannerError('Scanned QR code does not contain a valid Nostr npub URI (nostr:npub1...). Try again.');
            }
        };

        const qrCodeErrorCallback = (errorMessage: string) => {
            if (!errorMessage.toLowerCase().includes("qrcode parse error")) {
                console.error(`QR Scanner Error: ${errorMessage}`);
                setScannerError(`Scan Error: ${errorMessage}`);
            }
        };

        const config = {
            fps: 10,
            qrbox: { width: 250, height: 250 },
            rememberLastUsedCamera: true,
        };

        if (isScannerOpen) {
            try {
                if (window.location.protocol !== 'https:') {
                    throw new Error("Camera access requires a secure connection (HTTPS).");
                }
                
                html5QrcodeScanner = new Html5QrcodeScanner(
                    qrcodeRegionId,
                    config,
                    /* verbose= */ false
                );
                html5QrcodeScanner.render(qrCodeSuccessCallback, qrCodeErrorCallback);
                setScannerError(null);

            } catch (error: unknown) {
                 console.error("Failed to initialize or start scanner:", error);
                 const errorMsg = error instanceof Error ? error.message : "Failed to start scanner.";
                 setScannerError(errorMsg);
                 html5QrcodeScanner = null; 
            }

        }

        return () => {
            if (html5QrcodeScanner) {
                html5QrcodeScanner.clear().catch(error => {
                    console.error("Failed to clear html5QrcodeScanner.", error);
                });
                html5QrcodeScanner = null;
            }
        };
    }, [isScannerOpen]);

    const openScanner = () => {
        setScannerError(null);
        setShowPermissionHelper(true);
        setTimeout(() => {
            setIsScannerOpen(true);
            setShowPermissionHelper(false);
        }, 500); 
    };
    
    const closeScanner = () => {
        setIsScannerOpen(false);
        setScannerError(null);
    };

    return (
        <div className="w-full h-full flex flex-col items-center justify-start pt-4 p-4 text-white bg-gray-800 overflow-y-auto">
            {isScannerOpen && (
                 <div 
                    className="fixed inset-0 bg-black bg-opacity-75 flex flex-col items-center justify-center z-50 p-4"
                    onClick={closeScanner}
                 >
                    <div 
                        className="bg-white p-6 rounded-lg shadow-xl max-w-md w-full relative"
                        onClick={(e) => e.stopPropagation()}
                    >
                         <h3 className="text-xl font-semibold mb-4 text-gray-800 text-center">
                            {scannerError ? 'Scan Error' : "Scan Opponent's QR Code"}
                         </h3>
                         
                         <div id={qrcodeRegionId} style={{ width: '100%' }}></div>

                         {scannerError ? (
                            <div className="text-center text-red-600 my-4">
                                <p>{scannerError}</p>
                            </div>
                         ) : null}
                        
                         <button 
                            onClick={closeScanner} 
                            className="mt-4 w-full px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-opacity-50"
                         >
                             {scannerError ? 'Close' : 'Cancel Scan'}
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
                <div className="flex justify-between items-center mb-2">
                    <h2 className="text-xl font-semibold">Challenge Players</h2>
                     <button
                         onClick={openScanner}
                         className="px-3 py-1 bg-purple-600 rounded hover:bg-purple-700 text-sm disabled:opacity-50"
                     >
                         Scan QR
                     </button>
                 </div>
                 {showPermissionHelper && (
                    <p className="text-xs text-yellow-300 mb-2 text-center">
                        Your browser will ask for camera permission to scan the code.
                    </p>
                 )}
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