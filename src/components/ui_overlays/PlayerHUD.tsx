import React from 'react';
import { UserProfileDisplay } from './UserProfileDisplay';
import { HealthBar } from './HealthBar';
import NDK from '@nostr-dev-kit/ndk'; // Import NDK type

interface PlayerHUDProps {
    pubkey: string;
    currentHp: number;
    maxHp: number;
    isPlayer1?: boolean; // To control layout (e.g., left vs right align)
    ndk: NDK; // Add NDK prop
}

export function PlayerHUD({ pubkey, currentHp, maxHp, isPlayer1 = true, ndk }: PlayerHUDProps) { // Destructure ndk prop
    const alignmentClass = isPlayer1 ? 'items-start' : 'items-end';
    const profileAlignment = isPlayer1 ? 'justify-start' : 'justify-end';

    return (
        <div className={`flex flex-col space-y-1 w-48 ${alignmentClass}`}> {/* Fixed width for now */}
            <div className={`flex w-full ${profileAlignment}`}> {/* Ensure profile takes full width */} 
                 <UserProfileDisplay pubkey={pubkey} ndk={ndk} /> {/* Pass ndk prop */}
            </div>
            <HealthBar currentHp={currentHp} maxHp={maxHp} />
        </div>
    );
} 