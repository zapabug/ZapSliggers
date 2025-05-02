'use strict';
import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { AbilityType } from '../components/ui_overlays/ActionButtons';
import { InitialGamePositions, useGameInitialization } from './useGameInitialization';
import NDK, { NDKEvent, NDKFilter, NDKKind } from '@nostr-dev-kit/ndk';
import { useSubscribe } from '@nostr-dev-kit/ndk-hooks';
import {
    PlayerState,
    FireActionEvent,
    ShotResolvedEvent,
    GameNostrEventContent,
    ProjectilePathData,
} from '../types/game';
import { useShotTracers } from './useShotTracers';
import { GameSettingsProfile } from '../config/gameSettings';
import { useMatterPhysics, MatterPhysicsHandles } from './useMatterPhysics';

// Constants removed - now come from settings
// export const MAX_ROUNDS = 3; // Moved to settings (if needed)

// Input Props for the hook
export interface UseGameLogicProps {
    settings: GameSettingsProfile; // Settings are now required
    mode: 'practice' | 'multiplayer' | 'custom'; // Added 'custom' mode
    localPlayerPubkey: string;
    opponentPubkey?: string; // Optional for practice/custom?
    // gameRendererRef: React.RefObject<GameRendererRef | null>; // Renderer ref is internal now
    onGameEnd: (finalScore: [number, number]) => void;
    ndk?: NDK;
    matchId?: string;
}

// Return value of the hook
export interface UseGameLogicReturn {
    playerStates: [PlayerState, PlayerState];
    currentPlayerIndex: 0 | 1;
    aimStates: [{ angle: number; power: number }, { angle: number; power: number }];
    selectedAbility: AbilityType | null;
    levelData: InitialGamePositions | null; // Can be null while initializing
    score: [number, number];
    currentRound: number;
    handleAimChange: (aim: { angle: number; power: number }) => void;
    handleFire: () => void;
    handleSelectAbility: (abilityType: AbilityType) => void;
    myPlayerIndex: 0 | 1;
    // Expose physics handles for the renderer
    physicsHandles: MatterPhysicsHandles | null;
    // Expose shot tracer handlers for the renderer
    shotTracerHandlers: ReturnType<typeof useShotTracers>;
}

