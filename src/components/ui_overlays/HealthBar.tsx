import React from 'react';

interface HealthBarProps {
    currentHp: number;
    maxHp: number;
}

export function HealthBar({ currentHp, maxHp }: HealthBarProps) {
    const hpPercentage = maxHp > 0 ? (currentHp / maxHp) * 100 : 0;
    const barColor = hpPercentage > 60 ? 'bg-green-500' : hpPercentage > 30 ? 'bg-yellow-500' : 'bg-red-500';

    return (
        <div className="w-full bg-gray-700 rounded-full h-2.5 overflow-hidden border border-gray-600">
            <div
                className={`h-2.5 rounded-full transition-all duration-300 ease-in-out ${barColor}`}
                style={{ width: `${hpPercentage}%` }}
            ></div>
        </div>
    );
} 