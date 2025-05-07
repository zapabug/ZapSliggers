'use strict';
import React, { useCallback } from 'react';
import NDK from '@nostr-dev-kit/ndk';
import GameRenderer from '../game/GameRenderer';
import AimingInterface from '../ui_overlays/AimingInterface';
import { PlayerHUD } from '../ui_overlays/PlayerHUD';
import ActionButtons from '../ui_overlays/ActionButtons';
import { useGameLogic } from '../../hooks/useGameLogic';
import { gameSettings } from '../../config/gameSettings';
import { useKeyboardControls } from '../../hooks/useKeyboardControls';
import { GameEndResult } from '../../types/game';

interface GameScreenProps {
    ndk: NDK;
    localPlayerPubkey: string;
    opponentPubkey: string;
    matchId: string;
    onGameEnd: (result: GameEndResult) => void;
    onBackToMenu: () => void;
}

const GameScreen: React.FC<GameScreenProps> = ({
    ndk,
    localPlayerPubkey,
    opponentPubkey,
    matchId,
    onGameEnd,
    onBackToMenu,
}) => {
    const handleMultiplayerGameEnd = useCallback((result: GameEndResult) => {
        onGameEnd(result);
    }, [onGameEnd]);

    const {
        playerStates,
        myPlayerIndex,
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
        settings: gameSettings,
        mode: 'multiplayer',
        localPlayerPubkey: localPlayerPubkey,
        opponentPubkey: opponentPubkey,
        onGameEnd: handleMultiplayerGameEnd,
        ndk: ndk,
        matchId: matchId,
    });

    const localPlayerState = playerStates[myPlayerIndex];
    const localAimState = aimStates[myPlayerIndex];
    const opponentPlayerIndex = myPlayerIndex === 0 ? 1 : 0;
    const opponentPlayerState = playerStates[opponentPlayerIndex];

    const isMyTurn = true;

    useKeyboardControls({
        isActive: true,
        currentAngle: localAimState.angle,
        currentPower: localAimState.power,
        handleAimChange: handleAimChange,
        handleFire: handleFire,
        handleSelectAbility: handleSelectAbility,
    });

    return (
        <div className="relative w-full h-dvh bg-black text-white overflow-hidden flex flex-col">
            <div className="absolute inset-0 bg-black border-t-2 border-yellow-600">
                <div className="absolute inset-0 bg-[url('/backdrop.png')] bg-no-repeat bg-fixed bg-top"></div>
            </div>
            <div className="flex-shrink-0 w-full flex justify-start p-2 bg-gray-800 shadow-md z-20">
                <button
                    onClick={onBackToMenu}
                    className="px-3 py-1 bg-red-600 hover:bg-red-700 rounded text-white font-semibold transition-colors duration-150 mr-4"
                >
                    &larr; Leave Match
                </button>
                <h1 className="text-xl font-bold ml-4 text-purple-300 self-center">
                    Match vs {opponentPubkey.slice(0, 10)}...
                </h1>
                <div className="ml-auto text-lg font-semibold text-yellow-300 flex items-center space-x-4 pr-4">
                    <span>Round: {currentRound} / {gameSettings.MAX_ROUNDS}</span>
                    <span>Score: {score[myPlayerIndex]} - {score[opponentPlayerIndex]}</span>
                </div>
            </div>

            <div className="relative flex-grow w-full h-full">
                <div className={`absolute top-2 ${myPlayerIndex === 0 ? 'left-2' : 'right-2'} z-10 pointer-events-auto`}>
                    <PlayerHUD
                        pubkey={localPlayerPubkey}
                        currentHp={localPlayerState.hp}
                        maxHp={gameSettings.MAX_HP}
                        isPlayer1={myPlayerIndex === 0}
                        ndk={ndk}
                    />
                </div>
                <div className={`absolute top-2 ${opponentPlayerIndex === 0 ? 'left-2' : 'right-2'} z-10 pointer-events-auto`}>
                    <PlayerHUD
                        pubkey={opponentPubkey}
                        currentHp={opponentPlayerState.hp}
                        maxHp={gameSettings.MAX_HP}
                        isPlayer1={opponentPlayerIndex === 0}
                        ndk={ndk}
                    />
                </div>

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
                            Initializing Match...
                        </div>
                    )}
                </div>

                <div className="absolute bottom-6 left-6 z-10 pointer-events-auto flex flex-col items-start max-w-xs">
                    <AimingInterface
                        currentAngle={localAimState.angle}
                        currentPower={localAimState.power}
                        onAimChange={handleAimChange}
                    />
                </div>

                <div className="absolute bottom-6 right-6 z-10 pointer-events-auto flex flex-col items-end">
                    <ActionButtons
                        onFire={handleFire}
                        onAbilitySelect={handleSelectAbility}
                        selectedAbility={selectedAbility}
                        usedAbilities={localPlayerState.usedAbilities}
                        currentHp={localPlayerState.hp}
                        abilityCost={gameSettings.ABILITY_COST_HP}
                        maxAbilityUsesTotal={settings.MAX_ABILITIES_TOTAL}
                        maxAbilityUsesPerType={settings.MAX_ABILITIES_PER_TYPE}
                        disabled={!isMyTurn}
                        availableAbilities={settings.AVAILABLE_ABILITIES}
                    />
                </div>
            </div>
        </div>
    );
};

export default GameScreen;