import React, { useState, useRef, useEffect, useCallback } from 'react';
import GameRenderer, { GameRendererRef } from '../game/GameRenderer';
import ActionButtons, { AbilityType } from '../ui_overlays/ActionButtons';
// import PlayerInfo from '../ui_overlays/PlayerInfo'; // REMOVE: Assuming a PlayerInfo component
import { useGameInitialization } from '../../hooks/useGameInitialization'; // ADD: Import hook, REMOVE: InitialGamePositions

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

const GameScreen: React.FC = () => {
  const [currentPlayerIndex, setCurrentPlayerIndex] = useState<0 | 1>(0);
  const [winner, setWinner] = useState<0 | 1 | null>(null);
  const [selectedAbility, setSelectedAbility] = useState<AbilityType | null>(null); // Single ability state
  const [playerScores, setPlayerScores] = useState<[number, number]>([0, 0]);
  const [playerHp, setPlayerHp] = useState<[number, number]>([INITIAL_HP, INITIAL_HP]); // HP state
  // Remove separate P1/P2 power states
  const [currentPower, setCurrentPower] = useState<number>(1.0); // Single power state (if needed for UI)
  const [usedAbilities, setUsedAbilities] = useState<Set<AbilityType>>(new Set()); // Track used abilities this turn

  const gameRendererRef = useRef<GameRendererRef>(null);
  const levelData = useGameInitialization(); // ADD: Get level data

  // --- Restored Single Fire Handler ---
  const handleFire = () => {
    if (winner !== null) return; // Only fire if game not over

    // console.log(`[GameScreen] Firing for P${currentPlayerIndex + 1} with power ${currentPower.toFixed(2)}, Ability: ${selectedAbility}`);
    gameRendererRef.current?.fireProjectile(currentPlayerIndex, currentPower, selectedAbility);

    // Update used abilities
    if (selectedAbility) {
        setUsedAbilities(prev => new Set(prev).add(selectedAbility));
    }

    setSelectedAbility(null); // Reset selected ability after firing
    setCurrentPower(1.0); // Reset power after firing (if controlled by slider)
    setCurrentPlayerIndex(prevIndex => (prevIndex === 0 ? 1 : 0)); // Switch turn
  };

  // --- NEW: Handle Player Hit (Memoized) ---
  const handlePlayerHit = useCallback((hitPlayerIndex: 0 | 1, damage: number) => {
    // Check winner state using a ref or ensure it's in useCallback deps if needed
    // For now, assume direct check is okay, but be mindful of stale closures
    // if (winnerRef.current !== null) return;
    // Temporarily removing winner check from inside useCallback as it would require
    // adding `winner` to dependency array, potentially causing other issues.
    // The check outside in the component rendering the button might be sufficient.
    // OR pass winner state down if absolutely necessary.

    console.log(`[GameScreen] Player ${hitPlayerIndex + 1} hit for ${damage} damage.`);
    setPlayerHp(currentHp => {
        const newHp: [number, number] = [...currentHp];
        newHp[hitPlayerIndex] = Math.max(0, newHp[hitPlayerIndex] - damage);
        console.log(`[GameScreen] HP Updated: P1=${newHp[0]}, P2=${newHp[1]}`);

        // Check for winner
        if (newHp[hitPlayerIndex] <= 0) {
            const winnerIndex = hitPlayerIndex === 0 ? 1 : 0;
            console.log(`[GameScreen] Player ${winnerIndex + 1} wins the round!`);
            setWinner(winnerIndex);
            // Update score
            setPlayerScores(scores => {
              const newScores: [number, number] = [...scores];
              newScores[winnerIndex]++;
              console.log(`[GameScreen] Scores updated: P1=${newScores[0]}, P2=${newScores[1]}`);
              return newScores;
            });
        }
        return newHp;
    });
  // Dependencies: Functions from useState are stable and don't need to be listed.
  // If we checked `winner` inside, it would need to be added: }, [winner]);
  }, []);

  // --- Restored Single Ability Select Handler ---
  const handleAbilitySelect = (ability: AbilityType | null) => {
    if (winner !== null) return;
    // Check if ability has already been used this turn or max uses reached (if applicable)
    // Add checks here based on ActionButtons props if needed
    console.log(`[GameScreen] Ability selected for P${currentPlayerIndex + 1}: ${ability}`);
    setSelectedAbility(ability);
  };
  // Remove separate P1/P2 handlers

  // --- NEW: handleNewRound ---
  const handleNewRound = () => {
    console.log("[GameScreen] Starting new round...");
    gameRendererRef.current?.resetGame();
    setWinner(null);
    setPlayerHp([INITIAL_HP, INITIAL_HP]); // Reset HP
    setUsedAbilities(new Set()); // Reset used abilities
    // Decide who starts next round (e.g., loser starts or player 1 starts)
    // Let's make Player 1 always start for simplicity now.
    setCurrentPlayerIndex(0);
    setSelectedAbility(null);
    setCurrentPower(1.0); // Reset power
  };
  // --- END NEW ---

  // Reset UI state on turn change
  useEffect(() => {
      if (winner !== null) return;
      setSelectedAbility(null); // Reset ability selection
      setCurrentPower(1.0); // Reset power slider/value
      setUsedAbilities(new Set()); // Reset used abilities for the new turn
  }, [currentPlayerIndex, winner]);

  // --- NEW: Reset game physics when levelData changes (e.g., on initial load or explicit reset)
  useEffect(() => {
      if (levelData) {
          console.log("[GameScreen] New level data received, resetting renderer physics...");
          gameRendererRef.current?.resetGame(); // Tell renderer to reset with its internal logic
          // Reset local game state too
          setWinner(null);
          setPlayerHp([INITIAL_HP, INITIAL_HP]);
          setUsedAbilities(new Set());
          setCurrentPlayerIndex(0); // Player 1 starts
          setSelectedAbility(null);
          setCurrentPower(1.0);
      }
  }, [levelData]); // Depend on levelData


  return (
    <div style={{ position: 'relative', width: '100vw', height: '100vh', overflow: 'hidden' }}>
      {/* --- Player Info UI REMOVED --- */}
      {/* <PlayerInfo ... /> */}
      {/* <PlayerInfo ... /> */}

      {/* --- Leaderboard REMOVED (can add back later) --- */}
      {/* <div style={{...}}> Leaderboard ... </div> */}

      {/* --- Game Renderer (Pass levelData) --- */}
      {levelData ? (
        <GameRenderer 
          ref={gameRendererRef} 
          levelData={levelData} // ADD: Pass levelData
          onPlayerHit={handlePlayerHit} 
        />
      ) : (
        <div>Loading Level...</div> // Or some other placeholder
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
        {winner === null ? (
          // --- Game Active UI ---
          <>
            {/* Turn Indicator */}
            <h3 style={{ margin: '0', color: currentPlayerIndex === 0 ? '#87CEFA' : '#F08080', background: 'rgba(0,0,0,0.4)', padding: '5px 10px', borderRadius: '4px' }}>
              Player {currentPlayerIndex + 1}'s Turn
            </h3>
            {/* Single Action Button Set */}
            <ActionButtons
              onFire={handleFire}
              selectedAbility={selectedAbility}
              onAbilitySelect={handleAbilitySelect}
              usedAbilities={usedAbilities}
              currentHp={playerHp[currentPlayerIndex]}
              abilityCost={10} 
              maxAbilityUses={1} 
              disabled={false} 
              // currentPower={currentPower}
              // onPowerChange={setCurrentPower}
            />
          </>
        ) : (
          // --- Winner Screen UI (Stays centered for now, could also be moved) ---
          // This div wrapper could be removed if winner message should also be bottom-left
          <div style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }}> 
            <div style={{ textAlign: 'center', color: '#90EE90', background: 'rgba(0,0,0,0.6)', padding: '20px', borderRadius: '10px' }}>
              <h2>Player {winner + 1} Wins the Round!</h2>
              <h3 style={{ margin: '10px 0' }}>Score: {toRoman(playerScores[0])} - {toRoman(playerScores[1])}</h3>
              <button
                  onClick={handleNewRound}
                  style={{
                      marginTop: '20px', padding: '10px 20px', fontSize: '1.1em',
                      backgroundColor: '#4CAF50', color: 'white', border: 'none',
                      borderRadius: '5px', cursor: 'pointer'
                  }}
              >
                  New Round
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default GameScreen; 