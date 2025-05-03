'use strict';
import { useEffect, useCallback, useRef } from 'react';
import { AbilityType } from '../components/ui_overlays/ActionButtons';

interface UseKeyboardControlsProps {
    isActive: boolean; // Only listen if true (e.g., game is active, not in menu)
    currentAngle: number;
    currentPower: number;
    handleAimChange: (aim: { angle: number; power: number }) => void;
    handleFire: () => void;
    handleSelectAbility: (abilityType: AbilityType) => void;
}

export function useKeyboardControls({
    isActive,
    currentAngle,
    currentPower,
    handleAimChange,
    handleFire,
    handleSelectAbility,
}: UseKeyboardControlsProps) {

    // Refs to hold the latest state values
    const angleRef = useRef(currentAngle);
    const powerRef = useRef(currentPower);

    // Effect to keep refs updated
    useEffect(() => {
        angleRef.current = currentAngle;
    }, [currentAngle]);

    useEffect(() => {
        powerRef.current = currentPower;
    }, [currentPower]);
    
    const handleKeyDown = useCallback((event: KeyboardEvent) => {
        if (!isActive) return; // Ignore if not active

        // Read current values from refs
        const angle = angleRef.current;
        const power = powerRef.current;

        let newAngle: number | undefined = undefined;
        let newPower: number | undefined = undefined;
        let preventDefault = false;

        // Controls
        switch (event.key) {
            case 'ArrowLeft': // Angle LEFT
                newAngle = (angle - 5 + 360) % 360; // Use ref value
                preventDefault = true;
                break;
            case 'ArrowRight': // Angle RIGHT
                newAngle = (angle + 5) % 360; // Use ref value
                preventDefault = true;
                break;
            case 'ArrowDown': // Power DOWN
                newPower = Math.max(0, power - 5); // Use ref value
                preventDefault = true;
                break;
            case 'ArrowUp': // Power UP
                newPower = Math.min(100, power + 5); // Use ref value
                preventDefault = true;
                break;
            case ' ': // Spacebar for Fire
                preventDefault = true; // Prevent page scroll
                handleFire();
                break;
            case '1': handleSelectAbility('splitter'); break; 
            case '2': handleSelectAbility('gravity'); break; 
            case '3': handleSelectAbility('plastic'); break; 
            default:
                break;
        }

        if (preventDefault) {
            event.preventDefault();
        }

        // If angle or power changed, call the aim change handler
        if (newAngle !== undefined || newPower !== undefined) {
            const updatedAim = {
                angle: newAngle !== undefined ? newAngle : angle, // Use ref value as fallback
                power: newPower !== undefined ? newPower : power, // Use ref value as fallback
            };
            handleAimChange(updatedAim);
        }
        // Removed currentAngle and currentPower from dependencies
    }, [isActive, handleAimChange, handleFire, handleSelectAbility]);

    useEffect(() => {
        if (isActive) {
            window.addEventListener('keydown', handleKeyDown);
        } else {
            window.removeEventListener('keydown', handleKeyDown);
        }
        // Cleanup listener when isActive changes or component unmounts
        return () => {
            window.removeEventListener('keydown', handleKeyDown);
        };
    }, [isActive, handleKeyDown]); // Depend on isActive and the memoized handler
} 