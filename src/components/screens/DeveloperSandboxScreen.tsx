'use strict';
import React, { useCallback } from 'react';
import NDK from '@nostr-dev-kit/ndk';
import GameRenderer from '../game/GameRenderer';
import AimingInterface from '../ui_overlays/AimingInterface';
import ActionButtons from '../ui_overlays/ActionButtons';
import { useGameLogic } from '../../hooks/useGameLogic';
import { GameSettingsProfile } from '../../config/gameSettings';
import { GameEndResult } from '../../types/game';
import { useKeyboardControls } from '../../hooks/useKeyboardControls';
import { NDKUser } from '@nostr-dev-kit/ndk';
import { useGameAssets } from '../../hooks/useGameAssets';

interface DeveloperSandboxScreenProps {
    ndk: NDK;
    currentUser: NDKUser;
    onBackToMenu: () => void;
    settings: GameSettingsProfile;
}

const DeveloperSandboxScreen: React.FC<DeveloperSandboxScreenProps> = ({ ndk, currentUser, onBackToMenu, settings }) => {
    const handleSandboxGameEnd = useCallback((result: GameEndResult) => {
        console.log("Developer Sandbox game ended (or round completed):", result);
    }, []);

    const { assets: loadedAssets, loadingState: assetsLoadingState } = useGameAssets();

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
        settings: settings,
        mode: 'custom',
        localPlayerPubkey: currentUser.pubkey,
        opponentPubkey: "sandbox-opponent-pubkey",
        onGameEnd: handleSandboxGameEnd,
        ndk: ndk,
    });

    const localAimState = aimStates[0];

    useKeyboardControls({
        isActive: true,
        currentAngle: localAimState.angle,
        currentPower: localAimState.power,
        handleAimChange: handleAimChange,
        handleFire: handleFire,
        handleSelectAbility: handleSelectAbility,
    });

    return (
        <div className="relative w-full h-dvh bg-gray-900 text-white overflow-hidden flex flex-col">
            <div className="flex-shrink-0 w-full flex justify-between p-2 bg-gray-800 shadow-md z-20">
                <button
                    onClick={onBackToMenu}
                    className="px-3 py-1 bg-blue-600 hover:bg-blue-700 rounded text-white font-semibold transition-colors duration-150 mr-4"
                >
                    &larr; Back to Menu
                </button>
                <h1 className="text-xl font-bold text-purple-300 self-center">
                    Developer Sandbox
                </h1>
                <div className="text-lg font-semibold text-yellow-300 flex items-center space-x-4 pr-4">
                    <span>Round: {currentRound}</span>
                    <span>Score: {score[0]} - {score[1]}</span>
                </div>
            </div>

            <div className="relative flex-grow w-full h-full">
                <div className="absolute inset-0 z-0 w-full h-full">
                    {assetsLoadingState === 'loaded' && levelData && physicsHandles && shotTracerHandlers && aimStates && settings && (
                        <GameRenderer
                            physicsHandles={physicsHandles}
                            shotTracerHandlers={shotTracerHandlers}
                            settings={settings}
                            aimStates={aimStates}
                            gameAssets={loadedAssets}
                        />
                    )}
                    {(assetsLoadingState !== 'loaded' || !levelData || !physicsHandles) && (
                        <div className="absolute inset-0 flex items-center justify-center text-2xl font-bold text-gray-500">
                            Initializing Sandbox...
                        </div>
                    )}
                </div>

                <div className="absolute bottom-4 left-4 z-10 pointer-events-auto flex flex-col items-start max-w-xs">
                    <AimingInterface
                        aimStates={aimStates}
                        currentPlayerIndex={0}
                        onAimChange={handleAimChange}
                    />
                </div>

                <div className="absolute bottom-4 right-4 z-10 pointer-events-auto flex flex-col items-end">
                    <ActionButtons
                        onFire={handleFire}
                        onAbilitySelect={handleSelectAbility}
                        selectedAbility={selectedAbility}
                        playerStates={playerStates}
                        currentPlayerIndex={0}
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