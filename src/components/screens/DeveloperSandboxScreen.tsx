'use strict';
import React, { useCallback } from 'react';
import NDK from '@nostr-dev-kit/ndk';
import GameRenderer from '../game/GameRenderer';
import AimingInterface from '../ui_overlays/AimingInterface';
import ActionButtons from '../ui_overlays/ActionButtons';
import { useGameLogic } from '../../hooks/useGameLogic';
import { sandboxSettings } from '../../config/gameSettings';
import { GameEndResult } from '../../types/game';
import { useKeyboardControls } from '../../hooks/useKeyboardControls';
import { NDKUser } from '@nostr-dev-kit/ndk';

interface DeveloperSandboxScreenProps {
    ndk?: NDK;
    currentUser?: NDKUser;
    localPlayerPubkey?: string;
    onBackToMenu: () => void;
}

const DeveloperSandboxScreen: React.FC<DeveloperSandboxScreenProps> = ({ onBackToMenu, localPlayerPubkey = "sandbox-player" }) => {
    const handleGameEnd = useCallback((result: GameEndResult) => {
        console.log('[Sandbox] Game Over:', result);
        alert(`[Sandbox] Game Over! Winner: ${result.winnerIndex === 0 ? 'Player 0' : result.winnerIndex === 1 ? 'Player 1' : 'Draw'}. Final Score: ${result.finalScore[0]}-${result.finalScore[1]}. Reason: ${result.reason}`);
    }, []);

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
        settings,
    } = useGameLogic({
        settings: sandboxSettings,
        mode: 'practice',
        localPlayerPubkey: localPlayerPubkey,
        onGameEnd: handleGameEnd,
    });

    useKeyboardControls({
        isActive: true,
        currentAngle: aimStates[0].angle,
        currentPower: aimStates[0].power,
        handleAimChange: handleAimChange,
        handleFire: handleFire,
        handleSelectAbility: handleSelectAbility,
    });

    return (
        <div className="relative w-full h-dvh bg-gray-900 text-white overflow-hidden flex flex-col">
            <div className="flex-shrink-0 w-full flex justify-between items-center p-2 bg-gray-800 shadow-md z-20">
                <button
                    onClick={onBackToMenu}
                    className="px-3 py-1 bg-red-600 hover:bg-red-700 rounded text-white font-semibold transition-colors duration-150"
                >
                    &larr; Back to Menu
                </button>
                <h1 className="text-xl font-bold text-yellow-300">Developer Sandbox</h1>
                <div className="text-lg font-semibold text-blue-300 flex items-center space-x-4 pr-4">
                     <span>Round: {currentRound} / {settings.MAX_ROUNDS}</span>
                     <span>Score: {score[0]} - {score[1]}</span>
                     <span>P1 HP: {playerStates[0].hp}</span>
                     <span>P2 HP: {playerStates[1].hp}</span>
                </div>
            </div>

            <div className="relative flex-grow w-full h-full">
                <div className="absolute inset-0 z-0 w-full h-full">
                    {levelData && physicsHandles && shotTracerHandlers && aimStates && settings && (
                        <GameRenderer
                            physicsHandles={physicsHandles}
                            shotTracerHandlers={shotTracerHandlers}
                            settings={settings}
                            aimStates={aimStates}
                        />
                    )}
                    {(!levelData || !physicsHandles) && (
                        <div className="absolute inset-0 flex items-center justify-center text-2xl font-bold text-gray-500">
                            Initializing Sandbox...
                        </div>
                    )}
                </div>

                <div className="absolute bottom-4 left-4 z-10 pointer-events-auto flex flex-col items-start max-w-xs">
                     <AimingInterface
                         currentAngle={aimStates[0].angle}
                         currentPower={aimStates[0].power}
                         onAimChange={handleAimChange}
                     />
                </div>

                <div className="absolute bottom-4 right-4 z-10 pointer-events-auto flex flex-col items-end">
                    <ActionButtons
                        onFire={handleFire}
                        onAbilitySelect={handleSelectAbility}
                        selectedAbility={selectedAbility}
                        usedAbilities={playerStates[0].usedAbilities}
                        currentHp={playerStates[0].hp}
                        abilityCost={settings.ABILITY_COST_HP}
                        maxAbilityUsesTotal={settings.MAX_ABILITIES_TOTAL}
                        maxAbilityUsesPerType={settings.MAX_ABILITIES_PER_TYPE}
                        disabled={false}
                        availableAbilities={settings.AVAILABLE_ABILITIES}
                    />
                </div>
            </div>
        </div>
    );
};

export default DeveloperSandboxScreen; 