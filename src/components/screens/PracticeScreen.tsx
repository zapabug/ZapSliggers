'use strict';
import React, { useRef, useEffect, useCallback } from 'react';
import NDK, { NDKUser } from '@nostr-dev-kit/ndk'; // Import NDK types
import GameRenderer, { GameRendererRef } from '../game/GameRenderer'; // Adjust path
import AimingInterface from '../ui_overlays/AimingInterface'; // Adjust path
import { PlayerHUD } from '../ui_overlays/PlayerHUD'; // Adjust path
import ActionButtons from '../ui_overlays/ActionButtons'; // Adjust path
import { useGameLogic, MAX_ROUNDS } from '../../hooks/useGameLogic'; // Import hook and MAX_ROUNDS

// Define opponent Npub
const OPPONENT_NPUB = "npub180cvv07tjdrrgpa0j7j7tmnyl2yr6yr7l8j4s3evf6u64th6gkwsyjh6w6";

interface PracticeScreenProps {
    ndk: NDK;
    currentUser: NDKUser;
    onBackToMenu: () => void;
}

// Define constants (can be moved or shared)
const MAX_HP = 100;
const ABILITY_COST = 25;
const MAX_ABILITY_USES = 3;

const PracticeScreen: React.FC<PracticeScreenProps> = ({ 
    ndk, 
    currentUser, 
    onBackToMenu 
}) => {
    const gameRendererRef = useRef<GameRendererRef>(null);

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

    // --- Callback to handle game end (copied from previous correct state) ---
    const handlePracticeGameEnd = useCallback((finalScore?: [number, number]) => {
        let message = "Game Over!";
        if (finalScore) {
            if (finalScore[0] >= 2) {
                message = "Blue Wins!";
            } else if (finalScore[1] >= 2) {
                message = "Red Wins!";
            } else {
                // Neither reached 2 wins
                message = `Game Over!\nDraw: ${finalScore[0]} - ${finalScore[1]}`;
            }
        } 
        alert(message);
        onBackToMenu(); // Call the original navigation callback
    }, [onBackToMenu]);

    // --- Use the Game Logic Hook in Practice Mode (copied from previous correct state) --- 
    const {
        playerStates,
        currentPlayerIndex, // Use this to indicate whose turn it is visually
        currentAim,
        selectedAbility,
        levelData,
        score, 
        currentRound, 
        handleAimChange,
        handleFire,
        handleSelectAbility,
        handlePlayerHit,
    } = useGameLogic({
        mode: 'practice', 
        localPlayerPubkey: currentUser.pubkey,
        gameRendererRef,
        onGameEnd: handlePracticeGameEnd, // Use the wrapped callback
    });

    // Derived state for convenience
    const activePlayerState = playerStates[currentPlayerIndex]; // Based on turn
    // Inactive state not directly used currently, removed for linting

    // --- Keyboard Controls (Use handlers from hook) --- 
    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            let newAngle: number | undefined = undefined;
            let newPower: number | undefined = undefined;
            let preventDefault = false;
            let angleMultiplier = 1; // Default direction

            // Check if it's Player 2's turn in practice mode for inversion
            if (currentPlayerIndex === 1) { 
                angleMultiplier = -1;
            }

            // Swap controls and apply inversion if needed
            switch (event.key) {
                case 'ArrowLeft': // Now controls Angle LEFT
                    newAngle = (currentAim.angle - (2 * angleMultiplier) + 360) % 360;
                    preventDefault = true;
                    break;
                case 'ArrowRight': // Now controls Angle RIGHT
                    newAngle = (currentAim.angle + (2 * angleMultiplier)) % 360;
                    preventDefault = true;
                    break;
                case 'ArrowDown': // Now controls Power DOWN
                    newPower = Math.max(0, currentAim.power - 2);
                    preventDefault = true;
                    break;
                case 'ArrowUp': // Now controls Power UP
                    newPower = Math.min(100, currentAim.power + 2);
                    preventDefault = true;
                    break;
                case ' ': // Spacebar
                    event.preventDefault();
                    handleFire(); // Call hook handler
                    break;
                case '1': handleSelectAbility('splitter'); break; 
                case '2': handleSelectAbility('gravity'); break; 
                case '3': handleSelectAbility('plastic'); break; 
                default:
                    break;
            }

            if (preventDefault) {
                event.preventDefault();
            }

            if (newAngle !== undefined || newPower !== undefined) {
                const updatedAim = {
                    angle: newAngle !== undefined ? newAngle : currentAim.angle,
                    power: newPower !== undefined ? newPower : currentAim.power,
                };
                handleAimChange(updatedAim); // Call hook handler
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => {
            window.removeEventListener('keydown', handleKeyDown);
        };
        // Dependencies include handlers and currentPlayerIndex for the inversion logic
    }, [handleFire, handleSelectAbility, handleAimChange, currentAim.angle, currentAim.power, currentPlayerIndex]); 

    // --- Return JSX (Similar structure to GameScreen, connected to hook) --- 
    return (
        <div className="relative w-full h-dvh bg-black text-white overflow-hidden flex flex-col">
            {/* Header with Back Button */}
            <div className="flex-shrink-0 w-full flex justify-start p-2 bg-gray-800 shadow-md z-20">
                <button 
                    onClick={onBackToMenu}
                    className="px-4 py-2 rounded font-semibold text-white bg-gray-600 hover:bg-gray-700 transition-colors focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-opacity-50"
                >
                    &larr; Back to Menu
                </button>
                <h1 className="text-xl font-bold ml-4 text-purple-300 self-center">
                    Practice Mode - {currentPlayerIndex === 0 ? 'Player 1' : 'Player 2'}'s Turn
                </h1>
                {/* Display Score and Round (copied from previous correct state) */}
                <div className="ml-auto text-lg font-semibold text-yellow-300 flex items-center space-x-4 pr-4">
                    <span>Round: {currentRound} / {MAX_ROUNDS}</span>
                    <span>Score: {score[0]}</span>
                </div>
            </div>

            {/* Game Area Container (takes remaining space) */}
            <div className="relative flex-grow w-full h-full">
                {/* Player HUDs - Note: Both might show the same user in practice */}
                <div className="absolute top-2 left-2 z-10 pointer-events-auto">
                    <PlayerHUD
                        pubkey={currentUser.pubkey} // Player 1 (local user)
                        currentHp={playerStates[0].hp} // Use index 0 state
                        maxHp={MAX_HP}
                        isPlayer1={true}
                        ndk={ndk}
                    />
                </div>
                <div className="absolute top-2 right-2 z-10 pointer-events-auto">
                    <PlayerHUD
                        pubkey={opponentPubkey} // Player 2 (use derived opponent pubkey)
                        currentHp={playerStates[1].hp} // Use index 1 state
                        maxHp={MAX_HP}
                        isPlayer1={false}
                        ndk={ndk}
                    />
                </div>

                {/* Game Canvas Container */}
                <div className="absolute inset-0 z-0 w-full h-full">
                    {levelData && (
                        <GameRenderer
                            ref={gameRendererRef}
                            levelData={levelData} // Use level data from hook
                            onPlayerHit={handlePlayerHit} // Use hit handler from hook
                        />
                    )}
                </div>

                {/* Bottom Control Area - Aiming (Always active) */} 
                <div className="absolute bottom-4 left-4 z-10 pointer-events-auto flex flex-col items-start max-w-xs">
                    <AimingInterface
                        currentAngle={currentAim.angle} // Use aim from hook
                        onAimChange={handleAimChange} // Use handler from hook
                    />
                </div>

                {/* Bottom Control Area - Actions/Fire (Always active) */} 
                <div className="absolute bottom-4 right-4 z-10">
                    <ActionButtons
                        onFire={handleFire} // Use handler from hook
                        onAbilitySelect={handleSelectAbility} // Use handler from hook
                        selectedAbility={selectedAbility} // Use state from hook
                        // Pass state of the *current turn's* player
                        usedAbilities={activePlayerState.usedAbilities}
                        currentHp={activePlayerState.hp}
                        abilityCost={ABILITY_COST}
                        maxAbilityUses={MAX_ABILITY_USES}
                        disabled={false} // No disabled logic needed for practice
                    />
                </div>
            </div>
        </div>
    );
};

export default PracticeScreen; 