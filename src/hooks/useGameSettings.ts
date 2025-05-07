import { useMemo } from 'react';
import { gameSettings, GameSettingsProfile } from '../config/gameSettings';

export const useGameSettings = (): GameSettingsProfile => {
    // For now, just return the default game settings
    // In the future, this could be extended to support different game modes
    // or dynamic settings based on game state
    return useMemo(() => gameSettings, []);
}; 