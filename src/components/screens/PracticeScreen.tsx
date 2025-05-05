'use strict';
import React, { /* useEffect, */ useCallback } from 'react';
import NDK, { NDKUser } from '@nostr-dev-kit/ndk'; // Import NDK types
import GameRenderer /*, { GameRendererRef } */ from '../game/GameRenderer'; // Renderer ref not needed directly here
import AimingInterface from '../ui_overlays/AimingInterface'; // Adjust path
import { PlayerHUD } from '../ui_overlays/PlayerHUD'; // Adjust path
import ActionButtons from '../ui_overlays/ActionButtons'; // Adjust path
import { useGameLogic } from '../../hooks/useGameLogic'; // Import hook only
import { /* practiceSettings, */ GameSettingsProfile } from '../../config/gameSettings'; // Import practice settings
import { useKeyboardControls } from '../../hooks/useKeyboardControls'; // Import the new hook
import { GameEndResult } from '../../types/game'; // <-- Import GameEndResult
import { useGameAssets } from '../../hooks/useGameAssets'; // <<< CORRECT Import

// Define opponent Npub
const OPPONENT_NPUB = "npub180cvv07tjdrrgpa0j7j7tmnyl2yr6yr7l8j4s3evf6u64th6gkwsyjh6w6"; // Example Npub

interface PracticeScreenProps {
    ndk: NDK;
    currentUser: NDKUser;
    onBackToMenu: () => void;
    settings: GameSettingsProfile;
}

const PracticeScreen: React.FC<PracticeScreenProps> = ({ 
    ndk, 
    currentUser, 
    onBackToMenu, 
    settings
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
        console.log("Practice game ended:", result);
        alert(`Game Over! Winner: ${result.winnerIndex === null ? 'Draw' : `Player ${result.winnerIndex + 1}`} (${result.reason})\nScore: ${result.finalScore[0]} - ${result.finalScore[1]}`);
        onBackToMenu(); // Go back to menu after practice game
    }, [onBackToMenu]);

    // <<< Load Game Assets >>>
    // Destructure the return value to get the assets object and loading state
    const { assets: loadedAssets, loadingState: assetsLoadingState } = useGameAssets();

    // --- Use the Game Logic Hook with Practice Settings --- 
    const {
        playerStates,
        aimStates,
        selectedAbility,
        levelData,
        score,
        currentRound,
        handleAimChange,
        handleFire,
        handleSelectAbility,
        physicsHandles,
        shotTracerHandlers,
    } = useGameLogic({
        settings: settings, // Pass the imported practice settings
        mode: 'practice',
        localPlayerPubkey: currentUser.pubkey,
        opponentPubkey: "placeholder-opponent-pubkey", // Required, but not used in practice logic
        onGameEnd: handlePracticeGameEnd, // Use the wrapped callback
        ndk: ndk, 
        // matchId not needed for practice
    });

    // Derived state for convenience
    const localPlayerState = playerStates[0]; // Based on turn
    const localAimState = aimStates[0]; // Get the current player's aim state
    // Opponent state is present but might not be fully utilized in rendering practice HUD
    const opponentPlayerIndex = 1;
    const opponentPlayerState = playerStates[opponentPlayerIndex];
    
    // Setup keyboard controls ALWAYS for the current player's turn
    useKeyboardControls({
        isActive: true, // Always active in practice mode as user controls both
        currentAngle: localAimState.angle,
        currentPower: localAimState.power,
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
                        currentHp={localPlayerState.hp} // Use index 0 state
                        maxHp={settings.MAX_HP} // Use settings prop
                        isPlayer1={true}
                        ndk={ndk}
                    />
                </div>
                <div className="absolute top-8 right-2 z-10 pointer-events-auto"> {/* Moved down slightly */}
                    <PlayerHUD
                        pubkey={opponentPubkey} // Player 2 (use derived opponent pubkey)
                        currentHp={opponentPlayerState.hp} // Use index 1 state
                        maxHp={settings.MAX_HP} // Use settings prop
                        isPlayer1={false}
                        ndk={ndk}
                    />
                </div>

                {/* Game Canvas Container */}
                <div className="absolute inset-0 z-0 w-full h-full">
                    {/* Check if assets are LOADED and other data is ready */}
                    {assetsLoadingState === 'loaded' && levelData && physicsHandles && shotTracerHandlers && aimStates && settings && (
                        <GameRenderer
                            physicsHandles={physicsHandles}
                            shotTracerHandlers={shotTracerHandlers}
                            settings={settings}
                            aimStates={aimStates}
                            gameAssets={loadedAssets} // <<< Pass the extracted assets object
                        />
                    )}
                    {/* Show loading spinner if assets are NOT loaded OR other data is missing */}
                    {(assetsLoadingState !== 'loaded' || !levelData || !physicsHandles) && (
                        <div className="flex-grow flex items-center justify-center">
                            <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-gray-500"></div>
                        </div>
                    )}
                </div>

                {/* Bottom Control Area - Aiming (Always active) */} 
                <div className="absolute bottom-4 left-4 z-10 pointer-events-auto flex flex-col items-start max-w-xs">
                    <AimingInterface
                        aimStates={aimStates}
                        currentPlayerIndex={0}
                        onAimChange={handleAimChange}
                    />
                </div>

                {/* Bottom Control Area - Actions/Fire (Always active) */} 
                <div className="absolute bottom-4 right-4 z-10 pointer-events-auto flex flex-col items-end">
                    <ActionButtons
                        selectedAbility={selectedAbility}
                        playerStates={playerStates}
                        currentPlayerIndex={0}
                        abilityCost={settings.ABILITY_COST_HP}
                        maxAbilityUsesTotal={settings.MAX_ABILITIES_TOTAL}
                        maxAbilityUsesPerType={settings.MAX_ABILITIES_PER_TYPE}
                        onAbilitySelect={handleSelectAbility}
                        onFire={handleFire}
                        disabled={false}
                        availableAbilities={settings.AVAILABLE_ABILITIES}
                    />
                </div>
            </div>
        </div>
    );
};

export default PracticeScreen; 