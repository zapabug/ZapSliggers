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
        NUM_SLINGGER_PLANETS,
        SLINGGER_PLANET_MAX_RADIUS,
        SLINGGER_PLANET_CORE_RADIUS_FACTOR,
        // SLINGGER_PLANET_MIN_SPAWN_DIST_FACTOR, // REMOVED - Not used in edge placement
        // ---------------------------
        GAME_VIEW_WIDTH_FACTOR,
        GAME_VIEW_HEIGHT_FACTOR,
        SHIP_ZONE_WIDTH_FACTOR,
        PLANET_SPAWN_AREA_FACTOR,
        MIN_SHIP_SEPARATION_FACTOR,
        MIN_PLANET_SHIP_DISTANCE,
        MIN_PLANET_PLANET_DISTANCE
    } = settings;

    // --- Calculate Initial View Bounds and Center ---
    const initialViewWidth = VIRTUAL_WIDTH * GAME_VIEW_WIDTH_FACTOR;
    const initialViewHeight = VIRTUAL_HEIGHT * GAME_VIEW_HEIGHT_FACTOR;
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
    const planetSpawnMinY = initialViewMinY + (initialViewHeight - planetSpawnAreaHeight) / 1.5;
    const planetSpawnMaxY = planetSpawnMinY + planetSpawnAreaHeight;

    // --- Generate Planets (Normal + Orange) ---
    const planets: Matter.Body[] = [];
    let attemptsPlanets = 0;
    const maxAttemptsPlanets = 750;
    let normalPlanetsPlaced = 0;
    let orangePlanetsPlaced = 0;
    const totalPlanetsToPlace = NUM_PLANETS + NUM_SLINGGER_PLANETS;

    while (planets.length < totalPlanetsToPlace && attemptsPlanets < maxAttemptsPlanets) {
        attemptsPlanets++;
        
        // Determine if trying to place orange this attempt
        const isOrangeCandidate = orangePlanetsPlaced < NUM_SLINGGER_PLANETS;
        const isNormalCandidate = normalPlanetsPlaced < NUM_PLANETS;
        const attemptIsOrange = isOrangeCandidate && (!isNormalCandidate || Math.random() < 0.5);
        
        // Determine radius based on type
        const maxRadius = attemptIsOrange ? SLINGGER_PLANET_MAX_RADIUS : PLANET_MAX_RADIUS;
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
            const planetEdgePadding = radius + edgePadding;
            
            // Calculate visible game area bounds (the inner box)
            const gameViewWidth = VIRTUAL_WIDTH * GAME_VIEW_WIDTH_FACTOR;
            const gameViewHeight = VIRTUAL_HEIGHT * GAME_VIEW_HEIGHT_FACTOR;
            const gameViewMinX = (VIRTUAL_WIDTH - gameViewWidth) / 2;
            const gameViewMaxX = gameViewMinX + gameViewWidth;
            const gameViewMinY = (VIRTUAL_HEIGHT - gameViewHeight) / 2;
            const gameViewMaxY = gameViewMinY + gameViewHeight;

            // Extra padding to ensure planets are well outside the view
            const extraPadding = Math.max(gameViewWidth, gameViewHeight) * 0.2; // 20% of the larger dimension

            // Track diagonal corners for SLINGGER placement
            const usedCorners = new Set<number>();
            planets.forEach(planet => {
                if (planet.label === 'slingger-planet') {
                    const pos = planet.position;
                    // Check which corner this planet is in
                    if (pos.x < gameViewMinX && pos.y < gameViewMinY) usedCorners.add(0); // Top-left
                    if (pos.x > gameViewMaxX && pos.y < gameViewMinY) usedCorners.add(1); // Top-right
                    if (pos.x < gameViewMinX && pos.y > gameViewMaxY) usedCorners.add(2); // Bottom-left
                    if (pos.x > gameViewMaxX && pos.y > gameViewMaxY) usedCorners.add(3); // Bottom-right
                }
            });

            // Choose corners for diagonal placement
            let chosenCorner: number;
            if (orangePlanetsPlaced === 0) {
                // First SLINGGER: randomly choose any corner
                chosenCorner = Math.floor(Math.random() * 4);
            } else {
                // Second SLINGGER: pick the diagonal opposite corner
                const usedCorner = Array.from(usedCorners)[0];
                // Map corners to their diagonal opposites: 0->3, 1->2, 2->1, 3->0
                chosenCorner = usedCorner < 2 ? usedCorner + 2 : usedCorner - 2;
            }

            do {
                let candidateX = 0;
                let candidateY = 0;

                switch(chosenCorner) {
                    case 0: // Top-left corner
                        candidateX = Math.random() * (gameViewMinX - planetEdgePadding - extraPadding) + planetEdgePadding;
                        candidateY = Math.random() * (gameViewMinY - planetEdgePadding - extraPadding) + planetEdgePadding;
                        break;
                    case 1: // Top-right corner
                        candidateX = Math.random() * (VIRTUAL_WIDTH - gameViewMaxX - planetEdgePadding - extraPadding) + gameViewMaxX + extraPadding;
                        candidateY = Math.random() * (gameViewMinY - planetEdgePadding - extraPadding) + planetEdgePadding;
                        break;
                    case 2: // Bottom-left corner
                        candidateX = Math.random() * (gameViewMinX - planetEdgePadding - extraPadding) + planetEdgePadding;
                        candidateY = Math.random() * (VIRTUAL_HEIGHT - gameViewMaxY - planetEdgePadding - extraPadding) + gameViewMaxY + extraPadding;
                        break;
                    case 3: // Bottom-right corner
                        candidateX = Math.random() * (VIRTUAL_WIDTH - gameViewMaxX - planetEdgePadding - extraPadding) + gameViewMaxX + extraPadding;
                        candidateY = Math.random() * (VIRTUAL_HEIGHT - gameViewMaxY - planetEdgePadding - extraPadding) + gameViewMaxY + extraPadding;
                        break;
                }
                
                // Check collision for this specific spot
                const candidatePos = { x: candidateX, y: candidateY };
                let collision = false;
                // Ensure not too close to ships
                for (const ship of ships) { if (calculateDistance(candidatePos, ship) < radius + SHIP_RADIUS + MIN_PLANET_SHIP_DISTANCE) { collision = true; break; } }
                if (collision) { orangeAttempts++; continue; }
                // Check collision with other planets
                for (const existingPlanet of planets) { const existingRadius = existingPlanet.plugin?.Zapslingers?.radius || PLANET_MIN_RADIUS; if (calculateDistance(candidatePos, existingPlanet.position) < radius + existingRadius + MIN_PLANET_PLANET_DISTANCE) { collision = true; break; } }
                if (collision) { orangeAttempts++; continue; }
                
                // Spot is valid
                x = candidateX;
                y = candidateY;
                isOrange = true;
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
                for (const existingPlanet of planets) { const existingRadius = existingPlanet.plugin?.Zapslingers?.radius || PLANET_MIN_RADIUS; if (calculateDistance(candidatePos, existingPlanet.position) < radius + existingRadius + MIN_PLANET_PLANET_DISTANCE) { collision = true; break; } }
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
            const coreRadius = radius * SLINGGER_PLANET_CORE_RADIUS_FACTOR;
            planetBody = Bodies.circle(x, y, radius, {
                isStatic: true,
                label: 'slingger-planet',
                friction: 0.5,
                restitution: 0.5,
                plugin: { Zapslingers: { radius: radius, coreRadius: coreRadius } }
            });
            orangePlanetsPlaced++;
            console.log(`Placed Orange Planet ${orangePlanetsPlaced}/${NUM_SLINGGER_PLANETS} at (${x.toFixed(0)}, ${y.toFixed(0)})`);
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
                plugin: { Zapslingers: { radius: radius } } // Store radius for normal planets too
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
export const useGameInitialization = (settings: GameSettingsProfile): UseGameInitializationReturn => {
    const [levelData, setLevelData] = useState<InitialGamePositions | null>(null);
    const settingsRef = useRef(settings);

    // Update settings ref when settings change
    useEffect(() => {
        settingsRef.current = settings;
    }, [settings]);

    const regenerateLevel = useCallback(() => {
        if (!settingsRef.current) {
            console.error("[useGameInitialization] Settings are required for level generation");
            return;
        }
        const newLevelData = generateInitialPositions(settingsRef.current);
        setLevelData(newLevelData);
    }, []);

    // Initial level generation
    useEffect(() => {
        if (!settingsRef.current) {
            console.error("[useGameInitialization] Settings are required for initial level generation");
            return;
        }
        regenerateLevel();
    }, [regenerateLevel]);

    return {
        levelData,
        regenerateLevel,
    };
}; 