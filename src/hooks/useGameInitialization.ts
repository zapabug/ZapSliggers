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
        INITIAL_VIEW_WIDTH_FACTOR,
        INITIAL_VIEW_HEIGHT_FACTOR,
        SHIP_ZONE_WIDTH_FACTOR,
        PLANET_SPAWN_AREA_FACTOR,
        MIN_SHIP_SEPARATION_FACTOR,
        MIN_PLANET_SHIP_DISTANCE,
        MIN_PLANET_PLANET_DISTANCE
    } = settings;

    // --- Calculate Initial View Bounds ---
    const initialViewWidth = VIRTUAL_WIDTH * INITIAL_VIEW_WIDTH_FACTOR;
    const initialViewHeight = VIRTUAL_HEIGHT * INITIAL_VIEW_HEIGHT_FACTOR;
    const initialViewMinX = (VIRTUAL_WIDTH - initialViewWidth) / 2;
    const initialViewMaxX = initialViewMinX + initialViewWidth;
    const initialViewMinY = (VIRTUAL_HEIGHT - initialViewHeight) / 2;
    const initialViewMaxY = initialViewMinY + initialViewHeight;

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

    // --- Calculate Planet Spawn Area ---
    const planetSpawnAreaWidth = initialViewWidth * PLANET_SPAWN_AREA_FACTOR;
    const planetSpawnAreaHeight = initialViewHeight * PLANET_SPAWN_AREA_FACTOR;
    const planetSpawnMinX = initialViewMinX + (initialViewWidth - planetSpawnAreaWidth) / 2;
    const planetSpawnMaxX = planetSpawnMinX + planetSpawnAreaWidth;
    const planetSpawnMinY = initialViewMinY + (initialViewHeight - planetSpawnAreaHeight) / 2;
    const planetSpawnMaxY = planetSpawnMinY + planetSpawnAreaHeight;

    // --- Generate Planets ---
    const planets: Matter.Body[] = [];
    let attemptsPlanets = 0;
    const maxAttemptsPlanets = 500; // Keep local or move to settings?

    while (planets.length < NUM_PLANETS && attemptsPlanets < maxAttemptsPlanets) {
        attemptsPlanets++;
        const radius = Math.random() * (PLANET_MAX_RADIUS - PLANET_MIN_RADIUS) + PLANET_MIN_RADIUS;
        const x = Math.random() * (planetSpawnMaxX - planetSpawnMinX) + planetSpawnMinX;
        const y = Math.random() * (planetSpawnMaxY - planetSpawnMinY) + planetSpawnMinY;
        const position = { x, y };

        let collision = false;

        // Check collision with ships
        for (const ship of ships) {
            if (calculateDistance(position, ship) < radius + SHIP_RADIUS + MIN_PLANET_SHIP_DISTANCE) {
                collision = true;
                break;
            }
        }
        if (collision) continue;

        // Check collision with existing planets
        for (const existingPlanet of planets) {
            const existingRadius = existingPlanet.plugin?.klunkstr?.radius || PLANET_MIN_RADIUS;
            if (calculateDistance(position, existingPlanet.position) < radius + existingRadius + MIN_PLANET_PLANET_DISTANCE) {
                collision = true;
                break;
            }
        }
        if (collision) continue;

        // Create planet body
        const grayValue = Math.floor(Math.random() * (160 - 80 + 1)) + 80;
        const grayHex = grayValue.toString(16).padStart(2, '0');
        const grayColor = `#${grayHex}${grayHex}${grayHex}`;

        const planetBody = Bodies.circle(x, y, radius, {
            isStatic: true,
            label: 'planet',
            friction: 0.5,
            restitution: 0.5,
            render: { fillStyle: grayColor },
            plugin: { klunkstr: { radius: radius } }
        });
        planets.push(planetBody);
    }

    if (planets.length < NUM_PLANETS) {
        console.warn(`[generateInitialPositions] Could only place ${planets.length}/${NUM_PLANETS} planets after ${maxAttemptsPlanets} attempts.`);
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