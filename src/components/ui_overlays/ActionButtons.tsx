import React from 'react';

// Define known ability types (adjust as needed based on Gameplay.md)
export type AbilityType = 'triple' | 'explosive' | 'lead';

interface ActionButtonsProps {
  onFire: () => void;
  onSelectAbility: (abilityType: AbilityType) => void;
  selectedAbility: AbilityType | null; // Which ability is currently selected
  usedAbilities: Set<AbilityType>; // Which abilities have been used this match
  abilityUsesLeft: number; // How many total uses left (derived)
  currentHp: number; // Current HP for checks
  abilityCost: number; // Cost of abilities
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

const ActionButtons: React.FC<ActionButtonsProps> = ({ 
  onFire, 
  onSelectAbility, 
  selectedAbility, 
  usedAbilities, 
  abilityUsesLeft, 
  currentHp, 
  abilityCost 
}) => {
  // Placeholder: In a real implementation, track used abilities
  const availableAbilities: AbilityType[] = ['triple', 'explosive', 'lead'];

  // Define specific angles for each ability (relative to straight up being 0 deg)
  const abilityAngles: { [key in AbilityType]: number } = {
    triple: -100,    // Left-ish
    explosive: -45,  // Top-left
    lead: 10,      // Top-right-ish (Anchor)
  };

  const radius = 60; // Distance from the Fire button center

  return (
    // Main container remains relative
    <div className="relative flex items-center justify-center w-40 h-28"> 
      {/* Fire Button (Centered, then shifted right) */}
      <button 
        onClick={onFire} 
        className="absolute top-1/2 left-1/2 z-10 px-6 py-3 bg-red-600 hover:bg-red-700 text-white font-bold rounded-lg shadow-lg transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 focus:ring-offset-gray-900"
        // Apply transform to center, then add translateX to shift right
        style={{ transform: 'translate(-50%, -50%) translateX(20px)' }} 
      >
        Fire!
      </button>

      {/* Ability Buttons Origin - Stays Centered */}
      <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-0 h-0">
        {availableAbilities.map((ability) => {
          const isUsed = usedAbilities.has(ability);
          // Check HP cost in addition to other conditions
          const hasEnoughHp = currentHp >= abilityCost;
          const isDisabled = isUsed || abilityUsesLeft <= 0 || !hasEnoughHp;
          const isSelected = selectedAbility === ability;

          // Define base styles
          let baseBgColor = 'bg-purple-600 hover:bg-purple-700';
          let borderStyle = 'border-transparent'; // Default no border

          // Apply styles based on state
          if (isSelected) {
            borderStyle = 'border-yellow-400'; // Highlight selected
          }
          if (isDisabled) {
            baseBgColor = 'bg-gray-600 opacity-50';
            borderStyle = 'border-transparent'; // No border if disabled
          } 

          const angleDegrees = abilityAngles[ability];
          const angleRadians = angleDegrees * (Math.PI / 180);
          const x = radius * Math.sin(angleRadians); 
          const y = -radius * Math.cos(angleRadians);

          return (
            <button
              key={ability}
              onClick={() => onSelectAbility(ability)}
              disabled={isDisabled}
              className={`absolute w-10 h-10 ${baseBgColor} rounded-full flex items-center justify-center text-white text-lg font-bold shadow-md transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 focus:ring-offset-gray-900 disabled:cursor-not-allowed border-2 ${borderStyle}`}
              style={{
                transform: `translate(${x}px, ${y}px) translate(-50%, -50%)`, 
                top: '0px', 
                left: '0px' 
              }}
              title={`${ability.charAt(0).toUpperCase() + ability.slice(1)} Tip (Cost: ${abilityCost} HP, Uses left: ${abilityUsesLeft}, ${isUsed ? 'Used this match' : 'Available'}) - Requires ${abilityCost} HP, Have ${currentHp}`}
            >
              <AbilityIcon ability={ability} />
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default ActionButtons;
