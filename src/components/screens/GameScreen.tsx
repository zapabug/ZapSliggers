import React, { useState, useRef, useEffect, useCallback } from 'react';
import GameRenderer, { GameRendererRef } from '../game/GameRenderer';
import ActionButtons, { AbilityType } from '../ui_overlays/ActionButtons';
// import PlayerInfo from '../ui_overlays/PlayerInfo'; // REMOVE: Assuming a PlayerInfo component
import { useGameInitialization } from '../../hooks/useGameInitialization'; // ADD: Import hook, REMOVE: InitialGamePositions
import { ProjectilePathData } from '../../types/game'; // ADD: Import type

// --- Roman Numeral Conversion (Keep) ---
const toRoman = (num: number): string => {
  if (num < 1) return ""; // Roman numerals are positive
  const romanMap: { [key: string]: number } = {
    M: 1000, CM: 900, D: 500, CD: 400, C: 100, XC: 90, L: 50, XL: 40, X: 10, IX: 9, V: 5, IV: 4, I: 1
  };
  let result = '';
  for (const key in romanMap) {
    while (num >= romanMap[key]) {
      result += key;
      num -= romanMap[key];
    }
  }
  return result || "0"; // Return "0" if input was 0
};
// --- END NEW ---

const INITIAL_HP = 100;
const ROUND_END_DELAY_MS = 3000; // Delay before automatically starting next round

// Define Game States
type GameState = 'playing' | 'roundOver' | 'matchOver' | 'loadingNextRound';

