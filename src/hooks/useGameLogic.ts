'use strict';
import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { AbilityType } from '../components/ui_overlays/ActionButtons';
import { InitialGamePositions, useGameInitialization } from './useGameInitialization';
import NDK, { NDKEvent, NDKFilter, NDKKind, NostrEvent } from '@nostr-dev-kit/ndk';
import {
    PlayerState,
    GameNostrEventContent,
    ProjectilePathData,
    GameEndResult,
    GameActionEvent,
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

// --- Define Callback Types Locally ---
type OnPlayerHitCallback = (
    hitPlayerIndex: 0 | 1,
    firingPlayerIndex: 0 | 1,
    projectileType: AbilityType | 'standard'
) => void;
type OnProjectileResolvedCallback = (
    path: ProjectilePathData,
    firedByPlayerIndex: 0 | 1
) => void;

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

    // *** DIAGNOSTIC LOG: Check levelData after generation ***
    console.log(`[useGameLogic] Received levelData from useGameInitialization:`, levelData ? `Ships: ${levelData.ships.length}, Planets: ${levelData.planets.length}` : 'null');

    // --- Callbacks for Physics Engine Events ---
    // Ref to store the callback to prevent it from becoming stale in physics hook
    // Initialize refs with correct parameter signatures (use underscores for unused)
    const handlePlayerHitCallbackRef = useRef<(
        hitPlayerIndex: 0 | 1,
        firingPlayerIndex: 0 | 1,
        projectileType: AbilityType | 'standard'
    ) => void>(
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        (_hitPlayerIndex, _firingPlayerIndex, _projectileType) => { /* Initial dummy */ }
    );
    const handleProjectileResolvedCallbackRef = useRef<(path: ProjectilePathData, firedByPlayerIndex: 0 | 1) => void>(
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        (_path, _firedByPlayerIndex) => { /* Initial dummy */ }
    );

    // --- Stable callbacks to pass to useMatterPhysics ---
    const stableOnPlayerHit = useCallback((...args: Parameters<OnPlayerHitCallback>) => {
        handlePlayerHitCallbackRef.current(...args);
    }, []); // No dependencies needed as it calls the .current of a ref

    const stableOnProjectileResolved = useCallback((...args: Parameters<OnProjectileResolvedCallback>) => {
        handleProjectileResolvedCallbackRef.current(...args);
    }, []); // No dependencies needed as it calls the .current of a ref

    // --- Physics Initialization ---
    const physicsHandles = useMatterPhysics({
        settings,
        levelData,
        shotTracerHandlers,
        onPlayerHit: stableOnPlayerHit,             // <-- Use stable callback
        onProjectileResolved: stableOnProjectileResolved, // <-- Use stable callback
    });

    // *** DIAGNOSTIC LOG: Check physicsHandles after init and levelData passed ***
    console.log(`[useGameLogic] Initialized useMatterPhysics. Handles valid: ${!!physicsHandles}. Passed levelData:`, levelData ? `Ships: ${levelData.ships.length}, Planets: ${levelData.planets.length}` : 'null');

    // --- Nostr Event Subscription (Multiplayer) ---
    useEffect(() => {
        if (mode !== 'multiplayer' || !ndk || !matchId || !opponentPubkey) return;

        const subscriptionFilter: NDKFilter = {
            kinds: [30079 as NDKKind],
            '#j': [matchId],
            authors: [opponentPubkey],
            since: Math.floor(Date.now() / 1000) - 10,
        };
        const subscription = ndk.subscribe(subscriptionFilter, { closeOnEose: false });

        const handleIncomingEvent = (event: NostrEvent) => {
            if (event.pubkey !== opponentPubkey) return;
            try {
                const content: GameNostrEventContent = JSON.parse(event.content);
                if (content.type === 'game_action' && content.action.type === 'fire') {
                    const { turnIndex } = content;
                    const { aim, ability } = content.action;

                    if (turnIndex !== (myPlayerIndex === 0 ? 1 : 0)) {
                        console.warn(`[useGameLogic] Received fire event from wrong player: ${turnIndex}`);
                        return;
                    }
                    // Force local turn state if desynced
                    if (currentPlayerIndex !== turnIndex) {
                        console.warn(`[useGameLogic] Local turn ${currentPlayerIndex} !== incoming turn ${turnIndex}. Forcing.`);
                        setCurrentPlayerIndex(turnIndex);
                    }

                    setAimStates(prev => {
                        const newAimStates = [...prev] as typeof prev;
                        newAimStates[turnIndex] = aim;
                        return newAimStates;
                    });

                    if (ability) {
                        setPlayerStates(prev => {
                            const newStates = [...prev] as [PlayerState, PlayerState];
                            const opponentState = { ...newStates[turnIndex] };
                            const abilityCost = ABILITY_COST_HP;
                            
                            if (opponentState.hp >= abilityCost) {
                                opponentState.hp -= abilityCost;
                                opponentState.usedAbilities = new Set(opponentState.usedAbilities).add(ability);
                                newStates[turnIndex] = opponentState;
                                playerStatesRef.current = newStates; // Update ref
                                return newStates;
                            } else {
                                console.warn(`[useGameLogic] Opponent invalid ability use: ${ability} (HP: ${opponentState.hp}, Cost: ${abilityCost})`);
                                return prev;
                            }
                        });
                    }

                    if (physicsHandles) {
                        // *** DIAGNOSTIC LOG: Check physicsHandles before firing (Nostr event) ***
                        console.log(`[useGameLogic Nostr] Firing opponent projectile. Handles valid: ${!!physicsHandles}`);
                        // Correct arguments: playerIndex, power, abilityType
                        physicsHandles.fireProjectile(turnIndex, aim.power, ability);
                    }

                    setCurrentPlayerIndex(myPlayerIndex); // Switch turn back to local player
                    setSelectedAbility(null);
                    console.log(`[useGameLogic] Turn switched to P${myPlayerIndex} after opponent move.`);
                }
            } catch (error) {
                console.error('[useGameLogic] Failed to parse game event:', error, event.content);
            }
        };

        subscription.on('event', handleIncomingEvent);
        subscription.start();
        return () => { subscription.stop(); };

    }, [mode, ndk, matchId, opponentPubkey, myPlayerIndex, currentPlayerIndex, physicsHandles, ABILITY_COST_HP, settings]);

    // --- ADD EFFECT FOR PLAYER READY SIGNAL ---
    useEffect(() => {
        // Only run in multiplayer mode when NDK and matchId are ready
        if (mode === 'multiplayer' && ndk && matchId) {
            console.log(`[useGameLogic] Multiplayer mode active. Sending player_ready for match: ${matchId}`);

            const sendReadyEvent = async () => {
                try {
                    const readyEvent = new NDKEvent(ndk);
                    readyEvent.kind = 30079 as NDKKind; // Use specific kind number
                    readyEvent.content = JSON.stringify({ type: 'player_ready' });
                    readyEvent.tags = [['j', matchId]]; // Tag with the match identifier

                    // No need to encrypt this signal
                    await readyEvent.publish();
                    console.log(`[useGameLogic] Published player_ready event: ${readyEvent.encode()}`);
                } catch (error) {
                    console.error("[useGameLogic] Failed to publish player_ready event:", error);
                    // Optionally notify the user or trigger an error state
                }
            };

            // Send the event shortly after mount to ensure NDK connection is likely established
            // and other initial setup might be complete.
            const timerId = setTimeout(sendReadyEvent, 500); // Small delay

            return () => clearTimeout(timerId); // Cleanup timer on unmount

        } else {
            console.log("[useGameLogic] Not in multiplayer or NDK/matchId not ready, skipping player_ready send.");
        }
    // Run only once when NDK, matchId, and mode stabilize for multiplayer
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [mode, ndk, matchId]); // Add dependencies
    // --- END PLAYER READY EFFECT ---

    // --- Define full Round Completion Logic ---
    // This function is called by the hit handler below
    const handleRoundCompletion = useCallback((winningPlayerIndex: 0 | 1 | null) => {
        const updatedScore = [...score] as [number, number];
        if (winningPlayerIndex !== null) {
            updatedScore[winningPlayerIndex]++;
        }
        setScore(updatedScore);
        console.log(`Round ${currentRound} ended. Score: ${updatedScore[0]}-${updatedScore[1]}`);

        const roundsToWin = Math.ceil(MAX_ROUNDS / 2);
        const player0Wins = updatedScore[0] >= roundsToWin;
        const player1Wins = updatedScore[1] >= roundsToWin;
        const isFinalRound = currentRound >= MAX_ROUNDS;

        if (player0Wins || player1Wins || isFinalRound) {
            // --- Game Over Logic ---
            let finalScore: [number, number] = [...updatedScore];
            let winnerIndex: 0 | 1 | null = null;
            let reason: GameEndResult['reason'] = 'score';

            if (player0Wins) winnerIndex = 0;
            else if (player1Wins) winnerIndex = 1;
            else { // Final round tie or already tied
                const hp0 = playerStatesRef.current[0].hp;
                const hp1 = playerStatesRef.current[1].hp;
                if (hp0 > hp1) winnerIndex = 0;
                else if (hp1 > hp0) winnerIndex = 1;
                else winnerIndex = null; // Draw
                reason = 'hp_tiebreaker';
                // Adjust score display for tiebreaker win if needed
                if(winnerIndex === 0) finalScore = [roundsToWin, finalScore[1]];
                if(winnerIndex === 1) finalScore = [finalScore[0], roundsToWin];
            }
            
            console.log(`[useGameLogic] Game Over! Winner: ${winnerIndex === null ? 'Draw' : `P${winnerIndex}`}, Score: ${finalScore[0]}-${finalScore[1]}, Reason: ${reason}`);
            // TODO: Multiplayer needs robust game end sync. Sending final event?
            onGameEnd({ winnerIndex, finalScore, reason });

        } else {
            // --- Next Round Logic ---
            console.log(`[useGameLogic] Starting Round ${currentRound + 1}`);
            const nextRound = currentRound + 1;
            const startingPlayerIndex: 0 | 1 = (nextRound % 2 === 1) ? 0 : 1;
            // TODO: Multiplayer needs sync for next round start.
            // For now, reset state locally (will likely desync MP)
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
    }, [score, currentRound, MAX_ROUNDS, onGameEnd, playerStatesRef, regenerateLevel, MAX_HP, mode]); // Added mode

    // --- Update Physics Callbacks via useEffect ---
    // This pattern ensures the callbacks passed to useMatterPhysics always have access
    // to the latest state (currentPlayerIndex, handleRoundCompletion, etc.) without
    // causing the physics engine hook itself to re-run unnecessarily.
    useEffect(() => {
        handlePlayerHitCallbackRef.current = (hitPlayerIndex: 0 | 1, firingPlayerIndex: 0 | 1, projectileType: AbilityType | 'standard') => {
            console.log(`[useGameLogic] Player Hit! Hit: P${hitPlayerIndex}, Fired By: P${firingPlayerIndex}, Type: ${projectileType}, Current: P${currentPlayerIndex}`);
            let winningPlayer: 0 | 1 | null = null;

            if (hitPlayerIndex === firingPlayerIndex) winningPlayer = firingPlayerIndex === 0 ? 1 : 0; // Self-hit
            else if (projectileType === 'standard') winningPlayer = firingPlayerIndex; // Standard shot wins
            else { // Ability hit
                // TODO: Implement Vulnerability check if needed
                // if (hitPlayerState.isVulnerable) winningPlayer = firingPlayerIndex;
                // else return; // Hit on non-vulnerable does nothing yet
                 winningPlayer = firingPlayerIndex; // TEMPORARY: Assume any ability hit wins round for now
                 console.warn("TEMP: Ability hit logic assuming win - vulnerability not checked");
            }
            if (winningPlayer !== null) {
                handleRoundCompletion(winningPlayer);
            }
        };
    }, [handleRoundCompletion, playerStatesRef]); // Dependency: handleRoundCompletion

    useEffect(() => {
        handleProjectileResolvedCallbackRef.current = (_path: ProjectilePathData, firedByPlayerIndex: 0 | 1) => {
            console.log(`[useGameLogic] Projectile resolved callback. Fired by P${firedByPlayerIndex}. Current P${currentPlayerIndex}. Mode: ${mode}`);
            // TODO: Process the path data if needed (e.g., for tracing, effects)

            // Switch turn ONLY in practice/custom mode AFTER the shot resolves.
            if ((mode === 'practice' || mode === 'custom') && firedByPlayerIndex === currentPlayerIndex) {
                console.log(`[useGameLogic] Practice/Custom turn switch on projectile resolve.`);
                setCurrentPlayerIndex(currentPlayerIndex === 0 ? 1 : 0);
                setSelectedAbility(null);
            }
            // Multiplayer turn switching is handled via Nostr events (send/receive).
        };
    }, [mode, currentPlayerIndex]); // Dependencies: mode, currentPlayerIndex

    // --- User Actions ---
    const handleAimChange = useCallback((aim: { angle: number; power: number }) => {
        if (mode === 'multiplayer' && currentPlayerIndex !== myPlayerIndex) return;
        setAimStates(prev => {
            const newAimStates = [...prev] as typeof prev;
            newAimStates[currentPlayerIndex] = aim;
            return newAimStates;
        });
        // Update physics engine aim (only angle matters to physics)
        if(physicsHandles) {
            physicsHandles.setShipAim(currentPlayerIndex, aim.angle);
        }
    }, [currentPlayerIndex, mode, myPlayerIndex, physicsHandles]); // Added physicsHandles dep

    const handleSelectAbility = useCallback((abilityType: AbilityType | null) => {
        if (mode === 'multiplayer' && currentPlayerIndex !== myPlayerIndex) return;
        setSelectedAbility(abilityType);
    }, [myPlayerIndex, mode, currentPlayerIndex]);

    const handleFire = useCallback(async () => {
        if (!levelData || !physicsHandles) return;
        if (currentPlayerIndex !== myPlayerIndex && mode === 'multiplayer') {
            console.warn("[useGameLogic] Not player's turn to fire locally.");
            return;
        }

        const aim = aimStates[currentPlayerIndex];
        const abilityToUse = selectedAbility;

        // --- Ability Validation & Cost (Local Player) ---
        if (abilityToUse) {
            const currentPState = playerStatesRef.current[currentPlayerIndex]; // Use ref for latest state
            const totalUsedCount = currentPState.usedAbilities.size;
            const typeUsedCount = Array.from(currentPState.usedAbilities).filter(a => a === abilityToUse).length;

            // Use the single cost value from settings
            const abilityCost = ABILITY_COST_HP; // RENAME 'cost' to 'abilityCost'

            // Validation checks
            const canUse =
                currentPState.hp >= abilityCost && // USE abilityCost
                totalUsedCount < MAX_ABILITIES_TOTAL &&
                typeUsedCount < MAX_ABILITIES_PER_TYPE;

            if (!canUse) {
                console.warn(`[useGameLogic] Cannot use ability ${abilityToUse}: HP=${currentPState.hp}/${abilityCost}, TotalUsed=${totalUsedCount}/${MAX_ABILITIES_TOTAL}, TypeUsed=${typeUsedCount}/${MAX_ABILITIES_PER_TYPE}`); // USE abilityCost
                setSelectedAbility(null); // Deselect invalid ability
                return; // Prevent firing
            }

            // Apply ability cost locally (if used)
            // Ensure cost is a valid number before subtracting
            if (abilityCost !== Infinity) { // USE abilityCost
                setPlayerStates(prev => {
                    const newState = [...prev] as [PlayerState, PlayerState];
                    // Double check index validity
                    if (newState[currentPlayerIndex]) {
                         newState[currentPlayerIndex].hp -= abilityCost; // USE abilityCost
                         newState[currentPlayerIndex].usedAbilities = new Set(newState[currentPlayerIndex].usedAbilities).add(abilityToUse);
                         playerStatesRef.current = newState; // Update ref immediately for physics check
                    }
                    return newState;
                });
            } // else: cost is infinity, do nothing

            // Don't reset selectedAbility here, pass it to fireProjectile
        }

        // *** DIAGNOSTIC LOG: Check physicsHandles before firing (Local action) ***
        console.log(`[useGameLogic Local] Firing local projectile. Handles valid: ${!!physicsHandles}`);

        if (physicsHandles) {
            physicsHandles.fireProjectile(currentPlayerIndex, aim.power, abilityToUse);
        } else {
            console.error("[useGameLogic] Cannot fire, physicsHandles are null!");
        }

        // Reset selected ability *after* firing
        setSelectedAbility(null);

        // --- Send Nostr Event (Multiplayer) ---
        if (mode === 'multiplayer' && ndk && matchId) {
            // Define the specific action payload
            const fireActionPayload: { type: 'fire', aim: { angle: number, power: number }, ability: AbilityType | null } = {
                type: 'fire',
                aim: aim,
                ability: abilityToUse,
            };

            // Define the full Nostr event content using GameActionEvent type
            const nostrEventContent: GameActionEvent = { // Use GameActionEvent directly
                type: 'game_action', // Keep this as the discriminator
                matchId: matchId, // ADD missing property
                senderPubkey: localPlayerPubkey, // ADD missing property
                turnIndex: currentPlayerIndex,
                action: fireActionPayload, // Assign the specific action
            };

            const nostrEvent = new NDKEvent(ndk);
            nostrEvent.kind = 30079 as NDKKind;
            nostrEvent.content = JSON.stringify(nostrEventContent); // Stringify the correct object
            nostrEvent.tags = [['j', matchId]];
            nostrEvent.publish().catch(err => console.error("[useGameLogic] Failed to publish fire event:", err));
            console.log(`[useGameLogic] Published fire event for turn ${currentPlayerIndex}`);
        }

        // Switch turn ONLY if it's not multiplayer or if it IS the local player's turn
        if (mode !== 'multiplayer' || currentPlayerIndex === myPlayerIndex) {
             const nextPlayerIndex = currentPlayerIndex === 0 ? 1 : 0;
             setCurrentPlayerIndex(nextPlayerIndex);
             console.log(`[useGameLogic] Turn switched locally to P${nextPlayerIndex}`);
        } else {
            console.log("[useGameLogic] Waiting for opponent's move, not switching turn locally.");
        }

    }, [
        ndk,
        matchId,
        mode,
        currentPlayerIndex,
        myPlayerIndex,
        aimStates,
        selectedAbility,
        physicsHandles,
        levelData,
        ABILITY_COST_HP,
        MAX_ABILITIES_TOTAL,
        MAX_ABILITIES_PER_TYPE,
        localPlayerPubkey,
    ]);

    // --- Return Values ---
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
        settings,
    };
} 