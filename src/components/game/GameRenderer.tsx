import React, { useRef, useEffect, useState, forwardRef, useImperativeHandle, ForwardedRef } from 'react';
import Matter from 'matter-js'; // Import Matter.js
import { useShotTracers, ProjectileBody } from '../../hooks/useShotTracers'; // Corrected import path
import { useGameInitialization } from '../../hooks/useGameInitialization';
import { AbilityType } from '../ui_overlays/ActionButtons'; // Import AbilityType

// Destructure Matter.js modules
const { Engine, Runner, Bodies, World, Composite, Vector, Body, Events } = Matter;

// --- Constants (Keep only those used directly in this file) ---
const VIRTUAL_WIDTH = 2400;
const VIRTUAL_HEIGHT = 1200;
const SHIP_RADIUS = 63;
const PLANET_MIN_RADIUS = 30; // Used as fallback
const GRAVITY_CONSTANT = 0.5;
const GRAVITY_AOE_BONUS_FACTOR = 0.1;
const DESIGN_ASPECT_RATIO = VIRTUAL_WIDTH / VIRTUAL_HEIGHT;

// --- REMOVED Unused Constants ---
// const MIN_SHIP_SEPARATION_FACTOR = 0.4;
// const MIN_PLANET_SHIP_DISTANCE = 150;
// const MIN_PLANET_PLANET_DISTANCE = 50;
// const SHIP_START_AREA_WIDTH_FACTOR = 0.25;
// const NUM_PLANETS = 3;
// const PLANET_MAX_RADIUS = 180;
// const EDGE_PADDING = 50;
// const PLANET_SPAWN_AREA_FACTOR = 0.8;

// --- REMOVED Unused Helper Function ---
// const calculateDistance = (p1: { x: number; y: number }, p2: { x: number; y: number }) => { ... };

// Define props for the GameRenderer component
interface GameRendererProps {
  // TODO: Add necessary props later, e.g., game state, level data, dimensions
  gameId?: string; // Placeholder prop to satisfy linter
  player1Pos?: { x: number; y: number }; // Starting position for player 1 (example)
  player2Pos?: { x: number; y: number }; // Starting position for player 2 (example)
  onRoundWin: (winningPlayerIndex: 0 | 1) => void; // Callback for round win
}

// Define the interface for the methods exposed via the ref
export interface GameRendererRef {
  fireProjectile: (playerIndex: 0 | 1, power: number, abilityType: AbilityType | null) => void;
  setShipAim: (playerIndex: 0 | 1, angleDegrees: number) => void;
  getShipAngle: (playerIndex: 0 | 1) => number | undefined;
}

const ZOOM_LERP_FACTOR = 0.08; // How fast to zoom/pan (0-1)

// --- NEW: HP Constants (defined outside component) ---
const STARTING_HP = 100;
const PROJECTILE_DAMAGE = 25; // Example damage value

