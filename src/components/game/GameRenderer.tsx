import React, { useRef, useEffect, useState, forwardRef, useImperativeHandle } from 'react';
import Matter from 'matter-js'; // Import Matter.js

// Destructure Matter.js modules
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const { Engine, Runner, Bodies, World, Composite, Vector, Body, Events } = Matter;

// Define an interface for our projectile body with custom properties
interface ProjectileBody extends Matter.Body {
  custom: {
    createdAt: number;
    firedByPlayerIndex: 0 | 1;
    ownerShipLabel: string;
  };
}

// --- Constants ---
// MODIFIED: Double virtual dimensions to zoom out 2x
const VIRTUAL_WIDTH = 2400;
const VIRTUAL_HEIGHT = 1200;
const MIN_SHIP_SEPARATION_FACTOR = 0.4; // Minimum 40% of width apart
const MIN_PLANET_SHIP_DISTANCE = 150; // Min distance between planet center and ship center
const MIN_PLANET_PLANET_DISTANCE = 50; // Min distance between planet edges
const SHIP_START_AREA_WIDTH_FACTOR = 0.25; // Ships spawn in the outer 25% on each side
const NUM_PLANETS = 3; // Number of planets to generate
const SHIP_RADIUS = 20; // Visual/Physics radius of ships
const PLANET_MIN_RADIUS = 80; // Increased from 40
const PLANET_MAX_RADIUS = 180; // Increased from 90
const EDGE_PADDING = 50; // Keep entities away from screen edges
const GRAVITY_CONSTANT = 0.5; // Increased from 0.05 to make gravity stronger
const GRAVITY_AOE_BONUS_FACTOR = 0.1; // Small factor to boost larger planets' influence slightly

// --- NEW: Planet Spawning Area Factor ---
const PLANET_SPAWN_AREA_FACTOR = 0.8; // MODIFIED: Planets spawn in the central 80% of the virtual space

// --- NEW: Design Aspect Ratio ---
const DESIGN_ASPECT_RATIO = VIRTUAL_WIDTH / VIRTUAL_HEIGHT; // e.g., 2.0

// --- Helper Function: Calculate distance between two points ---
const calculateDistance = (p1: { x: number; y: number }, p2: { x: number; y: number }) => {
  return Math.sqrt(Math.pow(p1.x - p2.x, 2) + Math.pow(p1.y - p2.y, 2));
};

// Define props for the GameRenderer component
interface GameRendererProps {
  // TODO: Add necessary props later, e.g., game state, level data, dimensions
  gameId?: string; // Placeholder prop to satisfy linter
  player1Pos?: { x: number; y: number }; // Starting position for player 1 (example)
  player2Pos?: { x: number; y: number }; // Starting position for player 2 (example)
}

// Define the interface for the methods exposed via the ref
export interface GameRendererRef {
  fireProjectile: (playerIndex: 0 | 1, angle: number, power: number) => void;
}

