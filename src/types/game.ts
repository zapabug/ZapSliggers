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

// Define the structure for game action events sent over Nostr (Kind 30079)
// We'll use a single event type for simplicity in turn-based sync
export interface GameActionEvent {
    type: 'game_action'; // Consolidated type
    matchId: string;
    senderPubkey: string;
    turnIndex: 0 | 1; // Index of the player WHOSE turn it was
    action: {
        type: 'fire';
        aim: { angle: number; power: number };
        ability: AbilityType | null; // Keep AbilityType if serializable, else string
        // shotId?: string; // Optional: if needed for reconciling specific shots
    } | {
        type: 'sync_request'; // Future: For requesting state sync
    } | {
        type: 'state_update'; // Future: For sending full state snapshots
        // state: GameState; // TBD
    };
    // Consider adding a sequence number if event ordering becomes critical
    // sequence?: number;
}

// Define the structure for sending the resolved path data (Optional - keep for potential debug/resync)
export interface ShotResolvedEvent {
    type: 'shotResolved';
    matchId: string; // Include matchId for filtering
    senderPubkey: string;
    path: ProjectilePathData;
    turnIndex: 0 | 1; // Add turn index here too if sending this
    // shotId: string; // Include if added to FireActionEvent
}

// Union type for Nostr game events (Kind 30079)
// export type GameNostrEventContent = FireActionEvent | ShotResolvedEvent; // Old union
export type GameNostrEventContent = GameActionEvent | ShotResolvedEvent; // New union using GameActionEvent

// Export PlayerState
export interface PlayerState {
    hp: number;
    usedAbilities: Set<AbilityType>; // Use imported type
    isVulnerable: boolean;
}

// Add other game-related types here as needed
// e.g., Player, GameState, Level, Move 

export interface AimState {
    angle: number;
    power: number;
}

// Add GameEndResult type
export type GameEndResult = {
    winnerIndex: 0 | 1 | null; // 0 for player 1, 1 for player 2, null for draw/tie
    finalScore: [number, number]; // Final round scores [P1, P2]
    reason: 'score' | 'hp_tiebreaker' | 'opponent_left' | 'error'; // Reason for game end
}; 