import Matter from 'matter-js';
import { useState, useEffect, useRef, useCallback } from 'react';
import { GameSettingsProfile } from '../config/gameSettings'; // Import the settings profile type
// import { applyStandardGravity, applyGasGiantInnerRepulsion } from './useMatterPhysics'; // Assuming force logic is here or passed in - Temporarily unused

// Destructure Matter.js modules for convenience
const { Bodies, World } = Matter; // World might be needed for World.add

// Constants removed - now passed via settings object

// --- Helper Function ---
const calculateDistance = (p1: { x: number; y: number }, p2: { x: number; y: number }) => {
  return Math.sqrt(Math.pow(p1.x - p2.x, 2) + Math.pow(p1.y - p2.y, 2));
};

// --- Interface for the returned data ---
export interface InitialGamePositions {
  ships: [{ x: number; y: number }, { x: number; y: number }];
  planets: Matter.Body[];
}

// --- Interface for the hook's return value ---
export interface UseGameInitializationReturn {
    levelData: InitialGamePositions | null;
    regenerateLevel: () => void; // Function to trigger regeneration
}

// --- Exportable Generation Function (Now accepts settings) ---
export const generateInitialPositions = (settings: GameSettingsProfile): InitialGamePositions => {
    console.log("[generateInitialPositions] Generating new level layout with provided settings...");

    // Destructure needed settings for clarity
    const {
        VIRTUAL_WIDTH,
        VIRTUAL_HEIGHT,
        SHIP_RADIUS,
        PLANET_MIN_RADIUS,
        PLANET_MAX_RADIUS,
        NUM_PLANETS,
        // --- Orange Planet Settings ---
        NUM_ORANGE_PLANETS,
        ORANGE_PLANET_MAX_RADIUS,
        ORANGE_PLANET_CORE_RADIUS_FACTOR,
        // ORANGE_PLANET_MIN_SPAWN_DIST_FACTOR, // REMOVED - Not used in edge placement
        // ---------------------------
        INITIAL_VIEW_WIDTH_FACTOR,
        INITIAL_VIEW_HEIGHT_FACTOR,
        SHIP_ZONE_WIDTH_FACTOR,
        PLANET_SPAWN_AREA_FACTOR,
        MIN_SHIP_SEPARATION_FACTOR,
        MIN_PLANET_SHIP_DISTANCE,
        MIN_PLANET_PLANET_DISTANCE
    } = settings;

    // --- Calculate Initial View Bounds and Center ---
    const initialViewWidth = VIRTUAL_WIDTH * INITIAL_VIEW_WIDTH_FACTOR;
    const initialViewHeight = VIRTUAL_HEIGHT * INITIAL_VIEW_HEIGHT_FACTOR;
    const initialViewMinX = (VIRTUAL_WIDTH - initialViewWidth) / 2;
    const initialViewMaxX = initialViewMinX + initialViewWidth;
    const initialViewMinY = (VIRTUAL_HEIGHT - initialViewHeight) / 2;
    const initialViewMaxY = initialViewMinY + initialViewHeight;
    // REMOVED - Not used in edge placement
    // const viewCenterX = VIRTUAL_WIDTH / 2;
    // const viewCenterY = VIRTUAL_HEIGHT / 2;

    // --- Calculate Ship Spawn Zones ---
    const shipZoneWidth = initialViewWidth * SHIP_ZONE_WIDTH_FACTOR;
    const shipPadding = SHIP_RADIUS + 20; // Keep local or move padding to settings?
    
    // Left Zone X bounds
    const ship1MinX = initialViewMinX + shipPadding;
    const ship1MaxX = initialViewMinX + shipZoneWidth - shipPadding;
    // Right Zone X bounds
    const ship2MinX = initialViewMaxX - shipZoneWidth + shipPadding;
    const ship2MaxX = initialViewMaxX - shipPadding;

    // Y bounds for ships
    const shipMinY = initialViewMinY + shipPadding;
    const shipMaxY = initialViewMaxY - shipPadding;
    
    // --- Place ships RANDOMLY ensuring minimum separation ---
    let ship1Pos: { x: number, y: number };
    let ship2Pos: { x: number, y: number };
    const minSeparationSq = Math.pow(initialViewWidth * MIN_SHIP_SEPARATION_FACTOR, 2);
    let attemptsShips = 0;
    const maxAttemptsShips = 200; // Keep local or move to settings?

    do {
        // Random X and Y for Ship 1
        const x1 = Math.random() * (ship1MaxX - ship1MinX) + ship1MinX;
        const y1 = Math.random() * (shipMaxY - shipMinY) + shipMinY;
        ship1Pos = { x: x1, y: y1 };

        // Random X and Y for Ship 2
        const x2 = Math.random() * (ship2MaxX - ship2MinX) + ship2MinX;
        const y2 = Math.random() * (shipMaxY - shipMinY) + shipMinY;
        ship2Pos = { x: x2, y: y2 };

        attemptsShips++;

        // Check distance
        const dx = ship2Pos.x - ship1Pos.x;
        const dy = ship2Pos.y - ship1Pos.y;
        const distSq = dx * dx + dy * dy;

        if (distSq >= minSeparationSq) {
            break;
        }

    } while (attemptsShips < maxAttemptsShips);

    if (attemptsShips >= maxAttemptsShips) {
        console.warn(`Could not place ships with minimum separation after ${maxAttemptsShips} attempts, using last attempt.`);
    }

    const ships: [{ x: number; y: number }, { x: number; y: number }] = [ ship1Pos, ship2Pos ];

    // --- Calculate Planet Spawn Area (for normal planets) ---
    const planetSpawnAreaWidth = initialViewWidth * PLANET_SPAWN_AREA_FACTOR;
    const planetSpawnAreaHeight = initialViewHeight * PLANET_SPAWN_AREA_FACTOR;
    const planetSpawnMinX = initialViewMinX + (initialViewWidth - planetSpawnAreaWidth) / 2;
    const planetSpawnMaxX = planetSpawnMinX + planetSpawnAreaWidth;
    const planetSpawnMinY = initialViewMinY + (initialViewHeight - planetSpawnAreaHeight) / 2;
    const planetSpawnMaxY = planetSpawnMinY + planetSpawnAreaHeight;

    // --- Generate Planets (Normal + Orange) ---
    const planets: Matter.Body[] = [];
    let attemptsPlanets = 0;
    const maxAttemptsPlanets = 750; // Max attempts *total* across both types
    let normalPlanetsPlaced = 0;
    let orangePlanetsPlaced = 0;

    // --- Place NORMAL Planets Centered ---
    while (normalPlanetsPlaced < NUM_PLANETS && attemptsPlanets < maxAttemptsPlanets) {
        attemptsPlanets++;
        const radius = Math.random() * (PLANET_MAX_RADIUS - PLANET_MIN_RADIUS) + PLANET_MIN_RADIUS;

        let placedSuccessfully = false;
        let normalAttempts = 0;
        const maxNormalAttempts = 100; // Attempts per *single* normal planet

        do {
            normalAttempts++;
            // Generate position within the central spawn area
            const candidateX = Math.random() * (planetSpawnMaxX - planetSpawnMinX) + planetSpawnMinX;
            const candidateY = Math.random() * (planetSpawnMaxY - planetSpawnMinY) + planetSpawnMinY;
            const candidatePos = { x: candidateX, y: candidateY };

            // Check collision
            let collision = false;
            for (const ship of ships) { if (calculateDistance(candidatePos, ship) < radius + SHIP_RADIUS + MIN_PLANET_SHIP_DISTANCE) { collision = true; break; } }
            if (collision) continue;
            for (const existingPlanet of planets) { const existingRadius = existingPlanet.plugin?.ZapSlinggers?.radius || PLANET_MIN_RADIUS; if (calculateDistance(candidatePos, existingPlanet.position) < radius + existingRadius + MIN_PLANET_PLANET_DISTANCE) { collision = true; break; } }
            if (collision) continue;

            // Spot is valid
            const planetBody = Bodies.circle(candidateX, candidateY, radius, {
                isStatic: true,
                label: 'planet', // Normal planet
                friction: 0.5,
                restitution: 0.5,
                plugin: { ZapSlinggers: { radius: radius } }
            });
            planets.push(planetBody);
            normalPlanetsPlaced++;
            placedSuccessfully = true;
            break; // Exit attempt loop for this planet

        } while (normalAttempts < maxNormalAttempts);

        if (!placedSuccessfully) {
           console.warn(`[Init] Could not place normal planet ${normalPlanetsPlaced + 1} after ${maxNormalAttempts} attempts.`);
           // Optionally break the outer loop if one fails, or just continue to try others
        }
    } // End NORMAL planet placement loop

    // --- Place ORANGE Planets Randomly Across Map ---
    /* // Temporarily disable orange planet creation for NaN debugging
    while (orangePlanetsPlaced < NUM_ORANGE_PLANETS && attemptsPlanets < maxAttemptsPlanets) {
        attemptsPlanets++; // Still counting towards the total attempts limit
        const radius = Math.random() * (ORANGE_PLANET_MAX_RADIUS - PLANET_MIN_RADIUS) + PLANET_MIN_RADIUS; // Use orange max radius
        const coreRadius = radius * ORANGE_PLANET_CORE_RADIUS_FACTOR;
        const edgePadding = radius + 50; // Padding from absolute edges

        let placedSuccessfully = false;
        let orangeAttempts = 0;
        const maxOrangeAttempts = 100; // Attempts per *single* orange planet

        do {
             orangeAttempts++;
             // Generate position anywhere within virtual bounds, respecting padding
             const candidateX = Math.random() * (VIRTUAL_WIDTH - 2 * edgePadding) + edgePadding;
             const candidateY = Math.random() * (VIRTUAL_HEIGHT - 2 * edgePadding) + edgePadding;
             const candidatePos = { x: candidateX, y: candidateY };

             // Check collision (against ships AND existing normal/orange planets)
             let collision = false;
             for (const ship of ships) { if (calculateDistance(candidatePos, ship) < radius + SHIP_RADIUS + MIN_PLANET_SHIP_DISTANCE) { collision = true; break; } }
             if (collision) continue;
             // Check against ALL planets placed so far
             for (const existingPlanet of planets) { const existingRadius = existingPlanet.plugin?.ZapSlinggers?.radius || PLANET_MIN_RADIUS; if (calculateDistance(candidatePos, existingPlanet.position) < radius + existingRadius + MIN_PLANET_PLANET_DISTANCE) { collision = true; break; } }
             if (collision) continue;

             // Spot is valid
             const planetBody = Bodies.circle(candidateX, candidateY, radius, {
                 isStatic: true,
                 label: 'orange-planet',
                 friction: 0.5,
                 restitution: 0.5,
                 plugin: { ZapSlinggers: { radius: radius, coreRadius: coreRadius } }
             });
             planets.push(planetBody);
             orangePlanetsPlaced++;
             placedSuccessfully = true;
             break; // Exit attempt loop for this orange planet

        } while (orangeAttempts < maxOrangeAttempts);

        if (!placedSuccessfully) {
            console.warn(`[Init] Could not place orange planet ${orangePlanetsPlaced + 1} after ${maxOrangeAttempts} attempts.`);
        }
    } // End ORANGE planet placement loop
    */ // End temporary disabling block


    if (planets.length < NUM_PLANETS /* + NUM_ORANGE_PLANETS */) { // Adjusted check
        console.warn(`[Init] Failed to place all requested normal planets. Placed ${planets.length}/${NUM_PLANETS}`);
    }

    console.log(`[generateInitialPositions] Level generated. Ships: 2, Normal Planets: ${normalPlanetsPlaced}, Orange Planets: ${orangePlanetsPlaced} (Disabled)`); // Adjusted log

    return { ships, planets };
};

