'use strict';
import React, { /* useEffect, */ useCallback } from 'react';
import NDK, { NDKUser } from '@nostr-dev-kit/ndk'; // Import NDK types
import GameRenderer /*, { GameRendererRef } */ from '../game/GameRenderer'; // Renderer ref not needed directly here
import AimingInterface from '../ui_overlays/AimingInterface'; // Adjust path
import { PlayerHUD } from '../ui_overlays/PlayerHUD'; // Adjust path
import ActionButtons from '../ui_overlays/ActionButtons'; // Adjust path
import { useGameLogic } from '../../hooks/useGameLogic'; // Import hook only
import { practiceSettings } from '../../config/gameSettings'; // Import practice settings
import { useKeyboardControls } from '../../hooks/useKeyboardControls'; // Import the new hook
import { GameEndResult } from '../../types/game'; // <-- Import GameEndResult

// Define opponent Npub
const OPPONENT_NPUB = "npub180cvv07tjdrrgpa0j7j7tmnyl2yr6yr7l8j4s3evf6u64th6gkwsyjh6w6"; // Example Npub

interface PracticeScreenProps {
    ndk: NDK;
    currentUser: NDKUser;
    onBackToMenu: () => void;
}

const PracticeScreen: React.FC<PracticeScreenProps> = ({ 
    ndk, 
    currentUser, 
    onBackToMenu 
}) => {
    // Get opponent pubkey from npub using NDKUser
    let opponentPubkey: string;
    try {
        const opponentUser = new NDKUser({ npub: OPPONENT_NPUB });
        opponentPubkey = opponentUser.pubkey;
        if (!opponentPubkey) { // Basic check if pubkey is valid
            throw new Error('Failed to derive pubkey from NDKUser');
        }
    } catch (error) {
        console.error("Error getting opponent pubkey:", error);
        opponentPubkey = currentUser.pubkey; // Fallback to current user on error
    }

    // --- Callback to handle game end (accepts GameEndResult) ---
    const handlePracticeGameEnd = useCallback((result: GameEndResult) => {
        let message = "Game Over!";
        const scoreText = `Score: ${result.finalScore[0]} - ${result.finalScore[1]}`;

        if (result.winnerIndex === 0) {
            message = `Blue Wins! (${result.reason})`;
        } else if (result.winnerIndex === 1) {
            message = `Red Wins! (${result.reason})`;
        } else { // winnerIndex is null
            message = `Draw! (${result.reason})`;
        }
 
        alert(`${message}\n${scoreText}`);
        onBackToMenu(); // Call the original navigation callback
    }, [onBackToMenu]);

    // --- Use the Game Logic Hook with Practice Settings --- 
    const {
        playerStates,
        currentPlayerIndex, // Use this to indicate whose turn it is visually
        aimStates, // Get the aim states array
        selectedAbility,
        score, 
        currentRound, 
        handleAimChange,
        handleFire,
        handleSelectAbility,
        // Get handles for renderer
        physicsHandles,
        shotTracerHandlers,
        settings, // Destructure settings
    } = useGameLogic({
        settings: practiceSettings, // Pass the imported practice settings
        mode: 'practice',
        localPlayerPubkey: currentUser.pubkey,
        opponentPubkey: opponentPubkey, // Pass opponent pubkey
        onGameEnd: handlePracticeGameEnd, // Use the wrapped callback
    });

    // Derived state for convenience
    const activePlayerState = playerStates[currentPlayerIndex]; // Based on turn
    const currentAim = aimStates[currentPlayerIndex]; // Get the current player's aim state
    // Inactive state not directly used currently, removed for linting

    // --- Use Keyboard Controls Hook --- 
    useKeyboardControls({
        isActive: true, // Always active in practice screen
        currentAngle: currentAim.angle,
        currentPower: currentAim.power,
        handleAimChange: handleAimChange,
        handleFire: handleFire,
        handleSelectAbility: handleSelectAbility,
    });

    // --- Return JSX (Similar structure to GameScreen, connected to hook) --- 
    return (
        <div className="relative w-full h-dvh bg-black text-white overflow-hidden flex flex-col">
            {/* REMOVED Absolute Back Button */}
            {/* <button 
                onClick={onBackToMenu}
                className="absolute top-2 left-2 z-20 px-3 py-1 bg-gray-700 hover:bg-gray-600 rounded text-xs font-semibold"
            >
                &larr; Back to Menu
            </button> */}

            {/* ADD Minimalist Top-Right Close Button */}
            <button
                onClick={onBackToMenu}
                className="absolute top-2 right-2 z-20 px-2 py-0.5 rounded text-sm font-semibold text-white"
                aria-label="Back to Menu"
            >
                X
            </button>

            {/* ADD Minimalist Top-Center Score/Round Display */}
            <div className="absolute top-2 left-1/2 transform -translate-x-1/2 z-20 flex items-center space-x-4 px-3 py-1 bg-black/30 rounded">
                <span className="text-sm font-semibold text-yellow-300">Round: {currentRound} / {settings.MAX_ROUNDS}</span>
                <span className="text-sm font-semibold text-yellow-300">Score: {score[0]} - {score[1]}</span>
            </div>

            {/* Game Area Container (takes remaining space) - Now takes full height */}
            <div className="relative flex-grow w-full h-full">
                {/* Player HUDs - Adjusted slightly */}
                <div className="absolute top-8 left-2 z-10 pointer-events-auto"> {/* Moved down slightly */}
                    <PlayerHUD
                        pubkey={currentUser.pubkey} // Player 1 (local user)
                        currentHp={playerStates[0].hp} // Use index 0 state
                        maxHp={practiceSettings.MAX_HP}
                        isPlayer1={true}
                        ndk={ndk}
                    />
                </div>
                <div className="absolute top-8 right-2 z-10 pointer-events-auto"> {/* Moved down slightly */}
                    <PlayerHUD
                        pubkey={opponentPubkey} // Player 2 (use derived opponent pubkey)
                        currentHp={playerStates[1].hp} // Use index 1 state
                        maxHp={practiceSettings.MAX_HP}
                        isPlayer1={false}
                        ndk={ndk}
                    />
                </div>

                {/* Game Canvas Container */}
                <div className="absolute inset-0 z-0 w-full h-full">
                    <GameRenderer
                        physicsHandles={physicsHandles}
                        shotTracerHandlers={shotTracerHandlers}
                        settings={settings}
                        aimStates={aimStates}
                    />
                </div>

                {/* Bottom Control Area - Aiming (Always active) */} 
                <div className="absolute bottom-4 left-4 z-10 pointer-events-auto flex flex-col items-start max-w-xs">
                    <AimingInterface
                        currentAngle={currentAim.angle} // Use current player's aim angle
                        currentPower={currentAim.power} // Use current player's aim power
                        onAimChange={handleAimChange} // Use handler from hook
                    />
                </div>

                {/* Bottom Control Area - Actions/Fire (Always active) */} 
                <div className="absolute bottom-4 right-4 z-10 pointer-events-auto flex flex-col items-end">
                    <ActionButtons
                        selectedAbility={selectedAbility} // Pass current selection
                        usedAbilities={activePlayerState.usedAbilities} // Pass used abilities of active player
                        currentHp={activePlayerState.hp} // Pass active player's HP
                        abilityCost={practiceSettings.ABILITY_COST_HP} // Corrected prop name
                        maxAbilityUsesTotal={practiceSettings.MAX_ABILITIES_TOTAL} // Corrected prop name
                        maxAbilityUsesPerType={practiceSettings.MAX_ABILITIES_PER_TYPE} // Corrected prop name
                        onAbilitySelect={handleSelectAbility} // Renamed prop
                        onFire={handleFire} // Pass fire handler
                        disabled={false} // Added missing required prop
                        availableAbilities={settings.AVAILABLE_ABILITIES} // Pass available abilities from settings
                    />
                </div>
            </div>
        </div>
    );
};

export default PracticeScreen; 