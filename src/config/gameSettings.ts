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
    // Orange Planet Settings (May vary per profile)
    NUM_ORANGE_PLANETS: number;
    ORANGE_PLANET_MAX_RADIUS: number;
    ORANGE_PLANET_CORE_RADIUS_FACTOR: number;
    ORANGE_PLANET_REPULSION_CONSTANT: number;
    ORANGE_PLANET_MIN_SPAWN_DIST_FACTOR: number;
    // Available Abilities
    AVAILABLE_ABILITIES: AbilityType[];
}

// --- Base Physics and Core Rules ---
// Shared fundamental physics, sizes, core rules
const basePhysicsAndCore = {
    // Virtual World Dimensions
    VIRTUAL_WIDTH: 2400,
    VIRTUAL_HEIGHT: 1200,
    // Object Sizes
    SHIP_RADIUS: 63,
    STANDARD_PROJECTILE_RADIUS: 5,
    SPLITTER_FRAGMENT_RADIUS: 3,
    // Physics Parameters (Core)
    GRAVITY_CONSTANT: 0.35,
    GRAVITY_AOE_BONUS_FACTOR: 0.2,
    DEFAULT_FRICTION_AIR: 0.002,
    // Ability-Specific Physics
    PLASTIC_GRAVITY_FACTOR: 0.85,
    PLASTIC_FRICTION_AIR: 0.004,
    SHIP_GRAVITY_RANGE_FACTOR: 4,
    SHIP_GRAVITY_CONSTANT: 0.4,
    GRAVITY_FRICTION_AIR: 0.005,
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
    INITIAL_VIEW_WIDTH_FACTOR: 0.8,
    INITIAL_VIEW_HEIGHT_FACTOR: 0.8,
    SHIP_ZONE_WIDTH_FACTOR: 0.1,
    PLANET_SPAWN_AREA_FACTOR: 0.9,
    // Minimum Distance Constraints
    MIN_SHIP_SEPARATION_FACTOR: 0.97,
    MIN_PLANET_SHIP_DISTANCE: 150,
    MIN_PLANET_PLANET_DISTANCE: 75,
    // Orange Planet Settings
    NUM_ORANGE_PLANETS: 2,
    ORANGE_PLANET_MAX_RADIUS: 160,
    ORANGE_PLANET_CORE_RADIUS_FACTOR: 0.3,
    ORANGE_PLANET_REPULSION_CONSTANT: 1.6,
    ORANGE_PLANET_MIN_SPAWN_DIST_FACTOR: 0.8,
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
    INITIAL_VIEW_WIDTH_FACTOR: 0.8,
    INITIAL_VIEW_HEIGHT_FACTOR: 0.8,
    SHIP_ZONE_WIDTH_FACTOR: 0.1,
    PLANET_SPAWN_AREA_FACTOR: 0.9,
    MIN_SHIP_SEPARATION_FACTOR: 0.97,
    MIN_PLANET_SHIP_DISTANCE: 150,
    MIN_PLANET_PLANET_DISTANCE: 75,
    NUM_ORANGE_PLANETS: 2,
    ORANGE_PLANET_MAX_RADIUS: 160,
    ORANGE_PLANET_CORE_RADIUS_FACTOR: 0.3,
    ORANGE_PLANET_REPULSION_CONSTANT: 1.6,
    ORANGE_PLANET_MIN_SPAWN_DIST_FACTOR: 0.8,
    // Sandbox-specific rules (unlimited/high values for testing)
    MAX_ROUNDS: 999,
    MAX_ABILITIES_TOTAL: 999,
    MAX_ABILITIES_PER_TYPE: 99,
};

// Removed old settings objects (baseSettings, mainSettings, defaultCustomSettings)
// Removed standalone constants at the bottom 