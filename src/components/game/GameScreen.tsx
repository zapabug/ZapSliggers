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

  // TODO: Replace mock state with actual game state management (e.g., Zustand, props)
  // TODO: Fetch profile data for HUDs if needed beyond pubkey (useProfile hook?)
  // TODO: Implement game loop logic (turn handling, receiving Nostr events, triggering physics updates)
  // TODO: Connect physics engine updates to GameRenderer props
  // TODO: Handle ability selection state and logic
  console.log('NDK instance received in GameScreen:', ndk); // Log to confirm

  // Event Handlers
  // Use useCallback to memoize the handler passed to AimingInterface
  const handleAimChange = useCallback((aim: { angle: number; power: number }) => {
    // console.log('Aim updated:', aim); // For debugging
    setCurrentAim(aim);
  }, []); // Empty dependency array means this function reference doesn't change

  const handleFire = () => {
    console.log(`Fire button clicked by Player ${currentPlayerIndex}! Aim:`, currentAim);

    // Scale power appropriately (AimingInterface might give 0-100)
    const scaledPower = currentAim.power / 20; // Example scaling (maps 0-100 to 0-5 for fireProjectile)

    gameRendererRef.current?.fireProjectile(
        currentPlayerIndex,
        currentAim.angle, 
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
        // console.log('Key pressed:', event.key); // Debugging
        switch (event.key) {
            case 'ArrowUp':
                setCurrentAim(prev => ({ ...prev, angle: (prev.angle - 2 + 360) % 360 })); // Decrement angle (wraps around)
                break;
            case 'ArrowDown':
                setCurrentAim(prev => ({ ...prev, angle: (prev.angle + 2) % 360 })); // Increment angle (wraps around)
                break;
            case 'ArrowLeft':
                setCurrentAim(prev => ({ ...prev, power: Math.max(0, prev.power - 2) })); // Decrease power (min 0)
                break;
            case 'ArrowRight':
                setCurrentAim(prev => ({ ...prev, power: Math.min(100, prev.power + 2) })); // Increase power (max 100)
                break;
            case ' ': // Space bar
                event.preventDefault(); // Prevent scrolling if space is pressed
                handleFire();
                break;
            default:
                break;
        }
    };

    window.addEventListener('keydown', handleKeyDown);

    // Cleanup function
    return () => {
        window.removeEventListener('keydown', handleKeyDown);
    };
    // Rerun effect if handleFire changes (it shouldn't due to useCallback/state usage, but good practice)
  }, [handleFire]); // Dependency array includes handleFire
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