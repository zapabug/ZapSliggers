/**
 * Centralized configuration settings for the Klunkstr game.
 * Defines different profiles for various game modes.
 */

import { AbilityType } from '../components/ui_overlays/ActionButtons'; // Import AbilityType

// --- Settings Interface ---
// Defines the shape of a settings profile
export interface GameSettingsProfile {
    // Virtual World Dimensions
    VIRTUAL_WIDTH: number;
    VIRTUAL_HEIGHT: number;
    // Object Sizes
    SHIP_RADIUS: number;
    PLANET_MIN_RADIUS: number;
    PLANET_MAX_RADIUS: number;
    STANDARD_PROJECTILE_RADIUS: number;
    SPLITTER_FRAGMENT_RADIUS: number;
    // Level Generation Parameters
    NUM_PLANETS: number;
    // Placement Zone Factors
    INITIAL_VIEW_WIDTH_FACTOR: number;
    INITIAL_VIEW_HEIGHT_FACTOR: number;
    SHIP_ZONE_WIDTH_FACTOR: number;
    PLANET_SPAWN_AREA_FACTOR: number;
    // Minimum Distance Constraints
    MIN_SHIP_SEPARATION_FACTOR: number;
    MIN_PLANET_SHIP_DISTANCE: number;
    MIN_PLANET_PLANET_DISTANCE: number;
    // Physics Parameters
    GRAVITY_CONSTANT: number;
    GRAVITY_AOE_BONUS_FACTOR: number;
    DEFAULT_FRICTION_AIR: number;
    // Ability-Specific Physics
    PLASTIC_GRAVITY_FACTOR: number;
    PLASTIC_FRICTION_AIR: number;
    SHIP_GRAVITY_RANGE_FACTOR: number;
    SHIP_GRAVITY_CONSTANT: number;
    GRAVITY_FRICTION_AIR: number;
    // Gameplay Rules & Limits
    ABILITY_COST_HP: number;
    MAX_ABILITIES_TOTAL: number;
    MAX_ABILITIES_PER_TYPE: number;
    // Add Max HP
    MAX_HP: number;
    // Add Max Rounds
    MAX_ROUNDS: number;
    // --- New Orange Planet Settings ---
    NUM_ORANGE_PLANETS: number;
    ORANGE_PLANET_MAX_RADIUS: number;
    ORANGE_PLANET_CORE_RADIUS_FACTOR: number;
    ORANGE_PLANET_REPULSION_CONSTANT: number;
    ORANGE_PLANET_MIN_SPAWN_DIST_FACTOR: number;
    // Add other settings as needed (e.g., round time, shot limit)
    // --- New Available Abilities Setting ---
    AVAILABLE_ABILITIES: AbilityType[];
}

// --- Base Settings (Common values) ---
const baseSettings: Omit<GameSettingsProfile, 'comments'> = {
    // Virtual World Dimensions
    VIRTUAL_WIDTH: 2400,
    VIRTUAL_HEIGHT: 1200,
    // Object Sizes
    SHIP_RADIUS: 63,
    PLANET_MIN_RADIUS: 100,
    PLANET_MAX_RADIUS: 300,
    STANDARD_PROJECTILE_RADIUS: 5,
    SPLITTER_FRAGMENT_RADIUS: 3,
    // Level Generation Parameters
    NUM_PLANETS: 4,
    // Placement Zone Factors
    INITIAL_VIEW_WIDTH_FACTOR: 0.8,
    INITIAL_VIEW_HEIGHT_FACTOR: 0.8,
    SHIP_ZONE_WIDTH_FACTOR: 0.1,
    PLANET_SPAWN_AREA_FACTOR: 0.9,
    // Minimum Distance Constraints
    MIN_SHIP_SEPARATION_FACTOR: 0.97,
    MIN_PLANET_SHIP_DISTANCE: 150,
    MIN_PLANET_PLANET_DISTANCE: 75,
    // Physics Parameters
    GRAVITY_CONSTANT: 0.35,
    GRAVITY_AOE_BONUS_FACTOR: 0.2,
    DEFAULT_FRICTION_AIR: 0.002,
    // Ability-Specific Physics
    PLASTIC_GRAVITY_FACTOR: 0.85,
    PLASTIC_FRICTION_AIR: 0.004,
    SHIP_GRAVITY_RANGE_FACTOR: 4,
    SHIP_GRAVITY_CONSTANT: 0.4,
    GRAVITY_FRICTION_AIR: 0.005,
    // Gameplay Rules & Limits
    ABILITY_COST_HP: 25,
    MAX_ABILITIES_TOTAL: 3,
    MAX_ABILITIES_PER_TYPE: 1,
    // Add Max HP value
    MAX_HP: 100,
    // Add Max Rounds (default for main game)
    MAX_ROUNDS: 5,
    // --- New Orange Planet Settings ---
    NUM_ORANGE_PLANETS: 2, // Start with 1 for testing
    ORANGE_PLANET_MAX_RADIUS: 160, // Set max radius for orange
    ORANGE_PLANET_CORE_RADIUS_FACTOR: 0.3, // Core is 30% of radius
    ORANGE_PLANET_REPULSION_CONSTANT: 1.6, // Repulsion strength (tune as needed)
    ORANGE_PLANET_MIN_SPAWN_DIST_FACTOR: 0.8, // Must spawn outside inner 80% radius
    // --- New Available Abilities Setting ---
    AVAILABLE_ABILITIES: ['splitter', 'gravity', 'plastic'],
};

