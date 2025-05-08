/**
 * Centralized configuration settings for the Zapslingers game.
 * Defines different profiles for various game modes.
 */

import { AbilityType } from '../components/ui_overlays/ActionButtons'; // Import AbilityType

// --- Settings Interface ---
// Defines the shape of a settings profile
export interface GameSettingsProfile {
    // --- Virtual World Dimensions ---
    VIRTUAL_WIDTH: number;           // Width of the virtual game world (in world units)
    VIRTUAL_HEIGHT: number;          // Height of the virtual game world (in world units)
    // Object Sizes
    SHIP_RADIUS: number;             // Radius of each player's ship
    PLANET_MIN_RADIUS: number;       // Minimum radius for generated planets
    PLANET_MAX_RADIUS: number;       // Maximum radius for generated planets
    STANDARD_PROJECTILE_RADIUS: number; // Radius of standard projectiles
    SPLITTER_FRAGMENT_RADIUS: number;   // Radius of splitter ability fragments
    // Level Generation Parameters (May vary per profile)
    NUM_PLANETS: number;             // Number of planets to generate in the level
    // Placement Zone Factors
    GAME_VIEW_WIDTH_FACTOR: number;      // Fraction of the world width visible in the camera view
    GAME_VIEW_HEIGHT_FACTOR: number;     // Fraction of the world height visible in the camera view
    SHIP_ZONE_WIDTH_FACTOR: number;      // Fraction of the world width reserved for initial ship placement
    PLANET_SPAWN_AREA_FACTOR: number;    // Fraction of the world area where planets can spawn
    // Minimum Distance Constraints
    MIN_SHIP_SEPARATION_FACTOR: number;  // Minimum allowed distance between ships (as a fraction of world width)
    MIN_PLANET_SHIP_DISTANCE: number;    // Minimum allowed distance between any planet and any ship
    MIN_PLANET_PLANET_DISTANCE: number;  // Minimum allowed distance between any two planets
    // Physics Parameters (Core)
    GRAVITY_CONSTANT: number;            // Base gravity constant for planet attraction
    GRAVITY_AOE_BONUS_FACTOR: number;    // Bonus factor for gravity area-of-effect (scales with planet size)
    DEFAULT_FRICTION_AIR: number;        // Default air friction for all moving bodies
    // Ability-Specific Physics
    PLASTIC_GRAVITY_FACTOR: number;      // Multiplier for gravity when plastic ability is active
    PLASTIC_FRICTION_AIR: number;        // Air friction for projectiles with plastic ability
    SHIP_GRAVITY_RANGE_FACTOR: number;   // Multiplier for how far ship gravity ability reaches (in ship radii)
    SHIP_GRAVITY_CONSTANT: number;       // Gravity constant for ship gravity ability
    GRAVITY_FRICTION_AIR: number;        // Air friction for projectiles with gravity ability
    // Gameplay Rules & Limits (May vary per profile)
    ABILITY_COST_HP: number;             // HP cost to use an ability
    MAX_ABILITIES_TOTAL: number;         // Max total ability uses per player per match
    MAX_ABILITIES_PER_TYPE: number;      // Max uses per ability type per player per match
    MAX_HP: number;                      // Maximum HP for each player
    MAX_ROUNDS: number;                  // Maximum number of rounds per match
    // SLINGGER Settings (May vary per profile)
    NUM_SLINGGERS: number;                // Number of Slinger objects to spawn
    SLINGGER_MAX_RADIUS: number;          // Maximum radius for Slinger objects
    SLINGGER_CORE_RADIUS_FACTOR: number;  // Fraction of Slinger radius that is the repulsive core
    SLINGGER_REPULSION_CONSTANT: number;  // (Deprecated) Repulsion constant for Slinger core (not used)
    SLINGGER_MIN_SPAWN_DIST_FACTOR: number; // Minimum distance from edge for Slinger spawn (as a fraction of world size)
    SLINGGER_ATTRACTION_FACTOR: number;   // Multiplier for Slinger gravity outside the core
    SLINGGER_REPULSION_FACTOR: number;    // Multiplier for Slinger repulsion inside the core
    SLINGGER_BORDER_PADDING: number;      // Minimum distance from world border for Slinger placement
    // SLINGGER Planet Settings
    NUM_SLINGGER_PLANETS: number;            // Number of special Slinger planets to spawn
    SLINGGER_PLANET_MAX_RADIUS: number;      // Maximum radius for Slinger planets
    SLINGGER_PLANET_CORE_RADIUS_FACTOR: number; // Fraction of Slinger planet radius that is the repulsive core
    SLINGGER_PLANET_REPULSION_CONSTANT: number; // Repulsion constant for Slinger planet core
    // Available Abilities
    AVAILABLE_ABILITIES: AbilityType[];      // List of available abilities for players
    // Projectile Physics
    PROJECTILE_SPEED: number;              // Base speed of projectiles
    PROJECTILE_MASS: number;               // Mass of projectiles
    AIM_POWER_RATIO: number; // Multiplier for how much aim power affects projectile speed
}

