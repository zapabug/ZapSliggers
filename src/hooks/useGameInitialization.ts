import { useState, useEffect } from 'react';
import Matter from 'matter-js';

// Destructure Matter.js modules for convenience
const { Bodies } = Matter;

// --- Constants (Copied from GameRenderer for consistency) ---
const VIRTUAL_WIDTH = 2400;
const VIRTUAL_HEIGHT = 1200;
const SHIP_RADIUS = 63;
const PLANET_MIN_RADIUS = 30;
const PLANET_MAX_RADIUS = 180;
const EDGE_PADDING = 50;
const PLANET_SPAWN_AREA_FACTOR = 0.8; // Spawn planets within central 80%
const MIN_SHIP_SEPARATION_FACTOR = 0.4; // Minimum 40% of width separation
const MIN_PLANET_SHIP_DISTANCE = 150; // Min distance between planet edge and ship center
const MIN_PLANET_PLANET_DISTANCE = 50; // Min distance between planet edges
const SHIP_START_AREA_WIDTH_FACTOR = 0.25; // Ships spawn in leftmost/rightmost 25%
const NUM_PLANETS = 3;

// --- Helper Function ---
const calculateDistance = (p1: { x: number; y: number }, p2: { x: number; y: number }) => {
  return Math.sqrt(Math.pow(p1.x - p2.x, 2) + Math.pow(p1.y - p2.y, 2));
};

// --- Interface for the returned data ---
export interface InitialGamePositions {
  ships: [{ x: number; y: number }, { x: number; y: number }];
  planets: Matter.Body[]; // Planets are now Matter.Body objects
}

// --- NEW: Exportable Generation Function ---
export const generateInitialPositions = (width: number, height: number): InitialGamePositions => {
    console.log("[generateInitialPositions] Generating new level layout...");
    const shipPadding = SHIP_RADIUS + EDGE_PADDING;
    const shipY = height / 2; // Start ships vertically centered
    const shipStartXRange = width * SHIP_START_AREA_WIDTH_FACTOR;

    // Place ships with minimum separation
    const ship1X = Math.random() * (shipStartXRange - shipPadding * 2) + shipPadding;
    const minShip2X = ship1X + width * MIN_SHIP_SEPARATION_FACTOR;
    const maxShip2X = width - shipPadding;
    const ship2X = Math.random() * (maxShip2X - minShip2X) + minShip2X;

    const ships: [{ x: number; y: number }, { x: number; y: number }] = [
        { x: ship1X, y: shipY },
        { x: ship2X, y: shipY },
    ];

    // --- Generate Planets ---
    const planets: Matter.Body[] = [];
    const planetSpawnWidth = width * PLANET_SPAWN_AREA_FACTOR;
    const planetSpawnHeight = height * PLANET_SPAWN_AREA_FACTOR;
    const planetSpawnXOffset = (width - planetSpawnWidth) / 2;
    const planetSpawnYOffset = (height - planetSpawnHeight) / 2;
    let attempts = 0;
    const maxAttempts = 500;

    while (planets.length < NUM_PLANETS && attempts < maxAttempts) {
        attempts++;
        const radius = Math.random() * (PLANET_MAX_RADIUS - PLANET_MIN_RADIUS) + PLANET_MIN_RADIUS;
        const x = Math.random() * planetSpawnWidth + planetSpawnXOffset;
        const y = Math.random() * planetSpawnHeight + planetSpawnYOffset;
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
        // --- REVERT to Gray Colors ---
        const grayValue = Math.floor(Math.random() * (160 - 80 + 1)) + 80; // Random int between 80 (#50) and 160 (#A0)
        const grayHex = grayValue.toString(16).padStart(2, '0'); // Convert to 2-digit hex
        const grayColor = `#${grayHex}${grayHex}${grayHex}`; // Form the #rrggbb color

        const planetBody = Bodies.circle(x, y, radius, {
            isStatic: true,
            label: 'planet',
            friction: 0.5,
            restitution: 0.5,
            render: { fillStyle: grayColor }, // Use generated gray color
            // Store radius in a custom property for easier access
            plugin: { klunkstr: { radius: radius } }
        });
        // --- END REVERT ---
        planets.push(planetBody);
    }

    if (planets.length < NUM_PLANETS) {
        console.warn(`[generateInitialPositions] Could only place ${planets.length}/${NUM_PLANETS} planets after ${maxAttempts} attempts.`);
    }

    console.log("[generateInitialPositions] Level generation complete.");
    return { ships, planets };
};

// --- The Hook (Now simpler, just calls the generator) ---
export const useGameInitialization = (): InitialGamePositions | null => {
  const [positions, setPositions] = useState<InitialGamePositions | null>(null);

  useEffect(() => {
    // Generate positions once on mount
    const initialData = generateInitialPositions(VIRTUAL_WIDTH, VIRTUAL_HEIGHT);
    setPositions(initialData);
  }, []); // Empty dependency array ensures it runs only once

  return positions;
}; 