// --- The Hook (Now returns level data and a regeneration function) ---
export const useGameInitialization = (settings: GameSettingsProfile | null): UseGameInitializationReturn => {
  const [levelData, setLevelData] = useState<InitialGamePositions | null>(null);
  const currentSettingsRef = useRef(settings); // Store settings in a ref

  // Update ref when settings prop changes
  useEffect(() => {
    currentSettingsRef.current = settings;
  }, [settings]);

  // Function to generate and set level data
  const generateAndSetLevel = useCallback(() => {
    const currentSettings = currentSettingsRef.current;
    if (currentSettings) {
      console.log("[useGameInitialization] Generating level data...");
      const initialData = generateInitialPositions(currentSettings);
      setLevelData(initialData);
    } else {
      console.log("[useGameInitialization] Cannot generate level, no settings provided.");
      setLevelData(null);
    }
  }, []); // No dependencies, uses ref

  // Generate level initially when settings are first provided
  useEffect(() => {
    // Only generate initially if levelData is null and settings are available
    if (!levelData && settings) {
        generateAndSetLevel();
    }
    // If settings become null later, clear the level data
    else if (!settings && levelData) {
        setLevelData(null);
    }
  }, [settings, levelData, generateAndSetLevel]); // Re-run if settings change or level needs initial generation

  // Expose the regeneration function
  const regenerateLevel = useCallback(() => {
    console.log("[useGameInitialization] regenerateLevel called.");
    generateAndSetLevel(); // Call the internal generation function
  }, [generateAndSetLevel]);

  return { levelData, regenerateLevel };
}; 