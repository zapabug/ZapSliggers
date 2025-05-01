'use strict';
import React, { useRef, useEffect } from 'react';
import NDK, { NDKUser } from '@nostr-dev-kit/ndk'; // Import NDK types
import GameRenderer, { GameRendererRef } from '../game/GameRenderer'; // Adjust path
import AimingInterface from '../ui_overlays/AimingInterface'; // Adjust path
import { PlayerHUD } from '../ui_overlays/PlayerHUD'; // Adjust path
import ActionButtons from '../ui_overlays/ActionButtons'; // Adjust path
import { useGameLogic } from '../../hooks/useGameLogic'; // Adjust path

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

    // --- Use the Game Logic Hook in Practice Mode --- 
    const {
        playerStates,
        currentPlayerIndex, // Use this to indicate whose turn it is visually
        currentAim,
        selectedAbility,
        levelData,
        handleAimChange,
        handleFire,
        handleSelectAbility,
        handlePlayerHit,
        // myPlayerIndex // Removed, not needed for practice mode control
    } = useGameLogic({
        mode: 'practice', 
        localPlayerPubkey: currentUser.pubkey,
        // Opponent pubkey not needed for practice mode logic in the hook
        gameRendererRef,
        onGameEnd: onBackToMenu, // Map back callback to game end
        // NDK passed separately to HUDs below
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

            switch (event.key) {
                case 'ArrowUp':
                    newAngle = (currentAim.angle - 2 + 360) % 360;
                    preventDefault = true;
                    break;
                case 'ArrowDown':
                    newAngle = (currentAim.angle + 2) % 360;
                    preventDefault = true;
                    break;
                case 'ArrowLeft':
                    newPower = Math.max(0, currentAim.power - 2);
                    preventDefault = true;
                    break;
                case 'ArrowRight':
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
        // Dependencies include handlers from the hook
    }, [handleFire, handleSelectAbility, handleAimChange, currentAim.angle, currentAim.power]); 

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
                        // isActive={currentPlayerIndex === 0} // Prop removed for now
                    />
                </div>
                <div className="absolute top-2 right-2 z-10 pointer-events-auto">
                    <PlayerHUD
                        pubkey={currentUser.pubkey} // Player 2 (placeholder/local user)
                        currentHp={playerStates[1].hp} // Use index 1 state
                        maxHp={MAX_HP}
                        isPlayer1={false}
                        ndk={ndk}
                        // isActive={currentPlayerIndex === 1} // Prop removed for now
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