const GameScreen: React.FC = () => {
  // --- State --- //
  const [gameState, setGameState] = useState<GameState>('playing');
  const [roundWinnerIndex, setRoundWinnerIndex] = useState<0 | 1 | null>(null); // Store winner index
  const [currentPlayerIndex, setCurrentPlayerIndex] = useState<0 | 1>(0);
  const [selectedAbility, setSelectedAbility] = useState<AbilityType | null>(null);
  const [playerScores, setPlayerScores] = useState<[number, number]>([0, 0]);
  const [playerHp, setPlayerHp] = useState<[number, number]>([INITIAL_HP, INITIAL_HP]);
  const [currentPower, setCurrentPower] = useState<number>(1.0);
  const [roundUsedAbilities, setRoundUsedAbilities] = useState<[Set<AbilityType>, Set<AbilityType>]>([new Set(), new Set()]);

  const gameRendererRef = useRef<GameRendererRef>(null);
  const roundEndTimerRef = useRef<number | null>(null); // Define the missing ref
  const levelData = useGameInitialization();

  // *** ADD LOG AT START OF RENDER ***
  console.log(`[GameScreen Render] State: ${gameState}, HP: ${playerHp.join(', ')}, WinnerIdx: ${roundWinnerIndex}`);

  // --- Single Fire Handler ---
  const handleFire = useCallback(() => {
    if (gameState !== 'playing') return;
    gameRendererRef.current?.fireProjectile(currentPlayerIndex, currentPower, selectedAbility);
    if (selectedAbility) {
      setRoundUsedAbilities(prevSets => {
        const newSets: [Set<AbilityType>, Set<AbilityType>] = [new Set(prevSets[0]), new Set(prevSets[1])];
        newSets[currentPlayerIndex].add(selectedAbility);
        return newSets;
      });
    }
    setSelectedAbility(null);
    setCurrentPower(1.0);
    setCurrentPlayerIndex(prevIndex => (prevIndex === 0 ? 1 : 0));
  }, [gameState, currentPlayerIndex, currentPower, selectedAbility]);

  // --- Handle Player Hit (Sets Winner, Schedules Reset) --- //
  const handlePlayerHit = useCallback((hitPlayerIndex: 0 | 1, firingPlayerIndex: 0 | 1, projectileType: AbilityType | 'standard') => {
    // Check if the game is already over before processing the hit
    let shouldProcessHit = true;
    setGameState(currentGameState => {
        if (currentGameState !== 'playing') {
            shouldProcessHit = false;
        }
        return currentGameState; // Return current state, no change here
    });

    if (!shouldProcessHit) {
        console.log("[GameScreen] handlePlayerHit: Hit received but game state is not 'playing'. Ignoring.");
        return; 
    }

    const damage = projectileType === 'standard' ? 100 : 50;
    console.log(`[GameScreen] handlePlayerHit: FiringPlayer=${firingPlayerIndex}, HitPlayer=${hitPlayerIndex}, Type=${projectileType}, Damage=${damage}`);

    let determinedWinner: 0 | 1 | null = null;
    let matchIsOver = false;

    // Check for self-hit first
    if (hitPlayerIndex === firingPlayerIndex) {
        console.log(`!!! Player ${firingPlayerIndex + 1} hit themselves! Round Loss!`);
        determinedWinner = firingPlayerIndex === 0 ? 1 : 0;
    } else {
        // Apply damage using functional update
        let hitPlayerKnockedOut = false;
        setPlayerHp(currentHp => {
            const newHp: [number, number] = [...currentHp];
            newHp[hitPlayerIndex] = Math.max(0, currentHp[hitPlayerIndex] - damage);
            if (newHp[hitPlayerIndex] <= 0) {
                hitPlayerKnockedOut = true;
            }
            return newHp;
        });

        if (hitPlayerKnockedOut) {
            determinedWinner = firingPlayerIndex;
            console.log(`[GameScreen] Player ${determinedWinner + 1} wins by knockout!`);
        }
    }

    // If a winner was determined
    if (determinedWinner !== null) {
        console.log(`[GameScreen] Round Winner Index: ${determinedWinner}`);
        setRoundWinnerIndex(determinedWinner); // Store who won the round

        // Update score and check for MATCH end using functional update
            setPlayerScores(scores => {
              const newScores: [number, number] = [...scores];
            // Check winner index again inside setter, as it's determined above
            if (determinedWinner !== null) { 
                newScores[determinedWinner]++;
              console.log(`[GameScreen] Scores updated: P1=${newScores[0]}, P2=${newScores[1]}`);
                if (newScores[determinedWinner] >= 2) {
                    console.log(`[GameScreen] MATCH OVER! Player ${determinedWinner + 1} wins the match!`);
                    matchIsOver = true; // Set flag for state update below
                }
            }
              return newScores;
            });

        // Set game state based on match outcome
        // No need for functional update here as it only depends on matchIsOver flag set above
        const finalGameState = matchIsOver ? 'matchOver' : 'roundOver';
        setGameState(finalGameState); 
        console.log(`[GameScreen] Setting gameState to: ${finalGameState}`);
    }

    // Remove gameState and playerHp from dependencies, prepareNextRound is stable
  }, []);

  // --- Ability Select Handler (Prevent Switching) --- //
  const handleAbilitySelect = useCallback((ability: AbilityType) => {
    if (gameState !== 'playing') return;
    
    // Check if ability already used THIS ROUND by the CURRENT player
    if (roundUsedAbilities[currentPlayerIndex].has(ability)) {
        console.log(`[GameScreen] Ability ${ability} already used this round by Player ${currentPlayerIndex + 1}.`);
        return; // Cannot select an already used ability
    }

    // Logic to prevent switching selection
    setSelectedAbility(prevSelected => {
        if (prevSelected === null) {
            // Nothing selected, so select the clicked ability
            console.log(`[GameScreen] Selecting ability: ${ability}`);
            return ability;
        } else if (prevSelected === ability) {
            // Clicked the already selected ability, so deselect it
            console.log(`[GameScreen] Deselecting ability: ${ability}`);
            return null;
        } else {
            // An ability is already selected, and clicked a *different* one
            console.log(`[GameScreen] Cannot switch ability. Deselect ${prevSelected} first.`);
            return prevSelected; // Keep the previous selection
        }
    });
  }, [gameState, currentPlayerIndex, roundUsedAbilities]);

  // --- Cleanup Timer on Unmount --- //
  useEffect(() => {
    return () => {
      if (roundEndTimerRef.current) {
        // Use window.clearTimeout
        window.clearTimeout(roundEndTimerRef.current);
      }
    };
  }, []);

  // --- Effect to Handle Round End Delay --- //
  useEffect(() => {
    console.log(`[GameScreen Effect Check] gameState is now: ${gameState}`);
    let timerId: number | null = null;
    if (gameState === 'roundOver') {
        console.log(`[GameScreen Effect] Round over. Setting ${ROUND_END_DELAY_MS}ms timeout for next round...`);
        timerId = window.setTimeout(() => {
            console.log(`[GameScreen Effect] Timeout finished. Setting gameState to loadingNextRound.`);
            setGameState('loadingNextRound');
        }, ROUND_END_DELAY_MS);
    }
    // Cleanup function to clear timeout if component unmounts or gameState changes
    return () => {
      if (timerId !== null) {
         console.log('[GameScreen Effect] Cleaning up roundOver timer.');
         window.clearTimeout(timerId);
      }
    };
  }, [gameState]);

  // --- Effect to Handle State Reset and Start Next Round --- //
  useEffect(() => {
    console.log(`[GameScreen Effect Check] gameState is now: ${gameState}`);
    if (gameState === 'loadingNextRound') {
        console.log(`[GameScreen Effect] Loading next round: Resetting state...`);
        // Perform all state resets
        setPlayerHp([INITIAL_HP, INITIAL_HP]);
        setRoundUsedAbilities([new Set(), new Set()]);
        setCurrentPlayerIndex(0);
        setSelectedAbility(null);
        setCurrentPower(1.0);
        setRoundWinnerIndex(null); // Clear the round winner index
        
        // Immediately switch back to playing state AFTER resets
        setGameState('playing');
        console.log(`[GameScreen Effect] State reset complete. Switching gameState to playing.`);
    }
  }, [gameState]);

  // --- ADD: Placeholder for projectile resolution handler ---
  const handleProjectileResolved = useCallback((path: ProjectilePathData, firedByPlayerIndex: 0 | 1) => {
    // TODO: Implement logic to use this path data later for synchronization or other features.
    console.log(`[GameScreen] Projectile from Player ${firedByPlayerIndex + 1} resolved. Path length: ${path.length}`);
  }, []);
  // --- END ADD ---

  // --- Render Logic --- //
  const renderContent = () => {
    switch (gameState) {
      case 'playing':
        return (
          <>
            {/* Turn Indicator */}
            <h3 style={{ margin: '0', color: currentPlayerIndex === 0 ? '#87CEFA' : '#F08080', background: 'rgba(0,0,0,0.4)', padding: '5px 10px', borderRadius: '4px' }}>
              Player {currentPlayerIndex + 1}'s Turn (HP: {playerHp[currentPlayerIndex]})
            </h3>
            {/* Single Action Button Set */}
            <ActionButtons
              onFire={handleFire}
              selectedAbility={selectedAbility}
              onAbilitySelect={handleAbilitySelect}
              // Pass the ROUND used abilities for the CURRENT player
              usedAbilities={roundUsedAbilities[currentPlayerIndex]}
              currentHp={playerHp[currentPlayerIndex]}
              abilityCost={10} // Dummy cost display
              maxAbilityUses={1} // Keep as 1 for ActionButton's internal check? Or remove from ActionButtons?
              disabled={false}
            />
          </>
        );
      case 'roundOver':
      case 'matchOver': {
        const winnerText = roundWinnerIndex !== null ? `Player ${roundWinnerIndex + 1}` : 'Error';
        const isMatch = gameState === 'matchOver';
        return (
          <div style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }}> 
            <div style={{ textAlign: 'center', color: '#90EE90', background: 'rgba(0,0,0,0.6)', padding: '20px', borderRadius: '10px' }}>
              <h2>{winnerText} {isMatch ? 'WINS THE MATCH!' : 'Wins the Round!'}</h2>
              <h3 style={{ margin: '10px 0' }}>{isMatch ? 'Final Score' : 'Score'}: {toRoman(playerScores[0])} - {toRoman(playerScores[1])}</h3>
              {/* No button needed, transition is automatic */}
            </div>
          </div>
        );
      }
      case 'loadingNextRound':
         // Optional: Show a brief loading indicator
         return (
             <div style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', color: 'white' }}>
                 Loading next round...
             </div>
         );
      default:
        return null;
    }
  };

  return (
    <div style={{ position: 'relative', width: '100vw', height: '100vh', overflow: 'hidden' }}>
      {/* --- Player Info UI REMOVED --- */}
      {/* <PlayerInfo ... /> */}
      {/* <PlayerInfo ... /> */}

      {/* --- Leaderboard REMOVED (can add back later) --- */}
      {/* <div style={{...}}> Leaderboard ... </div> */}

      {/* --- Game Renderer (Pass levelData & CORRECTED onPlayerHit) --- */}
      {levelData ? (
        <GameRenderer 
          ref={gameRendererRef} 
          levelData={levelData}
          onPlayerHit={handlePlayerHit} 
          onProjectileResolved={handleProjectileResolved}
        />
      ) : (
        <div>Loading Level...</div>
      )}


      {/* --- UI Overlay - Bottom Left Controls / Winner Message --- */}
      <div style={{
          position: 'absolute',
          bottom: '40px !important',
          left: '40px !important',
          zIndex: 10,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-start',
          gap: '10px'
      }}>
        {renderContent()}
      </div>
    </div>
  );
};

export default GameScreen; 