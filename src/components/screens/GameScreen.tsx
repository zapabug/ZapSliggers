import React, { useState, useRef, useEffect } from 'react';
import GameRenderer, { GameRendererRef } from '../game/GameRenderer';
import ActionButtons, { AbilityType } from '../ui_overlays/ActionButtons';

// --- NEW: Roman Numeral Conversion ---
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

const GameScreen: React.FC = () => {
  const [currentPlayerIndex, setCurrentPlayerIndex] = useState<0 | 1>(0);
  const [winner, setWinner] = useState<0 | 1 | null>(null);
  const [selectedAbility, setSelectedAbility] = useState<AbilityType | null>(null);
  // --- NEW: Score State ---
  const [playerScores, setPlayerScores] = useState<[number, number]>([0, 0]);

  const gameRendererRef = useRef<GameRendererRef>(null);

  const handleFire = () => {
    if (winner !== null) return; // Only fire if game not over

    // Define a default power level (adjust as needed)
    const defaultPower = 1.0; 

    console.log(`[GameScreen] Firing for P${currentPlayerIndex + 1} with power ${defaultPower.toFixed(2)}, Ability: ${selectedAbility}`);
    gameRendererRef.current?.fireProjectile(currentPlayerIndex, defaultPower, selectedAbility);

    // Reset ability *after* firing
    setSelectedAbility(null);

    // Switch turn immediately
    setCurrentPlayerIndex(prevIndex => (prevIndex === 0 ? 1 : 0));
  };

  const handleRoundWin = (winningPlayerIndex: 0 | 1) => {
    console.log(`[GameScreen] Round win detected! Winner: P${winningPlayerIndex + 1}`);
    setWinner(winningPlayerIndex);
    // Update score
    setPlayerScores(scores => {
      const newScores: [number, number] = [...scores];
      newScores[winningPlayerIndex]++;
      console.log(`[GameScreen] Scores updated: P1=${newScores[0]}, P2=${newScores[1]}`);
      return newScores;
    });
  };

  const handleAbilitySelect = (ability: AbilityType | null) => {
    if (winner !== null) return; // Don't allow select after win
    console.log(`[GameScreen] Ability selected: ${ability}`);
    setSelectedAbility(ability);
  };

  // --- NEW: handleNewRound ---
  const handleNewRound = () => {
    console.log("[GameScreen] Starting new round...");
    gameRendererRef.current?.resetGame();
    setWinner(null);
    // Decide who starts next round (e.g., loser starts or player 1 starts)
    // Let's make Player 1 always start for simplicity now.
    setCurrentPlayerIndex(0);
    setSelectedAbility(null);
  };
  // --- END NEW ---

  // Get initial angle for the current player when turn changes (Reset UI state)
  useEffect(() => {
      if (winner !== null) return; // Don't reset if game is won
      setSelectedAbility(null); // Reset ability on turn change
  }, [currentPlayerIndex, winner]); // Rerun when turn changes or game ends


  return (
    <div style={{ position: 'relative', width: '100vw', height: '100vh', overflow: 'hidden' }}>
      {/* --- NEW: Leaderboard UI --- */}
      <div style={{
          position: 'absolute',
          top: '20px',
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 10,
          background: 'rgba(0, 0, 0, 0.5)',
          padding: '10px 20px',
          borderRadius: '8px',
          color: 'white',
          fontSize: '1.5em',
          display: 'flex',
          gap: '30px'
      }}>
          <span>Player I: {toRoman(playerScores[0])}</span>
          <span>Player II: {toRoman(playerScores[1])}</span>
      </div>
      {/* --- END NEW --- */}

      <GameRenderer ref={gameRendererRef} onRoundWin={handleRoundWin} />

      {/* UI Overlay - Action Buttons / Winner Message */}
      <div style={{
          position: 'absolute',
          bottom: '40px',
          left: '50%', // Center horizontally
          transform: 'translateX(-50%)', // Adjust for own width
          zIndex: 10,
          padding: '10px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center'
      }}>
        {winner === null ? (
          // --- Game Active UI ---
          <>
            <h3 style={{ margin: '0 0 10px 0', color: currentPlayerIndex === 0 ? '#87CEFA' : '#F08080' /* Light blue/red */ }}>
              Player {currentPlayerIndex + 1}'s Turn
            </h3>
            <ActionButtons
              onFire={handleFire}
              selectedAbility={selectedAbility}
              onAbilitySelect={handleAbilitySelect}
            />
          </>
        ) : (
          // --- Winner Screen UI ---
          <div style={{ textAlign: 'center', color: '#90EE90' /* Light green */ }}>
            <h2>Player {winner + 1} Wins the Round!</h2>
            <h3 style={{ margin: '10px 0' }}>Score: {toRoman(playerScores[0])} - {toRoman(playerScores[1])}</h3>
            <button
                onClick={handleNewRound}
                style={{
                    marginTop: '20px',
                    padding: '10px 20px',
                    fontSize: '1.1em',
                    backgroundColor: '#4CAF50', // Green
                    color: 'white',
                    border: 'none',
                    borderRadius: '5px',
                    cursor: 'pointer'
                }}
            >
                New Round
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default GameScreen; 