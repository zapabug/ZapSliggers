'use strict';
import React, { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { GameRendererRef } from '../components/game/GameRenderer'; // Adjust path if needed
import { AbilityType } from '../components/ui_overlays/ActionButtons'; // Adjust path if needed
import { InitialGamePositions, generateInitialPositions } from './useGameInitialization'; // Assuming this is in the same hooks folder
import NDK, { NDKEvent, NDKFilter, NDKKind } from '@nostr-dev-kit/ndk'; 
import { useSubscribe } from '@nostr-dev-kit/ndk-hooks'; 
import {
    PlayerState,
    FireActionEvent,
    ShotResolvedEvent,
    GameNostrEventContent,
    ProjectilePathData
} from '../types/game';
import { useShotTracers } from './useShotTracers'; // Import useShotTracers

// Constants can be defined here or passed as props
const MAX_HP = 100;
const ABILITY_COST = 25;
const MAX_ABILITY_USES = 3;
export const MAX_ROUNDS = 3; // Re-add export

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
    score: [number, number];
    currentRound: number;
    handleAimChange: (aim: { angle: number; power: number }) => void;
    handleFire: () => void;
    handleSelectAbility: (abilityType: AbilityType) => void;
    myPlayerIndex: 0 | 1;
    // Expose the internal callbacks needed by GameRenderer
    handlePlayerHit: (hitPlayerIndex: 0 | 1, firingPlayerIndex: 0 | 1, projectileType: AbilityType | 'standard') => void;
    handleProjectileResolved: (path: ProjectilePathData, firedByPlayerIndex: 0 | 1) => void;
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

    // --- Hooks ---
    const tracers = useShotTracers(); // Instantiate shot tracers hook

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

    // --- Refs --- (Optional: if needed for callbacks)
    const playerStatesRef = useRef(playerStates);
    useEffect(() => { playerStatesRef.current = playerStates; }, [playerStates]);

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

    // --- NDK Subscription (Multiplayer Only) ---
    const filter = useMemo((): NDKFilter | undefined => {
        if (mode !== 'multiplayer' || !matchId || !opponentPubkey) return undefined;
        return {
            kinds: [30079 as NDKKind],
            authors: [opponentPubkey],
            '#d': [matchId],
            since: Math.floor(Date.now() / 1000) - 60,
        };
    }, [mode, matchId, opponentPubkey]);

    const { events: opponentEvents } = useSubscribe(
        filter ? [filter] : [], // 1st arg: Filters array
        { // 2nd arg: Options object
            closeOnEose: false,
            groupable: false,
        },
        ndk ? [ndk] : undefined // 3rd arg: NDK instance (wrapped in array)
    );

    // --- Effect to Handle Incoming Opponent Events ---
    useEffect(() => {
        if (mode !== 'multiplayer' || !gameRendererRef.current || !opponentPubkey) return;

        opponentEvents.forEach(event => {
            try {
                const content: GameNostrEventContent = JSON.parse(event.content);

                // Basic validation
                if (content.matchId !== matchId || content.senderPubkey !== opponentPubkey) {
                    console.warn(`[useGameLogic] Received event from unexpected source/match. Ignoring.`, event);
                    return;
                }

                if (content.type === 'fire') {
                    console.log(`[useGameLogic] Received opponent FIRE event`, content);
                    const opponentIndex = myPlayerIndex === 0 ? 1 : 0;
                    const scaledPower = content.aim.power / 20;
                    // Simulate opponent's shot locally
                    gameRendererRef.current?.fireProjectile(
                        opponentIndex,
                        scaledPower,
                        content.ability as AbilityType | null // Assuming AbilityType is string enum or similar
                    );
                } else if (content.type === 'shotResolved') {
                    console.log(`[useGameLogic] Received opponent SHOT_RESOLVED event`, content);
                    const opponentIndex = myPlayerIndex === 0 ? 1 : 0;
                    // Add the received path to the tracer history for the opponent
                    tracers.addOpponentTrace(opponentIndex, content.path);
                }

            } catch (error) {
                console.error("[useGameLogic] Failed to parse opponent event content:", error, event);
            }
        });

    }, [opponentEvents, mode, matchId, opponentPubkey, gameRendererRef, myPlayerIndex, tracers.addOpponentTrace]);

    // --- Handle Player Hit Callback --- 
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
    }, [handleRoundCompletion, mode]);

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
    const handleFire = useCallback(() => {
        const actingPlayerIndex = mode === 'practice' ? currentPlayerIndex : myPlayerIndex;
        const actingPlayerState = playerStates[actingPlayerIndex];
        const abilityToFire = selectedAbility;
        const currentAimState = currentAim; // Capture state at time of call

        console.log(`[useGameLogic] Fire initiated by Player ${actingPlayerIndex} (Mode: ${mode}). Aim:`, currentAimState, `Ability: ${abilityToFire || 'None'}`);

        // --- Practice Mode Logic (unchanged) ---
        if (mode === 'practice') {
            const scaledPower = currentAimState.power / 20;

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
            const scaledPower = currentAimState.power / 20;
            // Local simulation first
            gameRendererRef.current?.fireProjectile(actingPlayerIndex, scaledPower, abilityToFire);
            console.log(`[useGameLogic] Locally fired for P${actingPlayerIndex}`);

            // Send FIRE event over Nostr
            const eventData: FireActionEvent = {
                type: 'fire',
                matchId: matchId,
                senderPubkey: localPlayerPubkey,
                aim: { angle: currentAimState.angle, power: currentAimState.power }, // Send raw aim
                ability: abilityToFire as string | null,
            };

            const ndkEvent = new NDKEvent(ndk);
            ndkEvent.kind = 30079 as NDKKind;
            ndkEvent.content = JSON.stringify(eventData);
            ndkEvent.tags = [
                ['d', matchId],
                ['p', opponentPubkey],
            ];

            ndkEvent.publish();
            console.log("[useGameLogic] Published FIRE event.");

            // Reset ability selection after firing (multiplayer)
            setSelectedAbility(null);
        }

    }, [
        mode,
        currentPlayerIndex,
        myPlayerIndex,
        playerStates,
        selectedAbility,
        currentAim,
        gameRendererRef,
        handleRoundCompletion,
        ndk,
        matchId,
        opponentPubkey,
        localPlayerPubkey,
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

    // --- Handle Projectile Resolved Callback (from GameRenderer -> Physics) ---
    const handleProjectileResolved = useCallback((path: ProjectilePathData, firedByPlayerIndex: 0 | 1) => {
        if (mode !== 'multiplayer' || !ndk || !matchId) return; // Only send in multiplayer

        // Only send path if it was OUR shot that just resolved
        if (firedByPlayerIndex === myPlayerIndex) {
            console.log(`[useGameLogic] Local player (P${myPlayerIndex}) shot resolved. Sending path...`, path.length);

            const eventData: ShotResolvedEvent = {
                type: 'shotResolved',
                matchId: matchId,
                senderPubkey: localPlayerPubkey,
                path: path,
            };

            const ndkEvent = new NDKEvent(ndk);
            ndkEvent.kind = 30079 as NDKKind;
            ndkEvent.content = JSON.stringify(eventData);
            ndkEvent.tags = [
                ['d', matchId],
                ['p', opponentPubkey!], // Tag opponent
            ];

            // No need to await, NDK handles publishing optimistically
            ndkEvent.publish();
            console.log("[useGameLogic] Published SHOT_RESOLVED event.");
        }
    }, [mode, ndk, matchId, localPlayerPubkey, opponentPubkey, myPlayerIndex]);

    // Return states and handlers
    return {
        playerStates,
        currentPlayerIndex,
        currentAim,
        selectedAbility,
        levelData,
        score,
        currentRound,
        handleAimChange,
        handleFire,
        handleSelectAbility,
        myPlayerIndex,
        handlePlayerHit,
        handleProjectileResolved,
    };
} 