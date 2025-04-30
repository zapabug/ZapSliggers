import React, { useEffect, useRef } from 'react';

// Define known ability types (adjust as needed based on Gameplay.md)
export type AbilityType = 'triple' | 'explosive' | 'lead';

interface ActionButtonsProps {
  onFire: (power: number) => void;
  isCharging: boolean;
  setIsCharging: (charging: boolean) => void;
  selectedAbility: AbilityType | null;
  onAbilitySelect: (abilityType: AbilityType | null) => void;
}

// Placeholder SVG function (replace with actual SVGs or an icon library)
const AbilityIcon: React.FC<{ ability: AbilityType }> = ({ ability }) => {
  switch (ability) {
    case 'triple':
      return <span className="text-xs">🔱</span>; // Placeholder
    case 'explosive':
      return <span className="text-xs">💥</span>; // Placeholder
    case 'lead':
      return <span className="text-xs">⚓</span>; // Placeholder
    default:
      return null;
  }
};

const ActionButtons: React.FC<ActionButtonsProps> = (props) => {
  // Destructure props 
  const { 
    onFire, 
    isCharging,
    setIsCharging,
    selectedAbility,
    onAbilitySelect,
  } = props;

  // Placeholder: In a real implementation, track used abilities
  const availableAbilities: AbilityType[] = ['triple', 'explosive', 'lead'];
  const usedAbilities = new Set<AbilityType>(); // Example: empty set
  const abilityUsesLeft = 1; // Example: 1 use per match
  const currentHp = 100; // Example HP
  const abilityCost = 20; // Example cost

  // Power State (Local to this component for display)
  const [displayPower, setDisplayPower] = React.useState(0); // 0-1 range for display
  const chargeIntervalRef = useRef<number | null>(null);
  const MAX_POWER = 5;

  // Handle Charging Logic triggered by props
  useEffect(() => {
    if (isCharging) {
      // Start charging interval
      const startTime = Date.now();
      setDisplayPower(0.1); // Start at min power

      chargeIntervalRef.current = setInterval(() => {
        const elapsed = Date.now() - startTime;
        // Simple linear charge for now (e.g., full charge in 2 seconds)
        const chargeDuration = 2000;
        const powerRatio = Math.min(elapsed / chargeDuration, 1);
        const calculatedPower = 0.1 + powerRatio * (MAX_POWER - 0.1); 
        setDisplayPower(calculatedPower / MAX_POWER); // Update display power (0-1)
      }, 50); // Update interval

    } else {
      // Stop charging interval
      if (chargeIntervalRef.current !== null) {
        clearInterval(chargeIntervalRef.current);
      }
      // Power is fired on mouse up in GameScreen using the final value
      // Reset display power *after* firing? Or keep last value?
      // Let's reset for now.
      // setDisplayPower(0); // Resetting here might be too soon
    }

    // Cleanup interval on unmount or if isCharging changes
    return () => {
      if (chargeIntervalRef.current !== null) {
        clearInterval(chargeIntervalRef.current);
      }
    };
  }, [isCharging]);

  // Define specific angles for each ability (relative to straight up being 0 deg)
  const abilityAngles: { [key in AbilityType]: number } = {
    triple: -100,    // Left-ish
    explosive: -45,  // Top-left
    lead: 10,      // Top-right-ish (Anchor)
  };

  const radius = 60; // Distance from the Fire button center

  // Handler for Fire Button Mouse Events
  const handleMouseDown = () => {
    // --- REMOVED Log --- 
    setIsCharging(true);
  };

  const handleMouseUp = () => {
    // Calculate final power based on displayPower ratio
    const finalPower = 0.1 + displayPower * (MAX_POWER - 0.1);
    // --- REMOVED Log --- 
    onFire(finalPower); // Pass the calculated power
    setIsCharging(false);
    setDisplayPower(0); // Reset display power after firing
  };
  
  // Mouse Leave equivalent to Mouse Up
  const handleMouseLeave = () => {
      if (isCharging) {
          // If mouse leaves while charging, fire with current power
          handleMouseUp(); 
      }
  };

  return (
    // Main container now uses flex row - REMOVED Background/Border classes
    <div className="relative flex flex-row items-center justify-center w-auto p-2" > 
      {/* Fire Button Container (Relative Positioning Context) */}
      <div className="relative flex items-center justify-center w-40 h-28 mx-4"> 
        {/* Fire Button (Centered) */}
        <button 
          onMouseDown={handleMouseDown}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseLeave} // Stop charging if mouse leaves
          onTouchStart={(e) => { e.preventDefault(); handleMouseDown(); }} // Basic touch support
          onTouchEnd={(e) => { e.preventDefault(); handleMouseUp(); }}
          className={`absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-10 px-5 py-2 ${isCharging ? 'bg-yellow-500' : 'bg-red-600 hover:bg-red-700'} text-white font-bold rounded-lg shadow-lg transition-colors duration-150 focus:outline-none select-none bg-opacity-75 text-opacity-90`}
        >
          {isCharging ? `Power: ${(displayPower * 100).toFixed(0)}%` : 'Fire!'} 
        </button>

        {/* Ability Buttons Origin (Centered - No Change Needed) */}
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-0 h-0">
          {availableAbilities.map((ability) => {
            const isUsed = usedAbilities.has(ability);
            const hasEnoughHp = currentHp >= abilityCost;
            const isDisabled = isUsed || abilityUsesLeft <= 0 || !hasEnoughHp || isCharging; // Disable abilities while charging
            const isSelected = selectedAbility === ability;

            let baseBgColor = 'bg-purple-600 hover:bg-purple-700 bg-opacity-75';
            let borderStyle = 'border-transparent';

            if (isSelected) { borderStyle = 'border-yellow-400 border-opacity-75'; }
            if (isDisabled) { 
                baseBgColor = 'bg-gray-600 opacity-60';
                borderStyle = 'border-transparent'; 
            }

            const angleDegrees = abilityAngles[ability];
            const angleRadians = angleDegrees * (Math.PI / 180);
            const x = radius * Math.sin(angleRadians); 
            const y = -radius * Math.cos(angleRadians);

            return (
              <button
                key={ability}
                onClick={() => !isCharging && onAbilitySelect(ability)} // Prevent selection while charging
                disabled={isDisabled}
                className={`absolute w-10 h-10 ${baseBgColor} rounded-full flex items-center justify-center text-white text-opacity-90 text-lg font-bold shadow-md transition-all duration-150 focus:outline-none disabled:cursor-not-allowed border-2 ${borderStyle}`}
                style={{
                  transform: `translate(${x}px, ${y}px) translate(-50%, -50%)`, 
                  top: '0px', 
                  left: '0px' 
                }}
                title={`${ability.charAt(0).toUpperCase() + ability.slice(1)} (Cost: ${abilityCost} HP) - ${isDisabled ? (isCharging ? 'Cannot use while charging' : 'Unavailable') : 'Available'}`}
              >
                <AbilityIcon ability={ability} />
              </button>
            );
          })}
        </div>
      </div>
      {/* Placeholder for Player Info / Other UI elements */}
      {/* <div className="text-white"> P{playerIndex + 1} Info </div> */}
    </div>
  );
};

export default ActionButtons;
