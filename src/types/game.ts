export interface GameAbility {
  id: string; // e.g., 'diamond_tip', 'triple_shot'
  name: string;
  description: string;
  hpCost: number;
}

// Add other game-related types here as needed
// e.g., Player, GameState, Level, Move 