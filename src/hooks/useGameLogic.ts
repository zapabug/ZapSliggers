'use strict';
import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { GameRendererRef } from '../components/game/GameRenderer'; // Adjust path if needed
import { AbilityType } from '../components/ui_overlays/ActionButtons'; // Adjust path if needed
import { InitialGamePositions, generateInitialPositions } from './useGameInitialization'; // Assuming this is in the same hooks folder

// Constants can be defined here or passed as props
const MAX_HP = 100;
const ABILITY_COST = 25;
const MAX_ABILITY_USES = 3;

// Player State structure
export interface PlayerState {
    hp: number;
    usedAbilities: Set<AbilityType>;
    isVulnerable: boolean;
}

// Input Props for the hook
export interface UseGameLogicProps {
    mode: 'practice' | 'multiplayer'; // 'multiplayer' means local control for now
    localPlayerPubkey: string;
    opponentPubkey?: string; // Optional for practice mode
    gameRendererRef: React.RefObject<GameRendererRef | null>; // Allow null initial value
    initialLevelData?: InitialGamePositions; // Optional, can generate internally
    onGameEnd: () => void; // Callback when game/round ends
}

// Return value of the hook
export interface UseGameLogicReturn {
    playerStates: [PlayerState, PlayerState];
    currentPlayerIndex: 0 | 1;
    currentAim: { angle: number; power: number };
    selectedAbility: AbilityType | null;
    levelData: InitialGamePositions;
    handleAimChange: (aim: { angle: number; power: number }) => void;
    handleFire: () => void;
    handleSelectAbility: (abilityType: AbilityType) => void;
    handlePlayerHit: (hitPlayerIndex: 0 | 1, firingPlayerIndex: 0 | 1, projectileType: AbilityType | 'standard') => void;
    myPlayerIndex: 0 | 1; // Expose the calculated index for the local player
}

