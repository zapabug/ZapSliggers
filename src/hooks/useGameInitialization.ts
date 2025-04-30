import { useState, useEffect } from 'react';
import Matter from 'matter-js';

// Destructure Matter.js modules for convenience
const { Bodies } = Matter;

// --- Constants ---
const VIRTUAL_WIDTH = 2400;
const VIRTUAL_HEIGHT = 1200;
const SHIP_RADIUS = 63;
const PLANET_MIN_RADIUS = 30;
const PLANET_MAX_RADIUS = 180;
// const EDGE_PADDING = 50; // No longer needed with constrained zones
const PLANET_SPAWN_AREA_FACTOR = 0.8; // Spawn planets within central 80% *of initial view*
const SHIP_ZONE_WIDTH_FACTOR = 0.2; // Ships spawn in outer 20% *of initial view*
const INITIAL_VIEW_WIDTH_FACTOR = 0.6; // Initial view is central 60%
const INITIAL_VIEW_HEIGHT_FACTOR = 0.6;
// Minimum distances remain the same
const MIN_SHIP_SEPARATION_FACTOR = 0.4; // Min separation relative to *initial view width*
const MIN_PLANET_SHIP_DISTANCE = 150; 
const MIN_PLANET_PLANET_DISTANCE = 50; 
const NUM_PLANETS = 3;

// --- Helper Function ---
const calculateDistance = (p1: { x: number; y: number }, p2: { x: number; y: number }) => {
  return Math.sqrt(Math.pow(p1.x - p2.x, 2) + Math.pow(p1.y - p2.y, 2));
};

// --- Interface for the returned data ---
export interface InitialGamePositions {
  ships: [{ x: number; y: number }, { x: number; y: number }];
  planets: Matter.Body[]; 
}

// --- Exportable Generation Function ---
export const generateInitialPositions = (width: number, height: number): InitialGamePositions => {
    console.log("[generateInitialPositions] Generating new level layout...");

    // --- Calculate Initial View Bounds (Central 60%) ---
    const initialViewWidth = width * INITIAL_VIEW_WIDTH_FACTOR;
    const initialViewHeight = height * INITIAL_VIEW_HEIGHT_FACTOR;
    const initialViewMinX = (width - initialViewWidth) / 2;
    const initialViewMaxX = initialViewMinX + initialViewWidth;
    const initialViewMinY = (height - initialViewHeight) / 2;
    const initialViewMaxY = initialViewMinY + initialViewHeight;

    // --- Calculate Ship Spawn Zones (Outer 20% of Initial View) ---
    const shipZoneWidth = initialViewWidth * SHIP_ZONE_WIDTH_FACTOR;
    const shipPadding = SHIP_RADIUS + 20; // Increase padding slightly
    
    // Left Zone X bounds
    const ship1MinX = initialViewMinX + shipPadding;
    const ship1MaxX = initialViewMinX + shipZoneWidth - shipPadding;
    // Right Zone X bounds
    const ship2MinX = initialViewMaxX - shipZoneWidth + shipPadding;
    const ship2MaxX = initialViewMaxX - shipPadding;

    // --- NEW: Y bounds for ships (within initial view height) ---
    const shipMinY = initialViewMinY + shipPadding;
    const shipMaxY = initialViewMaxY - shipPadding;
    
    // --- Place ships RANDOMLY ensuring minimum separation ---
    let ship1Pos: { x: number, y: number };
    let ship2Pos: { x: number, y: number };
    const minSeparationSq = Math.pow(initialViewWidth * MIN_SHIP_SEPARATION_FACTOR, 2); // Use squared distance
    let attemptsShips = 0;
    const maxAttemptsShips = 200;

    do {
        // Random X and Y for Ship 1 in its zone
        const x1 = Math.random() * (ship1MaxX - ship1MinX) + ship1MinX;
        const y1 = Math.random() * (shipMaxY - shipMinY) + shipMinY;
        ship1Pos = { x: x1, y: y1 };

        // Random X and Y for Ship 2 in its zone
        const x2 = Math.random() * (ship2MaxX - ship2MinX) + ship2MinX;
        const y2 = Math.random() * (shipMaxY - shipMinY) + shipMinY;
        ship2Pos = { x: x2, y: y2 };

        attemptsShips++;

        // Check distance between the two potential ship positions
        const dx = ship2Pos.x - ship1Pos.x;
        const dy = ship2Pos.y - ship1Pos.y;
        const distSq = dx * dx + dy * dy;

        if (distSq >= minSeparationSq) {
            break; // Found suitable positions
        }

    } while (attemptsShips < maxAttemptsShips);

    if (attemptsShips >= maxAttemptsShips) {
        console.warn(`Could not place ships with minimum separation after ${maxAttemptsShips} attempts, using last attempt.`);
        // Fallback: use the last generated positions even if too close
    }

    const ships: [{ x: number; y: number }, { x: number; y: number }] = [
        ship1Pos, // Use generated random positions
        ship2Pos, // Use generated random positions
    ];

    // --- Calculate Planet Spawn Area (Central 80% of Initial View) ---
    const planetSpawnAreaWidth = initialViewWidth * PLANET_SPAWN_AREA_FACTOR;
    const planetSpawnAreaHeight = initialViewHeight * PLANET_SPAWN_AREA_FACTOR;
    const planetSpawnMinX = initialViewMinX + (initialViewWidth - planetSpawnAreaWidth) / 2;
    const planetSpawnMaxX = planetSpawnMinX + planetSpawnAreaWidth;
    const planetSpawnMinY = initialViewMinY + (initialViewHeight - planetSpawnAreaHeight) / 2;
    const planetSpawnMaxY = planetSpawnMinY + planetSpawnAreaHeight;

    // --- Generate Planets within the calculated area ---
    const planets: Matter.Body[] = [];
    let attemptsPlanets = 0;
    const maxAttemptsPlanets = 500;

    while (planets.length < NUM_PLANETS && attemptsPlanets < maxAttemptsPlanets) {
        attemptsPlanets++;
        const radius = Math.random() * (PLANET_MAX_RADIUS - PLANET_MIN_RADIUS) + PLANET_MIN_RADIUS;
        // Generate within the specific planet spawn bounds
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

        // If no collision, create and add the planet body
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

// --- The Hook (No change needed here) ---
export const useGameInitialization = (): InitialGamePositions | null => {
  const [positions, setPositions] = useState<InitialGamePositions | null>(null);

  useEffect(() => {
    const initialData = generateInitialPositions(VIRTUAL_WIDTH, VIRTUAL_HEIGHT);
    setPositions(initialData);
  }, []); 

  return positions;
}; 