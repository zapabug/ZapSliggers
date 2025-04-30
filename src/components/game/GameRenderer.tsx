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
const SHIP_RADIUS = 25;
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

const GameRenderer = forwardRef<GameRendererRef, GameRendererProps>((props: GameRendererProps, ref: ForwardedRef<GameRendererRef>) => {
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
    // Planets are already Matter.Body objects from the hook
    const allBodies = [ship1Body, ship2Body, ...initialPositions.planets];
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
          // Access custom.createdAt directly
          if (now - projectileBody.custom.createdAt > 45000) { 
              console.log(`[Timeout] Removing proj ${projectileBody.id}`);
              // Pass the whole body to the removal hook
              handleProjectileRemoved(projectileBody);
              World.remove(currentEngine.world, projectileBody);
          }
        }
      });

      // --- Dynamic Viewport Logic ---
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
      // Clamp zoom (using outer scope constants)
      requiredWidth = Math.max(requiredWidth, VIRTUAL_WIDTH / MAX_ZOOM_FACTOR);
      requiredHeight = Math.max(requiredHeight, VIRTUAL_HEIGHT / MAX_ZOOM_FACTOR);
      requiredWidth = Math.min(requiredWidth, VIRTUAL_WIDTH);
      requiredHeight = Math.min(requiredHeight, VIRTUAL_HEIGHT);
      // Lerp towards target viewport (using outer scope constant)
      targetVirtualWidthRef.current = requiredWidth;
      targetVirtualHeightRef.current = requiredHeight;
      targetCenterXRef.current = centerX;
      targetCenterYRef.current = centerY;
      currentVirtualWidthRef.current += (targetVirtualWidthRef.current - currentVirtualWidthRef.current) * ZOOM_LERP_FACTOR;
      currentVirtualHeightRef.current += (targetVirtualHeightRef.current - currentVirtualHeightRef.current) * ZOOM_LERP_FACTOR;
      currentCenterXRef.current += (targetCenterXRef.current - currentCenterXRef.current) * ZOOM_LERP_FACTOR;
      currentCenterYRef.current += (targetCenterYRef.current - currentCenterYRef.current) * ZOOM_LERP_FACTOR;
    };

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
                  return; 
              } 
              if (otherBody.label === 'planet') {
                  console.log(`[Collision] Proj ${projectile.id} hit planet ${otherBody.id}`);
                  // Pass the whole body to the removal hook
                  handleProjectileRemoved(projectile);
                  World.remove(currentEngine.world, projectile);
              } else if (otherBody.label.startsWith('ship-')) {
                  const hitPlayerIndex = parseInt(otherBody.label.split('-')[1], 10);
                  // Access custom.firedByPlayerIndex directly
                  if (hitPlayerIndex !== projectile.custom.firedByPlayerIndex) { 
                      console.log(`[Collision] Proj ${projectile.id} hit P${hitPlayerIndex}`);
                      // Pass the whole body to the removal hook
                      handleProjectileRemoved(projectile);
                      World.remove(currentEngine.world, projectile);
                      
                      // Determine winning player index (the one who fired)
                      const winningPlayerIndex = projectile.custom.firedByPlayerIndex;
                      // Call the callback passed via props
                      props.onRoundWin(winningPlayerIndex); 
                  }
              }
          }
      });
    };

    const renderLoop = () => {
      const currentEngine = engineRef.current;
      const currentCanvas = canvasRef.current;
      if (!currentEngine || !currentCanvas) return;
      const ctx = currentCanvas.getContext('2d');
      if (!ctx) return;

      // Calculate viewport transforms based on current refs
      const scaleX = currentCanvas.width / currentVirtualWidthRef.current;
      const scaleY = currentCanvas.height / currentVirtualHeightRef.current;
      scaleRef.current = Math.min(scaleX, scaleY);
      const viewWidth = currentVirtualWidthRef.current * scaleRef.current;
      const viewHeight = currentVirtualHeightRef.current * scaleRef.current;
      offsetXRef.current = (currentCanvas.width - viewWidth) / 2 - (currentCenterXRef.current - currentVirtualWidthRef.current / 2) * scaleRef.current;
      offsetYRef.current = (currentCanvas.height - viewHeight) / 2 - (currentCenterYRef.current - currentVirtualHeightRef.current / 2) * scaleRef.current;

      ctx.save();
      ctx.translate(offsetXRef.current, offsetYRef.current);
      ctx.scale(scaleRef.current, scaleRef.current);

      // Draw background
      if (backgroundImage) {
        ctx.drawImage(backgroundImage, 0, 0, VIRTUAL_WIDTH, VIRTUAL_HEIGHT);
      } else {
        ctx.fillStyle = '#0A0A14'; ctx.fillRect(0, 0, VIRTUAL_WIDTH, VIRTUAL_HEIGHT);
      }

      // Draw Planets (using radius from plugin)
      ctx.fillStyle = '#8B4513';
      const planets = Composite.allBodies(currentEngine.world).filter(b => b.label === 'planet');
      planets.forEach(planet => {
          const radius = planet.plugin?.klunkstr?.radius || PLANET_MIN_RADIUS;
          ctx.beginPath(); ctx.arc(planet.position.x, planet.position.y, radius, 0, Math.PI * 2); ctx.fill();
      });

      // Draw Ships
      const ships = Composite.allBodies(currentEngine.world).filter(b => b.label.startsWith('ship-'));
      ships.forEach(ship => {
          const playerIndex = parseInt(ship.label.split('-')[1], 10);
          ctx.save();
          ctx.translate(ship.position.x, ship.position.y);
          ctx.rotate(ship.angle);
          ctx.fillStyle = playerIndex === 0 ? 'blue' : 'red';
          ctx.beginPath(); ctx.moveTo(SHIP_RADIUS, 0); ctx.lineTo(-SHIP_RADIUS / 2, -SHIP_RADIUS / 2); ctx.lineTo(-SHIP_RADIUS / 2, SHIP_RADIUS / 2); ctx.closePath(); ctx.fill();
          ctx.restore();
      });

      // Draw Projectiles & Active Trails
      const projectiles = Composite.allBodies(currentEngine.world).filter(b => b.label.startsWith('projectile-'));
      projectiles.forEach(body => {
          // Cast to ProjectileBody to access custom props
          const proj = body as ProjectileBody;
          // Access custom directly
          if (!proj.custom) return; // Guard 
          // Access custom.firedByPlayerIndex directly
          ctx.fillStyle = proj.custom.firedByPlayerIndex === 0 ? 'lightblue' : 'lightcoral'; 
          ctx.beginPath(); ctx.arc(proj.position.x, proj.position.y, 5, 0, Math.PI * 2); ctx.fill();
          
          // Use .get() for Map access
          const trail = projectileTrails.get(proj.id);
          if (trail && trail.length > 1) {
              ctx.strokeStyle = proj.custom.firedByPlayerIndex === 0 ? 'rgba(173, 216, 230, 0.7)' : 'rgba(240, 128, 128, 0.7)';
              ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(trail[0].x, trail[0].y);
              for (let i = 1; i < trail.length; i++) { ctx.lineTo(trail[i].x, trail[i].y); }
              ctx.stroke();
          }
      });

      // Draw Historical Traces (using ref updated by useEffect)
      ctx.lineWidth = 1; ctx.setLineDash([5, 5]);
      Object.values(latestTracesRef.current).forEach(traceArray => {
          traceArray.forEach(trace => {
              if (trace.length > 1) {
                  ctx.strokeStyle = 'rgba(0, 255, 0, 0.5)'; ctx.beginPath(); ctx.moveTo(trace[0].x, trace[0].y);
                  for (let i = 1; i < trace.length; i++) { ctx.lineTo(trace[i].x, trace[i].y); }
                  ctx.stroke();
              }
          });
      });
      ctx.setLineDash([]);
      ctx.restore(); // Restore transforms
    };

    // --- Start simulation and render loop ---
    Events.on(engine, 'collisionStart', handleCollisions);
    console.log("[GameRenderer Init] Starting Matter.js runner and render loop.");
    Runner.run(runner, engine);
    let animationFrameId: number;
    const gameLoop = () => {
        updateProjectilesAndApplyGravity(); // Update physics state first
        renderLoop(); // Then render based on new state
        animationFrameId = requestAnimationFrame(gameLoop);
    };
    gameLoop(); // Start the combined loop

    // --- Cleanup function for the useEffect ---
    return () => {
        console.log("[GameRenderer Init] Cleanup actions...");
        cancelAnimationFrame(animationFrameId); // Stop animation loop first
        if (runnerRef.current) Runner.stop(runnerRef.current);
        if (engineRef.current) {
            // Unbind events before clearing the engine
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
  // Add dependencies for the main useEffect
  }, [initialPositions, resetTraces, handleProjectileFired, handleProjectileUpdate, handleProjectileRemoved, props.onRoundWin]);

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