export function useGameLogic({
    mode,
    localPlayerPubkey,
    opponentPubkey,
    gameRendererRef,
    initialLevelData,
    onGameEnd,
}: UseGameLogicProps): UseGameLogicReturn {

    // --- Determine Player Indices --- 
    const { myPlayerIndex } = useMemo(() => {
        // In practice mode, local player is always P0, opponent is placeholder/same
        if (mode === 'practice' || !opponentPubkey) {
            return {
                myPlayerIndex: 0 as 0 | 1,
            };
        }
        // In multiplayer, sort pubkeys to determine P0 and P1 consistently
        const sortedPubkeys = [localPlayerPubkey, opponentPubkey].sort();
        const p0 = sortedPubkeys[0];
        const myIndex = localPlayerPubkey === p0 ? 0 : 1;
        return {
            myPlayerIndex: myIndex as 0 | 1,
        };
    }, [mode, localPlayerPubkey, opponentPubkey]);

    // --- State --- 
    const [levelData, setLevelData] = useState<InitialGamePositions>(() =>
        initialLevelData || generateInitialPositions(2400, 1200)
    );
    const [currentAim, setCurrentAim] = useState({ angle: myPlayerIndex === 1 ? 180 : 0, power: 50 }); // Initial angle based on index
    const [currentPlayerIndex, setCurrentPlayerIndex] = useState<0 | 1>(0); // Tracks turn in practice mode
    const [playerStates, setPlayerStates] = useState<[PlayerState, PlayerState]>([
        { hp: MAX_HP, usedAbilities: new Set(), isVulnerable: false }, // Player 0
        { hp: MAX_HP, usedAbilities: new Set(), isVulnerable: false }  // Player 1
    ]);
    const [selectedAbility, setSelectedAbility] = useState<AbilityType | null>(null);

     // --- Effect to Sync Aim State on Turn Change (Practice Mode Only) --- 
    useEffect(() => {
        if (mode !== 'practice') return; // Only run in practice mode

        const currentShipAngleRad = gameRendererRef.current?.getShipAngle(currentPlayerIndex);
        if (currentShipAngleRad !== undefined) {
            let angleDeg = currentShipAngleRad * (180 / Math.PI);
            angleDeg = (angleDeg % 360 + 360) % 360; // Normalize to 0-360
            setCurrentAim(prevAim => ({ ...prevAim, angle: angleDeg }));
        }
        setSelectedAbility(null);
    }, [currentPlayerIndex, mode, gameRendererRef]); // Dependency on currentPlayerIndex and mode

    // --- Callback for Round Win / Game End --- 
    const handleRoundWin = useCallback(() => {
        console.log(`!!! Round Win detected (Mode: ${mode}) !!!`);
        onGameEnd(); // Call the provided callback

        // Reset game state - TODO: Refine this based on actual game rules (rounds, etc.)
        const newLevel = generateInitialPositions(2400, 1200);
        setLevelData(newLevel);
        setPlayerStates([
            { hp: MAX_HP, usedAbilities: new Set(), isVulnerable: false },
            { hp: MAX_HP, usedAbilities: new Set(), isVulnerable: false }
        ]);
        setCurrentPlayerIndex(0);
        setSelectedAbility(null);
        // Reset aim based on player 0's initial angle (usually 0)
        setCurrentAim({ angle: 0, power: 50 });
        // Optionally, tell renderer to reset positions based on newLevel? Depends on GameRenderer structure
        // gameRendererRef.current?.resetPositions(newLevel);
    }, [onGameEnd, mode]); // Added mode dependency

    // --- Handle Player Hit Callback --- 
    const handlePlayerHit = useCallback((hitPlayerIndex: 0 | 1, firingPlayerIndex: 0 | 1, projectileType: AbilityType | 'standard') => {
        if (hitPlayerIndex === firingPlayerIndex) {
            console.log(`!!! Player ${firingPlayerIndex} (Mode: ${mode}) hit themselves! Round Loss!`);
            handleRoundWin();
            return;
        }

        const damage = projectileType === 'standard' ? 100 : 50;

        setPlayerStates(currentStates => {
            const newStates: [PlayerState, PlayerState] = [
                { ...currentStates[0] }, { ...currentStates[1] }
            ];
            const hitPlayerCurrentState = newStates[hitPlayerIndex];
            const newHp = hitPlayerCurrentState.hp - damage;
            hitPlayerCurrentState.hp = newHp;

            if (newHp <= 0) {
                 console.log(`Player ${hitPlayerIndex} (Mode: ${mode}) defeated. Player ${firingPlayerIndex} wins round!`);
                 setTimeout(() => handleRoundWin(), 0);
            }
            return newStates;
        });
    }, [handleRoundWin, mode]); // Added mode dependency

    // --- Aim Change Handler --- 
    const handleAimChange = useCallback((aim: { angle: number; power: number }) => {
        setCurrentAim(aim);
        // Apply aim change to the correct player based on mode
        const targetIndex = mode === 'practice' ? currentPlayerIndex : myPlayerIndex;
        gameRendererRef.current?.setShipAim(targetIndex, aim.angle);
    }, [mode, myPlayerIndex, currentPlayerIndex, gameRendererRef]);

    // --- Fire Handler --- 
    const handleFire = useCallback(() => {
        const actingPlayerIndex = mode === 'practice' ? currentPlayerIndex : myPlayerIndex;
        const actingPlayerState = playerStates[actingPlayerIndex];

        console.log(`[useGameLogic] Fire initiated by Player ${actingPlayerIndex} (Mode: ${mode}). HP: ${actingPlayerState.hp}, Aim:`, currentAim, `Ability: ${selectedAbility || 'None'}`);

        const scaledPower = currentAim.power / 20;

        if (selectedAbility) {
            if (actingPlayerState.hp <= ABILITY_COST) {
                console.error(`!!! Player ${actingPlayerIndex} (Mode: ${mode}) SUICIDE! Tried ${selectedAbility} with ${actingPlayerState.hp} HP.`);
                handleRoundWin();
                setSelectedAbility(null);
                return;
            }

            gameRendererRef.current?.fireProjectile(actingPlayerIndex, scaledPower, selectedAbility);

            setPlayerStates(currentStates => {
                const newStates: [PlayerState, PlayerState] = [
                    { ...currentStates[0], usedAbilities: new Set(currentStates[0].usedAbilities) }, 
                    { ...currentStates[1], usedAbilities: new Set(currentStates[1].usedAbilities) }
                ];
                const playerToUpdate = newStates[actingPlayerIndex];
                playerToUpdate.hp -= ABILITY_COST;
                playerToUpdate.usedAbilities.add(selectedAbility);
                playerToUpdate.isVulnerable = playerToUpdate.usedAbilities.size >= 2;
                return newStates;
            });
            setSelectedAbility(null);
        } else {
            gameRendererRef.current?.fireProjectile(actingPlayerIndex, scaledPower, null);
        }

        // Switch turn ONLY in practice mode
        if (mode === 'practice') {
             console.log(`[useGameLogic] Switching turn in practice mode.`);
             setCurrentPlayerIndex(prevIndex => (prevIndex === 0 ? 1 : 0));
        }

    }, [mode, myPlayerIndex, currentPlayerIndex, playerStates, currentAim, selectedAbility, handleRoundWin, gameRendererRef]);

    // --- Select Ability Handler --- 
    const handleSelectAbility = useCallback((abilityType: AbilityType) => {
        const actingPlayerIndex = mode === 'practice' ? currentPlayerIndex : myPlayerIndex;
        setPlayerStates(currentStates => {
            const actingPlayerData = currentStates[actingPlayerIndex];

            if (selectedAbility === abilityType) {
                setSelectedAbility(null);
                return currentStates;
            }
            if (actingPlayerData.usedAbilities.size >= MAX_ABILITY_USES) return currentStates;
            if (actingPlayerData.usedAbilities.has(abilityType)) return currentStates;
            // HP check moved to handleFire

             console.log(`Player ${actingPlayerIndex} (Mode: ${mode}) selected ability: ${abilityType}`);
            setSelectedAbility(abilityType);
            return currentStates;
        });
    }, [mode, myPlayerIndex, currentPlayerIndex, selectedAbility]);

    // Return states and handlers
    return {
        playerStates,
        currentPlayerIndex, // Still needed for Practice mode UI indication
        currentAim,
        selectedAbility,
        levelData,
        handleAimChange,
        handleFire,
        handleSelectAbility,
        handlePlayerHit,
        myPlayerIndex // Pass the calculated local player index
    };
} 