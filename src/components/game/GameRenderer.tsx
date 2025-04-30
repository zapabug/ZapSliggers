import React, { useRef, useEffect, useState, forwardRef, useImperativeHandle } from 'react';
import Matter from 'matter-js'; // Import Matter.js
import { useShotTracers } from '../../hooks/useShotTracers'; // Corrected import path

// Destructure Matter.js modules
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const { Engine, Runner, Bodies, World, Composite, Vector, Body, Events } = Matter;

// Define an interface for our projectile body with custom properties
// Ensure this matches the definition in useShotTracers.ts
interface ProjectileBody extends Matter.Body {
  custom: {
    createdAt: number;
    firedByPlayerIndex: 0 | 1;
    ownerShipLabel: string;
  };
  // Trail storage must be on the body for the update loop to easily access it
  trail?: Matter.Vector[]; // Use Matter.Vector type
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
const SHIP_RADIUS = 25; // Visual/Physics radius of ships
const PLANET_MIN_RADIUS = 30; // Increased from 40
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
  fireProjectile: (playerIndex: 0 | 1, power: number) => void;
  setShipAim: (playerIndex: 0 | 1, angleDegrees: number) => void;
  getShipAngle: (playerIndex: 0 | 1) => number | undefined;
}

const GameRenderer = forwardRef<GameRendererRef, GameRendererProps>((props, ref) => {
  // Remove default positions from props destructuring, they will be generated
  // const { player1Pos = { x: 100, y: 500 }, player2Pos = { x: 700, y: 500 } } = props;
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [backgroundImage, setBackgroundImage] = useState<HTMLImageElement | null>(null);
  const engineRef = useRef<Matter.Engine | null>(null);
  const runnerRef = useRef<Matter.Runner | null>(null);
  const shipBodiesRef = useRef<(Matter.Body | null)[]>([null, null]); // Store ship bodies

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

  // --- Use the Shot Tracers Hook --- 
  const { 
    projectileTrails,
    lastShotTraces,
    handleProjectileFired,
    handleProjectileUpdate,
    handleProjectileRemoved,
    resetTraces
  } = useShotTracers();

  // --- NEW: Ref to hold the latest historical traces for the render loop ---
  const latestTracesRef = useRef(lastShotTraces);

  // --- NEW: Effect to update the ref whenever the state changes ---
  useEffect(() => {
    latestTracesRef.current = lastShotTraces;
  }, [lastShotTraces]);

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

  // --- Expose methods via ref ---
  useImperativeHandle(ref, () => ({
    // --- Modified fireProjectile ---
    fireProjectile: (playerIndex: 0 | 1, power: number) => {
      if (!engineRef.current) return;

      // --- Clear the previous "last shot trace" (now handled by the hook) ---
      // lastShotTracesRef.current[playerIndex] = undefined; // REMOVE THIS LINE
      // ---

      const shipLabel = `ship-${playerIndex}`;
      const shipBody = shipBodiesRef.current[playerIndex];

      if (!shipBody) {
        console.error(`Could not find ship body with label ${shipLabel}`);
        return;
      }

      const shipAngle = shipBody.angle; 
      const shipPosition = shipBody.position;
      const clampedPower = Math.min(Math.max(power, 0.1), 5); 
      const velocityScale = 5 * clampedPower;
      const finalLaunchAngleRad = shipAngle;
      const spawnOffset = SHIP_RADIUS * 1.1; 
      const startX = shipPosition.x + spawnOffset * Math.cos(shipAngle);
      const startY = shipPosition.y + spawnOffset * Math.sin(shipAngle);
      const velocityX = Math.cos(finalLaunchAngleRad) * velocityScale;
      const velocityY = Math.sin(finalLaunchAngleRad) * velocityScale;
      const projectileRadius = 5;

      const projectile = Bodies.circle(
        startX, 
        startY,
        projectileRadius,
        {
          label: 'projectile',
          frictionAir: 0.01,
          restitution: 0.6, 
          density: 0.01,
          angle: finalLaunchAngleRad 
        }
      ) as ProjectileBody; // Cast to our interface

      projectile.custom = { 
        createdAt: Date.now(),
        firedByPlayerIndex: playerIndex,
        ownerShipLabel: `projectile-${playerIndex}-${Date.now()}`
      };
      
      // --- Initialize trail and call hook handler ---
      projectile.trail = []; // Initialize trail array on the body
      handleProjectileFired(projectile); // Notify the hook
      // ---

      World.add(engineRef.current.world, projectile);
      Body.setVelocity(projectile, { x: velocityX, y: velocityY });

      console.log(`Fired projectile for player ${playerIndex} ShipAngle: ${shipAngle.toFixed(2)}, Power: ${power}, Vel: (${velocityX.toFixed(2)}, ${velocityY.toFixed(2)})`);
    },

    // --- New setShipAim method ---
    setShipAim: (playerIndex: 0 | 1, angleDegrees: number) => {
      if (!engineRef.current) return;

      const shipLabel = `ship-${playerIndex}`;
      const shipBody = Composite.allBodies(engineRef.current.world).find(b => b.label === shipLabel);

      if (!shipBody) {
        console.warn(`setShipAim: Could not find ship body with label ${shipLabel}`); // Warn instead of error maybe?
        return;
      }

      // Convert degrees to radians. 
      // IMPORTANT: Adjust based on UI orientation. Assuming 0 degrees from UI means pointing right.
      // Matter.js angle: 0 = right, positive = clockwise.
      // If UI 0 degrees = up, subtract 90 degrees first: (angleDegrees - 90) * (Math.PI / 180);
      const angleRad = angleDegrees * (Math.PI / 180);

      Body.setAngle(shipBody, angleRad);
      // console.log(`Set ship ${playerIndex} angle to ${angleDegrees} degrees (${angleRad.toFixed(2)} rad)`);
    },

    // --- New getShipAngle method ---
    getShipAngle: (playerIndex: 0 | 1): number | undefined => {
      if (!engineRef.current) return undefined;
      const shipLabel = `ship-${playerIndex}`;
      const shipBody = Composite.allBodies(engineRef.current.world).find(b => b.label === shipLabel);
      // Convert radians to degrees before returning
      return shipBody ? (shipBody.angle * (180 / Math.PI) + 360) % 360 : undefined; 
    }

  }));

  // --- Main Setup and Cleanup useEffect --- 
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !initialPositions) return;

    const { clientWidth, clientHeight } = canvas;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = clientWidth * dpr;
    canvas.height = clientHeight * dpr;
    const ctx = canvas.getContext('2d');
    if (!ctx) return; 

    const handleResize = () => {
        const canvasEl = canvasRef.current;
        if (!canvasEl) return;
        const width = canvasEl.clientWidth;
        const height = canvasEl.clientHeight;
        const currentDpr = window.devicePixelRatio || 1;
        canvasEl.width = width * currentDpr;
        canvasEl.height = height * currentDpr;
        const currentAspectRatio = width / height;
        let newScale = 1;
        let newOffsetX = 0;
        let newOffsetY = 0;
        if (currentAspectRatio > DESIGN_ASPECT_RATIO) {
            newScale = height / VIRTUAL_HEIGHT;
            newOffsetX = (width - VIRTUAL_WIDTH * newScale) / 2;
            newOffsetY = 0;
        } else {
            newScale = width / VIRTUAL_WIDTH;
            newOffsetX = 0;
            newOffsetY = (height - VIRTUAL_HEIGHT * newScale) / 2;
        }
        scaleRef.current = newScale;
        offsetXRef.current = newOffsetX; 
        offsetYRef.current = newOffsetY;
        const context = canvasEl.getContext('2d');
        if (context) context.setTransform(1, 0, 0, 1, 0, 0);
    };
    handleResize(); 
    window.addEventListener('resize', handleResize);

    engineRef.current = Engine.create();
    const world = engineRef.current.world;
    world.gravity.y = 0; 
    runnerRef.current = Runner.create();
    World.add(world, initialPositions.planets);
     const shipBodies = initialPositions.ships.map((pos, index) =>
        Bodies.circle(pos.x, pos.y, SHIP_RADIUS, {
            isStatic: true,
            label: `ship-${index}`,
            angle: index === 1 ? Math.PI : 0 
        })
     );
     World.add(world, shipBodies);
     shipBodiesRef.current[0] = shipBodies[0];
     shipBodiesRef.current[1] = shipBodies[1];

    // --- Physics Update Loop --- (Restored)
    const updateProjectilesAndApplyGravity = () => {
        if (!engineRef.current) return;
        const projectiles = Composite.allBodies(engineRef.current.world).filter(
            (body): body is ProjectileBody => body.label === 'projectile'
        );
        const planets = Composite.allBodies(engineRef.current.world).filter(
            (body) => body.label === 'planet'
        );
        const projectilesToRemove: ProjectileBody[] = [];

        // --- Update Viewport --- (Restored)
        const ships = shipBodiesRef.current.filter(b => b !== null) as Matter.Body[];
        const activeObjects = [...ships, ...projectiles];
        let minX = VIRTUAL_WIDTH, maxX = 0, minY = VIRTUAL_HEIGHT, maxY = 0;
        if (activeObjects.length > 0) {
            activeObjects.forEach(obj => {
                minX = Math.min(minX, obj.position.x - (obj.circleRadius || 0));
                maxX = Math.max(maxX, obj.position.x + (obj.circleRadius || 0));
                minY = Math.min(minY, obj.position.y - (obj.circleRadius || 0));
                maxY = Math.max(maxY, obj.position.y + (obj.circleRadius || 0));
            });
        } else { 
            const defaultViewWidthFactor = 1 / 1.66;
            const defaultViewHeightFactor = 1 / 1.66;
            minX = VIRTUAL_WIDTH / 2 - (VIRTUAL_WIDTH * defaultViewWidthFactor / 2);
            maxX = VIRTUAL_WIDTH / 2 + (VIRTUAL_WIDTH * defaultViewWidthFactor / 2);
            minY = VIRTUAL_HEIGHT / 2 - (VIRTUAL_HEIGHT * defaultViewHeightFactor / 2);
            maxY = VIRTUAL_HEIGHT / 2 + (VIRTUAL_HEIGHT * defaultViewHeightFactor / 2);
        }
        minX -= VIEWPORT_PADDING;
        maxX += VIEWPORT_PADDING;
        minY -= VIEWPORT_PADDING;
        maxY += VIEWPORT_PADDING;
        let requiredWidth = Math.max(maxX - minX, VIRTUAL_WIDTH / MAX_ZOOM_FACTOR); 
        let requiredHeight = Math.max(maxY - minY, VIRTUAL_HEIGHT / MAX_ZOOM_FACTOR); 
        const requiredCenterX = (minX + maxX) / 2;
        const requiredCenterY = (minY + maxY) / 2;
        const originalAspectRatio = VIRTUAL_WIDTH / VIRTUAL_HEIGHT;
        const requiredAspectRatio = requiredWidth / requiredHeight;
        if (requiredAspectRatio > originalAspectRatio) {
            requiredHeight = requiredWidth / originalAspectRatio;
        } else {
            requiredWidth = requiredHeight * originalAspectRatio;
        }
        requiredWidth = Math.min(requiredWidth, VIRTUAL_WIDTH * MAX_ZOOM_FACTOR);
        requiredHeight = Math.min(requiredHeight, VIRTUAL_HEIGHT * MAX_ZOOM_FACTOR);
        targetVirtualWidthRef.current = requiredWidth;
        targetVirtualHeightRef.current = requiredHeight;
        targetCenterXRef.current = requiredCenterX;
        targetCenterYRef.current = requiredCenterY;

        projectiles.forEach((projectile) => {
            // Apply gravity 
            planets.forEach((planet) => {
                const dx = planet.position.x - projectile.position.x;
                const dy = planet.position.y - projectile.position.y;
                const planetRadius = planet.circleRadius || PLANET_MIN_RADIUS;
                const distanceSq = dx * dx + dy * dy;
                if (distanceSq === 0) return; 
                const distance = Math.sqrt(distanceSq);
                const effectiveRadius = planetRadius * (1 + GRAVITY_AOE_BONUS_FACTOR * (planetRadius / VIRTUAL_WIDTH));
                if (distance > planetRadius) { 
                    const forceMagnitude = (GRAVITY_CONSTANT * effectiveRadius * projectile.mass) / distanceSq;
                    const force = { x: (dx / distance) * forceMagnitude, y: (dy / distance) * forceMagnitude };
                    Body.applyForce(projectile, projectile.position, force);
                }
            });

            handleProjectileUpdate(projectile);

            const age = Date.now() - projectile.custom.createdAt;
            if (age > 45000) { 
                console.log('Projectile timed out', projectile.id);
                handleProjectileRemoved(projectile); 
                projectilesToRemove.push(projectile); 
            }
        });

        projectilesToRemove.forEach(p => {
            if (engineRef.current) {
                Composite.remove(engineRef.current.world, p);
            }
        });
    };
    Events.on(engineRef.current, 'beforeUpdate', updateProjectilesAndApplyGravity);

    // --- Collision Handling --- (Restored)
    const handleCollisions = (event: Matter.IEventCollision<Matter.Engine>) => {
        event.pairs.forEach(pair => {
            const { bodyA, bodyB } = pair;
            let projectile: ProjectileBody | null = null;
            let otherBody: Matter.Body | null = null;
            if (bodyA.label === 'projectile') {
                projectile = bodyA as ProjectileBody;
                otherBody = bodyB;
            } else if (bodyB.label === 'projectile') {
                projectile = bodyB as ProjectileBody;
                otherBody = bodyA;
            }
            if (projectile && otherBody && engineRef.current && projectile.trail) { 
                console.log(`Collision: Proj ${projectile.id} hit ${otherBody.label} ${otherBody.id}`);
                handleProjectileRemoved(projectile); 
                Composite.remove(engineRef.current.world, projectile); 
                if (otherBody.label.startsWith('ship-')) {
                    const firingPlayerIndex = projectile.custom.firedByPlayerIndex;
                    const targetPlayerLabel = `ship-${1 - firingPlayerIndex}`;
                    if (otherBody.label === targetPlayerLabel) {
                        console.log(`Player ${firingPlayerIndex} HIT Player ${1 - firingPlayerIndex}!`);
                    }
                }
            }
        });
    };
    Events.on(engineRef.current, 'collisionStart', handleCollisions);

    // Start Runner
    Runner.run(runnerRef.current, engineRef.current);

    // --- Animation Loop --- 
    let animationFrameId: number;
    const renderLoop = () => {
        // ... (Restored rendering logic, including body drawing) ...
        const engine = engineRef.current;
        const canvas = canvasRef.current;
        const ctx = canvas?.getContext('2d');
        if (!engine || !canvas || !ctx) {
          animationFrameId = requestAnimationFrame(renderLoop);
          return;
        }
        currentVirtualWidthRef.current += (targetVirtualWidthRef.current - currentVirtualWidthRef.current) * ZOOM_LERP_FACTOR;
        currentVirtualHeightRef.current += (targetVirtualHeightRef.current - currentVirtualHeightRef.current) * ZOOM_LERP_FACTOR;
        currentCenterXRef.current += (targetCenterXRef.current - currentCenterXRef.current) * ZOOM_LERP_FACTOR;
        currentCenterYRef.current += (targetCenterYRef.current - currentCenterYRef.current) * ZOOM_LERP_FACTOR;
        ctx.save();
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        const dpr = window.devicePixelRatio || 1;
        ctx.scale(dpr, dpr);
        ctx.translate(offsetXRef.current, offsetYRef.current);
        ctx.scale(scaleRef.current, scaleRef.current);
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
            ctx.fillStyle = 'rgba(10, 10, 20, 1)';
            ctx.fillRect(0, 0, VIRTUAL_WIDTH, VIRTUAL_HEIGHT);
        }
        const dynamicZoomScaleX = VIRTUAL_WIDTH / currentVirtualWidthRef.current;
        const dynamicZoomScaleY = VIRTUAL_HEIGHT / currentVirtualHeightRef.current;
        const dynamicZoomScale = Math.max(0.001, Math.min(dynamicZoomScaleX, dynamicZoomScaleY)); 
        ctx.translate(VIRTUAL_WIDTH / 2, VIRTUAL_HEIGHT / 2);
        ctx.scale(dynamicZoomScale, dynamicZoomScale);
        ctx.translate(-currentCenterXRef.current, -currentCenterYRef.current);
        const effectiveScale = scaleRef.current * dynamicZoomScale;

        // *** USE REF HERE ***
        // Access the latest traces via the ref
        const currentLastTraces = latestTracesRef.current; 
        console.log(`[RenderLoop] Drawing historical traces. P0: ${currentLastTraces[0].length}, P1: ${currentLastTraces[1].length}`);
        
        // Draw Last 10 Shot Traces (Dashed Lines - MORE VISIBLE)
        ctx.save();
        ctx.lineWidth = 2 / effectiveScale; 
        ctx.globalAlpha = 0.8; 
        ctx.setLineDash([10 / effectiveScale, 5 / effectiveScale]); 
        ([0, 1] as const).forEach(playerIndex => {
            // Use the ref's value for drawing
            currentLastTraces[playerIndex].forEach((trace: Matter.Vector[]) => {
                if (trace.length > 1) {
                    ctx.strokeStyle = '#00FF00'; // Bright Green for testing
                    ctx.beginPath();
                    ctx.moveTo(trace[0].x, trace[0].y);
                    for (let i = 1; i < trace.length; i++) {
                        ctx.lineTo(trace[i].x, trace[i].y);
                    }
                    ctx.stroke();
                }
            });
        });
        ctx.setLineDash([]); 
        ctx.restore(); 

        // Draw Active Projectile Trails (Solid Lines - Use direct map ref from hook)
        ctx.save();
        ctx.lineWidth = 3 / effectiveScale; 
        projectileTrails.forEach((trail: Matter.Vector[], projectileId: number) => {
             // ... active trail drawing ...
            const projectileBody = Composite.get(engine.world, projectileId, 'body') as ProjectileBody | undefined;
            if (trail.length > 1 && projectileBody) {
                ctx.strokeStyle = projectileBody.custom.firedByPlayerIndex === 0 ? '#66f' : '#f66'; 
                ctx.beginPath();
                ctx.moveTo(trail[0].x, trail[0].y);
                for (let i = 1; i < trail.length; i++) {
                    ctx.lineTo(trail[i].x, trail[i].y);
                }
                ctx.stroke();
            }
        });
        ctx.restore();

        // Draw Bodies 
        // ... (body drawing logic) ...
        const bodies = Composite.allBodies(engine.world);
        bodies.forEach((body) => {
             ctx.beginPath();
              const { position } = body;
              ctx.lineWidth = 1 / effectiveScale; 
              if (body.label === 'planet' && body.circleRadius) {
               ctx.moveTo(position.x + body.circleRadius, position.y);
               ctx.arc(position.x, position.y, body.circleRadius, 0, Math.PI * 2);
               ctx.fillStyle = 'grey';
               ctx.fill();
               ctx.strokeStyle = 'white';
               ctx.stroke();
            } else if (body.label === 'projectile' && body.circleRadius) {
               ctx.moveTo(position.x + body.circleRadius, position.y);
               ctx.arc(position.x, position.y, body.circleRadius, 0, Math.PI * 2);
               const projBody = body as ProjectileBody;
               ctx.fillStyle = projBody.custom?.firedByPlayerIndex === 0 ? '#66f' : '#f66';
               ctx.fill();
            } else if (body.label.startsWith('ship-') && body.circleRadius) {
               const size = body.circleRadius * 1.5; 
               const angle = body.angle;
               ctx.save();
               ctx.translate(position.x, position.y);
               ctx.rotate(angle);
               ctx.beginPath();
               ctx.moveTo(size * 0.75, 0); 
               ctx.lineTo(-size * 0.5, -size * 0.6); 
               ctx.lineTo(-size * 0.5, size * 0.6);  
               ctx.closePath();
               ctx.fillStyle = body.label === 'ship-0' ? '#00f' : '#f00';
               ctx.fill();
               ctx.strokeStyle = 'white';
               ctx.stroke();
               ctx.restore();
            }
        });

        ctx.restore(); // Restore transforms
        animationFrameId = requestAnimationFrame(renderLoop);
    };

    renderLoop(); // Start the loop

    // --- Cleanup --- 
    return () => {
      console.log('[GameRenderer] Cleaning up...');
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(animationFrameId);
      if (runnerRef.current) {
        Runner.stop(runnerRef.current);
      }
      if (engineRef.current) {
        Events.off(engineRef.current, 'beforeUpdate', updateProjectilesAndApplyGravity);
        Events.off(engineRef.current, 'collisionStart', handleCollisions); 
        World.clear(engineRef.current.world, false);
        Engine.clear(engineRef.current);
      }
      engineRef.current = null;
      runnerRef.current = null;
      shipBodiesRef.current = [null, null];
      resetTraces(); 
    };
    // Revert dependency array to original state
}, [initialPositions, backgroundImage]); 

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