import { useState, useEffect } from 'react';
import Matter from 'matter-js';

// Destructure Matter.js modules for convenience
const { Bodies } = Matter;

// --- Constants (Consider moving to a shared constants file later) ---
const VIRTUAL_WIDTH = 2400;
const VIRTUAL_HEIGHT = 1200;
const MIN_SHIP_SEPARATION_FACTOR = 0.4; // Minimum 40% of width apart
const MIN_PLANET_SHIP_DISTANCE = 150; // Min distance between planet center and ship center
const MIN_PLANET_PLANET_DISTANCE = 50; // Min distance between planet edges
const SHIP_START_AREA_WIDTH_FACTOR = 0.25; // Ships spawn in the outer 25% on each side
const NUM_PLANETS = 3; // Number of planets to generate
const SHIP_RADIUS = 25; // Visual/Physics radius of ships
const PLANET_MIN_RADIUS = 30;
const PLANET_MAX_RADIUS = 180;
const EDGE_PADDING = 50; // Keep entities away from screen edges
const PLANET_SPAWN_AREA_FACTOR = 0.8; // Planets spawn in the central 80%

// --- Helper Function: Calculate distance ---
const calculateDistance = (p1: { x: number; y: number }, p2: { x: number; y: number }) => {
  return Math.sqrt(Math.pow(p1.x - p2.x, 2) + Math.pow(p1.y - p2.y, 2));
};

// --- Type Definitions ---
export interface InitialPositions {
    ships: { x: number; y: number }[];
    planets: Matter.Body[];
}

// --- Custom Hook ---
export function useGameInitialization() {
    const [initialPositions, setInitialPositions] = useState<InitialPositions | null>(null);

    useEffect(() => {
        console.log("[useGameInitialization] Generating initial positions...");
        // Player Ships
        let p1Pos: { x: number; y: number };
        let p2Pos: { x: number; y: number };
        const minSeparation = VIRTUAL_WIDTH * MIN_SHIP_SEPARATION_FACTOR;
        const shipSpawnWidth = VIRTUAL_WIDTH * SHIP_START_AREA_WIDTH_FACTOR;

        do {
            p1Pos = {
                x: Math.random() * shipSpawnWidth + EDGE_PADDING, // Left side
                y: Math.random() * (VIRTUAL_HEIGHT - 2 * EDGE_PADDING) + EDGE_PADDING,
            };
            p2Pos = {
                x: VIRTUAL_WIDTH - (Math.random() * shipSpawnWidth) - EDGE_PADDING, // Right side
                y: Math.random() * (VIRTUAL_HEIGHT - 2 * EDGE_PADDING) + EDGE_PADDING,
            };
            // Initial facing angle - Player 1 faces right (0 rad), Player 2 faces left (PI rad)
            // We don't store the angle here, it will be set on the Matter.Body later
        } while (calculateDistance(p1Pos, p2Pos) < minSeparation);

        const generatedShips = [p1Pos, p2Pos];

        // Planets
        const generatedPlanets: Matter.Body[] = [];
        const maxAttempts = 20; // Prevent infinite loops

        for (let i = 0; i < NUM_PLANETS; i++) {
            let attempt = 0;
            let validPosition = false;
            // Initialize planetRadius before the loop to satisfy TS strictness
            let planetX: number = 0, planetY: number = 0, planetRadius: number = PLANET_MIN_RADIUS;

            while (attempt < maxAttempts && !validPosition) {
                attempt++;
                planetRadius = Math.random() * (PLANET_MAX_RADIUS - PLANET_MIN_RADIUS) + PLANET_MIN_RADIUS;

                const spawnZoneWidth = VIRTUAL_WIDTH * PLANET_SPAWN_AREA_FACTOR;
                const spawnZoneHeight = VIRTUAL_HEIGHT * PLANET_SPAWN_AREA_FACTOR;
                const minSpawnX = (VIRTUAL_WIDTH - spawnZoneWidth) / 2 + EDGE_PADDING + planetRadius;
                const maxSpawnX = (VIRTUAL_WIDTH + spawnZoneWidth) / 2 - EDGE_PADDING - planetRadius;
                const minSpawnY = (VIRTUAL_HEIGHT - spawnZoneHeight) / 2 + EDGE_PADDING + planetRadius;
                const maxSpawnY = (VIRTUAL_HEIGHT + spawnZoneHeight) / 2 - EDGE_PADDING - planetRadius;

                if (minSpawnX >= maxSpawnX || minSpawnY >= maxSpawnY) {
                    console.warn(`[useGameInitialization] Planet spawn area too small for radius ${planetRadius} and padding.`);
                    continue;
                }

                planetX = Math.random() * (maxSpawnX - minSpawnX) + minSpawnX;
                planetY = Math.random() * (maxSpawnY - minSpawnY) + minSpawnY;

                let tooClose = false;

                // Check distance to ships
                for (const shipPos of generatedShips) {
                    if (calculateDistance({ x: planetX, y: planetY }, shipPos) < MIN_PLANET_SHIP_DISTANCE + planetRadius + SHIP_RADIUS) {
                        tooClose = true;
                        break;
                    }
                }
                if (tooClose) continue;

                // Check distance to other planets
                for (const existingPlanet of generatedPlanets) {
                    if (calculateDistance({ x: planetX, y: planetY }, existingPlanet.position) < MIN_PLANET_PLANET_DISTANCE + planetRadius + (existingPlanet.circleRadius || 0)) {
                        tooClose = true;
                        break;
                    }
                }
                if (tooClose) continue;

                validPosition = true;
            }

            if (validPosition) {
                // Generate a random LIGHT GRAY color for the planet
                const grayValue = Math.floor(Math.random() * (255 - 100 + 1)) + 100; // Random int between 100 and 255
                const grayHex = grayValue.toString(16).padStart(2, '0'); // Convert to 2-digit hex
                const grayColor = `#${grayHex}${grayHex}${grayHex}`; // Form the #rrggbb color

                const newPlanet = Bodies.circle(planetX!, planetY!, planetRadius!, {
                    isStatic: true,
                    label: 'planet',
                    friction: 0.5,
                    restitution: 0,
                    plugin: { 
                      klunkstr: {
                          radius: planetRadius
                      }
                    },
                    render: {
                        fillStyle: grayColor,
                        // You could also add sprite configuration here later if needed
                        // sprite: {
                        //    texture: '/images/planet_sprite.png',
                        //    xScale: 1,
                        //    yScale: 1
                        // }
                    }
                });
                generatedPlanets.push(newPlanet);
            } else {
                console.warn(`[useGameInitialization] Could not find valid position for planet ${i + 1} after ${maxAttempts} attempts.`);
            }
        }
        console.log("[useGameInitialization] Generated positions:", { ships: generatedShips, planets: generatedPlanets.length });
        setInitialPositions({ ships: generatedShips, planets: generatedPlanets });

    }, []); // Run once on mount

    return initialPositions;
} 