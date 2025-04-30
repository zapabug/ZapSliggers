import React from 'react';
import { HealthBar } from './HealthBar'; // Assuming HealthBar takes hp and maxHp

interface HpDisplayProps {
  hp: number;
  maxHp: number;
  // Potentially add player name or identifier
}

const HpDisplay: React.FC<HpDisplayProps> = ({ hp, maxHp }) => {
  return (
    <div className="text-white">
      <span className="font-semibold">{hp} / {maxHp} HP</span>
      <HealthBar currentHp={hp} maxHp={maxHp} />
    </div>
  );
};

export default HpDisplay; 