import React, { useState, useCallback, useRef, useEffect } from 'react';
import GameRenderer, { GameRendererRef } from '../game/GameRenderer';
import AimingInterface from '../ui_overlays/AimingInterface';
import ActionButtons, { AbilityType } from '../ui_overlays/ActionButtons';
import { generateInitialPositions, InitialGamePositions } from '../../hooks/useGameInitialization';

// Define constants for the lobby playground
const VIRTUAL_WIDTH = 2400;
const VIRTUAL_HEIGHT = 1200;
const LOBBY_PLAYER_INDEX = 0; // Always player 0 in lobby

const LobbyPlayground = () => {
  const gameRendererRef = useRef<GameRendererRef>(null);
  const [levelData] = useState<InitialGamePositions>(() =>
    generateInitialPositions(VIRTUAL_WIDTH, VIRTUAL_HEIGHT)
  );
  const [currentAim, setCurrentAim] = useState({ angle: 0, power: 50 });

  // Simplified hit handler for lobby - just log and maybe reset?
  const handlePlayerHit = useCallback((hitPlayerIndex: 0 | 1, firingPlayerIndex: 0 | 1, projectileType: AbilityType | 'standard') => {
    console.log(`[Lobby Playground] Hit detected: Firing=${firingPlayerIndex}, Hit=${hitPlayerIndex}, Type=${projectileType}`);
    // Reset the level on any hit in the lobby?
    gameRendererRef.current?.resetGame();
  }, []);

  // Single player aim change
  const handleAimChange = useCallback((aim: { angle: number; power: number }) => {
    setCurrentAim(aim);
    gameRendererRef.current?.setShipAim(LOBBY_PLAYER_INDEX, aim.angle);
  }, []);

  // Single player fire
  const handleFire = () => {
    console.log(`[Lobby Playground] Fire! Aim:`, currentAim);
    const scaledPower = currentAim.power / 20;
    gameRendererRef.current?.fireProjectile(
      LOBBY_PLAYER_INDEX,
      scaledPower,
      null // No abilities in simple lobby playground yet
    );
    // No turn switching needed
  };

  // --- Keyboard Controls (Simplified for single player) ---
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      let newAngle: number | undefined = undefined;
      let newPower: number | undefined = undefined;
      let preventDefault = false;

      switch (event.key) {
        case 'ArrowUp':
          newAngle = (currentAim.angle - 2 + 360) % 360;
          preventDefault = true;
          break;
        case 'ArrowDown':
          newAngle = (currentAim.angle + 2) % 360;
          preventDefault = true;
          break;
        case 'ArrowLeft':
          newPower = Math.max(0, currentAim.power - 2);
          preventDefault = true;
          break;
        case 'ArrowRight':
          newPower = Math.min(100, currentAim.power + 2);
          preventDefault = true;
          break;
        case ' ':
          event.preventDefault();
          handleFire();
          break;
        default:
          break;
      }

      if (preventDefault) {
        event.preventDefault();
      }

      if (newAngle !== undefined || newPower !== undefined) {
        const updatedAim = {
          angle: newAngle !== undefined ? newAngle : currentAim.angle,
          power: newPower !== undefined ? newPower : currentAim.power,
        };
        setCurrentAim(updatedAim);
        if (newAngle !== undefined) {
          gameRendererRef.current?.setShipAim(LOBBY_PLAYER_INDEX, newAngle);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleFire, currentAim.angle, currentAim.power]);

  return (
    // Container for the lobby playground
    <div className="relative w-full h-full border border-gray-700 rounded-lg overflow-hidden shadow-lg">
      {/* Game Canvas */} 
      <div className="relative z-0 w-full h-full">
        {levelData && (
          <GameRenderer
            ref={gameRendererRef}
            levelData={levelData}
            onPlayerHit={handlePlayerHit}
          />
        )}
      </div>

      {/* Controls Overlay - Position appropriately */}
      <div className="absolute bottom-4 left-4 z-10 pointer-events-auto flex flex-col items-start max-w-xs">
        <AimingInterface
          onAimChange={handleAimChange}
          currentAngle={currentAim.angle}
        />
      </div>
      <div className="absolute bottom-4 right-4 z-10">
        <ActionButtons
          onFire={handleFire}
          // Dummy props for abilities - not used in simple lobby
          selectedAbility={null}
          onAbilitySelect={() => {}}
          usedAbilities={new Set()}
          currentHp={100} // Dummy HP
          abilityCost={25}
          maxAbilityUses={3}
          disabled={false} // Always enabled in lobby playground
        />
      </div>
    </div>
  );
};

export default LobbyPlayground; 