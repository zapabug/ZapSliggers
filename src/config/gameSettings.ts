/**
 * Centralized configuration settings for the Zapsliggers game.
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
    // Level Generation Parameters (May vary per profile)
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
    // Physics Parameters (Core)
    GRAVITY_CONSTANT: number;
    GRAVITY_AOE_BONUS_FACTOR: number;
    DEFAULT_FRICTION_AIR: number;
    // Ability-Specific Physics
    PLASTIC_GRAVITY_FACTOR: number;
    PLASTIC_FRICTION_AIR: number;
    SHIP_GRAVITY_RANGE_FACTOR: number;
    SHIP_GRAVITY_CONSTANT: number;
    GRAVITY_FRICTION_AIR: number;
    // Gameplay Rules & Limits (May vary per profile)
    ABILITY_COST_HP: number;
    MAX_ABILITIES_TOTAL: number;
    MAX_ABILITIES_PER_TYPE: number;
    MAX_HP: number;
    MAX_ROUNDS: number;
    // Sligger Settings (May vary per profile)
    NUM_SLIGGERS: number;
    SLIGGER_MAX_RADIUS: number;               // Specific max size for Sliggers
    SLIGGER_CORE_RADIUS_FACTOR: number;       // Factor of radius to determine repulsive core size
    SLIGGER_REPULSION_CONSTANT: number;       // Deprecated? Keep if used, maybe phase out? Check physics code later.
    SLIGGER_MIN_SPAWN_DIST_FACTOR: number;    // Minimum distance factor from edge for Sliggers (if different)
    SLIGGER_ATTRACTION_FACTOR: number;        // Multiplier for base gravity strength outside core
    SLIGGER_REPULSION_FACTOR: number;         // Multiplier applied to base attraction to get repulsion strength inside core
    SLIGGER_BORDER_PADDING: number;           // Min distance from virtual border and initial view edge for Sliggers
    // Available Abilities
    AVAILABLE_ABILITIES: AbilityType[];
}

// --- Base Physics and Core Rules ---
// Shared fundamental physics, sizes, core rules
const basePhysicsAndCore = {
    // Virtual World Dimensions
    VIRTUAL_WIDTH: 2600,
    VIRTUAL_HEIGHT: 1800,
    // Object Sizes
    SHIP_RADIUS: 63,
    STANDARD_PROJECTILE_RADIUS: 10,
    SPLITTER_FRAGMENT_RADIUS: 5,
    // Physics Parameters (Core)
    GRAVITY_CONSTANT: 0.5,
    GRAVITY_AOE_BONUS_FACTOR: 0.3,
    DEFAULT_FRICTION_AIR: 0.002,
    // Ability-Specific Physics
    PLASTIC_GRAVITY_FACTOR: 0.85,
    PLASTIC_FRICTION_AIR: 0.0025,
    SHIP_GRAVITY_RANGE_FACTOR: 4,
    SHIP_GRAVITY_CONSTANT: 0.4,
    GRAVITY_FRICTION_AIR: 0.0025,
    // Core Gameplay Rules
    ABILITY_COST_HP: 25,
    MAX_HP: 100,
    AVAILABLE_ABILITIES: ['splitter', 'gravity', 'plastic'] as AbilityType[],
};

// --- Standard Level Generation Parameters ---
// Used for practice and standard multiplayer games
const standardLevelGeneration = {
    // Planet Sizes
    PLANET_MIN_RADIUS: 100,
    PLANET_MAX_RADIUS: 300,
    // Level Generation Parameters
    NUM_PLANETS: 4,
    // Placement Zone Factors
    INITIAL_VIEW_WIDTH_FACTOR: 0.85,
    INITIAL_VIEW_HEIGHT_FACTOR: 0.85,
    SHIP_ZONE_WIDTH_FACTOR: 0.1,
    PLANET_SPAWN_AREA_FACTOR: 0.9,
    // Minimum Distance Constraints
    MIN_SHIP_SEPARATION_FACTOR: 0.97,
    MIN_PLANET_SHIP_DISTANCE: 150,
    MIN_PLANET_PLANET_DISTANCE: 75,
    // Sligger Settings
    NUM_SLIGGERS: 2,                      // How many Sliggers to spawn
    SLIGGER_MAX_RADIUS: 160,              // Max size for Sliggers
    SLIGGER_CORE_RADIUS_FACTOR: 0.3,      // Core is 30% of the Sligger's radius
    SLIGGER_REPULSION_CONSTANT: 1.6,      // Deprecated?
    SLIGGER_MIN_SPAWN_DIST_FACTOR: 0.8,   // Min distance factor from edge
    SLIGGER_ATTRACTION_FACTOR: 1,         // Default: Same attraction as normal planets
    SLIGGER_REPULSION_FACTOR: 3,          // Default: 3x attraction force as repulsion
    SLIGGER_BORDER_PADDING: 75,           // Default padding from virtual border and initial view edge
};


// --- Practice Settings Profile ---
// Uses standard generation, limited rounds
export const practiceSettings: GameSettingsProfile = {
    ...basePhysicsAndCore,
    ...standardLevelGeneration,
    // Practice-specific rules
    NUM_SLIGGERS: 0, // Override: No Sliggers in practice mode
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
    INITIAL_VIEW_WIDTH_FACTOR: 0.8,
    INITIAL_VIEW_HEIGHT_FACTOR: 0.8,
    SHIP_ZONE_WIDTH_FACTOR: 0.1,
    PLANET_SPAWN_AREA_FACTOR: 0.9,
    MIN_SHIP_SEPARATION_FACTOR: 0.97,
    MIN_PLANET_SHIP_DISTANCE: 150,
    MIN_PLANET_PLANET_DISTANCE: 75,
    // Sligger Settings
    NUM_SLIGGERS: 2,                      // Explicitly include for sandbox tuning
    SLIGGER_MAX_RADIUS: 160,              // Explicitly include for sandbox tuning
    SLIGGER_CORE_RADIUS_FACTOR: 0.3,      // Explicitly include for sandbox tuning
    SLIGGER_REPULSION_CONSTANT: 1.6,      // Deprecated? Explicitly include for sandbox tuning
    SLIGGER_MIN_SPAWN_DIST_FACTOR: 0.8,   // Explicitly include for sandbox tuning
    SLIGGER_ATTRACTION_FACTOR: 1,         // Explicitly include for sandbox tuning
    SLIGGER_REPULSION_FACTOR: 3,          // Explicitly include for sandbox tuning
    SLIGGER_BORDER_PADDING: 75,           // Explicitly include for sandbox tuning (match default or set specific)
    // Sandbox-specific rules (unlimited/high values for testing)
    MAX_ROUNDS: 999,
    MAX_ABILITIES_TOTAL: 999,
    MAX_ABILITIES_PER_TYPE: 99,
};

// Removed old settings objects (baseSettings, mainSettings, defaultCustomSettings)
// Removed standalone constants at the bottom 