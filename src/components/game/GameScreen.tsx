'use strict';
import React, { useRef, useEffect } from 'react';
import NDK from '@nostr-dev-kit/ndk';
import GameRenderer, { GameRendererRef } from './GameRenderer';
import AimingInterface from '../ui_overlays/AimingInterface';
import { PlayerHUD } from '../ui_overlays/PlayerHUD';
import ActionButtons from '../ui_overlays/ActionButtons';
// Import the new hook
import { useGameLogic } from '../../hooks/useGameLogic';
// Keep level generation import if GameScreen needs to generate initial level
// import { generateInitialPositions, InitialGamePositions } from '../../hooks/useGameInitialization';

// Define props expected by GameScreen (Keep this interface)
interface GameScreenProps {
  opponentPubkey: string;
  localPlayerPubkey: string;
  ndk: NDK; // Pass NDK instance
  matchId: string; // Match ID prop remains
  onGameEnd: () => void; // Callback when the game concludes
}

// Define constants (can be moved or kept)
const MAX_HP = 100;
const ABILITY_COST = 25;
const MAX_ABILITY_USES = 3;

// PlayerState interface is now exported from useGameLogic, no need to redefine
// interface PlayerState { ... }

const GameScreen: React.FC<GameScreenProps> = ({ 
  opponentPubkey, 
  localPlayerPubkey, 
  ndk,
  matchId,
  onGameEnd 
}) => {
  // Ref for accessing GameRenderer methods
  const gameRendererRef = useRef<GameRendererRef>(null);

  // --- Use the Game Logic Hook --- 
  const {
    playerStates,
    // currentPlayerIndex, // Keep commented out, not needed here
    currentAim,
    selectedAbility,
    levelData,
    handleAimChange,
    handleFire,
    handleSelectAbility,
    handlePlayerHit,
    handleProjectileResolved,
    myPlayerIndex // Get the index determined by the hook
  } = useGameLogic({
      mode: 'multiplayer', 
      localPlayerPubkey,
      opponentPubkey,
      gameRendererRef,
      // initialLevelData: generateInitialPositions(2400, 1200), // Optionally pass initial data
      onGameEnd, // Pass the callback
      ndk,
      matchId,
  });

  // Log Match ID on mount (Keep this or adapt)
  useEffect(() => {
    console.log(`[GameScreen] Initialized for Match ID: ${matchId}. My Index: ${myPlayerIndex}`);
  }, [matchId, myPlayerIndex]);

  // --- REMOVED ALL STATE DEFINITIONS AND HANDLER FUNCTIONS --- 
  // (levelData, currentAim, currentPlayerIndex, playerStates, selectedAbility)
  // (handleRoundWin, handlePlayerHit, handleAimChange, handleFire, handleSelectAbility)
  // --- REMOVED Effect to Sync Aim State on Turn Change --- 

  // Derived state for convenience (using hook state)
  const localPlayerData = playerStates[myPlayerIndex];
  const opponentPlayerIndex = myPlayerIndex === 0 ? 1 : 0;
  const opponentPlayerData = playerStates[opponentPlayerIndex];

  // --- Keyboard Controls (Use handlers from hook) --- 
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
        let newAngle: number | undefined = undefined;
        let newPower: number | undefined = undefined;
        let preventDefault = false;
        // Determine mode from useGameLogic props (assuming it doesn't change)
        // If mode could change, we'd need it from the hook's return value.
        // const mode = 'multiplayer'; // Removed unused variable
        // Actually, useGameLogic is called with mode: 'multiplayer' here,
        // so this key handler only applies to multiplayer as written.
        // The practice mode inversion needs to happen where practice mode is active.
        
        // Let's rethink: The keyboard controls should be handled where the mode is known.
        // If PracticeScreen also uses this key logic, THAT screen needs the inversion.
        // For GameScreen (multiplayer), inversion isn't needed.
        
        // Applying the UX swap first:
        switch (event.key) {
            case 'ArrowLeft': // Now controls Angle LEFT
                newAngle = (currentAim.angle - 2 + 360) % 360;
                preventDefault = true;
                break;
            case 'ArrowRight': // Now controls Angle RIGHT
                newAngle = (currentAim.angle + 2) % 360;
                preventDefault = true;
                break;
            case 'ArrowDown': // Now controls Power DOWN
                newPower = Math.max(0, currentAim.power - 2);
                preventDefault = true;
                break;
            case 'ArrowUp': // Now controls Power UP
                newPower = Math.min(100, currentAim.power + 2);
                preventDefault = true;
                break;
            case ' ': // Spacebar
                event.preventDefault();
                handleFire(); // Call hook handler
                break;
            case '1': handleSelectAbility('splitter'); break; 
            case '2': handleSelectAbility('gravity'); break; 
            case '3': handleSelectAbility('plastic'); break; 
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
          handleAimChange(updatedAim); // Call hook handler
        }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
        window.removeEventListener('keydown', handleKeyDown);
    };
    // Dependencies now include handlers from the hook
    // Add currentPlayerIndex if needed for conditional logic (removed for now)
  }, [handleFire, handleSelectAbility, handleAimChange, currentAim.angle, currentAim.power]); 

  // --- Return JSX (Connect UI to hook state/handlers) --- 
  return (
    <div className="relative w-full h-dvh bg-black text-white overflow-hidden">

      {/* Player HUDs - Use determined indices */}
      <div className="absolute top-2 left-2 z-10 pointer-events-auto">
        <PlayerHUD
          pubkey={localPlayerPubkey} 
          currentHp={localPlayerData.hp} // Use local player data from hook
          maxHp={MAX_HP}
          isPlayer1={myPlayerIndex === 0} // Determine layout based on index
          ndk={ndk}
        />
      </div>
      <div className="absolute top-2 right-2 z-10 pointer-events-auto">
        <PlayerHUD
          pubkey={opponentPubkey} 
          currentHp={opponentPlayerData.hp} // Use opponent player data from hook
          maxHp={MAX_HP}
          isPlayer1={opponentPlayerIndex === 0} // Determine layout based on index
          ndk={ndk}
        />
      </div>

      {/* Game Canvas Container */}
      <div className="absolute inset-0 z-0 w-full h-full">
        {levelData && (
          <GameRenderer
            ref={gameRendererRef}
            levelData={levelData}
            onPlayerHit={handlePlayerHit}
            onProjectileResolved={handleProjectileResolved}
          />
        )}
      </div>

      {/* Bottom Control Area - Aiming */} 
      <div className="absolute bottom-4 left-4 z-10 pointer-events-auto flex flex-col items-start max-w-xs">
        <AimingInterface
          currentAngle={currentAim.angle} // Use aim from hook
          onAimChange={handleAimChange} // Use handler from hook
        />
      </div>

      {/* Bottom Control Area - Actions/Fire */} 
      <div className="absolute bottom-4 right-4 z-10">
        <ActionButtons
          onFire={handleFire} // Use handler from hook
          onAbilitySelect={handleSelectAbility} // Use handler from hook
          selectedAbility={selectedAbility} // Use state from hook
          // Pass correct player state data from hook
          usedAbilities={localPlayerData.usedAbilities} // Use local player data
          currentHp={localPlayerData.hp} // Use local player data
          abilityCost={ABILITY_COST}
          maxAbilityUses={MAX_ABILITY_USES}
          disabled={false} // TODO: Add disabled logic
        />
      </div>

    </div>
  );
};

export default GameScreen;