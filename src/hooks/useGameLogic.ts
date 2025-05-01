'use strict';
import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { GameRendererRef } from '../components/game/GameRenderer'; // Adjust path if needed
import { AbilityType } from '../components/ui_overlays/ActionButtons'; // Adjust path if needed
import { InitialGamePositions, generateInitialPositions } from './useGameInitialization'; // Assuming this is in the same hooks folder
import NDK, { NDKEvent, NDKFilter, NDKKind } from '@nostr-dev-kit/ndk'; 
import { useSubscribe } from '@nostr-dev-kit/ndk-hooks'; 

// Constants can be defined here or passed as props
const MAX_HP = 100;
const ABILITY_COST = 25;
const MAX_ABILITY_USES = 3;
export const MAX_ROUNDS = 3; // Re-add export

// Define the structure for game action events
interface GameActionEvent {
    type: 'fire';
    aim: { angle: number; power: number };
    ability: AbilityType | null;
    // Add sender pubkey to verify source
    senderPubkey: string; 
}

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
    onGameEnd: (finalScore: [number, number]) => void; // Callback when game/round ends
    // Add NDK and matchId for multiplayer
    ndk?: NDK;
    matchId?: string;
}

// Return value of the hook
export interface UseGameLogicReturn {
    playerStates: [PlayerState, PlayerState];
    currentPlayerIndex: 0 | 1;
    currentAim: { angle: number; power: number };
    selectedAbility: AbilityType | null;
    levelData: InitialGamePositions;
    score: [number, number]; // Re-add score
    currentRound: number; // Re-add current round
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
    // Destructure new props
    ndk,
    matchId,
}: UseGameLogicProps): UseGameLogicReturn {

    // Add validation for multiplayer props
    if (mode === 'multiplayer' && (!ndk || !matchId || !opponentPubkey)) {
        throw new Error("useGameLogic: NDK instance, matchId, and opponentPubkey are required for multiplayer mode.");
    }

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
    const [score, setScore] = useState<[number, number]>([0, 0]); // Re-add score
    const [currentRound, setCurrentRound] = useState<number>(1); // Re-add current round

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
    // Restore the full round completion logic
    const handleRoundCompletion = useCallback((winningPlayerIndex: 0 | 1 | null) => {
        const updatedScore = [...score] as [number, number]; // Clone score

        if (winningPlayerIndex !== null) {
            updatedScore[winningPlayerIndex]++;
            console.log(`Round ${currentRound} won by Player ${winningPlayerIndex}. Score: ${updatedScore[0]}-${updatedScore[1]}`);
        } else {
            // Self-hit or other non-scoring round end
            console.log(`Round ${currentRound} completed (No score). Score: ${updatedScore[0]}-${updatedScore[1]}`);
        }
        setScore(updatedScore); // Use setScore

        // Check if game should end (best of 3 + tie-breaker) or next round should start
        const player0Wins = updatedScore[0] >= 2;
        const player1Wins = updatedScore[1] >= 2;

        if (mode === 'practice' && (player0Wins || player1Wins || currentRound >= MAX_ROUNDS)) {
            // End Game logic with tie-breaker
            let finalScore: [number, number] = [...updatedScore]; 
            let finalWinnerMsg = "";

            if (player0Wins) {
                finalWinnerMsg = "Player 0 (Blue) wins";
            } else if (player1Wins) {
                finalWinnerMsg = "Player 1 (Red) wins";
            } else if (currentRound >= MAX_ROUNDS && finalScore[0] === finalScore[1]) {
                // Tie score after final round, apply HP tie-breaker
                const hp0 = playerStates[0].hp;
                const hp1 = playerStates[1].hp;
                if (hp0 > hp1) {
                    finalScore = [2, finalScore[1]]; 
                    finalWinnerMsg = "Player 0 (Blue) wins (HP Tie-breaker)";
                } else if (hp1 > hp0) {
                    finalScore = [finalScore[0], 2]; 
                    finalWinnerMsg = "Player 1 (Red) wins (HP Tie-breaker)";
                } else {
                    finalWinnerMsg = "Draw (Score and HP Tie)";
                }
            } else {
                 finalWinnerMsg = "Draw";
            }
            
            const winnerMsg = finalWinnerMsg || "Game Over"; 

            console.log(`Game Over! ${winnerMsg}. Final Score: ${updatedScore[0]}-${updatedScore[1]} (HP: ${playerStates[0].hp} vs ${playerStates[1].hp})`);
            onGameEnd(finalScore); 
        } else if (mode === 'practice'){
            // Start Next Round logic with alternating start player
            console.log(`Starting Round ${currentRound + 1}`);
            const nextRound = currentRound + 1;
            const startingPlayerIndex: 0 | 1 = (nextRound % 2 === 1) ? 0 : 1; 

            setCurrentRound(nextRound); // Use setCurrentRound

            const newLevel = generateInitialPositions(2400, 1200);
            setLevelData(newLevel);
            setPlayerStates([
                { hp: MAX_HP, usedAbilities: new Set(), isVulnerable: false },
                { hp: MAX_HP, usedAbilities: new Set(), isVulnerable: false }
            ]);
            setCurrentPlayerIndex(startingPlayerIndex); 
            setSelectedAbility(null);
            const initialAngle = startingPlayerIndex === 0 ? 0 : 180;
            setCurrentAim({ angle: initialAngle, power: 50 });
        } else {
            // Multiplayer logic (remains unchanged)
             console.log(`Multiplayer Round Ended. Triggering onGameEnd.`);
             // Pass a placeholder score for multiplayer until score logic is added there
             onGameEnd([0, 0]); 
        }
    }, [mode, currentRound, score, onGameEnd, playerStates]); // Ensure all dependencies are correct

    // --- Handle Player Hit Callback --- 
    // Restore logic to call handleRoundCompletion
    const handlePlayerHit = useCallback((hitPlayerIndex: 0 | 1, firingPlayerIndex: 0 | 1, projectileType: AbilityType | 'standard') => {
        if (hitPlayerIndex === firingPlayerIndex) {
            console.log(`!!! Player ${firingPlayerIndex} (Mode: ${mode}) hit themselves! Round Lost!`);
            setTimeout(() => handleRoundCompletion(null), 0);
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
                 setTimeout(() => handleRoundCompletion(firingPlayerIndex), 0);
            }
            return newStates;
        });
    }, [handleRoundCompletion, mode]); // Update dependencies

    // --- Aim Change Handler --- 
    // TODO: In multiplayer, maybe send aim updates via ephemeral events? For now, only send fire.
    const handleAimChange = useCallback((aim: { angle: number; power: number }) => {
        setCurrentAim(aim);
        // Apply aim change to the correct player based on mode
        const targetIndex = mode === 'practice' ? currentPlayerIndex : myPlayerIndex;
        gameRendererRef.current?.setShipAim(targetIndex, aim.angle);
    }, [mode, myPlayerIndex, currentPlayerIndex, gameRendererRef]);

    // --- Fire Handler --- 
    // Modify to send Nostr event in multiplayer
    const handleFire = useCallback(async () => { // Make async for publish
        const actingPlayerIndex = mode === 'practice' ? currentPlayerIndex : myPlayerIndex;
        const actingPlayerState = playerStates[actingPlayerIndex];
        const abilityToFire = selectedAbility; // Capture selected ability at time of fire

        console.log(`[useGameLogic] Fire initiated by Player ${actingPlayerIndex} (Mode: ${mode}). HP: ${actingPlayerState.hp}, Aim:`, currentAim, `Ability: ${abilityToFire || 'None'}`);

        // --- Practice Mode Logic (unchanged) ---
        if (mode === 'practice') {
            const scaledPower = currentAim.power / 20;

            if (abilityToFire) {
                if (actingPlayerState.hp <= ABILITY_COST) {
                    console.error(`!!! Player ${actingPlayerIndex} (Mode: ${mode}) SUICIDE! Tried ${abilityToFire} with ${actingPlayerState.hp} HP.`);
                    setTimeout(() => handleRoundCompletion(null), 0);
                    setSelectedAbility(null);
                    return;
                }

                gameRendererRef.current?.fireProjectile(actingPlayerIndex, scaledPower, abilityToFire);

                setPlayerStates(currentStates => {
                    const newStates: [PlayerState, PlayerState] = [
                        { ...currentStates[0], usedAbilities: new Set(currentStates[0].usedAbilities) },
                        { ...currentStates[1], usedAbilities: new Set(currentStates[1].usedAbilities) }
                    ];
                    const playerToUpdate = newStates[actingPlayerIndex];
                    playerToUpdate.hp -= ABILITY_COST;
                    playerToUpdate.usedAbilities.add(abilityToFire);
                    playerToUpdate.isVulnerable = playerToUpdate.usedAbilities.size >= 2;
                    return newStates;
                });
                setSelectedAbility(null); // Clear selection after firing ability
            } else {
                gameRendererRef.current?.fireProjectile(actingPlayerIndex, scaledPower, null);
            }

            console.log(`[useGameLogic] Switching turn in practice mode.`);
            setCurrentPlayerIndex(prevIndex => (prevIndex === 0 ? 1 : 0));
            return; // End practice mode logic here
        }

        // --- Multiplayer Mode Logic ---
        if (mode === 'multiplayer' && ndk && matchId && opponentPubkey) {
            console.log(`[useGameLogic] Publishing fire event for match ${matchId}`);

            // Check for suicide condition *before* publishing
            if (abilityToFire && actingPlayerState.hp <= ABILITY_COST) {
                 console.error(`!!! Player ${actingPlayerIndex} (Mode: ${mode}) SUICIDE! Tried ${abilityToFire} with ${actingPlayerState.hp} HP.`);
                 // Note: In multiplayer, local suicide doesn't immediately end the round for the opponent.
                 // We still might need to publish this action if it's required for sync,
                 // or handle it purely locally if local simulation determines the outcome.
                 // For now, prevent firing and handle locally.
                 setTimeout(() => handleRoundCompletion(null), 0); // Trigger local end
                 setSelectedAbility(null); // Clear selection
                 return; 
            }

            const fireAction: GameActionEvent = {
                type: 'fire',
                aim: { ...currentAim }, // Send a copy of the aim state
                ability: abilityToFire,
                senderPubkey: localPlayerPubkey, // Include sender pubkey
            };

            const event = new NDKEvent(ndk);
            event.kind = 30079; // Custom ephemeral kind for game actions
            event.content = JSON.stringify(fireAction);
            event.tags = [
                ['d', matchId], // Game ID
                ['p', opponentPubkey] // Tag opponent so they can subscribe easily
            ];

            try {
                // Don't await, let NDK handle background publish & optimistic update
                event.publish(); 
                console.log(`[useGameLogic] Published fire event ${event.id}`);

                // Optimistically update local state *after* successful publish intent
                // This includes applying HP cost and ability usage locally immediately
                if (abilityToFire) {
                    setPlayerStates(currentStates => {
                        const newStates: [PlayerState, PlayerState] = [
                            { ...currentStates[0], usedAbilities: new Set(currentStates[0].usedAbilities) },
                            { ...currentStates[1], usedAbilities: new Set(currentStates[1].usedAbilities) }
                        ];
                        const playerToUpdate = newStates[actingPlayerIndex];
                        // Ensure HP cost is applied locally
                        playerToUpdate.hp -= ABILITY_COST; 
                        playerToUpdate.usedAbilities.add(abilityToFire);
                        playerToUpdate.isVulnerable = playerToUpdate.usedAbilities.size >= 2;
                        return newStates;
                    });
                     setSelectedAbility(null); // Clear selection after firing ability
                }

                // Optimistically render the shot locally using gameRendererRef
                // This gives immediate feedback to the firing player
                const scaledPower = currentAim.power / 20;
                gameRendererRef.current?.fireProjectile(actingPlayerIndex, scaledPower, abilityToFire);


            } catch (error) {
                console.error("[useGameLogic] Failed to publish fire event:", error);
                // Handle error, maybe show a message to the user
            }
        }

    }, [
        mode, myPlayerIndex, currentPlayerIndex, playerStates, currentAim, selectedAbility, 
        handleRoundCompletion, gameRendererRef, ndk, matchId, opponentPubkey, localPlayerPubkey // Add new dependencies
    ]);

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

    // --- Subscribe to Opponent Actions (Multiplayer Mode Only) ---
    const subscriptionFilter: NDKFilter | undefined = useMemo(() => {
        if (mode !== 'multiplayer' || !matchId || !opponentPubkey) return undefined;
        // Use NDKKind for the kind number
        const gameActionKind = 30079 as NDKKind; 
        return {
            kinds: [gameActionKind],
            '#d': [matchId],
            authors: [opponentPubkey], // Only listen to opponent's events
        };
    }, [mode, matchId, opponentPubkey]);

    const { events: opponentActions } = useSubscribe(
        subscriptionFilter ? [subscriptionFilter] : [], // Pass filter array or empty array
        { closeOnEose: false, groupable: false }, // Keep listening
        // Provide dependency array, useSubscribe gets ndk instance implicitly
        [subscriptionFilter] 
    );

    // --- Process Received Opponent Actions ---
    useEffect(() => {
        if (mode !== 'multiplayer' || !opponentPubkey) return;

        // Explicitly type the event parameter
        opponentActions.forEach((event: NDKEvent) => { 
            console.log(`[useGameLogic] Received event ${event.id} from opponent ${opponentPubkey}:`, event.content);
            try {
                const action = JSON.parse(event.content) as GameActionEvent;

                // Basic validation
                if (action.type === 'fire' && action.senderPubkey === opponentPubkey) {
                    const opponentIndex = myPlayerIndex === 0 ? 1 : 0;
                    const opponentState = playerStates[opponentIndex];

                    console.log(`[useGameLogic] Processing opponent fire action:`, action);
                    
                    // Check for opponent suicide *remotely*
                    if (action.ability && opponentState.hp <= ABILITY_COST) {
                        console.warn(`!!! Opponent ${opponentPubkey} triggered SUICIDE remotely with ${action.ability} at ${opponentState.hp} HP. Ending round.`);
                         // Opponent hitting themselves means local player wins the round.
                        setTimeout(() => handleRoundCompletion(myPlayerIndex), 0); 
                        // Potentially update opponent state to reflect HP cost if needed, though round ends.
                        // setPlayerStates(...apply HP cost...) 
                        return; // Stop processing this event
                    }

                    // Apply opponent's action to the game state
                    const scaledPower = action.aim.power / 20;
                    gameRendererRef.current?.fireProjectile(opponentIndex, scaledPower, action.ability);

                    // Update opponent's state based on their action
                    if (action.ability) {
                        setPlayerStates(currentStates => {
                            const newStates: [PlayerState, PlayerState] = [
                                { ...currentStates[0], usedAbilities: new Set(currentStates[0].usedAbilities) },
                                { ...currentStates[1], usedAbilities: new Set(currentStates[1].usedAbilities) }
                            ];
                            const playerToUpdate = newStates[opponentIndex];
                            playerToUpdate.hp -= ABILITY_COST; // Apply cost based on received event
                            playerToUpdate.usedAbilities.add(action.ability as AbilityType); // Add used ability
                            playerToUpdate.isVulnerable = playerToUpdate.usedAbilities.size >= 2;
                            return newStates;
                        });
                    }
                } else {
                     console.warn(`[useGameLogic] Received invalid or unexpected action from ${event.pubkey}:`, action);
                }
            } catch (error) {
                console.error("[useGameLogic] Failed to parse opponent action event:", event.content, error);
            }
        });

    }, [opponentActions, mode, opponentPubkey, myPlayerIndex, playerStates, handleRoundCompletion, gameRendererRef]); // Add dependencies

    // Return states and handlers
    return {
        playerStates,
        currentPlayerIndex, // Still needed for practice mode UI/logic
        currentAim,
        selectedAbility,
        levelData,
        score, // Re-add score
        currentRound, // Re-add current round
        handleAimChange,
        handleFire,
        handleSelectAbility,
        handlePlayerHit,
        myPlayerIndex,
    };
} 