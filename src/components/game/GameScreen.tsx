import React, { useState, useCallback, useRef, useEffect } from 'react';
import NDK from '@nostr-dev-kit/ndk'; // Import NDK type
import GameRenderer, { GameRendererRef } from './GameRenderer';
import AimingInterface from '../ui_overlays/AimingInterface';
import { PlayerHUD } from '../ui_overlays/PlayerHUD';
import ActionButtons from '../ui_overlays/ActionButtons';

// Define props expected by GameScreen
interface GameScreenProps {
  opponentPubkey: string;
  localPlayerPubkey: string;
  ndk: NDK; // Add NDK instance prop
  // TODO: Add game state props as needed (e.g., gameState, turnNumber)
}

// Define constants or get from config
const MAX_HP = 100;

const GameScreen: React.FC<GameScreenProps> = ({ opponentPubkey, localPlayerPubkey, ndk }) => { // Destructure ndk prop
  // Ref for accessing GameRenderer methods
  const gameRendererRef = useRef<GameRendererRef>(null);

  // Component State for aiming values (angle in degrees, power unitless)
  // Angle: Assuming 0 is right, positive clockwise (adjust if UI gives different)
  // Power: Assuming 0-100 from UI, needs scaling before passing to fireProjectile
  const [currentAim, setCurrentAim] = useState({ angle: 0, power: 50 });

  // Other Component State
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [turnTimer, setTurnTimer] = useState(60); // Example timer - Drive from game state later
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [abilityUsesLeft, setAbilityUsesLeft] = useState(3); // Example - Drive from game state later

  // Mock Game State (replace with actual state management/props)
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [localPlayerCurrentHp, setLocalPlayerCurrentHp] = useState(MAX_HP); // Example
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [opponentCurrentHp, setOpponentCurrentHp] = useState(MAX_HP); // Example
  // Remove unused 3D/physics state
  // const [activeProjectiles, setActiveProjectiles] = useState<any[]>([]);
  // const [gameState, setGameState] = useState('aiming'); // Example

  // State for current player (0 or 1)
  const [currentPlayerIndex, setCurrentPlayerIndex] = useState<0 | 1>(0);

  // --- Effect to Sync Aim State on Turn Change ---
  useEffect(() => {
    // Get the actual angle of the ship that is NOW current
    const currentShipAngleRad = gameRendererRef.current?.getShipAngle(currentPlayerIndex);

    if (currentShipAngleRad !== undefined) {
      // Convert radians back to degrees (0-360 range)
      let angleDeg = currentShipAngleRad * (180 / Math.PI);
      angleDeg = (angleDeg % 360 + 360) % 360; // Normalize to 0-360

      console.log(`Turn changed to ${currentPlayerIndex}. Syncing aim angle state to: ${angleDeg.toFixed(1)} degrees`);

      // Update the aim state (angle only, keep existing power)
      setCurrentAim(prevAim => ({ ...prevAim, angle: angleDeg }));
    } else {
      console.warn(`Could not get ship angle for player ${currentPlayerIndex} on turn change.`);
      // Optionally reset to a default angle if getting the angle fails
      // setCurrentAim(prevAim => ({ ...prevAim, angle: currentPlayerIndex === 1 ? 180 : 0 }));
    }
    // Dependency: Run when the current player changes
  }, [currentPlayerIndex]);

  // TODO: Replace mock state with actual game state management (e.g., Zustand, props)
  // TODO: Fetch profile data for HUDs if needed beyond pubkey (useProfile hook?)
  // TODO: Implement game loop logic (turn handling, receiving Nostr events, triggering physics updates)
  // TODO: Connect physics engine updates to GameRenderer props
  // TODO: Handle ability selection state and logic
  console.log('NDK instance received in GameScreen:', ndk); // Log to confirm

  // Event Handlers
  // Use useCallback to memoize the handler passed to AimingInterface
  const handleAimChange = useCallback((aim: { angle: number; power: number }) => {
    // Update local state
    setCurrentAim(aim);
    // ALSO update the ship angle in the renderer
    gameRendererRef.current?.setShipAim(currentPlayerIndex, aim.angle);
  }, [currentPlayerIndex]); // Add currentPlayerIndex dependency

  const handleFire = () => {
    console.log(`Fire button clicked by Player ${currentPlayerIndex}! Aim:`, currentAim);

    const scaledPower = currentAim.power / 20;

    // Call fireProjectile WITHOUT the angle
    gameRendererRef.current?.fireProjectile(
        currentPlayerIndex,
        scaledPower
    );

    // Switch player turn
    setCurrentPlayerIndex(prevIndex => (prevIndex === 0 ? 1 : 0));

    // TODO: Send move via Nostr event (kind:30079)
    // TODO: Update game state (e.g., switch to 'resolving' phase)
  };

  const handleAbilities = () => {
    console.log('Open Abilities');
    // TODO: Implement ability selection modal/UI
    // TODO: Update state based on selection, deduct HP cost
  };

  // --- Keyboard Controls --- 
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
        let newAngle: number | undefined = undefined;
        let newPower: number | undefined = undefined;
        let preventDefault = false; // Flag to prevent default behavior

        switch (event.key) {
            case 'ArrowUp':
                newAngle = (currentAim.angle - 2 + 360) % 360;
                preventDefault = true; // Prevent scroll
                break;
            case 'ArrowDown':
                newAngle = (currentAim.angle + 2) % 360;
                preventDefault = true; // Prevent scroll
                break;
            case 'ArrowLeft':
                newPower = Math.max(0, currentAim.power - 2);
                preventDefault = true; // Prevent scroll
                break;
            case 'ArrowRight':
                newPower = Math.min(100, currentAim.power + 2);
                preventDefault = true; // Prevent scroll
                break;
            case ' ': 
                // Space already has preventDefault
                event.preventDefault();
                handleFire();
                break;
            default:
                break;
        }

        // Prevent default browser action (scrolling) if needed
        if (preventDefault) {
          event.preventDefault();
        }

        // Update local state if changed
        if (newAngle !== undefined || newPower !== undefined) {
          const updatedAim = {
            angle: newAngle !== undefined ? newAngle : currentAim.angle,
            power: newPower !== undefined ? newPower : currentAim.power,
          };
          setCurrentAim(updatedAim);
          
          // If angle changed, update the renderer
          if (newAngle !== undefined) {
            gameRendererRef.current?.setShipAim(currentPlayerIndex, newAngle);
          }
        }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
        window.removeEventListener('keydown', handleKeyDown);
    };
  }, [handleFire, currentAim.angle, currentAim.power, currentPlayerIndex]); // Update dependencies
  // --- End Keyboard Controls ---

  // Remove unused PhysicsUpdater component
  // const PhysicsUpdater = () => { ... };

  return (
    // Main container: Remove flex centering
    <div className="relative w-full h-screen bg-black text-white overflow-hidden">

      {/* Player HUDs - Positioned absolutely top-left and top-right */}
      {/* Use closer positioning values like top-2 left-2 etc. */}
      <div className="absolute top-2 left-2 z-10 pointer-events-auto">
        <PlayerHUD
          pubkey={localPlayerPubkey}
          currentHp={localPlayerCurrentHp}
          maxHp={MAX_HP}
          isPlayer1={true}
          ndk={ndk}
        />
      </div>
      <div className="absolute top-2 right-2 z-10 pointer-events-auto">
        <PlayerHUD
          pubkey={opponentPubkey}
          currentHp={opponentCurrentHp}
          maxHp={MAX_HP}
          isPlayer1={false} // Controls alignment
          ndk={ndk}
        />
      </div>

      {/* Game Canvas Container - Set to fill parent */}
      <div className="relative z-0 w-full h-full">
        <GameRenderer
          ref={gameRendererRef} // Pass the ref here
          // TODO: Pass actual player positions if they change
          player1Pos={{ x: 100, y: 500 }} // Example static positions
          player2Pos={{ x: 700, y: 500 }}
          // TODO: Pass necessary game state for rendering (planets, traces)
        />
      </div>

      {/* Bottom Control Area - Positioned absolutely near corners */}
      {/* Use closer positioning values like bottom-4 left-4 etc. */}
      <div className="absolute bottom-4 left-4 z-10 pointer-events-auto flex flex-col items-start max-w-xs">
        <AimingInterface
          onAimChange={handleAimChange} // Pass the handler
          currentAngle={currentAim.angle} // Pass current angle state
        />
      </div>

      <div className="absolute bottom-4 right-4 z-10 pointer-events-auto flex flex-col items-end max-w-xs">
          <ActionButtons 
            onFire={handleFire} // Pass the fire handler
            onSelectAbility={handleAbilities} // Assuming a new handler
            abilityUsesLeft={abilityUsesLeft}
          />
      </div>

    </div>
  );
};

export default GameScreen; 