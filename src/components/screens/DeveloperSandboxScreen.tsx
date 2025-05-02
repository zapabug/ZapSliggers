'use strict';
import React, { useState, useCallback } from 'react';
import NDK, { NDKUser } from '@nostr-dev-kit/ndk';
import GameRenderer from '../game/GameRenderer';
import AimingInterface from '../ui_overlays/AimingInterface';
import { PlayerHUD } from '../ui_overlays/PlayerHUD';
import ActionButtons from '../ui_overlays/ActionButtons';
import { useGameLogic } from '../../hooks/useGameLogic';
import { defaultCustomSettings, GameSettingsProfile } from '../../config/gameSettings'; // Import default custom settings and profile type

// Define opponent Npub (same placeholder as practice)
const OPPONENT_NPUB = "npub180cvv07tjdrrgpa0j7j7tmnyl2yr6yr7l8j4s3evf6u64th6gkwsyjh6w6";

interface DeveloperSandboxScreenProps {
    ndk: NDK;
    currentUser: NDKUser;
    onBackToMenu: () => void;
}

const DeveloperSandboxScreen: React.FC<DeveloperSandboxScreenProps> = ({ ndk, currentUser, onBackToMenu }) => {
    // --- State for Current Settings --- 
    // Initialize with default custom settings, allow modification later
    const [currentSettings, setCurrentSettings] = useState<GameSettingsProfile>(defaultCustomSettings);

    // opponent pubkey derivation (same as practice)
    let opponentPubkey: string;
    try {
        const opponentUser = new NDKUser({ npub: OPPONENT_NPUB });
        opponentPubkey = opponentUser.pubkey;
        if (!opponentPubkey) throw new Error('Failed to derive pubkey from NDKUser');
    } catch (error) {
        console.error("Error getting opponent pubkey:", error);
        opponentPubkey = currentUser.pubkey; // Fallback to self
    }

    // Game end callback
    const handleGameEnd = useCallback((finalScore: [number, number]) => {
        console.log("Developer Sandbox Game Ended. Score:", finalScore);
        // Maybe just log, or add a reset button? For now, do nothing extra.
    }, []);

    // --- Use the Game Logic Hook with CURRENT Settings --- 
    const {
        playerStates,
        currentPlayerIndex,
        myPlayerIndex, // Needed to determine local player
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
        settings: currentSettings, // Pass the settings STATE here
        mode: 'custom', // Use 'custom' mode
        localPlayerPubkey: currentUser.pubkey,
        opponentPubkey: opponentPubkey, // Pass opponent pubkey
        onGameEnd: handleGameEnd,
        // ndk and matchId not strictly needed for custom/practice mode logic in the hook currently
        ndk: ndk, 
    });

    // Derived state
    const localPlayerState = playerStates[myPlayerIndex];
    const localAimState = aimStates[myPlayerIndex];
    const opponentPlayerIndex = myPlayerIndex === 0 ? 1 : 0;
    const opponentPlayerState = playerStates[opponentPlayerIndex];

    // Determine whose turn it is for UI (assuming alternating turns like practice for 'custom' mode)
    const isMyTurn = currentPlayerIndex === myPlayerIndex;

    // Keyboard Controls (optional, can copy from PracticeScreen if desired)
    // useEffect(() => { ... }, [handleFire, ...]);

    // TODO: Add UI controls here to modify `currentSettings` state
    // Example: <input type="range" value={currentSettings.GRAVITY_CONSTANT} onChange={(e) => setCurrentSettings(s => ({...s, GRAVITY_CONSTANT: parseFloat(e.target.value)}))} />

    // --- Return JSX --- 
    return (
        <div className="relative w-full h-dvh bg-black text-white overflow-hidden flex flex-col">
            {/* Header */}
            <div className="flex-shrink-0 w-full flex justify-start p-2 bg-gray-800 shadow-md z-20">
                 <button 
                    onClick={onBackToMenu} 
                    className="px-3 py-1 bg-gray-600 hover:bg-gray-700 rounded text-white font-semibold transition-colors duration-150 mr-4"
                 >
                     &larr; Back
                 </button>
                 <h1 className="text-xl font-bold ml-4 text-cyan-300 self-center">
                     Developer Sandbox - {isMyTurn ? 'Your Turn' : 'Opponent Turn'} 
                 </h1>
                 {/* Use current settings for max rounds */}
                 <div className="ml-auto text-lg font-semibold text-yellow-300 flex items-center space-x-4 pr-4">
                     <span>Round: {currentRound} / {currentSettings.MAX_ROUNDS}</span> 
                     <span>Score: {score[myPlayerIndex]} - {score[opponentPlayerIndex]}</span>
                 </div>
            </div>

            {/* Game Area */}
            <div className="relative flex-grow w-full h-full">
                {/* Player HUDs - Use myPlayerIndex to place */}
                <div className={`absolute top-2 ${myPlayerIndex === 0 ? 'left-2' : 'right-2'} z-10 pointer-events-auto`}>
                    <PlayerHUD
                        pubkey={currentUser.pubkey} 
                        currentHp={localPlayerState.hp}
                        maxHp={currentSettings.MAX_HP} // Use setting
                        isPlayer1={myPlayerIndex === 0}
                        ndk={ndk}
                    />
                </div>
                <div className={`absolute top-2 ${opponentPlayerIndex === 0 ? 'left-2' : 'right-2'} z-10 pointer-events-auto`}>
                    <PlayerHUD
                        pubkey={opponentPubkey}
                        currentHp={opponentPlayerState.hp}
                        maxHp={currentSettings.MAX_HP} // Use setting
                        isPlayer1={opponentPlayerIndex === 0}
                        ndk={ndk}
                    />
                </div>

                {/* Game Canvas Container */}
                <div className="absolute inset-0 z-0 w-full h-full">
                    {levelData && physicsHandles && shotTracerHandlers && (
                        <GameRenderer
                            physicsHandles={physicsHandles}
                            shotTracerHandlers={shotTracerHandlers}
                        />
                    )}
                     {(!levelData || !physicsHandles) && (
                        <div className="absolute inset-0 flex items-center justify-center text-2xl font-bold text-gray-500">
                            Initializing Sandbox...
                        </div>
                    )}
                </div>

                {/* Settings Controls Panel (Placeholder) */}
                {/* <div className="absolute top-1/4 left-2 z-20 bg-black bg-opacity-60 p-2 rounded max-w-xs"> */}
                {/*     <h3 className="text-sm font-bold mb-1">Settings</h3> */}
                {/*     <label className="text-xs block">Gravity: */}
                {/*         <input type="range" min="0" max="1" step="0.05" value={currentSettings.GRAVITY_CONSTANT} onChange={(e) => setCurrentSettings(s => ({...s, GRAVITY_CONSTANT: parseFloat(e.target.value)}))} /> */}
                {/*     </label> */}
                {/*     { Add more controls } */}
                {/* </div> */}

                {/* Bottom Controls - Aiming */}
                <div className="absolute bottom-4 left-4 z-10 pointer-events-auto flex flex-col items-start max-w-xs">
                    <AimingInterface 
                        currentAngle={localAimState.angle} 
                        currentPower={localAimState.power}
                        onAimChange={handleAimChange} 
                        // No disabled prop needed here for single player
                    />
                </div>

                {/* Bottom Controls - Actions/Fire */}
                <div className="absolute bottom-4 right-4 z-10">
                    <ActionButtons
                        onFire={handleFire}
                        onAbilitySelect={handleSelectAbility}
                        selectedAbility={selectedAbility}
                        usedAbilities={localPlayerState.usedAbilities} // Use local player's used abilities
                        currentHp={localPlayerState.hp} // Use local player's HP
                        // Use settings for cost/limits
                        abilityCost={currentSettings.ABILITY_COST_HP}
                        maxAbilityUsesTotal={currentSettings.MAX_ABILITIES_TOTAL}
                        maxAbilityUsesPerType={currentSettings.MAX_ABILITIES_PER_TYPE}
                        disabled={!isMyTurn} // Disable controls if not the local player's turn
                    />
                </div>
            </div>
        </div>
    );
};

export default DeveloperSandboxScreen; 