// --- Main Settings Profile ---
// Used for standard multiplayer games
export const mainSettings: GameSettingsProfile = {
    ...baseSettings,
    // No overrides needed for main regarding MAX_ROUNDS
};

// --- Practice Settings Profile ---
// Used for the practice screen
export const practiceSettings: GameSettingsProfile = {
    ...baseSettings,
    // Override Max Rounds for practice
    MAX_ROUNDS: 3,
    // Example override for practice:
    // MAX_ABILITIES_TOTAL: 999, // Allow more ability uses in practice
    // NUM_PLANETS: 1, // Fewer planets for easier practice
};

// --- Default Custom Settings Profile ---
// Starting point for the 'free for all' custom game screen
export const defaultCustomSettings: GameSettingsProfile = {
    ...baseSettings,
    // Add any custom-specific defaults here
};

// --- Virtual World Dimensions ---
export const VIRTUAL_WIDTH = 2400;
export const VIRTUAL_HEIGHT = 1200;

// --- Object Sizes ---
export const SHIP_RADIUS = 63; // Radius for player ships (used in generation and physics)
export const PLANET_MIN_RADIUS = 120; // Minimum radius for generated planets
export const PLANET_MAX_RADIUS = 350; // Maximum radius for generated planets

// --- Level Generation Parameters ---
export const NUM_PLANETS = 4; // Default number of planets per level

// --- Placement Zone Factors (Relative to Initial View Area) ---
// Initial view area is the central portion of the virtual space players initially see.
export const INITIAL_VIEW_WIDTH_FACTOR = 0.75; // How much of VIRTUAL_WIDTH is the initial view (e.g., 0.75 = central 75%)
export const INITIAL_VIEW_HEIGHT_FACTOR = 0.75; // How much of VIRTUAL_HEIGHT is the initial view (e.g., 0.75 = central 75%)
export const SHIP_ZONE_WIDTH_FACTOR = 0.1; // Width of ship spawn zones as factor of initial view width (e.g., 0.1 = outer 10% on each side)
export const PLANET_SPAWN_AREA_FACTOR = 0.9; // Size of planet spawn area as factor of initial view size (e.g., 0.9 = central 90%)

// --- Minimum Distance Constraints ---
export const MIN_SHIP_SEPARATION_FACTOR = 0.9; // Min ship separation as factor of initial view width
export const MIN_PLANET_SHIP_DISTANCE = 120; // Min clearance between planet edge and ship edge
export const MIN_PLANET_PLANET_DISTANCE = 50; // Min clearance between planet edges

// --- Physics Parameters ---
export const GRAVITY_CONSTANT = 0.35; // Base strength of planetary gravity
export const GRAVITY_AOE_BONUS_FACTOR = 0.2; // How much planet size increases its effective gravity range
export const DEFAULT_FRICTION_AIR = 0.002; // Default air drag for projectiles

// --- Ability-Specific Physics ---
// Plastic
export const PLASTIC_GRAVITY_FACTOR = 0.85; // Multiplier reducing gravity effect on Plastic projectiles
export const PLASTIC_FRICTION_AIR = 0.008; // Increased air drag for Plastic projectiles
// Gravity
export const SHIP_GRAVITY_RANGE_FACTOR = 4; // Range of opponent ship pull = SHIP_RADIUS * this factor
export const SHIP_GRAVITY_CONSTANT = 0.3; // Strength of opponent ship pull on Gravity projectiles
export const GRAVITY_FRICTION_AIR = 0.005; // Air drag for Gravity projectiles
// Splitter (uses DEFAULT_FRICTION_AIR for fragments)

// --- Projectile Sizes ---
export const STANDARD_PROJECTILE_RADIUS = 5;
export const SPLITTER_FRAGMENT_RADIUS = 3;

// --- Gameplay Rules & Limits ---
export const ABILITY_COST_HP = 25;
export const MAX_ABILITIES_TOTAL = 3; // Max total abilities used per player per match
export const MAX_ABILITIES_PER_TYPE = 1; // Max uses of a specific ability type per player per match

// --- Potentially move other constants here later if needed ---
// e.g., Gameplay rules 