import React from 'react';
import { GameAbility } from '../../types/game'; // Assuming types are defined here

interface AbilitySelectorProps {
  availableAbilities: GameAbility[]; // List of abilities player *could* use
  usedAbilities: GameAbility['id'][]; // List of ability IDs already used this match
  currentHp: number;
  onSelectAbility: (abilityId: GameAbility['id']) => void; // Callback when an ability button is clicked
  maxAbilityUses: number; // e.g., 3
}

const AbilitySelector: React.FC<AbilitySelectorProps> = ({
  availableAbilities,
  usedAbilities,
  currentHp,
  onSelectAbility,
  maxAbilityUses
}) => {
  const remainingUses = maxAbilityUses - usedAbilities.length;

  return (
    <div className="bg-purple-800/70 p-4 rounded shadow-lg text-white">
      <p className="text-center font-bold mb-2">Abilities ({remainingUses} uses left)</p>
      <div className="grid grid-cols-3 gap-2">
        {availableAbilities.map((ability) => {
          const isUsed = usedAbilities.includes(ability.id);
          const canAfford = currentHp >= ability.hpCost;
          const isDisabled = isUsed || !canAfford || remainingUses <= 0;

          return (
            <button
              key={ability.id}
              onClick={() => !isDisabled && onSelectAbility(ability.id)}
              className={`px-2 py-1 border rounded text-xs font-semibold transition-colors 
                ${isDisabled 
                  ? 'bg-gray-600 text-gray-400 cursor-not-allowed' 
                  : 'bg-purple-600 hover:bg-purple-700 border-purple-400'}
                ${isUsed ? 'line-through' : ''}
              `}
              title={`${ability.name} - Cost: ${ability.hpCost} HP. ${ability.description}${isUsed ? ' (Used)' : !canAfford ? ' (Cannot Afford)' : remainingUses <= 0 ? ' (No uses left)' : ''}`}
              disabled={isDisabled}
            >
              {ability.name} ({ability.hpCost} HP)
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default AbilitySelector; 