import React, { useState, useCallback, useRef, useEffect } from 'react';
import NDK from '@nostr-dev-kit/ndk'; // Import NDK type
import GameRenderer, { GameRendererRef } from './GameRenderer';
import AimingInterface from '../ui_overlays/AimingInterface';
import { PlayerHUD } from '../ui_overlays/PlayerHUD';
import ActionButtons, { AbilityType } from '../ui_overlays/ActionButtons'; // Import AbilityType
// Import level generation function
import { generateInitialPositions, InitialGamePositions } from '../../hooks/useGameInitialization';

// Define props expected by GameScreen
interface GameScreenProps {
  opponentPubkey: string;
  localPlayerPubkey: string;
  ndk: NDK; // Pass NDK instance
  onGameEnd: () => void; // Callback when the game concludes
}

// Define constants or get from config
const MAX_HP = 100;
const ABILITY_COST = 25;
const MAX_ABILITY_USES = 3;
// const MAX_ABILITY_TYPE_USES = 1; // Removed, not used

// Define Player State structure
interface PlayerState {
  hp: number;
  usedAbilities: Set<AbilityType>;
  isVulnerable: boolean;
}

const GameScreen: React.FC<GameScreenProps> = ({ 
  opponentPubkey, 
  localPlayerPubkey, 
  ndk, 
  onGameEnd // Destructure the new prop
}) => {
  // Ref for accessing GameRenderer methods
  const gameRendererRef = useRef<GameRendererRef>(null);

  // --- Level Data State ---
  const [levelData, setLevelData] = useState<InitialGamePositions>(() => 
    generateInitialPositions(2400, 1200) 
  );

  // Component State for aiming values
  const [currentAim, setCurrentAim] = useState({ angle: 0, power: 50 });

  // Other Component State
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [turnTimer, setTurnTimer] = useState(60);
  const [currentPlayerIndex, setCurrentPlayerIndex] = useState<0 | 1>(0);
  const [playerStates, setPlayerStates] = useState<[PlayerState, PlayerState]>([
    { hp: MAX_HP, usedAbilities: new Set(), isVulnerable: false }, // Player 0
    { hp: MAX_HP, usedAbilities: new Set(), isVulnerable: false }  // Player 1
  ]);
  const [selectedAbility, setSelectedAbility] = useState<AbilityType | null>(null);

  // Derived state for convenience
  const localPlayerIndex = 0; // Assuming local player is always index 0
  const opponentPlayerIndex = 1;
  const localPlayerState = playerStates[localPlayerIndex];
  const opponentPlayerState = playerStates[opponentPlayerIndex];
  const localPlayerCurrentHp = localPlayerState.hp;
  const opponentCurrentHp = opponentPlayerState.hp;
  
  // --- Effect to Sync Aim State on Turn Change ---
  useEffect(() => {
    // Get the actual angle of the ship that is NOW current
    const currentShipAngleRad = gameRendererRef.current?.getShipAngle(currentPlayerIndex);

    if (currentShipAngleRad !== undefined) {
      // Convert radians back to degrees (0-360 range)
      let angleDeg = currentShipAngleRad * (180 / Math.PI);
      angleDeg = (angleDeg % 360 + 360) % 360; // Normalize to 0-360

      // console.log(`Turn changed to ${currentPlayerIndex}. Syncing aim angle state to: ${angleDeg.toFixed(1)} degrees`);

      // Update the aim state (angle only, keep existing power)
      setCurrentAim(prevAim => ({ ...prevAim, angle: angleDeg }));
    } else {
      // console.warn(`Could not get ship angle for player ${currentPlayerIndex} on turn change.`);
      // Optionally reset to a default angle if getting the angle fails
      // setCurrentAim(prevAim => ({ ...prevAim, angle: currentPlayerIndex === 1 ? 180 : 0 }));
    }
    // Dependency: Run when the current player changes

    // Reset selected ability when turn changes
    setSelectedAbility(null); 

  }, [currentPlayerIndex]);

  // --- Callback for Round Win --- 
  const handleRoundWin = useCallback(() => {
    // TODO: Determine actual winner, potentially pass to onGameEnd
    console.log(`!!! Round Win detected !!!`);
    // For now, just call onGameEnd to return to lobby/menu
    // This needs proper scoring/match end logic later
    onGameEnd(); 

    // --- Reset Logic (Maybe move this to game start?) ---
    const newLevel = generateInitialPositions(2400, 1200);
    setLevelData(newLevel);
    setPlayerStates([
      { hp: MAX_HP, usedAbilities: new Set(), isVulnerable: false },
      { hp: MAX_HP, usedAbilities: new Set(), isVulnerable: false }
    ]);
    setCurrentPlayerIndex(0);
    setSelectedAbility(null);
  }, [onGameEnd]);

  // --- Handle Player Hit Callback ---
  const handlePlayerHit = useCallback((hitPlayerIndex: 0 | 1, firingPlayerIndex: 0 | 1, projectileType: AbilityType | 'standard') => {
      // console.log(`[GameScreen] handlePlayerHit: FiringPlayer=${firingPlayerIndex}, HitPlayer=${hitPlayerIndex}, Type=${projectileType}`);

      // --- Check for Self-Hit first ---
      if (hitPlayerIndex === firingPlayerIndex) {
          // console.log(`!!! Player ${firingPlayerIndex} hit themselves! Round Loss!`);
          handleRoundWin();
          return; // Stop further processing
      }

      // --- Calculate Damage --- 
      let damage = 0;
      if (projectileType === 'standard') {
          damage = 100;
          // console.log(`Standard hit dealt ${damage} damage.`);
      } else {
          // All current abilities deal the same damage
          damage = 50; 
          // console.log(`Ability hit (${projectileType}) dealt ${damage} damage.`);
      }

      // --- Apply Damage and Check for Round Win --- 
      setPlayerStates(currentStates => {
          // Clone the state array and the specific player state we are modifying
          const newStates: [PlayerState, PlayerState] = [
              { ...currentStates[0] }, 
              { ...currentStates[1] }
          ];
          const hitPlayerCurrentState = newStates[hitPlayerIndex];

          // Deduct HP
          const newHp = hitPlayerCurrentState.hp - damage;
          hitPlayerCurrentState.hp = newHp;
          // console.log(`Player ${hitPlayerIndex} HP reduced to ${newHp}`);

          // Check if the hit resulted in a win
          if (newHp <= 0) {
              // console.log(`Player ${hitPlayerIndex} HP reached 0 or below. Player ${firingPlayerIndex} wins the round!`);
              // Schedule handleRoundWin to run *after* this state update completes
              // Use setTimeout to avoid calling it directly within the setter
              setTimeout(() => handleRoundWin(), 0); 
          }
          
          return newStates; // Return the updated states array
      });
      
      // --- Round Win logic is now handled *inside* setPlayerStates based on HP --- 

  }, [handleRoundWin]);

  // --- Aim Change Handler ---
  const handleAimChange = useCallback((aim: { angle: number; power: number }) => {
    // console.log(`[GameScreen] handleAimChange called with:`, aim);
    // Update local state
    setCurrentAim(aim);
    // ALSO update the ship angle in the renderer
    gameRendererRef.current?.setShipAim(currentPlayerIndex, aim.angle);
  }, [currentPlayerIndex]);

  // --- Fire Handler ---
  const handleFire = useCallback(() => {
    const currentPlayerState = playerStates[currentPlayerIndex];
    // console.log(`Fire button clicked by Player ${currentPlayerIndex}! HP: ${currentPlayerState.hp}, Aim:`, currentAim, `Ability: ${selectedAbility || 'None'}`);

    const scaledPower = currentAim.power / 20;

    // Check if trying to use an ability
    if (selectedAbility) {
      // --- SUICIDE CHECK ---
      if (currentPlayerState.hp <= ABILITY_COST) {
        // console.error(`!!! Player ${currentPlayerIndex} SUICIDE! Tried to use ${selectedAbility} with ${currentPlayerState.hp} HP (Cost: ${ABILITY_COST}). Round Loss!`);
        // Opponent wins
        handleRoundWin();
        // Reset selected ability visually, but don't proceed further
        setSelectedAbility(null);
        return; // Stop execution here
      }

      // --- Sufficient HP - Fire Ability Projectile ---
      // console.log(`Firing ability ${selectedAbility} for Player ${currentPlayerIndex}`);
      gameRendererRef.current?.fireProjectile(
          currentPlayerIndex,
          scaledPower,
          selectedAbility // Pass the selected ability
      );

      // --- Update state AFTER successful ability fire ---
      setPlayerStates(currentStates => {
        const newStates: [PlayerState, PlayerState] = [
            { ...currentStates[0], usedAbilities: new Set(currentStates[0].usedAbilities) }, 
            { ...currentStates[1], usedAbilities: new Set(currentStates[1].usedAbilities) }
        ];
        const playerToUpdate = newStates[currentPlayerIndex];
        
        // Deduct HP
        playerToUpdate.hp -= ABILITY_COST;
        // Add ability to used set
        playerToUpdate.usedAbilities.add(selectedAbility);
        // Update vulnerability status
        playerToUpdate.isVulnerable = playerToUpdate.usedAbilities.size >= 2; // Vulnerable if 2 or more abilities used

        // console.log(`Player ${currentPlayerIndex} state updated after ability use: HP=${playerToUpdate.hp}, Used=${Array.from(playerToUpdate.usedAbilities).join(',')}, Vulnerable=${playerToUpdate.isVulnerable}`);
        
        return newStates;
      });

      // Reset selected ability visually
      setSelectedAbility(null);

    } else {
      // --- Fire Standard Projectile ---
      // console.log(`Firing standard projectile for Player ${currentPlayerIndex}`);
      gameRendererRef.current?.fireProjectile(
          currentPlayerIndex,
          scaledPower,
          null // No ability selected
      );
      // No state change needed for standard fire (HP cost, ability use)
    }

    // Switch player turn AFTER processing fire (either ability or standard)
    setCurrentPlayerIndex(prevIndex => (prevIndex === 0 ? 1 : 0));

    // TODO: Send move via Nostr event (kind:30079)
    // TODO: Update game state (e.g., switch to 'resolving' phase)
  }, [playerStates, currentPlayerIndex, currentAim, selectedAbility, handleRoundWin]);

  // --- Select Ability Handler ---
  const handleSelectAbility = useCallback((abilityType: AbilityType) => {
    // console.log(`[GameScreen] handleSelectAbility START for ability: ${abilityType}. Current aim:`, currentAim);
    setPlayerStates(currentStates => {
      const currentPlayerData = currentStates[currentPlayerIndex];

      // Check if already selected (deselect)
      if (selectedAbility === abilityType) {
        console.log(`Deselecting ${abilityType}`);
        setSelectedAbility(null);
        return currentStates; // No state change needed for player data
      }

      // Check Max Uses
      if (currentPlayerData.usedAbilities.size >= MAX_ABILITY_USES) {
        // console.warn(`Player ${currentPlayerIndex} cannot select ability: Max uses (${MAX_ABILITY_USES}) reached.`);
        return currentStates; // Prevent selection
      }

      // Check if already used this specific ability type
      if (currentPlayerData.usedAbilities.has(abilityType)) {
        // console.warn(`Player ${currentPlayerIndex} cannot select ability: ${abilityType} already used this match.`);
        return currentStates; // Prevent selection
      }

      // --- REMOVED HP CHECK HERE ---
      // The check is now done in handleFire at the moment of firing.

      // --- All checks passed - Select the ability ---
      console.log(`Player ${currentPlayerIndex} selected ability: ${abilityType}`);
      setSelectedAbility(abilityType);
      // No player state change needed *at selection time* regarding HP or ability usage count
      return currentStates; 
    });
  }, [currentPlayerIndex, selectedAbility]);

  // --- Keyboard Controls --- 
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
        let newAngle: number | undefined = undefined;
        let newPower: number | undefined = undefined;
        let preventDefault = false; // Flag to prevent default behavior

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
            case ' ': // Spacebar
                event.preventDefault(); // Always prevent default for space
                handleFire();
                break;
            // Map numbers 1, 2, 3 to abilities if needed
            case '1': handleSelectAbility('splitter'); break; 
            case '2': handleSelectAbility('gravity'); break; 
            case '3': handleSelectAbility('plastic'); break; 
            default:
                break;
        }

        if (preventDefault) {
          event.preventDefault();
        }

        // Update local state if changed
        if (newAngle !== undefined || newPower !== undefined) {
          const updatedAim = {
            angle: newAngle !== undefined ? newAngle : currentAim.angle,
            power: newPower !== undefined ? newPower : currentAim.power,
          };
          handleAimChange(updatedAim); // Use handleAimChange to update state & renderer
        }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
        window.removeEventListener('keydown', handleKeyDown);
    };
  }, [handleFire, handleSelectAbility, handleAimChange, currentAim.angle, currentAim.power]); // Update dependencies

  // --- Return JSX --- 
  return (
    <div className="relative w-full h-dvh bg-black text-white overflow-hidden">

      {/* Player HUDs - Positioned absolutely top-left and top-right */}
      <div className="absolute top-2 left-2 z-10 pointer-events-auto">
        <PlayerHUD
          pubkey={localPlayerPubkey} // Pass pubkey
          currentHp={localPlayerCurrentHp}
          maxHp={MAX_HP}
          isPlayer1={true} // Controls alignment/layout
          ndk={ndk}
        />
      </div>
      <div className="absolute top-2 right-2 z-10 pointer-events-auto">
        <PlayerHUD
          pubkey={opponentPubkey} // Pass pubkey
          currentHp={opponentCurrentHp}
          maxHp={MAX_HP}
          isPlayer1={false} // Controls alignment/layout
          ndk={ndk}
        />
      </div>

      {/* Game Canvas Container - Fills space behind UI */}
      <div className="absolute inset-0 z-0 w-full h-full">
        {levelData && (
          <GameRenderer
            ref={gameRendererRef}
            levelData={levelData}
            onPlayerHit={handlePlayerHit}
          />
        )}
      </div>

      {/* Bottom Control Area - Aiming */} 
      <div className="absolute bottom-4 left-4 z-10 pointer-events-auto flex flex-col items-start max-w-xs">
        <AimingInterface
          // Pass necessary props - Assuming AimingInterface takes angle/power and onChange
          currentAngle={currentAim.angle} 
          onAimChange={handleAimChange} 
        />
      </div>

      {/* Bottom Control Area - Actions/Fire */} 
      <div className="absolute bottom-4 right-4 z-10">
        <ActionButtons
          onFire={handleFire}
          onAbilitySelect={handleSelectAbility}
          selectedAbility={selectedAbility}
          // Pass correct player state data
          usedAbilities={playerStates[currentPlayerIndex].usedAbilities}
          currentHp={playerStates[currentPlayerIndex].hp}
          abilityCost={ABILITY_COST}
          maxAbilityUses={MAX_ABILITY_USES}
          disabled={false} // TODO: Add disabled logic (e.g., during shot resolution)
        />
      </div>

    </div>
  );
};

export default GameScreen;