const GameRenderer = forwardRef<GameRendererRef, GameRendererProps>((props: GameRendererProps, ref: ForwardedRef<GameRendererRef>) => {
  // Remove default positions from props destructuring, they will be generated
  // const { player1Pos = { x: 100, y: 500 }, player2Pos = { x: 700, y: 500 } } = props;
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [backgroundImage, setBackgroundImage] = useState<HTMLImageElement | null>(null);
  const engineRef = useRef<Matter.Engine | null>(null);
  const runnerRef = useRef<Matter.Runner | null>(null);
  const shipBodiesRef = useRef<(Matter.Body | null)[]>([null, null]); // Store ship bodies
  // --- NEW: Player HP State ---
  const [playerHP, setPlayerHP] = useState<[number, number]>([STARTING_HP, STARTING_HP]);

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
  const MAX_VIEW_FACTOR = 1.5; // NEW: Allow zooming out to show 1.5x the virtual area
  const VIEWPORT_PADDING = 100; // Pixels to keep around edges

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

  // --- Use Hooks ---
  const initialPositions = useGameInitialization();

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

  // *** Restore useImperativeHandle ***
  useImperativeHandle(ref, () => ({
    fireProjectile: (playerIndex: 0 | 1, power: number, abilityType: AbilityType | null) => {
        if (!engineRef.current) return;
        const shipBody = shipBodiesRef.current[playerIndex];
        if (!shipBody) {
            console.error(`Could not find ship body for player ${playerIndex}`);
            return;
        }

        console.log(`[fireProjectile] Firing for P${playerIndex} with Ability: ${abilityType || 'Standard'}`);

        // TODO: Implement logic based on abilityType
        // For now, just fire one standard projectile regardless

        const shipAngle = shipBody.angle;
        const shipPosition = shipBody.position;
        const clampedPower = Math.min(Math.max(power, 0.1), 5);
        const velocityScale = 5 * clampedPower;
        const finalLaunchAngleRad = shipAngle;
        const spawnOffset = SHIP_RADIUS * 1.1;
        const spawnX = shipPosition.x + Math.cos(finalLaunchAngleRad) * spawnOffset;
        const spawnY = shipPosition.y + Math.sin(finalLaunchAngleRad) * spawnOffset;
        const velocityX = Math.cos(finalLaunchAngleRad) * velocityScale;
        const velocityY = Math.sin(finalLaunchAngleRad) * velocityScale;

        const projectileId = Matter.Common.nextId();
        // Create the body without custom properties initially
        const projectile = Bodies.circle(spawnX, spawnY, 5, { 
            label: `projectile-${projectileId}`, 
            frictionAir: 0, friction: 0, restitution: 0.5, density: 0.1,
            id: projectileId // Assign the generated ID
            // Custom props added after creation
        }) as ProjectileBody; // Assert type here

        // Assign custom properties AFTER creation
        projectile.custom = { 
            createdAt: Date.now(),
            firedByPlayerIndex: playerIndex,
            ownerShipLabel: shipBody.label,
            abilityType: abilityType // Store the ability type used
        };
        projectile.trail = [Vector.clone({ x: spawnX, y: spawnY })];

        Body.setVelocity(projectile, { x: velocityX, y: velocityY });
        World.add(engineRef.current.world, projectile);
        console.log(`[fireProjectile] Fired projectile ${projectile.id} from P${playerIndex} power ${power.toFixed(2)}`);
        
        // Pass the whole projectile body to the hook
        handleProjectileFired(projectile);
    },
    setShipAim: (playerIndex: 0 | 1, angleDegrees: number) => {
        const shipBody = shipBodiesRef.current[playerIndex];
        if (shipBody) {
            Body.setAngle(shipBody, angleDegrees * (Math.PI / 180));
        }
    },
    getShipAngle: (playerIndex: 0 | 1) => {
        const shipBody = shipBodiesRef.current[playerIndex];
        return shipBody ? shipBody.angle * (180 / Math.PI) : undefined;
    },
  }));

  // --- Main Setup and Cleanup useEffect ---
  useEffect(() => {
    // Wait for canvas and initial positions from the hook
    if (!canvasRef.current || !initialPositions) {
      console.log("[GameRenderer Init] Waiting for canvas or initial positions...");
      return; // Exit if prerequisites not met
    }
    console.log("[GameRenderer Init] Initializing Matter.js...");

    const engine = Engine.create();
    engineRef.current = engine;
    engine.world.gravity.y = 0;
    engine.world.gravity.x = 0;

    const runner = Runner.create();
    runnerRef.current = runner;

    // Create ship and planet bodies using data from the hook
    const ship1Body = Bodies.circle(initialPositions.ships[0].x, initialPositions.ships[0].y, SHIP_RADIUS, {
        label: 'ship-0', restitution: 0.5, friction: 0.1, frictionAir: 0.01, angle: 0
    });
    const ship2Body = Bodies.circle(initialPositions.ships[1].x, initialPositions.ships[1].y, SHIP_RADIUS, {
        label: 'ship-1', restitution: 0.5, friction: 0.1, frictionAir: 0.01, angle: Math.PI
    });
    shipBodiesRef.current = [ship1Body, ship2Body];

    // --- Create Static Boundary Walls (Extended) ---
    const wallThickness = 50; // Thickness of the boundary walls
    const extendedWidth = VIRTUAL_WIDTH * 2; // Total width of the boundary box
    const extendedHeight = VIRTUAL_HEIGHT * 3; // MODIFIED: Total height of the boundary box

    const boundaries = [
        // Top wall (Center Y = -VIRTUAL_HEIGHT) - MODIFIED
        Bodies.rectangle(VIRTUAL_WIDTH / 2, -VIRTUAL_HEIGHT, extendedWidth, wallThickness, { isStatic: true, label: 'boundary' }),
        // Bottom wall (Center Y = VIRTUAL_HEIGHT * 2) - MODIFIED
        Bodies.rectangle(VIRTUAL_WIDTH / 2, VIRTUAL_HEIGHT * 2, extendedWidth, wallThickness, { isStatic: true, label: 'boundary' }),
        // Left wall (Center X = -VIRTUAL_WIDTH / 2) - Uses updated extendedHeight
        Bodies.rectangle(-VIRTUAL_WIDTH / 2, VIRTUAL_HEIGHT / 2, wallThickness, extendedHeight, { isStatic: true, label: 'boundary' }),
        // Right wall (Center X = VIRTUAL_WIDTH * 1.5) - Uses updated extendedHeight
        Bodies.rectangle(VIRTUAL_WIDTH * 1.5, VIRTUAL_HEIGHT / 2, wallThickness, extendedHeight, { isStatic: true, label: 'boundary' })
    ];
    // --- End Boundary Walls ---

    // Planets are already Matter.Body objects from the hook
    const allBodies = [ship1Body, ship2Body, ...initialPositions.planets, ...boundaries]; // Add boundaries to the world
    World.add(engine.world, allBodies);

    // --- Define physics update, collision, and render logic INSIDE useEffect ---

    const updateProjectilesAndApplyGravity = () => {
      const currentEngine = engineRef.current;
      if (!currentEngine) return;

      Composite.allBodies(currentEngine.world).forEach(body => {
        if (body.label.startsWith('projectile-')) {
          const projectileBody = body as ProjectileBody;
          // Access custom and trail directly
          if (!projectileBody.custom) {
              console.warn(`[Physics Update] Projectile ${projectileBody.id} missing custom data.`);
              return; 
          }
          if (!projectileBody.trail) {
              console.warn(`[Physics Update] Projectile ${projectileBody.id} missing trail array. Initializing.`);
              projectileBody.trail = [Vector.clone(projectileBody.position)]; // Initialize if somehow missing
          } else {
              projectileBody.trail.push(Vector.clone(projectileBody.position));
          }
          
          // Pass the whole body to the update hook
          handleProjectileUpdate(projectileBody);

          // Apply gravity from planets
          Composite.allBodies(currentEngine.world).forEach(staticBody => {
            if (staticBody.label === 'planet') {
              const distanceVector = Vector.sub(staticBody.position, projectileBody.position);
              const distanceSq = Vector.magnitudeSquared(distanceVector);
              if (distanceSq > 100) { // Min distance check (10 squared)
                  const planetRadius = staticBody.plugin?.klunkstr?.radius || PLANET_MIN_RADIUS;
                  const effectiveRadius = planetRadius * (1 + GRAVITY_AOE_BONUS_FACTOR * (planetRadius / VIRTUAL_WIDTH));
                  const forceMagnitude = (GRAVITY_CONSTANT * projectileBody.mass * effectiveRadius) / distanceSq;
                  const forceVector = Vector.mult(Vector.normalise(distanceVector), forceMagnitude);
                  Body.applyForce(projectileBody, projectileBody.position, forceVector);
              }
            }
          });

          // Check projectile timeout
          const now = Date.now();
          let shouldRemove = false;
          let removalReason = "";

          // Access custom.createdAt directly
          if (now - projectileBody.custom.createdAt > 45000) { 
              removalReason = "Timeout";
              shouldRemove = true;
          }

          // --- REDUNDANT OUT OF BOUNDS CHECK (COMMENTED OUT) --- 
          /* 
          const boundsPadding = 200; 
          if (!shouldRemove && (
              projectileBody.position.x < -boundsPadding || 
              projectileBody.position.x > VIRTUAL_WIDTH + boundsPadding ||
              projectileBody.position.y < -boundsPadding ||
              projectileBody.position.y > VIRTUAL_HEIGHT + boundsPadding
          )) {
              removalReason = "OutOfBounds";
              shouldRemove = true;
          }
          */
          // --- END REDUNDANT OUT OF BOUNDS CHECK ---

          if (shouldRemove) {
              console.log(`[${removalReason}] Removing proj ${projectileBody.id}`);
              // Pass the whole body to the removal hook
              handleProjectileRemoved(projectileBody);
              World.remove(currentEngine.world, projectileBody);
          }
        }
      });

      // --- Dynamic Viewport Update Logic --- 
      let minX = VIRTUAL_WIDTH, maxX = 0, minY = VIRTUAL_HEIGHT, maxY = 0;
      let hasDynamicBodies = false;
      Composite.allBodies(currentEngine.world).forEach(body => {
        if (body.label.startsWith('ship-') || body.label.startsWith('projectile-')) {
            hasDynamicBodies = true;
            const bounds = body.bounds;
            minX = Math.min(minX, bounds.min.x); maxX = Math.max(maxX, bounds.max.x);
            minY = Math.min(minY, bounds.min.y); maxY = Math.max(maxY, bounds.max.y);
        }
      });
      if (!hasDynamicBodies) { // Reset to default view if no dynamic bodies
          minX = VIRTUAL_WIDTH * 0.2; maxX = VIRTUAL_WIDTH * 0.8;
          minY = VIRTUAL_HEIGHT * 0.2; maxY = VIRTUAL_HEIGHT * 0.8;
      }
      let requiredWidth = (maxX - minX) + 2 * VIEWPORT_PADDING;
      let requiredHeight = (maxY - minY) + 2 * VIEWPORT_PADDING;
      const centerX = (minX + maxX) / 2; const centerY = (minY + maxY) / 2;
      // Adjust for aspect ratio
      if (requiredWidth / requiredHeight > DESIGN_ASPECT_RATIO) {
        requiredHeight = requiredWidth / DESIGN_ASPECT_RATIO;
      } else {
        requiredWidth = requiredHeight * DESIGN_ASPECT_RATIO;
      }
      // Clamp zoom
      // Max zoom in (minimum view size)
      requiredWidth = Math.max(requiredWidth, VIRTUAL_WIDTH / MAX_ZOOM_FACTOR);
      requiredHeight = Math.max(requiredHeight, VIRTUAL_HEIGHT / MAX_ZOOM_FACTOR);
      // Max zoom out (maximum view size) - MODIFIED
      requiredWidth = Math.min(requiredWidth, VIRTUAL_WIDTH * MAX_VIEW_FACTOR);
      requiredHeight = Math.min(requiredHeight, VIRTUAL_HEIGHT * MAX_VIEW_FACTOR);
      
      // Set target refs directly (lerping happens in render loop update)
      targetVirtualWidthRef.current = requiredWidth;
      targetVirtualHeightRef.current = requiredHeight;
      targetCenterXRef.current = centerX;
      targetCenterYRef.current = centerY;
    }; // End of updateProjectilesAndApplyGravity

    const handleCollisions = (event: Matter.IEventCollision<Matter.Engine>) => {
      const currentEngine = engineRef.current;
      if (!currentEngine) return;

      event.pairs.forEach(pair => {
          const { bodyA, bodyB } = pair;
          let projectile: ProjectileBody | null = null;
          let otherBody: Matter.Body | null = null;
          if (bodyA.label.startsWith('projectile-')) { projectile = bodyA as ProjectileBody; otherBody = bodyB; }
          else if (bodyB.label.startsWith('projectile-')) { projectile = bodyB as ProjectileBody; otherBody = bodyA; }

          if (projectile && otherBody) {
              // Access custom directly
              if (!projectile.custom) {
                  console.warn(`[Collision] Projectile ${projectile.id} involved in collision missing custom data.`);
                  // Remove projectile even if data is missing to prevent it flying forever
                  handleProjectileRemoved(projectile);
                  World.remove(currentEngine.world, projectile);
                  return; 
              } 

              const firedByPlayerIndex = projectile.custom.firedByPlayerIndex;
              let projectileRemoved = false; // Track if projectile is handled

              if (otherBody.label === 'planet') {
                  console.log(`[Collision] Proj ${projectile.id} hit planet ${otherBody.id}`);
                  handleProjectileRemoved(projectile);
                  World.remove(currentEngine.world, projectile);
                  projectileRemoved = true;
              } else if (otherBody.label.startsWith('ship-')) {
                  const hitPlayerIndex = parseInt(otherBody.label.split('-')[1], 10) as 0 | 1;
                  // Access custom.firedByPlayerIndex directly
                  if (hitPlayerIndex !== firedByPlayerIndex) { 
                      console.log(`[Collision] Proj ${projectile.id} (from P${firedByPlayerIndex}) hit P${hitPlayerIndex}`);
                      
                      // --- NEW: Update HP State ---
                      setPlayerHP(currentHP => {
                          const newHP: [number, number] = [...currentHP];
                          newHP[hitPlayerIndex] = Math.max(0, newHP[hitPlayerIndex] - PROJECTILE_DAMAGE);
                          console.log(`[HP Update] P${hitPlayerIndex} HP: ${currentHP[hitPlayerIndex]} -> ${newHP[hitPlayerIndex]}`);
                          
                          // Check for win condition *after* HP update
                          if (newHP[hitPlayerIndex] <= 0) {
                              console.log(`[Win Condition] P${hitPlayerIndex} defeated. P${firedByPlayerIndex} wins!`);
                              // Call the callback passed via props with the *winning* player index
                              props.onRoundWin(firedByPlayerIndex); 
                          }
                          return newHP;
                      });

                      // Remove projectile after processing hit
                      handleProjectileRemoved(projectile);
                      World.remove(currentEngine.world, projectile);
                      projectileRemoved = true;
                  } else {
                      // Optional: Handle hitting your own projectile? Ignore for now.
                      // console.log(`[Collision] Proj ${projectile.id} hit its own ship P${hitPlayerIndex}. Ignoring.`);
                  }
              } else if (otherBody.label === 'boundary') { 
                  console.log(`[Collision] Proj ${projectile.id} hit boundary`);
                  handleProjectileRemoved(projectile);
                  World.remove(currentEngine.world, projectile); 
                  projectileRemoved = true;
              }

              // Ensure projectile is removed if it hit something unexpected (shouldn't happen often)
              if (!projectileRemoved) {
                  console.warn(`[Collision Warning] Proj ${projectile.id} collided with unhandled body: ${otherBody.label}. Removing projectile.`);
                  handleProjectileRemoved(projectile);
                  World.remove(currentEngine.world, projectile);
              }
          }
      });

    }; // End of handleCollisions

    const renderLoop = () => {
      if (!canvasRef.current || !engineRef.current) return;
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      // --- Lerp Viewport Towards Target ---
      currentVirtualWidthRef.current += (targetVirtualWidthRef.current - currentVirtualWidthRef.current) * ZOOM_LERP_FACTOR;
      currentVirtualHeightRef.current += (targetVirtualHeightRef.current - currentVirtualHeightRef.current) * ZOOM_LERP_FACTOR;
      currentCenterXRef.current += (targetCenterXRef.current - currentCenterXRef.current) * ZOOM_LERP_FACTOR;
      currentCenterYRef.current += (targetCenterYRef.current - currentCenterYRef.current) * ZOOM_LERP_FACTOR;

      // --- Calculate Final Viewport Scale and Offset for Rendering ---
      const scaleX = canvas.width / currentVirtualWidthRef.current;
      const scaleY = canvas.height / currentVirtualHeightRef.current;
      const finalScale = Math.min(scaleX, scaleY); // Maintain aspect ratio
      const viewWidth = currentVirtualWidthRef.current * finalScale;
      const viewHeight = currentVirtualHeightRef.current * finalScale;
      const finalOffsetX = (canvas.width - viewWidth) / 2 - (currentCenterXRef.current - currentVirtualWidthRef.current / 2) * finalScale;
      const finalOffsetY = (canvas.height - viewHeight) / 2 - (currentCenterYRef.current - currentVirtualHeightRef.current / 2) * finalScale;
      
      // Update refs used by drawing (optional, but keeps them consistent if needed elsewhere)
      scaleRef.current = finalScale;
      offsetXRef.current = finalOffsetX;
      offsetYRef.current = finalOffsetY;

      // --- Apply Viewport Transformations ---
      ctx.save(); // Save the default state
      ctx.clearRect(0, 0, canvas.width, canvas.height); // Clear canvas *before* transform

      // Apply the dynamic translation and scaling
      ctx.translate(finalOffsetX, finalOffsetY);
      ctx.scale(finalScale, finalScale);

      // --- Draw Background (Stretched to Extended Boundaries) ---
      const bgX = -VIRTUAL_WIDTH / 2;
      const bgY = -VIRTUAL_HEIGHT;
      const bgWidth = VIRTUAL_WIDTH * 2;
      const bgHeight = VIRTUAL_HEIGHT * 3;
      if (backgroundImage) {
          ctx.drawImage(backgroundImage, bgX, bgY, bgWidth, bgHeight);
      } else {
          ctx.fillStyle = '#000020'; 
          ctx.fillRect(bgX, bgY, bgWidth, bgHeight);
      }
      // --- End Background ---

      // --- Draw Game Field Border (at Extended Physical Boundary Positions) ---
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)'; // Semi-transparent white
      ctx.lineWidth = 4; // Adjust thickness as needed
      const borderX = -VIRTUAL_WIDTH / 2;
      const borderY = -VIRTUAL_HEIGHT;
      const borderWidth = VIRTUAL_WIDTH * 2;
      const borderHeight = VIRTUAL_HEIGHT * 3;
      ctx.strokeRect(borderX, borderY, borderWidth, borderHeight);
      // --- End Game Field Border ---

      // --- Draw Game Objects (Planets, Ships, Projectiles) ---
      const bodies = Composite.allBodies(engineRef.current.world);
      bodies.forEach(body => {
        // Planet drawing logic...
        if (body.label === 'planet') {
          const radius = body.plugin?.klunkstr?.radius || PLANET_MIN_RADIUS;
          ctx.beginPath();
          ctx.arc(body.position.x, body.position.y, radius, 0, 2 * Math.PI);
          ctx.fillStyle = body.render.fillStyle || '#888'; 
          ctx.fill();
        }
        // Ship drawing logic...
        else if (body.label.startsWith('ship-')) {
          const playerIndex = parseInt(body.label.split('-')[1], 10);
          const shipRadius = SHIP_RADIUS;
          ctx.save(); 
          ctx.translate(body.position.x, body.position.y);
          ctx.rotate(body.angle);
          ctx.beginPath();
          ctx.moveTo(shipRadius, 0); 
          ctx.lineTo(-shipRadius / 2, -shipRadius / 2);
          ctx.lineTo(-shipRadius / 2, shipRadius / 2);
          ctx.closePath();
          ctx.fillStyle = playerIndex === 0 ? '#00f' : '#f00'; 
          ctx.fill();
          ctx.restore(); 
        }
        // Projectile drawing logic...
        else if (body.label.startsWith('projectile-')) {
          ctx.beginPath();
          ctx.arc(body.position.x, body.position.y, 5, 0, 2 * Math.PI);
          const projectileBody = body as ProjectileBody;
          const ownerIndex = projectileBody.custom?.firedByPlayerIndex ?? 0;
          ctx.fillStyle = ownerIndex === 0 ? '#add8e6' : '#ffcccb'; 
          ctx.fill();
        }
      });

      // --- Draw Active Projectile Trails ---
      projectileTrails.forEach((trailData) => {
          if (trailData.trail.length < 2) {
            // console.log(`[Render DEBUG] Skipping short active trail for ${projectileId}`);
            return;
          }
          // console.log(`[Render DEBUG] Drawing active trail for ${projectileId}, length: ${trailData.trail.length}`);
          ctx.beginPath();
          ctx.moveTo(trailData.trail[0].x, trailData.trail[0].y);
          for (let i = 1; i < trailData.trail.length; i++) {
              ctx.lineTo(trailData.trail[i].x, trailData.trail[i].y);
          }
          ctx.strokeStyle = trailData.ownerIndex === 0 ? '#00f' : '#f00'; 
          ctx.lineWidth = 2;
          ctx.stroke();
      });

      // --- Draw Historical Shot Traces (Using the Ref!) ---
      Object.values(latestTracesRef.current).forEach(playerTraces => {
        playerTraces.forEach((trace: Matter.Vector[]) => {
          if (trace.length < 2) return;
          ctx.beginPath();
          ctx.moveTo(trace[0].x, trace[0].y);
          for (let i = 1; i < trace.length; i++) {
            ctx.lineTo(trace[i].x, trace[i].y);
          }
          ctx.strokeStyle = '#0f0'; 
          ctx.lineWidth = 1;
          ctx.setLineDash([5, 5]); 
          ctx.stroke();
          ctx.setLineDash([]); 
        });
      });

      // --- Restore Canvas Transformations ---
      ctx.restore(); // Restore the default state (removes translate/scale)

    }; // End of renderLoop

    // --- Start simulation and render loop --- 
    Events.on(engine, 'beforeUpdate', updateProjectilesAndApplyGravity); // Run physics updates before engine step
    Events.on(engine, 'collisionStart', handleCollisions);
    console.log("[GameRenderer Init] Starting Matter.js runner and render loop.");
    Runner.run(runner, engine); // Use static Runner.run
    
    let animationFrameId: number;
    const animationLoop = () => { // Separate render loop driven by requestAnimationFrame
        renderLoop();
        animationFrameId = requestAnimationFrame(animationLoop);
    };
    animationLoop(); // Start the render loop

    // --- Cleanup function for the useEffect --- 
    return () => {
        console.log("[GameRenderer Init] Cleanup actions...");
        cancelAnimationFrame(animationFrameId); // Stop render loop first
        if (runnerRef.current) {
            Runner.stop(runnerRef.current); // Use static Runner.stop
            // Must pass the runner instance to the static stop method
        }
        if (engineRef.current) {
            // Unbind events before clearing the engine
            Events.off(engineRef.current, 'beforeUpdate', updateProjectilesAndApplyGravity);
            Events.off(engineRef.current, 'collisionStart', handleCollisions);
            World.clear(engineRef.current.world, false); // Clear world bodies
            Engine.clear(engineRef.current); // Clear the engine itself
        }
        // Nullify refs
        engineRef.current = null;
        runnerRef.current = null;
        shipBodiesRef.current = [null, null];
        // Reset shot tracer state on cleanup
        resetTraces();
    };
  // Dependencies for the main setup/cleanup useEffect:
  // - initialPositions: Rerun if the level layout changes.
  // - resetTraces: Stable callback from useShotTracers, needed for cleanup.
  // - props.onRoundWin: Rerun if the win callback function changes.
  // ADD playerHP dependency to ensure renderLoop uses latest HP for drawing bars
  }, [initialPositions, resetTraces, props.onRoundWin, playerHP]);

  // ... (Keep Handle Resize useEffect)
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const handleResize = () => {
        const { width, height } = canvas.getBoundingClientRect();
        const dpr = window.devicePixelRatio || 1;
        canvas.width = width * dpr;
        canvas.height = height * dpr;
        console.log(`[Resize] Canvas resized: ${canvas.width}x${canvas.height}`);
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Style the canvas to fill its container
  const canvasStyle: React.CSSProperties = {
    display: 'block', 
    width: '100%',
    height: '100%',
    backgroundColor: '#000020', 
  };

  return (
    <canvas
      ref={canvasRef}
      style={canvasStyle}
    />
  );
});

export default GameRenderer;