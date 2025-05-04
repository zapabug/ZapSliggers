import { useState, useEffect, useRef, useCallback } from 'react';
import Matter from 'matter-js';
import { GameSettingsProfile } from '../config/gameSettings'; // Import the settings profile type

// Destructure Matter.js modules for convenience
const { Bodies } = Matter;

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
    const maxAttemptsPlanets = 750;
    let normalPlanetsPlaced = 0;
    let orangePlanetsPlaced = 0;
    const totalPlanetsToPlace = NUM_PLANETS + NUM_ORANGE_PLANETS;

    while (planets.length < totalPlanetsToPlace && attemptsPlanets < maxAttemptsPlanets) {
        attemptsPlanets++;
        
        // Determine if trying to place orange this attempt
        const isOrangeCandidate = orangePlanetsPlaced < NUM_ORANGE_PLANETS;
        const isNormalCandidate = normalPlanetsPlaced < NUM_PLANETS;
        const attemptIsOrange = isOrangeCandidate && (!isNormalCandidate || Math.random() < 0.5);
        
        // Determine radius based on type
        const maxRadius = attemptIsOrange ? ORANGE_PLANET_MAX_RADIUS : PLANET_MAX_RADIUS;
        const minRadiusForAttempt = Math.min(PLANET_MIN_RADIUS, maxRadius);
        const radius = Math.random() * (maxRadius - minRadiusForAttempt) + minRadiusForAttempt;
        
        let x: number = 0; 
        let y: number = 0; 
        let placedSuccessfully = false;
        let isOrange = false; // Will be set true if orange placement succeeds
        const edgePadding = 50; // Added padding from virtual edge and initial view edge

        // Try placing Orange first if decided
        if (attemptIsOrange) {
            let orangeAttempts = 0;
            let foundOrangeSpot = false;
            // Padding from virtual edge
            const planetEdgePadding = radius + edgePadding;

            do {
                // Choose a random edge zone (0: Left, 1: Right, 2: Top, 3: Bottom)
                const edgeZone = Math.floor(Math.random() * 4);
                let candidateX = 0;
                let candidateY = 0;

                switch(edgeZone) {
                    case 0: // Left Edge
                        // Spawn between edgePadding and (initialViewMinX - edgePadding)
                        candidateX = Math.random() * (initialViewMinX - edgePadding * 2) + edgePadding;
                        candidateY = Math.random() * (VIRTUAL_HEIGHT - planetEdgePadding * 2) + planetEdgePadding;
                        break;
                    case 1: // Right Edge
                        // Spawn between (initialViewMaxX + edgePadding) and (VIRTUAL_WIDTH - edgePadding)
                        candidateX = Math.random() * (VIRTUAL_WIDTH - initialViewMaxX - edgePadding * 2) + initialViewMaxX + edgePadding;
                        candidateY = Math.random() * (VIRTUAL_HEIGHT - planetEdgePadding * 2) + planetEdgePadding;
                        break;
                    case 2: // Top Edge
                        // Spawn between edgePadding and (initialViewMinY - edgePadding)
                        candidateY = Math.random() * (initialViewMinY - edgePadding * 2) + edgePadding;
                        // Keep within central X band, but ensure padding from initialView edges if they extend beyond
                        candidateX = Math.random() * (initialViewMaxX - initialViewMinX - planetEdgePadding * 2) + initialViewMinX + planetEdgePadding; 
                        break;
                    case 3: // Bottom Edge
                         // Spawn between (initialViewMaxY + edgePadding) and (VIRTUAL_HEIGHT - edgePadding)
                        candidateY = Math.random() * (VIRTUAL_HEIGHT - initialViewMaxY - edgePadding * 2) + initialViewMaxY + edgePadding;
                        // Keep within central X band, ensuring padding
                        candidateX = Math.random() * (initialViewMaxX - initialViewMinX - planetEdgePadding * 2) + initialViewMinX + planetEdgePadding;
                        break;
                }
                
                // Check collision for this specific spot
                const candidatePos = { x: candidateX, y: candidateY };
                let collision = false;
                // Ensure not too close to ships (only check ships, not planets initially for edge placement)
                for (const ship of ships) { if (calculateDistance(candidatePos, ship) < radius + SHIP_RADIUS + MIN_PLANET_SHIP_DISTANCE) { collision = true; break; } }
                if (collision) { orangeAttempts++; continue; }
                // Check collision with other planets AFTER checking ships
                for (const existingPlanet of planets) { const existingRadius = existingPlanet.plugin?.Zapsliggers?.radius || PLANET_MIN_RADIUS; if (calculateDistance(candidatePos, existingPlanet.position) < radius + existingRadius + MIN_PLANET_PLANET_DISTANCE) { collision = true; break; } }
                if (collision) { orangeAttempts++; continue; }
                
                // Spot is valid, assign and mark success
                x = candidateX;
                y = candidateY;
                isOrange = true; // Set type for body creation
                placedSuccessfully = true;
                foundOrangeSpot = true;
                break; 
                
            } while (orangeAttempts < 50); 
            
            if (!foundOrangeSpot && !isNormalCandidate) continue; 
        }
        
        // If didn't place orange (or wasn't candidate, or failed and normal is available)
        if (!placedSuccessfully && isNormalCandidate) {
            let normalAttempts = 0;
            do { // Attempt to place a normal planet
                const candidateX = Math.random() * (planetSpawnMaxX - planetSpawnMinX) + planetSpawnMinX;
                const candidateY = Math.random() * (planetSpawnMaxY - planetSpawnMinY) + planetSpawnMinY;
                const candidatePos = { x: candidateX, y: candidateY };
                
                // Check collision for this specific spot
                let collision = false;
                for (const ship of ships) { if (calculateDistance(candidatePos, ship) < radius + SHIP_RADIUS + MIN_PLANET_SHIP_DISTANCE) { collision = true; break; } }
                if (collision) { normalAttempts++; continue; }
                for (const existingPlanet of planets) { const existingRadius = existingPlanet.plugin?.Zapsliggers?.radius || PLANET_MIN_RADIUS; if (calculateDistance(candidatePos, existingPlanet.position) < radius + existingRadius + MIN_PLANET_PLANET_DISTANCE) { collision = true; break; } }
                if (collision) { normalAttempts++; continue; }

                // Spot is valid
                x = candidateX;
                y = candidateY;
                isOrange = false; // Ensure it's marked as normal
                placedSuccessfully = true;
                break;
            } while (normalAttempts < 50); // Limit placement attempts for normal
        }

        // If no spot found in either attempt, continue
        if (!placedSuccessfully) continue;

        // Create planet body based on type (isOrange flag is now reliable)
        let planetBody: Matter.Body;
        if (isOrange) {
            const coreRadius = radius * ORANGE_PLANET_CORE_RADIUS_FACTOR;
            planetBody = Bodies.circle(x, y, radius, {
                isStatic: true,
                label: 'orange-planet',
                friction: 0.5,
                restitution: 0.5,
                plugin: { Zapsliggers: { radius: radius, coreRadius: coreRadius } }
            });
            orangePlanetsPlaced++;
            console.log(`Placed Orange Planet ${orangePlanetsPlaced}/${NUM_ORANGE_PLANETS} at (${x.toFixed(0)}, ${y.toFixed(0)})`);
        } else {
            const grayValue = Math.floor(Math.random() * (160 - 80 + 1)) + 80;
            const grayHex = grayValue.toString(16).padStart(2, '0');
            const grayColor = `#${grayHex}${grayHex}${grayHex}`;
            planetBody = Bodies.circle(x, y, radius, {
                isStatic: true,
                label: 'planet',
                friction: 0.5,
                restitution: 0.5,
                render: { fillStyle: grayColor },
                plugin: { Zapsliggers: { radius: radius } } // Store radius for normal planets too
            });
            normalPlanetsPlaced++;
        }
        planets.push(planetBody);
    }

    if (planets.length < totalPlanetsToPlace) {
        console.warn(`[generateInitialPositions] Could only place ${planets.length}/${totalPlanetsToPlace} total planets after ${maxAttemptsPlanets} attempts.`);
    }

    console.log("[generateInitialPositions] Level generation complete.");
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