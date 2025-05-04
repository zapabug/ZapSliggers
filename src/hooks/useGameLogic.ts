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

    // --- Physics Initialization Callbacks (Defined Before Hook) ---
    // Initialize refs with correct parameter signatures (use underscores for unused)
    const handlePlayerHitCallbackRef = useRef((_hitPlayerIndex: 0 | 1, _firingPlayerIndex: 0 | 1, _projectileType: AbilityType | 'standard') => {});
    const handleProjectileResolvedCallbackRef = useRef((_path: ProjectilePathData, _firedByPlayerIndex: 0 | 1) => {});

    // --- Physics Initialization ---
    const physicsHandles = useMatterPhysics({
        settings,
        levelData,
        shotTracerHandlers,
        onPlayerHit: (...args) => handlePlayerHitCallbackRef.current(...args),
        onProjectileResolved: (...args) => handleProjectileResolvedCallbackRef.current(...args),
    });

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
                            const cost = ABILITY_COST_HP;
                            
                            if (opponentState.hp >= cost) {
                                opponentState.hp -= cost;
                                opponentState.usedAbilities = new Set(opponentState.usedAbilities).add(ability);
                                newStates[turnIndex] = opponentState;
                                playerStatesRef.current = newStates; // Update ref
                                return newStates;
                            } else {
                                console.warn(`[useGameLogic] Opponent invalid ability use: ${ability} (HP: ${opponentState.hp}, Cost: ${cost})`);
                                return prev;
                            }
                        });
                    }

                    if (physicsHandles) {
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
            console.log(`[useGameLogic] handlePlayerHit: P${firingPlayerIndex} (Type: ${projectileType}) hit P${hitPlayerIndex}`);
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
        handleProjectileResolvedCallbackRef.current = (path: ProjectilePathData, firedByPlayerIndex: 0 | 1) => {
            console.log(`[useGameLogic] handleProjectileResolved: Fired by P${firedByPlayerIndex}`);
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
            newAimStates[myPlayerIndex] = aim;
            return newAimStates;
        });
        // Update physics engine aim (only angle matters to physics)
        if(physicsHandles) {
            physicsHandles.setShipAim(myPlayerIndex, aim.angle);
        }
    }, [myPlayerIndex, mode, currentPlayerIndex, physicsHandles]); // Added physicsHandles dep

    const handleSelectAbility = useCallback((abilityType: AbilityType | null) => {
        if (mode === 'multiplayer' && currentPlayerIndex !== myPlayerIndex) return;
        setSelectedAbility(abilityType);
    }, [myPlayerIndex, mode, currentPlayerIndex]);

    const handleFire = useCallback(() => {
        if (mode === 'multiplayer' && currentPlayerIndex !== myPlayerIndex) {
            console.warn("[useGameLogic] Cannot fire - not my turn.");
            return;
        }

        const currentAim = aimStates[myPlayerIndex];
        const currentPState = playerStates[myPlayerIndex];
        let abilityToUse: AbilityType | null = selectedAbility;

        // Validate Ability Use
        if (abilityToUse) {
            // Use the single cost value from settings
            const cost = ABILITY_COST_HP;
            const totalUsedCount = currentPState.usedAbilities.size;
            const typeUsedCount = Array.from(currentPState.usedAbilities).filter(a => a === abilityToUse).length;

            if (
                currentPState.hp < cost ||
                totalUsedCount >= MAX_ABILITIES_TOTAL ||
                typeUsedCount >= MAX_ABILITIES_PER_TYPE
            ) {
                console.warn(`[useGameLogic] Cannot use ability ${abilityToUse}: HP=${currentPState.hp}/${cost}, TotalUsed=${totalUsedCount}/${MAX_ABILITIES_TOTAL}, TypeUsed=${typeUsedCount}/${MAX_ABILITIES_PER_TYPE}`);
                abilityToUse = null;
                setSelectedAbility(null);
            }
        }

        // Apply ability cost locally (if used)
        if (abilityToUse) {
             // Ensure cost is a valid number before subtracting
            if (cost !== Infinity) {
                setPlayerStates(prev => {
                    const newStates = [...prev] as [PlayerState, PlayerState];
                    const newState = { ...newStates[myPlayerIndex] };
                    newState.hp -= cost;
                    newState.usedAbilities = new Set(newState.usedAbilities).add(abilityToUse!);
                    newStates[myPlayerIndex] = newState;
                    playerStatesRef.current = newStates;
                    return newStates;
                });
             } // else: cost is infinity, do nothing
        }

        // --- Publish Fire Event (Multiplayer) ---
        if (mode === 'multiplayer' && ndk && matchId) {
            const fireAction: GameActionEvent['action'] = { type: 'fire', aim: currentAim, ability: abilityToUse };
            const eventPayload: GameActionEvent = { type: 'game_action', matchId, senderPubkey: localPlayerPubkey, turnIndex: myPlayerIndex, action: fireAction };
            const nostrEvent = new NDKEvent(ndk); nostrEvent.kind = 30079 as NDKKind; nostrEvent.content = JSON.stringify(eventPayload); nostrEvent.tags = [['j', matchId]];
            
            console.log('[useGameLogic] Publishing game action:', eventPayload);
            nostrEvent.publish().catch(err => console.error('[useGameLogic] Failed to publish fire event:', err));

             // Switch turn locally immediately AFTER sending the event in multiplayer
             setCurrentPlayerIndex(myPlayerIndex === 0 ? 1 : 0);
             setSelectedAbility(null);
             console.log(`[useGameLogic] Turn switched to P${myPlayerIndex === 0 ? 1 : 0} after publishing fire event.`);
        }

        // Trigger local physics simulation
        if (physicsHandles) {
            // Correct arguments: playerIndex, power, abilityType
            physicsHandles.fireProjectile(myPlayerIndex, currentAim.power, abilityToUse);
        }

    }, [
        mode, ndk, matchId, localPlayerPubkey, currentPlayerIndex, myPlayerIndex, 
        aimStates, playerStates, selectedAbility, physicsHandles, 
        ABILITY_COST_HP, MAX_ABILITIES_TOTAL, MAX_ABILITIES_PER_TYPE, settings, playerStatesRef
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