// --- Base Physics and Core Rules ---
// Shared fundamental physics, sizes, core rules
const basePhysicsAndCore = {
    // Virtual World Dimensions
    VIRTUAL_WIDTH: 3200,
    VIRTUAL_HEIGHT: 1600,
    // Object Sizes
    SHIP_RADIUS: 63,
    STANDARD_PROJECTILE_RADIUS: 12,
    SPLITTER_FRAGMENT_RADIUS: 4,
    // Physics Parameters (Core)
    GRAVITY_CONSTANT: 1,
    GRAVITY_AOE_BONUS_FACTOR: 0.3,
    DEFAULT_FRICTION_AIR: 0.002,
    // Ability-Specific Physics
    PLASTIC_GRAVITY_FACTOR: 0.85,
    PLASTIC_FRICTION_AIR: 0.0025,
    SHIP_GRAVITY_RANGE_FACTOR: 4,
    SHIP_GRAVITY_CONSTANT: 1,
    GRAVITY_FRICTION_AIR: 0.0025,
    // Core Gameplay Rules
    ABILITY_COST_HP: 25,
    MAX_HP: 100,
    AVAILABLE_ABILITIES: ['splitter', 'gravity', 'plastic'] as AbilityType[],
    PROJECTILE_SPEED: 15,                // Default projectile speed
    PROJECTILE_MASS: 5,                    // Default projectile mass
    AIM_POWER_RATIO: 1.5, // Default: each unit of power adds 1.5 to speed
};

// --- Standard Level Generation Parameters ---
// Used for practice and standard multiplayer games
const standardLevelGeneration = {
    // Planet Sizes
    PLANET_MIN_RADIUS: 163,
    PLANET_MAX_RADIUS: 435,
    // Level Generation Parameters
    NUM_PLANETS: 4,
    // Placement Zone Factors
    GAME_VIEW_WIDTH_FACTOR: 1,
    GAME_VIEW_HEIGHT_FACTOR: 1,
    SHIP_ZONE_WIDTH_FACTOR: 0.2,
    PLANET_SPAWN_AREA_FACTOR: 1,
    // Minimum Distance Constraints
    MIN_SHIP_SEPARATION_FACTOR: 0.98,
    MIN_PLANET_SHIP_DISTANCE: 200,
    MIN_PLANET_PLANET_DISTANCE: 150,
    // SLINGGER Settings
    NUM_SLINGGERS: 2,                      // How many SLINGGERs to spawn
    SLINGGER_MAX_RADIUS: 160,              // Max size for SLINGGERs
    SLINGGER_CORE_RADIUS_FACTOR: 0.1,      // Core is 30% of the SLINGGER's radius
    SLINGGER_MIN_SPAWN_DIST_FACTOR: 0.8,   // Min distance factor from edge
    SLINGGER_ATTRACTION_FACTOR: 1,         // Default: Same attraction as normal planets
    SLINGGER_REPULSION_FACTOR: 3,          // Default: 3x attraction force as repulsion
    SLINGGER_BORDER_PADDING: 75,           // Default padding from virtual border and initial view edge
    SLINGGER_REPULSION_CONSTANT: 1.6,      // Base repulsion constant for SLINGGER core
    // SLINGGER Planet Settings
    NUM_SLINGGER_PLANETS: 2,               // Number of SLINGGER planets to spawn
    SLINGGER_PLANET_MAX_RADIUS: 200,       // Max size for SLINGGER planets
    SLINGGER_PLANET_CORE_RADIUS_FACTOR: 0.4, // Core is 40% of the SLINGGER planet's radius
    SLINGGER_PLANET_REPULSION_CONSTANT: 0.5, // Constant for SLINGGER planet repulsion force
};


