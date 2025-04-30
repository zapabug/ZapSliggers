import React from 'react';

// Define known ability types based on refined mechanics
export type AbilityType = 'splitter' | 'gravity' | 'plastic' | 'splitter_fragment';

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
  // Note: No icon needed for 'splitter_fragment' as it's not selectable
  switch (ability) {
    case 'splitter':
      return <span className="text-xs">🔱</span>; // Placeholder for Splitter
    case 'gravity':
      return <span className="text-xs">🧲</span>; // Placeholder for Gravity Pull
    case 'plastic':
      return <span className="text-xs">🪁</span>; // Placeholder for Plastic (Low Gravity)
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

  // Selectable abilities available to the player
  const availableAbilities: AbilityType[] = ['splitter', 'gravity', 'plastic'];

  // Define specific angles for each selectable ability button
  const abilityAngles: { [key in 'splitter' | 'gravity' | 'plastic']: number } = {
    splitter: -100,
    gravity: -45,
    plastic: 10,
  };

  const radius = 50; // Increased from 40 to give more space

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
    // Main container - Relative, full size to act as positioning context for children
    <div className="relative w-full h-full">

      {/* Fire Button - Positioned absolutely in the bottom-right corner */}
      <button
        onClick={handleFireClick}
        disabled={disabled}
        className={`absolute bottom-1 right-1 z-20 px-5 py-2 bg-red-600 hover:bg-red-700 text-white font-bold rounded-lg shadow-lg transition-colors duration-150 focus:outline-none select-none bg-opacity-75 text-opacity-90 ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
      >
        {'Fire!'}
      </button>

      {/* Ability Buttons Origin - Positioned absolutely, offset from the corner */}
      <div className="absolute bottom-8 right-16 z-10 w-0 h-0">
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

          // Assert the type when indexing abilityAngles
          const angleDegrees = abilityAngles[ability as 'splitter' | 'gravity' | 'plastic'];
          const angleRadians = angleDegrees * (Math.PI / 180);
          const x = radius * Math.sin(angleRadians);
          const y = -radius * Math.cos(angleRadians);

          return (
            <button
              key={ability}
              onClick={() => handleAbilityButtonClick(ability)}
              disabled={isButtonDisabled}
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

    </div> // Closing tag for the main relative container
  );
};

export default ActionButtons;
