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
    GameEndResult,
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
    onGameEnd: (result: GameEndResult) => void;
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
    settings: GameSettingsProfile;
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

        const roundsToWin = Math.ceil(MAX_ROUNDS / 2);
        const player0Wins = updatedScore[0] >= roundsToWin;
        const player1Wins = updatedScore[1] >= roundsToWin;
        const isFinalRound = currentRound >= MAX_ROUNDS;

        // Check game end conditions (win score reached OR final round completed)
        if ((mode === 'practice' || mode === 'custom') && (player0Wins || player1Wins || isFinalRound)) {
            let finalScore: [number, number] = [...updatedScore];
            let winnerIndex: 0 | 1 | null = null;
            let reason: GameEndResult['reason'] = 'score';

            if (player0Wins) {
                winnerIndex = 0;
            } else if (player1Wins) {
                winnerIndex = 1;
            } else if (isFinalRound) { // Final round, check for tie-breaker
                if (finalScore[0] === finalScore[1]) {
                    // HP Tie-breaker
                    const hp0 = playerStatesRef.current[0].hp;
                    const hp1 = playerStatesRef.current[1].hp;
                    if (hp0 > hp1) {
                        winnerIndex = 0;
                        finalScore = [roundsToWin, finalScore[1]]; // Assign win score
                    } else if (hp1 > hp0) {
                        winnerIndex = 1;
                        finalScore = [finalScore[0], roundsToWin]; // Assign win score
                    } else {
                        winnerIndex = null; // True draw
                    }
                    reason = 'hp_tiebreaker';
                } else { // Scores unequal on final round
                    winnerIndex = finalScore[0] > finalScore[1] ? 0 : 1;
                }
            } else {
                // Should not happen if logic above is correct
                winnerIndex = null;
                reason = 'error'; 
                console.error("Game Over in unexpected state!");
            }

            const result: GameEndResult = {
                winnerIndex,
                finalScore,
                reason,
            };

            console.log(`Game Over! Winner: ${winnerIndex === null ? 'Draw' : `Player ${winnerIndex}`}, Reason: ${reason}. Final Score: ${finalScore[0]}-${finalScore[1]}`);
            onGameEnd(result);

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
            // Multiplayer game end logic needs refinement.
            // For now, just end game if win condition met.
            // TODO: Handle ties/HP tiebreaker in multiplayer?
            if (player0Wins || player1Wins || isFinalRound) {
                const winnerIndex = player0Wins ? 0 : (player1Wins ? 1 : null);
                const reason: GameEndResult['reason'] = 'score'; // Basic reason for now
                const result: GameEndResult = {
                    winnerIndex,
                    finalScore: updatedScore,
                    reason,
                };
                console.log(`Multiplayer Game Over Detected. Triggering onGameEnd. Score: ${updatedScore[0]}-${updatedScore[1]}, Winner: ${winnerIndex}`);
                onGameEnd(result);
            } else {
                // Multiplayer next round logic (unchanged)
                // ...
            }
        }
    }, [mode, currentRound, score, onGameEnd, MAX_ROUNDS, MAX_HP, regenerateLevel, playerStatesRef]);

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
        console.log(`[useGameLogic ${mode}] handleProjectileResolved: P${firedByPlayerIndex}'s shot resolved. Current Player Before Switch Attempt: ${currentPlayerIndex}`); // Updated Log
        if (mode === 'practice' || mode === 'custom') {
            // Turn switching logic moved to handleFire
        }
        // If multiplayer, send resolved path to opponent
        else if (mode === 'multiplayer' && ndk && matchId && opponentPubkey) {
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
        // Always add historical trace - REMOVED INCORRECT CALL
        // shotTracerHandlers.addHistoricalTrace(path, firedByPlayerIndex);

    }, [mode, ndk, matchId, opponentPubkey, localPlayerPubkey, shotTracerHandlers, currentPlayerIndex]);

    // --- Initialize Physics Engine (Pass settings) ---
    const physicsHandles = useMatterPhysics({
        settings: settings, // Pass settings to physics
        levelData: levelData, // Pass initial level data (might be null initially)
        shotTracerHandlers: shotTracerHandlers, // Pass tracer handlers
        onPlayerHit: handlePlayerHit, // Pass hit handler
        onProjectileResolved: handleProjectileResolved, // Pass resolve handler
    });

    // --- Effect to Reset Physics when Level Data Changes ---
    useEffect(() => {
        console.log('[useGameLogic] Physics Reset Effect Triggered. levelData:', levelData, 'physicsHandles:', !!physicsHandles, 'resetPhysics available:', !!physicsHandles?.resetPhysics);
        // Ensure both levelData and the resetPhysics function are available
        if (levelData && physicsHandles?.resetPhysics) {
            console.log('[useGameLogic] Conditions met! Resetting physics engine with levelData:', levelData);
            physicsHandles.resetPhysics(levelData);
        } else {
            console.log('[useGameLogic] Conditions NOT met for physics reset.');
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [levelData, physicsHandles?.resetPhysics]); // Depend on levelData and the resetPhysics function identity

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
        // In practice mode, update the current player's state AND physics
        if (mode === 'practice'){
            // console.log(`[handleAimChange ${mode}] Current Player: ${currentPlayerIndex}, Setting Aim:`, aim); // Log removed for brevity now
            setAimStates(prev => {
                const newStates = [...prev] as typeof prev;
                newStates[currentPlayerIndex] = aim; // Use currentPlayerIndex
                return newStates;
            });
            // Update physics engine for the current player
            physicsHandles?.setShipAim(currentPlayerIndex, aim.angle); // Use currentPlayerIndex
        }
        // In multiplayer AND custom mode, only update the local player's state and physics
        else if (mode === 'multiplayer' || mode === 'custom') {
            // console.log(`[handleAimChange ${mode}] My Index: ${myPlayerIndex}, Setting Aim:`, aim); // Log removed for brevity now
            setAimStates(prev => {
                const newStates = [...prev] as typeof prev;
                newStates[myPlayerIndex] = aim;
                return newStates;
            });
            // Update physics engine for local player
            physicsHandles?.setShipAim(myPlayerIndex, aim.angle);
            // TODO: Send aim update via Nostr?
        }
    }, [mode, myPlayerIndex, currentPlayerIndex, physicsHandles]); // Restore correct dependencies

    const handleSelectAbility = useCallback((abilityType: AbilityType) => {
        // Always check local player state in multiplayer/custom
        // In practice, it should check currentPlayerIndex state
        const playerIndexToCheck = (mode === 'practice') ? currentPlayerIndex : myPlayerIndex;
        const currentState = playerStates[playerIndexToCheck];
        const abilitiesOfTypeUsed = Array.from(currentState.usedAbilities).filter(used => used === abilityType).length;

        // Check limits (respecting settings passed in)
        if (abilitiesOfTypeUsed >= MAX_ABILITIES_PER_TYPE) {
            console.log(`Ability ${abilityType} already used max times (${MAX_ABILITIES_PER_TYPE}) for P${playerIndexToCheck}.`);
            return;
        }
        if (currentState.usedAbilities.size >= MAX_ABILITIES_TOTAL) {
            console.log(`Max total abilities (${MAX_ABILITIES_TOTAL}) used for P${playerIndexToCheck}.`);
            return;
        }
        if (currentState.hp < ABILITY_COST_HP) {
            console.log(`Not enough HP (${currentState.hp}) for P${playerIndexToCheck} to use ability (Cost: ${ABILITY_COST_HP}).`);
            return;
        }

        // Toggle selection
        setSelectedAbility(prev => prev === abilityType ? null : abilityType);
        console.log(`Selected ability: ${selectedAbility === abilityType ? 'None' : abilityType}`);

    }, [
        mode, myPlayerIndex, currentPlayerIndex, playerStates, selectedAbility,
        MAX_ABILITIES_TOTAL, MAX_ABILITIES_PER_TYPE, ABILITY_COST_HP, settings // Added settings to deps
    ]);

    const handleFire = useCallback(() => {
        // In practice, fire for current player. In multi/custom, fire for local player.
        const firingPlayerIndex = (mode === 'practice') ? currentPlayerIndex : myPlayerIndex;

        // ADD LOGGING FOR PRACTICE/CUSTOM
        if (mode !== 'multiplayer') {
            console.log(`[handleFire ${mode}] Current Player Index: ${currentPlayerIndex}, Determined Firing Index: ${firingPlayerIndex}`);
        } else {
            console.log(`[handleFire ${mode}] My Index: ${myPlayerIndex}, Determined Firing Index: ${firingPlayerIndex}`);
        }

        // Check HP cost for ability
        const currentAim = aimStates[firingPlayerIndex];
        const currentAbility = selectedAbility;
        const playerState = playerStates[firingPlayerIndex];

        if (currentAbility && playerState.hp < ABILITY_COST_HP) {
            console.warn(`Cannot fire ability ${currentAbility}: Not enough HP.`);
            setSelectedAbility(null); // Deselect if not enough HP
            return;
        }

        // Apply HP cost and update ability usage/vulnerability state LOCALLY
        if (currentAbility) {
            setPlayerStates(prev => {
                const newState = [...prev] as [PlayerState, PlayerState];
                const newUsedAbilities = new Set(playerState.usedAbilities);
                newUsedAbilities.add(currentAbility);
                const newHp = playerState.hp - ABILITY_COST_HP;
                // Use MAX_ABILITIES_TOTAL from settings for vulnerability check
                const newVulnerable = newUsedAbilities.size >= settings.MAX_ABILITIES_TOTAL;
                newState[firingPlayerIndex] = {
                    hp: newHp,
                    usedAbilities: newUsedAbilities,
                    isVulnerable: newVulnerable,
                };
                console.log(`[useGameLogic] Applied HP cost to Self P${firingPlayerIndex}. New HP: ${newHp}, Vulnerable: ${newVulnerable} (Limit: ${settings.MAX_ABILITIES_TOTAL})`);
                return newState;
            });
        }

        // Fire projectile via physics hook
        const scaledPower = currentAim.power / 20; // TODO: Revisit power scaling
        physicsHandles?.fireProjectile(firingPlayerIndex, scaledPower, currentAbility);

        // Reset selected ability after firing
        setSelectedAbility(null);

        // --- Send FIRE event in multiplayer mode --- //
        if (mode === 'multiplayer' && ndk && matchId && opponentPubkey) {
            const fireEventContent: FireActionEvent = {
                type: 'fire',
                senderPubkey: localPlayerPubkey,
                matchId: matchId,
                aim: currentAim,
                ability: currentAbility,
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
        }
        // --- Switch Turn Immediately ONLY in Practice Mode --- //
        else if (mode === 'practice') {
            const nextPlayerIndex = currentPlayerIndex === 0 ? 1 : 0;
            console.log(`[handleFire ${mode}] Fired for P${currentPlayerIndex}. Switching turn immediately to P${nextPlayerIndex}.`);
            setCurrentPlayerIndex(nextPlayerIndex);
            // setSelectedAbility is already reset above
        }
        // --- No turn switch in Custom mode --- //

    }, [
        mode, myPlayerIndex, currentPlayerIndex, aimStates, selectedAbility, playerStates,
        physicsHandles, ndk, matchId, opponentPubkey, localPlayerPubkey, ABILITY_COST_HP, settings
    ]);

    // --- Return Hook State and Handlers ---
    return {
        playerStates,
        currentPlayerIndex, // Still needed for practice mode
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
        settings,
    };
} 