// --- Practice Settings Profile ---
// Uses standard generation, limited rounds
export const practiceSettings: GameSettingsProfile = {
    ...basePhysicsAndCore,
    ...standardLevelGeneration,
    // Practice-specific rules
    MAX_ROUNDS: 3,
    MAX_ABILITIES_TOTAL: 3,
    MAX_ABILITIES_PER_TYPE: 1,
};

// --- Game Settings Profile ---
// Standard multiplayer game settings, uses standard generation
export const gameSettings: GameSettingsProfile = {
    ...basePhysicsAndCore,
    ...standardLevelGeneration,
    // Standard game rules
    MAX_ROUNDS: 5,
    MAX_ABILITIES_TOTAL: 3,
    MAX_ABILITIES_PER_TYPE: 1,
};

// --- Sandbox Settings Profile ---
// For testing/development, potentially different generation and unlimited rules
export const sandboxSettings: GameSettingsProfile = {
    ...basePhysicsAndCore,
    // Sandbox-specific level generation (initially copied from standard, but independent)
    PLANET_MIN_RADIUS: 100,
    PLANET_MAX_RADIUS: 300,
    NUM_PLANETS: 4,
    GAME_VIEW_WIDTH_FACTOR: 0.8,
    GAME_VIEW_HEIGHT_FACTOR: 0.8,
    SHIP_ZONE_WIDTH_FACTOR: 0.1,
    PLANET_SPAWN_AREA_FACTOR: 1.04,
    MIN_SHIP_SEPARATION_FACTOR: 0.97,
    MIN_PLANET_SHIP_DISTANCE: 150,
    MIN_PLANET_PLANET_DISTANCE: 75,
    // SLINGGER Settings
    NUM_SLINGGERS: 2,                      // Explicitly include for sandbox tuning
    SLINGGER_MAX_RADIUS: 160,              // Explicitly include for sandbox tuning
    SLINGGER_CORE_RADIUS_FACTOR: 0.3,      // Explicitly include for sandbox tuning
    SLINGGER_REPULSION_CONSTANT: 1.6,      // Deprecated? Explicitly include for sandbox tuning
    SLINGGER_MIN_SPAWN_DIST_FACTOR: 0.8,   // Explicitly include for sandbox tuning
    SLINGGER_ATTRACTION_FACTOR: 1,         // Explicitly include for sandbox tuning
    SLINGGER_REPULSION_FACTOR: 3,          // Explicitly include for sandbox tuning
    SLINGGER_BORDER_PADDING: 75,           // Explicitly include for sandbox tuning (match default or set specific)
    // SLINGGER Planet Settings
    NUM_SLINGGER_PLANETS: 2,              // Include SLINGGER planets in sandbox mode
    SLINGGER_PLANET_MAX_RADIUS: 200,      // Max size for SLINGGER planets
    SLINGGER_PLANET_CORE_RADIUS_FACTOR: 0.4, // Core is 40% of the SLINGGER planet's radius
    SLINGGER_PLANET_REPULSION_CONSTANT: 0.5, // Constant for SLINGGER planet repulsion force
    // Sandbox-specific rules (unlimited/high values for testing)
    MAX_ROUNDS: 999,
    MAX_ABILITIES_TOTAL: 999,
    MAX_ABILITIES_PER_TYPE: 99,
};
// Removed old settings objects (baseSettings, mainSettings, defaultCustomSettings)