const GameRenderer = forwardRef<GameRendererRef, GameRendererProps>((props, ref) => {
  // Remove default positions from props destructuring, they will be generated
  // const { player1Pos = { x: 100, y: 500 }, player2Pos = { x: 700, y: 500 } } = props;
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [backgroundImage, setBackgroundImage] = useState<HTMLImageElement | null>(null);
  const engineRef = useRef<Matter.Engine | null>(null);
  const runnerRef = useRef<Matter.Runner | null>(null);

  // --- Refs and Constants for Dynamic Viewport ---
  const currentVirtualWidthRef = useRef(VIRTUAL_WIDTH);
  const currentVirtualHeightRef = useRef(VIRTUAL_HEIGHT);
  const currentCenterXRef = useRef(VIRTUAL_WIDTH / 2);
  const currentCenterYRef = useRef(VIRTUAL_HEIGHT / 2);
  const targetVirtualWidthRef = useRef(VIRTUAL_WIDTH); // Target refs updated by physics loop
  const targetVirtualHeightRef = useRef(VIRTUAL_HEIGHT);
  const targetCenterXRef = useRef(VIRTUAL_WIDTH / 2);
  const targetCenterYRef = useRef(VIRTUAL_HEIGHT / 2);
  const MAX_ZOOM_FACTOR = 2; // MODIFIED: Max zoom in is now 2x (shows 50% of virtual space)
  const VIEWPORT_PADDING = 100; // Pixels to keep around edges
  const ZOOM_LERP_FACTOR = 0.08; // How fast to zoom/pan (0-1)

  // --- NEW: Refs for Dynamic Zoom ---
  const scaleRef = useRef(1);
  const offsetXRef = useRef(0);
  const offsetYRef = useRef(0);

  // --- State for generated positions ---
  const [initialPositions, setInitialPositions] = useState<{
      ships: { x: number; y: number }[];
      planets: Matter.Body[];
  } | null>(null);

  // --- Generate Initial Positions (Ships and Planets) ---
  useEffect(() => {
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
      } while (calculateDistance(p1Pos, p2Pos) < minSeparation);

      const generatedShips = [p1Pos, p2Pos];

      // Planets
      const generatedPlanets: Matter.Body[] = [];
      const maxAttempts = 20; // Prevent infinite loops

      for (let i = 0; i < NUM_PLANETS; i++) {
          let attempt = 0;
          let validPosition = false;
          let planetX: number, planetY: number, planetRadius: number;

          while (attempt < maxAttempts && !validPosition) {
              attempt++;
              planetRadius = Math.random() * (PLANET_MAX_RADIUS - PLANET_MIN_RADIUS) + PLANET_MIN_RADIUS;
              
              // --- MODIFIED: Calculate central spawn boundaries ---
              const spawnZoneWidth = VIRTUAL_WIDTH * PLANET_SPAWN_AREA_FACTOR;
              const spawnZoneHeight = VIRTUAL_HEIGHT * PLANET_SPAWN_AREA_FACTOR;
              const minSpawnX = (VIRTUAL_WIDTH - spawnZoneWidth) / 2 + EDGE_PADDING + planetRadius;
              const maxSpawnX = (VIRTUAL_WIDTH + spawnZoneWidth) / 2 - EDGE_PADDING - planetRadius;
              const minSpawnY = (VIRTUAL_HEIGHT - spawnZoneHeight) / 2 + EDGE_PADDING + planetRadius;
              const maxSpawnY = (VIRTUAL_HEIGHT + spawnZoneHeight) / 2 - EDGE_PADDING - planetRadius;
              
              // Ensure spawnable area exists
              if (minSpawnX >= maxSpawnX || minSpawnY >= maxSpawnY) {
                  console.warn(`Planet spawn area too small for radius ${planetRadius} and padding.`);
                  // Skip this attempt or handle error appropriately
                  continue; 
              }

              // Generate position within the central zone
              planetX = Math.random() * (maxSpawnX - minSpawnX) + minSpawnX;
              planetY = Math.random() * (maxSpawnY - minSpawnY) + minSpawnY;
              // --- END MODIFIED ---

              let tooClose = false;

              // Check distance to ships
              for (const shipPos of generatedShips) {
                  if (calculateDistance({ x: planetX, y: planetY }, shipPos) < MIN_PLANET_SHIP_DISTANCE + planetRadius + SHIP_RADIUS) {
                      tooClose = true;
                      break;
                  }
              }
              if (tooClose) continue; // Try new position

              // Check distance to other planets
              for (const existingPlanet of generatedPlanets) {
                  if (calculateDistance({ x: planetX, y: planetY }, existingPlanet.position) < MIN_PLANET_PLANET_DISTANCE + planetRadius + (existingPlanet.circleRadius || 0)) {
                      tooClose = true;
                      break;
                  }
              }
              if (tooClose) continue; // Try new position

              // If we reach here, the position is valid
              validPosition = true;
          }

          if (validPosition) {
              const newPlanet = Bodies.circle(planetX!, planetY!, planetRadius!, {
                  isStatic: true,
                  label: 'planet',
                  friction: 0.5, // Add some friction if needed
                  restitution: 0 // Planets shouldn't bounce
              });
              generatedPlanets.push(newPlanet);
          } else {
              console.warn(`Could not find a valid position for planet ${i + 1} after ${maxAttempts} attempts.`);
          }
      }

      setInitialPositions({ ships: generatedShips, planets: generatedPlanets });

  }, []); // Run once on mount

  // --- Load background image ---
  useEffect(() => {
    const img = new Image();
    img.onload = () => {
      setBackgroundImage(img);
    };
    img.onerror = () => {
      console.error('Failed to load background image.');
    };
    img.src = '/images/backdrop.png'; // Path relative to public directory

    // Cleanup function for the image effect
    return () => {
      img.onload = null;
      img.onerror = null;
    };
  }, []);

  // --- Expose fireProjectile method via ref ---
  useImperativeHandle(ref, () => ({
    fireProjectile: (playerIndex: 0 | 1, angle: number, power: number) => {
      if (!engineRef.current || !initialPositions) return; // Wait for positions

      // Determine starting position based on player index from generated state
      const startPos = initialPositions.ships[playerIndex];
      if (!startPos) {
          console.error(`Could not find initial position for player index ${playerIndex}`);
          return;
      }

      // Clamp power to avoid extreme velocities
      const clampedPower = Math.min(Math.max(power, 0.1), 5); // Example range 0.1 to 5
      const velocityScale = 5 * clampedPower; // Adjust scale as needed

      // Convert angle (degrees) to radians for trigonometry
      // Assuming 0 degrees is right, positive is clockwise (adjust if needed)
      // If angle comes from a UI joystick, 0 might be up.
      // Let's assume 0 degrees = right for now.
      const angleRad = angle * (Math.PI / 180);

      // Calculate velocity components
      const velocityX = Math.cos(angleRad) * velocityScale;
      const velocityY = Math.sin(angleRad) * velocityScale;

      // Create projectile body
      const projectileRadius = 5;
      const projectile = Bodies.circle(
        startPos.x,
        startPos.y,
        projectileRadius,
        {
          label: 'projectile',
          frictionAir: 0.01, // Add some air resistance
          restitution: 0.6, // Make it slightly bouncy if needed (though settings say 0)
          density: 0.01,
        }
      );

      // Add custom properties AFTER body creation (using the defined interface)
      (projectile as ProjectileBody).custom = { 
        createdAt: Date.now(),
        firedByPlayerIndex: playerIndex,
        ownerShipLabel: `ship-${playerIndex}` // Add owner ship label for collision check
      };

      // Add to world
      World.add(engineRef.current.world, projectile);

      // Apply initial velocity
      Body.setVelocity(projectile, { x: velocityX, y: velocityY });

      console.log(`Fired projectile for player ${playerIndex} Angle: ${angle}, Power: ${power}, Vel: (${velocityX.toFixed(2)}, ${velocityY.toFixed(2)})`);
    }
  }));

  // --- Initialize Matter.js Engine and Runner ---
  useEffect(() => {
    const canvas = canvasRef.current;
    // Wait until canvas AND initial positions are ready
    if (!canvas || !initialPositions) return;

    // *** MODIFIED: Set canvas resolution considering device pixel ratio ***
    const { clientWidth, clientHeight } = canvas;
    const dpr = window.devicePixelRatio || 1;
    // We set canvas drawing buffer size based on client size * dpr
    // The CSS size (clientWidth/Height) remains the actual display size.
    canvas.width = clientWidth * dpr;
    canvas.height = clientHeight * dpr;
    console.log(`[GameRenderer] Set canvas resolution (DPR ${dpr}): ${canvas.width}x${canvas.height}`);
    // *** END MODIFIED ***

    // Get context AFTER setting canvas size
    const ctx = canvas.getContext('2d');
    if (!ctx) {
        console.error('Failed to get 2D context');
        return; 
    }

    // --- NEW: Resize Handler Logic ---
    const handleResize = () => {
        const canvasEl = canvasRef.current;
        if (!canvasEl) return;

        // Get ACTUAL display size (CSS pixels)
        const width = canvasEl.clientWidth;
        const height = canvasEl.clientHeight;

        // Update drawing buffer size based on DPR
        const currentDpr = window.devicePixelRatio || 1;
        canvasEl.width = width * currentDpr;
        canvasEl.height = height * currentDpr;

        const currentAspectRatio = width / height;

        let newScale = 1;
        let newOffsetX = 0;
        let newOffsetY = 0;

        if (currentAspectRatio > DESIGN_ASPECT_RATIO) {
            // Window is wider than design: Fit height, letterbox horizontally
            newScale = height / VIRTUAL_HEIGHT;
            newOffsetX = (width - VIRTUAL_WIDTH * newScale) / 2;
            newOffsetY = 0;
        } else {
            // Window is taller than design: Fit width, pillarbox vertically
            newScale = width / VIRTUAL_WIDTH;
            newOffsetX = 0;
            newOffsetY = (height - VIRTUAL_HEIGHT * newScale) / 2;
        }

        scaleRef.current = newScale;
        // Store offsets in CSS pixels (will apply before DPR scaling in render loop)
        offsetXRef.current = newOffsetX; 
        offsetYRef.current = newOffsetY;

        console.log(`[Resize] W:${width} H:${height} AR:${currentAspectRatio.toFixed(2)} | Scale:${newScale.toFixed(2)} OffsetX:${newOffsetX.toFixed(0)} OffsetY:${newOffsetY.toFixed(0)}`);

        // Ensure context scaling is reset for subsequent draws if needed
        const context = canvasEl.getContext('2d');
        if (context) {
            context.setTransform(1, 0, 0, 1, 0, 0); // Reset transform
        }
    };
    
    // Initial call and setup resize listener
    handleResize(); // Call once initially
    window.addEventListener('resize', handleResize);
    // --- END NEW Resize Handler Logic ---

    // Create engine
    engineRef.current = Engine.create();
    const world = engineRef.current.world;
    world.gravity.y = 0; // Disable world gravity as per original Slingshot mechanics

    // Create runner
    runnerRef.current = Runner.create();

    // --- Add Generated Planets ---
    World.add(world, initialPositions.planets);

     // --- Add placeholder Ships (using generated positions) ---
     const shipBodies = initialPositions.ships.map((pos, index) =>
        Bodies.circle(pos.x, pos.y, SHIP_RADIUS, { isStatic: true, label: `ship-${index}` })
     );
     World.add(world, shipBodies);

    // --- Apply Planetary Gravity & Projectile Updates ---
    // Rename function to reflect broader responsibilities
    const updateProjectilesAndApplyGravity = () => {
        if (!engineRef.current) return;
        // Type the projectiles array using our custom interface
        const projectiles = Composite.allBodies(engineRef.current.world).filter(
            (body): body is ProjectileBody => body.label === 'projectile'
        );
        const planets = Composite.allBodies(engineRef.current.world).filter(
            (body) => body.label === 'planet'
        );

        // --- Calculate Bounding Box for Zoom --- 
        const ships = Composite.allBodies(engineRef.current.world).filter(b => b.label.startsWith('ship-'));
        const activeObjects = [...ships, ...projectiles]; // Combine ships and projectiles
        let minX = VIRTUAL_WIDTH, maxX = 0, minY = VIRTUAL_HEIGHT, maxY = 0;

        if (activeObjects.length > 0) {
            activeObjects.forEach(obj => {
                minX = Math.min(minX, obj.position.x - (obj.circleRadius || 0));
                maxX = Math.max(maxX, obj.position.x + (obj.circleRadius || 0));
                minY = Math.min(minY, obj.position.y - (obj.circleRadius || 0));
                maxY = Math.max(maxY, obj.position.y + (obj.circleRadius || 0));
            });
        } else {
            // Default to center view if no objects (or just center on ships if always present)
            minX = VIRTUAL_WIDTH / 2 - VIRTUAL_WIDTH / 4;
            maxX = VIRTUAL_WIDTH / 2 + VIRTUAL_WIDTH / 4;
            minY = VIRTUAL_HEIGHT / 2 - VIRTUAL_HEIGHT / 4;
            maxY = VIRTUAL_HEIGHT / 2 + VIRTUAL_HEIGHT / 4;
            // MODIFIED: Use a larger default view (approx 20% bigger than 50% width/height)
            const defaultViewWidthFactor = 1 / (4 / 1.2); // ~1/3.33 -> 60% width
            const defaultViewHeightFactor = 1 / (4 / 1.2); // ~1/3.33 -> 60% height
            minX = VIRTUAL_WIDTH / 2 - (VIRTUAL_WIDTH * defaultViewWidthFactor / 2);
            maxX = VIRTUAL_WIDTH / 2 + (VIRTUAL_WIDTH * defaultViewWidthFactor / 2);
            minY = VIRTUAL_HEIGHT / 2 - (VIRTUAL_HEIGHT * defaultViewHeightFactor / 2);
            maxY = VIRTUAL_HEIGHT / 2 + (VIRTUAL_HEIGHT * defaultViewHeightFactor / 2);
        }

        // Add padding
        minX -= VIEWPORT_PADDING;
        maxX += VIEWPORT_PADDING;
        minY -= VIEWPORT_PADDING;
        maxY += VIEWPORT_PADDING;

        // Calculate required width/height and center
        let requiredWidth = Math.max(maxX - minX, VIRTUAL_WIDTH / MAX_ZOOM_FACTOR); // Ensure minimum width
        let requiredHeight = Math.max(maxY - minY, VIRTUAL_HEIGHT / MAX_ZOOM_FACTOR); // Ensure minimum height
        const requiredCenterX = (minX + maxX) / 2;
        const requiredCenterY = (minY + maxY) / 2;

        // Maintain aspect ratio (based on initial VIRTUAL dimensions)
        const originalAspectRatio = VIRTUAL_WIDTH / VIRTUAL_HEIGHT;
        const requiredAspectRatio = requiredWidth / requiredHeight;

        if (requiredAspectRatio > originalAspectRatio) {
            // Wider than original: Adjust height to match aspect ratio
            requiredHeight = requiredWidth / originalAspectRatio;
        } else {
            // Taller than original (or same): Adjust width to match aspect ratio
            requiredWidth = requiredHeight * originalAspectRatio;
        }

        // Clamp maximum zoom
        requiredWidth = Math.min(requiredWidth, VIRTUAL_WIDTH * MAX_ZOOM_FACTOR);
        requiredHeight = Math.min(requiredHeight, VIRTUAL_HEIGHT * MAX_ZOOM_FACTOR);
        
        // Update target refs
        targetVirtualWidthRef.current = requiredWidth;
        targetVirtualHeightRef.current = requiredHeight;
        targetCenterXRef.current = requiredCenterX;
        targetCenterYRef.current = requiredCenterY;
        // --- End Bounding Box Calculation ---

        projectiles.forEach((projectile) => {
            // Apply gravity from each planet
            planets.forEach((planet) => {
                const dx = planet.position.x - projectile.position.x;
                const dy = planet.position.y - projectile.position.y;
                const planetRadius = planet.circleRadius || PLANET_MIN_RADIUS; // Use a fallback
                const distanceSq = dx * dx + dy * dy;
                const distance = Math.sqrt(distanceSq);

                // Calculate effective radius with a bonus for larger planets
                // Bonus scales quadratically with radius relative to world width
                const effectiveRadius = planetRadius * (1 + GRAVITY_AOE_BONUS_FACTOR * (planetRadius / VIRTUAL_WIDTH));

                // Only apply gravity if the projectile is outside the planet
                if (distance > planetRadius) { 
                    // Use effectiveRadius in the force calculation
                    const forceMagnitude = (GRAVITY_CONSTANT * effectiveRadius * projectile.mass) / distanceSq;
                    const force = {
                        x: (dx / distance) * forceMagnitude,
                        y: (dy / distance) * forceMagnitude,
                    };
                    Body.applyForce(projectile, projectile.position, force);
                }
            });

            // --- Projectile Timeout Check ---
            const age = Date.now() - projectile.custom.createdAt;
            if (age > 45000) { // Timeout after 45000ms (45 seconds)
                console.log('Projectile timed out', projectile.id);
                World.remove(engineRef.current!.world, projectile);
                return; // Stop processing this projectile
            }

            // --- Collision Checks ---
            // Planet Collision
            const planetCollisions = Matter.Query.collides(projectile, planets);
            if (planetCollisions.length > 0) {
                console.log('Projectile hit planet', projectile.id, planetCollisions[0].bodyA.id, planetCollisions[0].bodyB.id);
                World.remove(engineRef.current!.world, projectile);
                return; // Stop processing this projectile
            }

            // Ship Collision
            const ships = Composite.allBodies(engineRef.current!.world).filter(b => b.label.startsWith('ship-'));
            const shipCollisions = Matter.Query.collides(projectile, ships);
            if (shipCollisions.length > 0) {
                // Check if the collided ship is NOT the one that fired the projectile
                const collidedShip = shipCollisions[0].bodyA === projectile ? shipCollisions[0].bodyB : shipCollisions[0].bodyA;
                if (collidedShip.label !== projectile.custom.ownerShipLabel) {
                    console.log('Projectile hit opponent ship', projectile.id, collidedShip.label);
                    World.remove(engineRef.current!.world, projectile);
                    // TODO: Implement damage/hit logic here
                    // e.g., find ship index, update HP state in GameScreen
                    return; // Stop processing this projectile
                }
            }
        });
    };

    // Replace the old gravity update with the new combined update function
    Events.on(engineRef.current, 'beforeUpdate', updateProjectilesAndApplyGravity);

    // --- Start the runner ---
    Runner.run(runnerRef.current, engineRef.current);

    // --- Animation Loop ---
    let animationFrameId: number;
    const renderLoop = () => {
      if (!engineRef.current || !ctx || !canvas) {
        animationFrameId = requestAnimationFrame(renderLoop);
        return;
      }

      // --- Lerp Dynamic Viewport Target ---
      currentVirtualWidthRef.current += (targetVirtualWidthRef.current - currentVirtualWidthRef.current) * ZOOM_LERP_FACTOR;
      currentVirtualHeightRef.current += (targetVirtualHeightRef.current - currentVirtualHeightRef.current) * ZOOM_LERP_FACTOR;
      currentCenterXRef.current += (targetCenterXRef.current - currentCenterXRef.current) * ZOOM_LERP_FACTOR;
      currentCenterYRef.current += (targetCenterYRef.current - currentCenterYRef.current) * ZOOM_LERP_FACTOR;
      
      // --- Clear and Transform Canvas ---
      ctx.save(); // Save default state (identity transform)

      // 1. Clear canvas (whole canvas, pre-transform)
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      // 2. Apply Device Pixel Ratio Scaling
      const dpr = window.devicePixelRatio || 1;
      ctx.scale(dpr, dpr); 

      // 3. Apply Aspect Ratio Offset (calculated in CSS pixels)
      ctx.translate(offsetXRef.current, offsetYRef.current);
      
      // 4. Apply Aspect Ratio Scale (maps VIRTUAL coords to available screen space)
      ctx.scale(scaleRef.current, scaleRef.current);

      // --- Draw Background (covering the VIRTUAL space) ---
      if (backgroundImage) {
        const bgScaleX = VIRTUAL_WIDTH / backgroundImage.naturalWidth;
        const bgScaleY = VIRTUAL_HEIGHT / backgroundImage.naturalHeight;
        const bgScale = Math.max(bgScaleX, bgScaleY); 
        const bgWidth = backgroundImage.naturalWidth * bgScale;
        const bgHeight = backgroundImage.naturalHeight * bgScale;
        const bgX = (VIRTUAL_WIDTH - bgWidth) / 2;
        const bgY = (VIRTUAL_HEIGHT - bgHeight) / 2;
        ctx.drawImage(backgroundImage, bgX, bgY, bgWidth, bgHeight);
      } else {
        ctx.fillStyle = 'rgba(10, 10, 20, 1)'; // Dark blue fallback
        ctx.fillRect(0, 0, VIRTUAL_WIDTH, VIRTUAL_HEIGHT);
      }
     
      // --- 5. Apply Dynamic Zoom/Pan (relative to VIRTUAL space) ---
      // Calculate the scale factor needed to fit the dynamic view (currentVirtualWidth/Height)
      // into the base virtual view (VIRTUAL_WIDTH/HEIGHT).
      const dynamicZoomScaleX = VIRTUAL_WIDTH / currentVirtualWidthRef.current;
      const dynamicZoomScaleY = VIRTUAL_HEIGHT / currentVirtualHeightRef.current;
      // Use the smaller scale factor to ensure the entire dynamic area fits
      const dynamicZoomScale = Math.min(dynamicZoomScaleX, dynamicZoomScaleY);

      // Apply the transformations:
      // a. Translate origin to the center of the base virtual canvas
      ctx.translate(VIRTUAL_WIDTH / 2, VIRTUAL_HEIGHT / 2);
      // b. Scale by the dynamic zoom factor
      ctx.scale(dynamicZoomScale, dynamicZoomScale);
      // c. Translate back by the center of the *dynamic* view area
      ctx.translate(-currentCenterXRef.current, -currentCenterYRef.current);

      // --- Draw Game Objects (using Matter.js bodies) ---
      const bodies = Composite.allBodies(engineRef.current.world);

      bodies.forEach((body) => {
          ctx.beginPath();
          const { position } = body;
  
          // Adjust line width based on the combined scale (aspect ratio * dynamic zoom)
          const baseLineWidth = 1;
          // Effective scale is the product of the two scales applied
          const effectiveScale = scaleRef.current * dynamicZoomScale; 
          ctx.lineWidth = baseLineWidth / effectiveScale; 
  
          if (body.label === 'planet' && body.circleRadius) {
           ctx.moveTo(position.x + body.circleRadius, position.y);
           ctx.arc(position.x, position.y, body.circleRadius, 0, Math.PI * 2);
           ctx.fillStyle = 'grey';
           ctx.fill();
           ctx.strokeStyle = 'white';
           ctx.stroke();
           // TODO: Draw planet textures later
        } else if (body.label === 'projectile' && body.circleRadius) {
           ctx.moveTo(position.x + body.circleRadius, position.y);
           ctx.arc(position.x, position.y, body.circleRadius, 0, Math.PI * 2);
           ctx.fillStyle = 'yellow'; // Projectile color
           ctx.fill();
        } else if (body.label.startsWith('ship-') && body.circleRadius) {
           // Use circleRadius as a general size indicator for the triangle
           const size = body.circleRadius;
           // Get angle (currently 0 for static ships, but use it for future rotation)
           // Note: Matter.js angle is 0 = right, positive = clockwise. Adjust if aiming logic differs.
           const angle = body.angle;

           ctx.save(); // Save context state
           ctx.translate(position.x, position.y); // Move origin to body center
           ctx.rotate(angle); // Rotate coordinate system

           // Draw the triangle pointing along the new x-axis (which is the direction of 'angle')
           ctx.beginPath();
           ctx.moveTo(size, 0); // Tip of the triangle (adjust multiplier if needed)
           ctx.lineTo(-size / 2, -size / 1.5); // Back left corner (adjusted for better shape)
           ctx.lineTo(-size / 2, size / 1.5);  // Back right corner (adjusted for better shape)
           ctx.closePath();

           // Set color based on label
           ctx.fillStyle = body.label === 'ship-0' ? 'blue' : 'red';
           ctx.fill();
           ctx.strokeStyle = 'white';
           ctx.stroke();

           ctx.restore(); // Restore context state for this specific body drawing
           // TODO: Draw ship textures later instead of primitives
        }
      });

      // --- Restore Canvas State ---
      ctx.restore(); // Restore to the state before transforms

      // Request next frame
      animationFrameId = requestAnimationFrame(renderLoop);
    };

    // Start the loop
    animationFrameId = requestAnimationFrame(renderLoop);

    // --- Cleanup ---
    return () => {
      console.log('[GameRenderer] Cleaning up...');
      // --- NEW: Remove resize listener ---
      window.removeEventListener('resize', handleResize);

      // Stop the animation loop
      cancelAnimationFrame(animationFrameId);
      // Stop the runner
      if (runnerRef.current) {
        Runner.stop(runnerRef.current);
      }
      // Clear the engine
      if (engineRef.current) {
        // --- Remove Gravity Listener ---
        Events.off(engineRef.current, 'beforeUpdate', updateProjectilesAndApplyGravity);
        // --- End Remove ---
        World.clear(engineRef.current.world, false);
        Engine.clear(engineRef.current);
      }
      // Nullify refs
      engineRef.current = null;
      runnerRef.current = null;
    };
    // Rerun effect only if canvas or backgroundImage changes (though backgroundImage is handled separately for drawing)
    // Primarily depends on canvas ref being available.
    // Add initialPositions as a dependency so Matter world is rebuilt if positions change
  }, [backgroundImage, initialPositions]); // Add player positions as dependencies if they can change

  // Style the canvas to fill its container
  // The container size will be managed by GameScreen.tsx
  const canvasStyle: React.CSSProperties = {
    display: 'block', // Prevent extra space below canvas
    width: '100%',
    height: '100%',
    backgroundColor: '#000020', // Ensure background while image loads
  };

  return (
    <canvas
      ref={canvasRef}
      // Remove fixed width/height attributes
      // The canvas element will now inherit size from its CSS-styled container
      style={canvasStyle}
    />
  );
});

export default GameRenderer; 