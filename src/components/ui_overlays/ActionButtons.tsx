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
  maxAbilityUsesTotal: number;
  maxAbilityUsesPerType: number;
  disabled: boolean; // General disabled state (e.g., not player's turn)
}

// Removed unused AbilityIcon component
// const AbilityIcon: React.FC<{ ability: AbilityType }> = ({ ability }) => {
//   // ... icon logic ...
// };

const ActionButtons: React.FC<ActionButtonsProps> = (props) => {
  const {
    onFire,
    selectedAbility,
    onAbilitySelect,
    usedAbilities,
    currentHp,
    abilityCost,
    maxAbilityUsesTotal,
    maxAbilityUsesPerType,
    disabled,
  } = props;

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
          // Calculate if used max times for this specific type
          const abilitiesOfTypeUsed = Array.from(usedAbilities).filter(used => used === ability).length;
          const isUsedMaxPerType = abilitiesOfTypeUsed >= maxAbilityUsesPerType;
          // Calculate if max total abilities have been used
          const isUsedMaxTotal = usedAbilities.size >= maxAbilityUsesTotal;
          // Check HP
          const hasEnoughHp = currentHp >= abilityCost;
          // Determine final disabled state
          const isButtonDisabled = disabled || isUsedMaxPerType || isUsedMaxTotal || !hasEnoughHp;
          const isSelected = selectedAbility === ability;

          let baseBgColor = 'bg-purple-600 hover:bg-purple-700 bg-opacity-75';
          let borderStyle = 'border-transparent';

          if (isSelected) { borderStyle = 'border-yellow-400 border-opacity-75'; }
          if (isButtonDisabled) {
              baseBgColor = 'bg-gray-600 opacity-60';
              borderStyle = 'border-transparent';
          }

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
              title={`${ability.charAt(0).toUpperCase() + ability.slice(1)} (Cost: ${abilityCost} HP) - Used ${abilitiesOfTypeUsed}/${maxAbilityUsesPerType} times (Total: ${usedAbilities.size}/${maxAbilityUsesTotal}) - ${isButtonDisabled ? 'Unavailable' : 'Available'}`}
            >
              {/* <AbilityIcon ability={ability} /> */}
              <span className="text-xs">{ability.slice(0,3)}</span> {/* TEMP: Show text */}
            </button>
          );
        })}
      </div>

    </div> // Closing tag for the main relative container
  );
};

export default ActionButtons;
