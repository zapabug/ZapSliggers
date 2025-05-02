// import Matter from 'matter-js'; // Removed unused import
import { AbilityType } from '../components/ui_overlays/ActionButtons'; // Import AbilityType

export interface GameAbility {
  id: string; // e.g., 'diamond_tip', 'triple_shot'
  name: string;
  description: string;
  hpCost: number;
}

// Type for a point in a projectile's path
export interface PathPoint {
    x: number;
    y: number;
}

// Type for the full path data
export type ProjectilePathData = PathPoint[];

// Define the structure for game action events sent over Nostr
// Keeping 'fire' separate from 'shotResolved' for clarity
export interface FireActionEvent {
    type: 'fire';
    matchId: string; // Include matchId for filtering
    senderPubkey: string;
    aim: { angle: number; power: number };
    ability: string | null; // Use string representation if AbilityType is complex
    // shotId: string; // Consider adding a unique ID per shot if needed later
}

// Define the structure for sending the resolved path data
export interface ShotResolvedEvent {
    type: 'shotResolved';
    matchId: string; // Include matchId for filtering
    senderPubkey: string;
    path: ProjectilePathData;
    // shotId: string; // Include if added to FireActionEvent
}

// Union type for Nostr game events (Kind 30079)
export type GameNostrEventContent = FireActionEvent | ShotResolvedEvent;

// Export PlayerState
export interface PlayerState {
    hp: number;
    usedAbilities: Set<AbilityType>; // Use imported type
    isVulnerable: boolean;
}

// Add other game-related types here as needed
// e.g., Player, GameState, Level, Move 