export function useGameLogic({
    settings,
    mode,
    localPlayerPubkey,
    opponentPubkey,
    // gameRendererRef,
    onGameEnd,
    ndk,
    matchId,
}: UseGameLogicProps): UseGameLogicReturn {

    // Extract needed settings
    const {
        ABILITY_COST_HP,
        MAX_ABILITIES_TOTAL,
        MAX_ABILITIES_PER_TYPE,
        MAX_HP, // Use MAX_HP from settings
        MAX_ROUNDS, // Use MAX_ROUNDS from settings
    } = settings;
    // const MAX_HP = 100; // Removed, use from settings
    // const MAX_ROUNDS_INTERNAL = 3; // Removed, use from settings

    // --- Validate Multiplayer Props ---
    if (mode === 'multiplayer' && (!ndk || !matchId || !opponentPubkey)) {
        throw new Error("useGameLogic: NDK, matchId, and opponentPubkey required for multiplayer.");
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
    // const [levelData, setLevelData] = useState<InitialGamePositions | null>(null); // Now handled by useGameInitialization
    const [aimStates, setAimStates] = useState<[{ angle: number; power: number }, { angle: number; power: number }]>(
        [{ angle: 0, power: 50 }, { angle: 180, power: 50 }]
    );
    const [currentPlayerIndex, setCurrentPlayerIndex] = useState<0 | 1>(0); // Practice/Custom turn tracking?
    const [playerStates, setPlayerStates] = useState<[PlayerState, PlayerState]>([
        { hp: MAX_HP, usedAbilities: new Set(), isVulnerable: false },
        { hp: MAX_HP, usedAbilities: new Set(), isVulnerable: false },
    ]);
    const [selectedAbility, setSelectedAbility] = useState<AbilityType | null>(null);
    const [score, setScore] = useState<[number, number]>([0, 0]);
    const [currentRound, setCurrentRound] = useState<number>(1);

    // --- Refs ---
    const playerStatesRef = useRef(playerStates);
    useEffect(() => { playerStatesRef.current = playerStates; }, [playerStates]);

    // --- Hooks ---
    const shotTracerHandlers = useShotTracers(); // Tracer hook
    const { levelData, regenerateLevel } = useGameInitialization(settings); // Initialization hook (pass settings)

    // --- Core Game Logic Callbacks (Defined BEFORE useMatterPhysics) ---
    const handleRoundCompletion = useCallback((winningPlayerIndex: 0 | 1 | null) => {
        const updatedScore = [...score] as [number, number];
        if (winningPlayerIndex !== null) {
            updatedScore[winningPlayerIndex]++;
            console.log(`Round ${currentRound} won by Player ${winningPlayerIndex}. Score: ${updatedScore[0]}-${updatedScore[1]}`);
        } else {
            console.log(`Round ${currentRound} completed (No score). Score: ${updatedScore[0]}-${updatedScore[1]}`);
        }
        setScore(updatedScore);

        // Calculate win threshold based on MAX_ROUNDS (e.g., first to ceil(MAX_ROUNDS/2))
        const roundsToWin = Math.ceil(MAX_ROUNDS / 2);
        const player0Wins = updatedScore[0] >= roundsToWin;
        const player1Wins = updatedScore[1] >= roundsToWin;

        // Check game end conditions (win score reached OR final round completed)
        if ((mode === 'practice' || mode === 'custom') && (player0Wins || player1Wins || currentRound >= MAX_ROUNDS)) {
            // End Game logic with tie-breaker
            let finalScore: [number, number] = [...updatedScore];
            let finalWinnerMsg = "";

            if (player0Wins) {
                finalWinnerMsg = "Player 0 (Blue) wins";
            } else if (player1Wins) {
                finalWinnerMsg = "Player 1 (Red) wins";
            } else if (currentRound >= MAX_ROUNDS && finalScore[0] === finalScore[1]) {
                // Tie score after final round, apply HP tie-breaker
                // Use playerStatesRef.current for most up-to-date HP for tie-break
                const hp0 = playerStatesRef.current[0].hp;
                const hp1 = playerStatesRef.current[1].hp;
                if (hp0 > hp1) {
                    finalScore = [roundsToWin, finalScore[1]]; // Assign win score
                    finalWinnerMsg = "Player 0 (Blue) wins (HP Tie-breaker)";
                } else if (hp1 > hp0) {
                    finalScore = [finalScore[0], roundsToWin]; // Assign win score
                    finalWinnerMsg = "Player 1 (Red) wins (HP Tie-breaker)";
                } else {
                    finalWinnerMsg = "Draw (Score and HP Tie)";
                }
            } else if (currentRound >= MAX_ROUNDS) { // Final round, scores unequal
                 if (finalScore[0] > finalScore[1]) {
                    finalWinnerMsg = "Player 0 (Blue) wins (Score)";
                 } else {
                    finalWinnerMsg = "Player 1 (Red) wins (Score)";
                 }
            } else {
                 finalWinnerMsg = "Game Over (Unexpected state)"; // Should not happen if logic above is correct
            }

            const winnerMsg = finalWinnerMsg || "Game Over";

            console.log(`Game Over! ${winnerMsg}. Final Score: ${updatedScore[0]}-${updatedScore[1]} (HP: ${playerStatesRef.current[0].hp} vs ${playerStatesRef.current[1].hp})`);
            onGameEnd(finalScore);

        } else if (mode === 'practice' || mode === 'custom'){
            // Start Next Round logic
            console.log(`Starting Round ${currentRound + 1}`);
            const nextRound = currentRound + 1;
            // Determine starting player based on round number (P0 starts odd rounds, P1 starts even)
            const startingPlayerIndex: 0 | 1 = (nextRound % 2 === 1) ? 0 : 1;
            setCurrentRound(nextRound);

            regenerateLevel(); // Trigger level regeneration

            // Reset player states (HP, abilities, vulnerability)
            setPlayerStates([
                { hp: MAX_HP, usedAbilities: new Set(), isVulnerable: false },
                { hp: MAX_HP, usedAbilities: new Set(), isVulnerable: false }
            ]);
            setCurrentPlayerIndex(startingPlayerIndex); // Set who starts next round
            setSelectedAbility(null);
            setAimStates([{ angle: 0, power: 50 }, { angle: 180, power: 50 }]);

        } else if (mode === 'multiplayer') {
            // Multiplayer round/game end logic needs refinement.
            // For now, just end game if win condition met.
            if (player0Wins || player1Wins || currentRound >= MAX_ROUNDS) {
                console.log(`Multiplayer Game Over Detected. Triggering onGameEnd. Score: ${updatedScore[0]}-${updatedScore[1]}`);
                onGameEnd(updatedScore); // Send final score
            } else {
                // TODO: Multiplayer next round logic (state reset, maybe sync event?)
                console.log(`Multiplayer round ${currentRound} ended. Score: ${updatedScore[0]}-${updatedScore[1]}. Waiting for next round logic.`);
                 // Simple reset for now, needs proper sync
                 const nextRound = currentRound + 1;
                 const startingPlayerIndex: 0 | 1 = (nextRound % 2 === 1) ? 0 : 1;
                 setCurrentRound(nextRound);
                 regenerateLevel();
                 setPlayerStates([
                     { hp: MAX_HP, usedAbilities: new Set(), isVulnerable: false },
                     { hp: MAX_HP, usedAbilities: new Set(), isVulnerable: false }
                 ]);
                 setCurrentPlayerIndex(startingPlayerIndex);
                 setSelectedAbility(null);
                 setAimStates([{ angle: 0, power: 50 }, { angle: 180, power: 50 }]);
            }
        }
    }, [mode, currentRound, score, onGameEnd, MAX_ROUNDS, MAX_HP, regenerateLevel, playerStatesRef]); // Added MAX_ROUNDS, MAX_HP, playerStatesRef. Removed playerStates.

    const handlePlayerHit = useCallback((hitPlayerIndex: 0 | 1, firingPlayerIndex: 0 | 1, projectileType: AbilityType | 'standard') => {
        console.log(`[useGameLogic] handlePlayerHit: P${firingPlayerIndex} (Type: ${projectileType}) hit P${hitPlayerIndex}`);
        const currentStates = playerStatesRef.current;
        const hitPlayerState = currentStates[hitPlayerIndex];

        let winningPlayer: 0 | 1 | null = null;

        if (hitPlayerIndex === firingPlayerIndex) {
            winningPlayer = firingPlayerIndex === 0 ? 1 : 0; // Opponent wins on self-hit
            console.log("Self-hit detected.");
        } else if (projectileType === 'standard') {
            winningPlayer = firingPlayerIndex; // Standard shot wins round
            console.log("Standard hit detected.");
        } else { // Ability hit
            if (hitPlayerState.isVulnerable) {
                winningPlayer = firingPlayerIndex; // Ability hit on vulnerable player wins round
                console.log("Vulnerable hit detected.");
            } else {
                // Ability hit on non-vulnerable player does nothing *yet* (no HP loss implemented)
                console.log(`[useGameLogic] Ability hit on non-vulnerable P${hitPlayerIndex}. No round change.`);
                 // Important: If HP loss IS implemented later, a non-vulnerable hit should NOT trigger handleRoundCompletion
                return; // Explicitly return early, no round completion
            }
        }

        // If a winner was determined by the hit logic above, complete the round
        if (winningPlayer !== null) {
            handleRoundCompletion(winningPlayer);
        }

    }, [handleRoundCompletion, playerStatesRef]); // Depends on stable callback and ref

    const handleProjectileResolved = useCallback((path: ProjectilePathData, firedByPlayerIndex: 0 | 1) => {
        console.log(`[useGameLogic] handleProjectileResolved: P${firedByPlayerIndex}'s shot resolved.`);
        if (mode === 'practice' || mode === 'custom') {
            const nextPlayerIndex = firedByPlayerIndex === 0 ? 1 : 0;
            setCurrentPlayerIndex(nextPlayerIndex);
            setSelectedAbility(null);
        }
        if (mode === 'multiplayer' && ndk && matchId && opponentPubkey) {
            const shotResolvedContent: ShotResolvedEvent = {
                type: 'shotResolved',
                senderPubkey: localPlayerPubkey,
                matchId: matchId,
                path: path,
            };
            const ndkEvent = new NDKEvent(ndk);
            ndkEvent.kind = 30079 as NDKKind;
            ndkEvent.content = JSON.stringify(shotResolvedContent);
            ndkEvent.tags = [
                ['p', opponentPubkey],
                ['d', matchId]
            ];
            ndkEvent.publish().catch(err => console.error("Error publishing shotResolved event:", err));
            console.log("[useGameLogic] Published SHOT_RESOLVED event");
        }
    }, [mode, ndk, matchId, opponentPubkey, localPlayerPubkey]);

    // --- Initialize Physics Hook (AFTER defining callbacks) ---
    const physicsHandles = useMatterPhysics({
        settings: settings,
        levelData: levelData,
        shotTracerHandlers: shotTracerHandlers,
        onPlayerHit: handlePlayerHit,
        onProjectileResolved: handleProjectileResolved,
    });

    // --- Effect for Turn/Round Initialization ---
    useEffect(() => {
        if (mode === 'practice' || mode === 'custom') {
            setSelectedAbility(null);
        }
        // Reset aim on round change?
        // Physics sets initial angle, maybe not needed
        // setAimStates([{ angle: 0, power: 50 }, { angle: 180, power: 50 }]);
    }, [currentPlayerIndex, currentRound, mode]);

    // --- NDK Subscription (Multiplayer Only) ---
    const filter = useMemo((): NDKFilter | undefined => {
        if (mode !== 'multiplayer' || !matchId || !opponentPubkey) return undefined;
        const now = Math.floor(Date.now() / 1000);
        return {
            kinds: [30079 as NDKKind],
            authors: [opponentPubkey],
            '#d': [matchId],
            since: now - 300, // Look back 5 minutes initially
        };
    }, [mode, matchId, opponentPubkey]);

    // Use the hook without the 3rd argument; relies on NDK context
    const { events: opponentEvents } = useSubscribe(
        filter ? [filter] : [],
        { closeOnEose: false, groupable: false }
    );

    // --- Effect to Handle Incoming Opponent Events ---
    useEffect(() => {
        if (mode !== 'multiplayer' || !physicsHandles || !opponentPubkey || !matchId) return;

        opponentEvents.forEach(event => {
            try {
                const content = JSON.parse(event.content) as GameNostrEventContent;
                console.log(`[useGameLogic] Received Event KIND ${event.kind} from ${event.pubkey}`, content);

                // Basic validation
                if (content.matchId !== matchId || content.senderPubkey !== opponentPubkey) {
                    console.warn("[useGameLogic] Received event for wrong match/sender. Ignoring.");
                    return;
                }

                const opponentIndex = myPlayerIndex === 0 ? 1 : 0;

                if (content.type === 'fire') {
                    console.log(`[useGameLogic] Processing opponent FIRE event`, content);

                    // TODO: Add turn validation if strictly enforcing turns

                    // Apply opponent HP cost locally (important for consistency)
                    if (content.ability) {
                        setPlayerStates(prev => {
                            const newState = [...prev] as [PlayerState, PlayerState];
                            const opponentState = newState[opponentIndex];
                            const newHp = Math.max(0, opponentState.hp - ABILITY_COST_HP);
                            const newUsedAbilities = new Set(opponentState.usedAbilities);
                            newUsedAbilities.add(content.ability as AbilityType);
                            const newVulnerable = newUsedAbilities.size >= 2;
                            newState[opponentIndex] = {
                                ...opponentState,
                                hp: newHp,
                                usedAbilities: newUsedAbilities,
                                isVulnerable: newVulnerable,
                            };
                            console.log(`[useGameLogic] Applied HP cost to Opponent P${opponentIndex}. New HP: ${newHp}, Vulnerable: ${newVulnerable}`);
                            return newState;
                        });
                    }

                    // Fire opponent projectile via physics handle
                    const scaledPower = content.aim.power / 20; // Revisit power scaling?
                    physicsHandles.fireProjectile(
                        opponentIndex,
                        scaledPower,
                        content.ability as AbilityType | null // Cast to expected type (Fixes linter error)
                    );

                    // Switch turn locally if needed (simple alternation for now)
                    // setCurrentPlayerIndex(myPlayerIndex);
                    // setSelectedAbility(null);

                } else if (content.type === 'shotResolved') {
                    // Opponent's shot finished, add their trace locally
                    console.log(`[useGameLogic] Processing opponent SHOT_RESOLVED event`);
                    shotTracerHandlers.addOpponentTrace(opponentIndex, content.path);

                    // If turn logic depends on shot resolution:
                    // setCurrentPlayerIndex(myPlayerIndex);
                    // setSelectedAbility(null);

                } else {
                    // Log unhandled type safely using Partial
                    const unknownContent = content as Partial<GameNostrEventContent>;
                    console.warn(`[useGameLogic] Received unhandled event type: ${unknownContent.type ?? 'unknown'}`);
                }
            } catch (err) {
                console.error("[useGameLogic] Error processing opponent event:", err, event);
            }
        });
        // Dependencies: Needs opponentPubkey, matchId added
    }, [mode, physicsHandles, opponentEvents, myPlayerIndex, opponentPubkey, matchId, shotTracerHandlers, ABILITY_COST_HP, ndk]);

    // --- Player Action Handlers ---
    const handleAimChange = useCallback((aim: { angle: number; power: number }) => {
        const indexToUpdate = myPlayerIndex; // In multiplayer, always update local player's aim state
        setAimStates(prev => {
            const newState = [...prev] as typeof prev;
            newState[indexToUpdate] = aim;
            return newState;
        });
        // Update physics engine aim for local player
        physicsHandles?.setShipAim(indexToUpdate, aim.angle);

        // TODO: Send aim update event in multiplayer?
        // Consider throttling this heavily if implemented.

    }, [myPlayerIndex, physicsHandles]);

    const handleSelectAbility = useCallback((abilityType: AbilityType) => {
        // In multiplayer, always check local player state
        const playerIndex = myPlayerIndex;
        const currentState = playerStates[playerIndex];
        const abilitiesOfTypeUsed = Array.from(currentState.usedAbilities).filter(used => used === abilityType).length;

        if (abilitiesOfTypeUsed >= MAX_ABILITIES_PER_TYPE) {
            console.log(`Ability ${abilityType} already used max times (${MAX_ABILITIES_PER_TYPE}).`);
            return;
        }
        if (currentState.usedAbilities.size >= MAX_ABILITIES_TOTAL) {
            console.log(`Max total abilities (${MAX_ABILITIES_TOTAL}) used.`);
            return;
        }
        if (currentState.hp < ABILITY_COST_HP) {
            console.log(`Not enough HP (${currentState.hp}) to use ability (Cost: ${ABILITY_COST_HP}).`);
            return;
        }

        // Toggle selection
        setSelectedAbility(prev => prev === abilityType ? null : abilityType);
        console.log(`Selected ability: ${selectedAbility === abilityType ? 'None' : abilityType}`);

    }, [myPlayerIndex, playerStates, ABILITY_COST_HP, MAX_ABILITIES_TOTAL, MAX_ABILITIES_PER_TYPE, selectedAbility]);

    const handleFire = useCallback(() => {
        // In multiplayer, always fire for the local player
        const playerIndex = myPlayerIndex;
        const aim = aimStates[playerIndex];
        const ability = selectedAbility;
        const playerState = playerStates[playerIndex];

        // Check HP cost again before firing
        if (ability && playerState.hp < ABILITY_COST_HP) {
            console.warn(`Cannot fire ability ${ability}: Not enough HP.`);
            setSelectedAbility(null);
            return;
        }

        // Apply HP cost and update ability usage/vulnerability state LOCALLY
        if (ability) {
            setPlayerStates(prev => {
                const newState = [...prev] as [PlayerState, PlayerState];
                const newUsedAbilities = new Set(playerState.usedAbilities);
                newUsedAbilities.add(ability);
                const newHp = playerState.hp - ABILITY_COST_HP;
                const newVulnerable = newUsedAbilities.size >= 2;
                newState[playerIndex] = {
                    hp: newHp,
                    usedAbilities: newUsedAbilities,
                    isVulnerable: newVulnerable,
                };
                console.log(`[useGameLogic] Applied HP cost to Self P${playerIndex}. New HP: ${newHp}, Vulnerable: ${newVulnerable}`);
                return newState;
            });
        }

        // Fire projectile via physics hook
        const scaledPower = aim.power / 20; // TODO: Revisit power scaling
        physicsHandles?.fireProjectile(playerIndex, scaledPower, ability);

        // Reset selected ability after firing
        setSelectedAbility(null);

        // --- Send FIRE event in multiplayer mode --- //
        if (mode === 'multiplayer' && ndk && matchId && opponentPubkey) {
            const fireEventContent: FireActionEvent = {
                type: 'fire',
                senderPubkey: localPlayerPubkey,
                matchId: matchId,
                aim: aim,
                ability: ability,
            };
            const ndkEvent = new NDKEvent(ndk);
            ndkEvent.kind = 30079 as NDKKind;
            ndkEvent.content = JSON.stringify(fireEventContent);
            ndkEvent.tags = [
                ['p', opponentPubkey],
                ['d', matchId]
            ];
            ndkEvent.publish().catch(err => console.error("Error publishing fire event:", err));
            console.log("[useGameLogic] Published FIRE event", fireEventContent);

            // Switch turn locally? Maybe wait for shot resolution?
            // setCurrentPlayerIndex(opponentPlayerIndex); // Simple alternation
        }
        // ----------------------------------------- //

    }, [mode, myPlayerIndex, aimStates, selectedAbility, playerStates, physicsHandles, ndk, matchId, opponentPubkey, localPlayerPubkey, ABILITY_COST_HP]);

    // --- Return Hook State and Handlers ---
    return {
        playerStates,
        currentPlayerIndex,
        aimStates,
        selectedAbility,
        levelData,
        score,
        currentRound,
        handleAimChange,
        handleFire,
        handleSelectAbility,
        myPlayerIndex,
        physicsHandles,
        shotTracerHandlers,
    };
} 