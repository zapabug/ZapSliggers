import React from 'react';

// Define known ability types (adjust as needed based on Gameplay.md)
export type AbilityType = 'triple' | 'explosive' | 'lead';

interface ActionButtonsProps {
  onFire: () => void;
  selectedAbility: AbilityType | null;
  onAbilitySelect: (abilityType: AbilityType) => void; // Changed signature to NOT accept null for selection
  // --- ADDED Props ---
  usedAbilities: Set<AbilityType>;
  currentHp: number;
  abilityCost: number;
  maxAbilityUses: number;
  disabled: boolean; // General disabled state (e.g., not player's turn)
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
  const {
    onFire,
    selectedAbility,
    onAbilitySelect,
    // --- Destructure Added Props ---
    usedAbilities,
    currentHp,
    abilityCost,
    maxAbilityUses,
    disabled,
  } = props;

  // Use available abilities directly
  const availableAbilities: AbilityType[] = ['triple', 'explosive', 'lead'];

  // Define specific angles for each ability
  const abilityAngles: { [key in AbilityType]: number } = {
    triple: -100,
    explosive: -45,
    lead: 10,
  };

  const radius = 60; // Distance from the Fire button center

  const handleFireClick = () => {
      if (disabled) return; // Check general disabled state
      console.log("[ActionButtons] Fire button clicked");
      onFire();
  };

  const handleAbilityButtonClick = (ability: AbilityType) => {
      if (disabled) return; // Check general disabled state
      // Logic to determine if it's a select or deselect is now handled in GameScreen
      // Here, we just call the handler passed down.
      onAbilitySelect(ability);
  };

  return (
    // Main container now uses flex row - REMOVED Background/Border classes
    <div className="relative flex flex-row items-center justify-center w-auto p-2" >
      {/* Fire Button Container (Relative Positioning Context) */}
      <div className="relative flex items-center justify-center w-40 h-28 mx-4"> 
        {/* Fire Button (Centered) - MODIFIED */}
        <button
          onClick={handleFireClick}
          // --- Use general disabled prop ---
          disabled={disabled}
          className={`absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-10 px-5 py-2 bg-red-600 hover:bg-red-700 text-white font-bold rounded-lg shadow-lg transition-colors duration-150 focus:outline-none select-none bg-opacity-75 text-opacity-90 ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
          {'Fire!'}
        </button>

        {/* Ability Buttons Origin (Centered - No Change Needed) */}
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-0 h-0">
          {availableAbilities.map((ability) => {
            // --- Use Props for Checks ---
            const isUsed = usedAbilities.has(ability);
            const hasEnoughHp = currentHp >= abilityCost;
            const usesLeft = maxAbilityUses - usedAbilities.size;
            // Check general disabled state first
            const isButtonDisabled = disabled || isUsed || usesLeft <= 0 || !hasEnoughHp;
            const isSelected = selectedAbility === ability;

            let baseBgColor = 'bg-purple-600 hover:bg-purple-700 bg-opacity-75';
            let borderStyle = 'border-transparent';

            if (isSelected) { borderStyle = 'border-yellow-400 border-opacity-75'; }
            if (isButtonDisabled) {
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
                onClick={() => handleAbilityButtonClick(ability)} // Call specific handler
                disabled={isButtonDisabled} // Use combined disabled state
                className={`absolute w-10 h-10 ${baseBgColor} rounded-full flex items-center justify-center text-white text-opacity-90 text-lg font-bold shadow-md transition-all duration-150 focus:outline-none disabled:cursor-not-allowed border-2 ${borderStyle}`}
                style={{
                  transform: `translate(${x}px, ${y}px) translate(-50%, -50%)`,
                  top: '0px',
                  left: '0px'
                }}
                title={`${ability.charAt(0).toUpperCase() + ability.slice(1)} (Cost: ${abilityCost} HP) - ${isButtonDisabled ? 'Unavailable' : 'Available'}`}
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
