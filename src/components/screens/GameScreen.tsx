import React, { useState, useRef, useEffect } from 'react';
import GameRenderer, { GameRendererRef } from '../game/GameRenderer';
import ActionButtons, { AbilityType } from '../ui_overlays/ActionButtons';

const GameScreen: React.FC = () => {
  const [currentPlayerIndex, setCurrentPlayerIndex] = useState<0 | 1>(0);
  const [winner, setWinner] = useState<0 | 1 | null>(null);
  const [isCharging, setIsCharging] = useState(false);
  const [selectedAbility, setSelectedAbility] = useState<AbilityType | null>(null);

  const gameRendererRef = useRef<GameRendererRef>(null);

  const handleFire = (power: number) => {
    if (winner !== null || !isCharging) return; // Only fire if charging and game not over
    
    // Note: isCharging state is set to false by ActionButtons *after* calling onFire
    console.log(`[GameScreen] Firing for P${currentPlayerIndex} with power ${power.toFixed(2)}, Ability: ${selectedAbility}`);
    gameRendererRef.current?.fireProjectile(currentPlayerIndex, power, selectedAbility);
    
    // Reset ability *after* firing
    setSelectedAbility(null); 
    
    // Switch turn (simple alternating turns for now)
    // Delay turn switch slightly to allow projectile to appear?
    // Or maybe better to switch immediately.
    setCurrentPlayerIndex(prevIndex => (prevIndex === 0 ? 1 : 0));
  };

  const handleRoundWin = (winningPlayerIndex: 0 | 1) => {
    console.log(`[GameScreen] Round win detected! Winner: P${winningPlayerIndex}`);
    setWinner(winningPlayerIndex);
    setIsCharging(false); // Ensure charging stops on win
  };

  const handleAbilitySelect = (ability: AbilityType | null) => {
    if (winner !== null || isCharging) return; // Don't allow select while charging or after win
    console.log(`[GameScreen] Ability selected: ${ability}`);
    setSelectedAbility(ability);
  };

  // Get initial angle for the current player when turn changes
  useEffect(() => {
      if (winner !== null) return;
      setSelectedAbility(null); // Reset ability on turn change
      setIsCharging(false); // Ensure charging state is reset on turn change
  }, [currentPlayerIndex, winner]); // Rerun when turn changes or game ends


  return (
    <div style={{ position: 'relative', width: '100vw', height: '100vh', overflow: 'hidden' }}>
      <GameRenderer ref={gameRendererRef} onRoundWin={handleRoundWin} />

      {/* UI Overlay */}
      <div style={{ 
          position: 'absolute', 
          bottom: '40px',
          left: '60%',
          transform: 'translateX(-50%)',
          zIndex: 10,
          padding: '10px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center'
      }}>
        {winner === null ? (
          <>
            <h3 style={{ margin: '0 0 10px 0', color: currentPlayerIndex === 0 ? '#87CEFA' : '#F08080' /* Light blue/red */ }}>
              Player {currentPlayerIndex + 1}'s Turn
            </h3>
            <ActionButtons
              onFire={handleFire}
              isCharging={isCharging}
              setIsCharging={setIsCharging}
              selectedAbility={selectedAbility}
              onAbilitySelect={handleAbilitySelect}
            />
          </>
        ) : (
          <div style={{ textAlign: 'center', color: '#90EE90' /* Light green */ }}>
            <h2>Player {winner + 1} Wins!</h2>
            {/* TODO: Add options like "Play Again?" */}
          </div>
        )}
      </div>
    </div>
  );
};

export default GameScreen; 