import React, { useRef, useEffect, useCallback } from 'react';
import Matter from 'matter-js';
import { ProjectileBody } from './useShotTracers'; // Assuming ProjectileBody export
import { InitialGamePositions } from './useGameInitialization';
import { AbilityType } from '../components/ui_overlays/ActionButtons';
import { ProjectilePathData } from '../types/game'; // Import path type

// Define the expected shape for shotTracerHandlers prop
interface ShotTracerHandlers {
    handleProjectileFired: (projectile: ProjectileBody) => void;
    handleProjectileUpdate: (projectile: ProjectileBody) => void;
    handleProjectileRemoved: (projectile: ProjectileBody) => void;
    getLastCompletedPath: () => ProjectilePathData | null;
    resetTraces: () => void;
}

const { Engine, Runner, Bodies, World, Composite, Vector, Body, Events } = Matter;

// Constants from GameRenderer relevant to physics
const SHIP_RADIUS = 63; // Sets the size (radius) for player ship bodies. Used for ship creation and collision detection.
const PLANET_MIN_RADIUS = 40; // Default radius used for planets in gravity calculations if a specific radius isn't found.
const GRAVITY_CONSTANT = 0.35; // Multiplier controlling the overall strength of gravitational pull from planets.
const GRAVITY_AOE_BONUS_FACTOR = 0.2; // Factor applied to increase a planet's effective gravitational range based on its size.
const PLASTIC_GRAVITY_FACTOR = 0.85; // Factor by which planet gravity is reduced for 'plastic' projectiles.
const SHIP_GRAVITY_RANGE = SHIP_RADIUS * 4; // Range within which 'gravity' projectile is pulled by opponent ship.
const SHIP_GRAVITY_CONSTANT = 0.3; // Strength of the opponent ship's pull on 'gravity' projectiles.
const DEFAULT_FRICTION_AIR = 0.002; // Default air friction for standard projectiles & fragments
const PLASTIC_FRICTION_AIR = 0.008;  // Increased air friction (drag) for plastic projectiles.
const GRAVITY_FRICTION_AIR = 0.005; // Slightly increased air friction (drag) for gravity projectiles.

interface UseMatterPhysicsProps {
  levelData: InitialGamePositions;
  virtualWidth: number;
  virtualHeight: number;
  shotTracerHandlers: ShotTracerHandlers;
  onPlayerHit: (hitPlayerIndex: 0 | 1, firingPlayerIndex: 0 | 1, projectileType: AbilityType | 'standard') => void;
  onProjectileResolved: (path: ProjectilePathData, firedByPlayerIndex: 0 | 1) => void;
}

// --- Add Ref type for the callback ---
type OnPlayerHitCallback = (hitPlayerIndex: 0 | 1, firingPlayerIndex: 0 | 1, projectileType: AbilityType | 'standard') => void;
// --- Add Ref type for the new callback --- 
type OnProjectileResolvedCallback = (path: ProjectilePathData, firedByPlayerIndex: 0 | 1) => void;

export interface MatterPhysicsHandles {
  engine: Matter.Engine | null;
  shipBodies: React.RefObject<(Matter.Body | null)[]>;
  getDynamicBodies: () => Matter.Body[];
  getAllBodies: () => Matter.Body[];
  fireProjectile: (playerIndex: 0 | 1, power: number, abilityType: AbilityType | null) => void;
  setShipAim: (playerIndex: 0 | 1, angleDegrees: number) => void;
  getShipAngle: (playerIndex: 0 | 1) => number | undefined;
  resetPhysics: (newLevelData: InitialGamePositions) => void;
}

export const useMatterPhysics = ({
  levelData: initialLevelData,
  virtualWidth,
  virtualHeight,
  shotTracerHandlers,
  onPlayerHit,
  onProjectileResolved, // Destructure new prop
}: UseMatterPhysicsProps): MatterPhysicsHandles => {
  const engineRef = useRef<Matter.Engine | null>(null);
  const runnerRef = useRef<Matter.Runner | null>(null);
  const shipBodiesRef = useRef<(Matter.Body | null)[]>([null, null]);
  const currentLevelDataRef = useRef(initialLevelData);

  // --- Ref to store the latest onPlayerHit callback --- 
  const onPlayerHitRef = useRef<OnPlayerHitCallback>(onPlayerHit);
  // --- Ref for the new callback ---
  const onProjectileResolvedRef = useRef<OnProjectileResolvedCallback>(onProjectileResolved);

  // --- Effect to keep the refs updated --- 
  useEffect(() => { onPlayerHitRef.current = onPlayerHit; }, [onPlayerHit]);
  useEffect(() => { onProjectileResolvedRef.current = onProjectileResolved; }, [onProjectileResolved]); // Update effect for new callback
  useEffect(() => { currentLevelDataRef.current = initialLevelData; }, [initialLevelData]);
  const shotTracerHandlersRef = useRef<ShotTracerHandlers>(shotTracerHandlers);
  useEffect(() => { shotTracerHandlersRef.current = shotTracerHandlers; }, [shotTracerHandlers]);

  // --- Helper to remove projectile and notify resolved ---
  const removeProjectileAndNotify = useCallback((projectile: ProjectileBody, world: Matter.World) => {
    const tracerHandlers = shotTracerHandlersRef.current;
    if (!projectile.custom) {
        console.warn(`[Physics] Cannot remove projectile ${projectile.id}: missing custom data.`);
        World.remove(world, projectile);
        return;
    }
    const playerIndex = projectile.custom.firedByPlayerIndex;

    // Call the tracer handler first to store the path
    tracerHandlers.handleProjectileRemoved(projectile);

    // Now get the stored path
    const path = tracerHandlers.getLastCompletedPath();

    // Remove from world
    World.remove(world, projectile);

    // If a path was stored, notify the game logic
    if (path) {
        onProjectileResolvedRef.current(path, playerIndex);
    }
  }, []); // Dependencies? shotTracerHandlersRef, onProjectileResolvedRef are refs. Ok.

  // --- Collision Handling Logic ---
  const handleCollisions = useCallback((event: Matter.IEventCollision<Matter.Engine>) => {
    const currentEngine = engineRef.current;
    if (!currentEngine) return;

    event.pairs.forEach(pair => {
        const { bodyA, bodyB } = pair;
        let projectile: ProjectileBody | null = null;
        let otherBody: Matter.Body | null = null;
        if (bodyA.label.startsWith('projectile-')) { projectile = bodyA as ProjectileBody; otherBody = bodyB; }
        else if (bodyB.label.startsWith('projectile-')) { projectile = bodyB as ProjectileBody; otherBody = bodyA; }

        if (projectile && otherBody) {
            const firedByPlayerIndex = projectile.custom?.firedByPlayerIndex;
            const projectileType = projectile.custom?.abilityType || 'standard';
            let shouldRemove = false;

            if (otherBody.label === 'planet') {
                console.log(`[Collision] Proj ${projectile.id} hit planet ${otherBody.id}`);
                shouldRemove = true;
            } else if (otherBody.label.startsWith('ship-')) {
                const hitPlayerIndex = parseInt(otherBody.label.split('-')[1], 10) as 0 | 1;
                if (firedByPlayerIndex === undefined) {
                    console.warn('[Collision] Projectile hit ship but firing player index unknown!');
                } else {
                    console.log(`[Collision] Proj ${projectile.id} (P${firedByPlayerIndex}, Type: ${projectileType}) hit P${hitPlayerIndex}`);
                    onPlayerHitRef.current(hitPlayerIndex, firedByPlayerIndex, projectileType);
                }
                shouldRemove = true;
            } else if (otherBody.label === 'boundary') {
                console.log(`[Collision] Proj ${projectile.id} hit boundary`);
                shouldRemove = true;
            } else if (otherBody.label.startsWith('projectile-')) {
                 // Ignore projectile-projectile collisions for now
            } else {
                console.warn(`[Collision Warning] Proj ${projectile.id} collided with unhandled body: ${otherBody.label}. Removing.`);
                shouldRemove = true;
            }

            if (shouldRemove) {
                 removeProjectileAndNotify(projectile, currentEngine.world);
            }
        }
    });
  }, [removeProjectileAndNotify]); // Use helper

  // --- Physics Update Logic ---
  const updateProjectilesAndApplyGravity = useCallback(() => {
    const currentEngine = engineRef.current;
    if (!currentEngine) return;

    const bodiesToRemove: ProjectileBody[] = [];
    const bodiesToAdd: Matter.Body[] = [];
    const projectilesToNotifyFired: ProjectileBody[] = [];

    Composite.allBodies(currentEngine.world).forEach(body => {
      if (body.label.startsWith('projectile-')) {
        const projectileBody = body as ProjectileBody;

        // --- SPLITTER LOGIC ---
        if (
          projectileBody.custom?.abilityType === 'splitter' &&
          !projectileBody.custom?.hasSplit && // Check if not already split
          Date.now() - (projectileBody.custom?.createdAt ?? 0) > 1500
        ) {
          const originalPos = Vector.clone(projectileBody.position);
          const originalVel = Vector.clone(projectileBody.velocity);
          const firedBy = projectileBody.custom.firedByPlayerIndex;
          const originalLabel = projectileBody.custom.ownerShipLabel;

          // Mark original for removal (and notify tracer)
          bodiesToRemove.push(projectileBody);
          removeProjectileAndNotify(projectileBody, currentEngine.world);

          const spreadAngle = 0.15; // Radians, adjust as needed
          const velocities = [
            Vector.rotate(originalVel, -spreadAngle),
            originalVel, // Center fragment keeps original velocity
            Vector.rotate(originalVel, spreadAngle),
          ];

          // Create 3 fragments
          for (let i = 0; i < 3; i++) {
            const fragmentLabel = `${originalLabel}-frag${i}`;
            const fragment: ProjectileBody = Bodies.circle(originalPos.x, originalPos.y, 4, { // Smaller radius for fragments
              label: fragmentLabel,
              frictionAir: 0.005,
              restitution: 0.6,
              density: 0.04, // Slightly lower density for fragments
              collisionFilter: { group: -1 } // Prevent fragments colliding with each other
            }) as ProjectileBody;

            fragment.custom = {
              firedByPlayerIndex: firedBy,
              abilityType: 'splitter_fragment', // Mark as fragment
              createdAt: Date.now(),
              ownerShipLabel: fragmentLabel,
              // No hasSplit needed for fragments
            };
            fragment.trail = [Vector.clone(originalPos)]; // Start new trail

            Body.setVelocity(fragment, velocities[i]);
            bodiesToAdd.push(fragment);
            projectilesToNotifyFired.push(fragment); // Notify tracer about new fragments
          }

          // Skip gravity/update for the original projectile this tick
          return; 
        }
        // --- END SPLITTER LOGIC ---

        // --- Standard Update & Gravity ---
        if (!projectileBody.custom || !projectileBody.trail) {
            console.warn(`[Physics Update] Proj ${projectileBody.id} missing data/trail.`);
            projectileBody.trail = projectileBody.trail || [Vector.clone(projectileBody.position)]; // Ensure trail exists
            // Maybe remove if custom data is missing? For now, let it continue
            // return;
        } else {
            projectileBody.trail.push(Vector.clone(projectileBody.position));
        }

        shotTracerHandlersRef.current.handleProjectileUpdate(projectileBody);

        // --- Apply Planet Gravity ---
        Composite.allBodies(currentEngine.world).forEach(staticBody => {
          if (staticBody.label === 'planet') {
             const distanceVector = Vector.sub(staticBody.position, projectileBody.position);
             const distanceSq = Vector.magnitudeSquared(distanceVector);
             if (distanceSq > 100) { // Min distance^2
                 const planetRadius = staticBody.plugin?.klunkstr?.radius || PLANET_MIN_RADIUS;
                 const effectiveRadius = planetRadius * (1 + GRAVITY_AOE_BONUS_FACTOR * (planetRadius / virtualWidth));
                 
                 // Calculate base force
                 let forceMagnitude = (GRAVITY_CONSTANT * projectileBody.mass * effectiveRadius) / distanceSq;
                 
                 // --- Adjust force based on ability type ---
                 if (projectileBody.custom?.abilityType === 'plastic') {
                     forceMagnitude *= PLASTIC_GRAVITY_FACTOR;
                 }
                 // --- End ability adjustment ---

                 const forceVector = Vector.mult(Vector.normalise(distanceVector), forceMagnitude);
                 Body.applyForce(projectileBody, projectileBody.position, forceVector);
             }
          }
        });
        // --- End Planet Gravity ---

        // --- Apply Opponent Ship Gravity (for 'gravity' ability) ---
        if (projectileBody.custom?.abilityType === 'gravity') {
            const firingPlayerIndex = projectileBody.custom.firedByPlayerIndex;
            const opponentPlayerIndex = firingPlayerIndex === 0 ? 1 : 0;
            const opponentShipBody = shipBodiesRef.current[opponentPlayerIndex];

            if (opponentShipBody) {
                const shipDistanceVector = Vector.sub(opponentShipBody.position, projectileBody.position);
                const shipDistanceSq = Vector.magnitudeSquared(shipDistanceVector);

                // Check if within range
                if (shipDistanceSq > 100 && shipDistanceSq < (SHIP_GRAVITY_RANGE * SHIP_GRAVITY_RANGE)) { 
                    // Apply force pulling projectile towards opponent ship
                    // Using opponent ship mass and SHIP_GRAVITY_CONSTANT
                    const shipForceMagnitude = (SHIP_GRAVITY_CONSTANT * projectileBody.mass * opponentShipBody.mass) / shipDistanceSq;
                    const shipForceVector = Vector.mult(Vector.normalise(shipDistanceVector), shipForceMagnitude);
                    Body.applyForce(projectileBody, projectileBody.position, shipForceVector);
                }
            }
        }
        // --- End Opponent Ship Gravity ---

        // --- Timeout Check ---
        const projectileAge = Date.now() - (projectileBody.custom?.createdAt ?? Date.now());
        if (projectileAge > 45000) { // 45 seconds timeout
          console.log(`[Physics Update] Proj ${projectileBody.id} timed out.`);
          bodiesToRemove.push(projectileBody);
        }
      }
    });

    // Process additions and removals
    if (bodiesToAdd.length > 0) {
        World.add(currentEngine.world, bodiesToAdd);
        // Notify tracer about new fragments
        projectilesToNotifyFired.forEach(proj => {
            shotTracerHandlersRef.current.handleProjectileFired(proj);
        });
    }
    if (bodiesToRemove.length > 0) {
        bodiesToRemove.forEach(proj => {
            // Use helper for removal
            removeProjectileAndNotify(proj, currentEngine.world);
        });
    }
  }, [removeProjectileAndNotify]); // Use helper

  // --- Function to Initialize/Reset the Matter.js World ---
  const initializeWorld = useCallback((levelData: InitialGamePositions | undefined) => {
    const engine = engineRef.current;
    if (!engine) {
        console.error("[Physics Hook] Engine not available during world initialization.");
        return;
    }
    if (!levelData || !levelData.ships || levelData.ships.length < 2 || !levelData.planets) {
        console.error("[Physics Hook] Invalid or undefined levelData provided to initializeWorld:", levelData);
        World.clear(engine.world, false);
        Events.off(engine, 'beforeUpdate');
        Events.off(engine, 'collisionStart');
        shipBodiesRef.current = [null, null];
        return;
    }

    console.log("[Physics Hook] Initializing/Resetting World with valid data...");

    World.clear(engine.world, false);
    Events.off(engine, 'beforeUpdate');
    Events.off(engine, 'collisionStart');

    shotTracerHandlersRef.current.resetTraces();

    const ship1Body = Bodies.circle(levelData.ships[0].x, levelData.ships[0].y, SHIP_RADIUS, {
        label: 'ship-0', restitution: 0.5, friction: 0.1, frictionAir: 0.01, angle: 0
    });
    const ship2Body = Bodies.circle(levelData.ships[1].x, levelData.ships[1].y, SHIP_RADIUS, {
        label: 'ship-1', restitution: 0.5, friction: 0.1, frictionAir: 0.01, angle: Math.PI
    });
    shipBodiesRef.current = [ship1Body, ship2Body];

    const wallThickness = 50;
    const extendedWidth = virtualWidth * 2;
    const extendedHeight = virtualHeight * 3;
    const boundaries = [
        Bodies.rectangle(virtualWidth / 2, -virtualHeight, extendedWidth, wallThickness, { isStatic: true, label: 'boundary' }),
        Bodies.rectangle(virtualWidth / 2, virtualHeight * 2, extendedWidth, wallThickness, { isStatic: true, label: 'boundary' }),
        Bodies.rectangle(-virtualWidth / 2, virtualHeight / 2, wallThickness, extendedHeight, { isStatic: true, label: 'boundary' }),
        Bodies.rectangle(virtualWidth * 1.5, virtualHeight / 2, wallThickness, extendedHeight, { isStatic: true, label: 'boundary' })
    ];

    const allBodies = [ship1Body, ship2Body, ...levelData.planets, ...boundaries];
    World.add(engine.world, allBodies);

    Events.on(engine, 'beforeUpdate', updateProjectilesAndApplyGravity);
    Events.on(engine, 'collisionStart', handleCollisions);

    console.log("[Physics Hook] World setup complete.");
  }, [virtualWidth, virtualHeight, shotTracerHandlersRef, handleCollisions, updateProjectilesAndApplyGravity]);

  // --- Main Setup and Cleanup useEffect ---
  useEffect(() => {
    console.log("[Physics Hook] Initializing Engine & Runner...");
    const engine = Engine.create();
    engineRef.current = engine;
    engine.world.gravity.y = 0;
    engine.world.gravity.x = 0;

    const runner = Runner.create();
    runnerRef.current = runner;

    if (currentLevelDataRef.current) {
        initializeWorld(currentLevelDataRef.current);
    } else {
        console.warn("[Physics Hook] Initial levelData is undefined. World will be initialized when valid data is provided via resetPhysics.");
        World.clear(engine.world, false);
        shipBodiesRef.current = [null, null];
    }

    console.log("[Physics Hook] Starting runner.");
    Runner.run(runner, engine);

    return () => {
        console.log("[Physics Hook] Cleanup: Stopping engine, runner.");
        if (runnerRef.current) Runner.stop(runnerRef.current);
        if (engineRef.current) {
            Events.off(engineRef.current, 'beforeUpdate');
            Events.off(engineRef.current, 'collisionStart');
            World.clear(engineRef.current.world, false);
            Engine.clear(engineRef.current);
        }
        engineRef.current = null;
        runnerRef.current = null;
        shipBodiesRef.current = [null, null];
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initializeWorld]);

  // --- Exposed Control Functions ---
  const fireProjectile = useCallback((playerIndex: 0 | 1, power: number, abilityType: AbilityType | null) => {
    const engine = engineRef.current;
    const shipBody = shipBodiesRef.current[playerIndex];
    if (!engine || !shipBody) return;

    const angle = shipBody.angle;
    const speed = 10 + power * 1.5; // Base speed + power scaled by 1.5x
    const velocity = Vector.mult(Vector.rotate({ x: 1, y: 0 }, angle), speed);

    // Start position slightly in front of the ship
    const startOffset = Vector.mult(Vector.rotate({ x: 1, y: 0 }, angle), SHIP_RADIUS * 1.1);
    const startPosition = Vector.add(shipBody.position, startOffset);

    // Determine frictionAir based on ability type
    let frictionAir = DEFAULT_FRICTION_AIR;
    if (abilityType === 'plastic') {
        frictionAir = PLASTIC_FRICTION_AIR;
    } else if (abilityType === 'gravity') {
        frictionAir = GRAVITY_FRICTION_AIR;
    }
    // Splitter projectiles use default friction initially

    const projectile: ProjectileBody = Bodies.circle(startPosition.x, startPosition.y, 5, {
        label: `projectile-${playerIndex}-${Date.now()}`,
        frictionAir: frictionAir, // Apply calculated air friction
        restitution: 0.6,
        density: 0.05, // Adjust density as needed
        collisionFilter: { group: -1 } // Prevent projectiles colliding with each other
    }) as ProjectileBody;

    const projectileLabel = `projectile-${playerIndex}-${Date.now()}`;
    projectile.label = projectileLabel; // Assign label separately

    // Assign custom properties and initialize trail *after* creation
    projectile.custom = {
        firedByPlayerIndex: playerIndex,
        abilityType: abilityType, // Assign null if abilityType is null, otherwise assign the AbilityType
        createdAt: Date.now(),
        ownerShipLabel: projectileLabel, // Add the missing required property
        // Explicitly set hasSplit: false for splitter, undefined otherwise
        hasSplit: abilityType === 'splitter' ? false : undefined,
    };
    projectile.trail = [Vector.clone(startPosition)]; // Initialize trail here

    // Set initial velocity
    Body.setVelocity(projectile, velocity);

    World.add(engine.world, projectile);
    shotTracerHandlersRef.current.handleProjectileFired(projectile);
    console.log(`[Physics] Fired projectile ${projectile.id} by P${playerIndex}, Power: ${power}, Ability: ${abilityType || 'None'}`);

  }, [shotTracerHandlersRef]); // Removed engine from deps, using ref

  const setShipAim = useCallback((playerIndex: 0 | 1, angleDegrees: number) => {
    const shipBody = shipBodiesRef.current[playerIndex];
    if (shipBody) {
        Body.setAngle(shipBody, angleDegrees * (Math.PI / 180));
    }
  }, []);

  const getShipAngle = useCallback((playerIndex: 0 | 1) => {
    const shipBody = shipBodiesRef.current[playerIndex];
    return shipBody ? shipBody.angle * (180 / Math.PI) : undefined;
  }, []);

  const resetPhysics = useCallback((newLevelData: InitialGamePositions) => {
      console.log("[Physics Hook] resetPhysics called.");
      if (!newLevelData) {
          console.error("[Physics Hook] Attempted resetPhysics with undefined newLevelData.");
          return;
      }
      // Update the ref just in case anything else relies on it
      currentLevelDataRef.current = newLevelData;
      // Directly initialize world with the new data
      initializeWorld(newLevelData);
  }, [initializeWorld]); // Dependency is stable initializeWorld

  const getDynamicBodies = useCallback(() => {
      if (!engineRef.current) return [];
      return Composite.allBodies(engineRef.current.world).filter(
          body => body.label.startsWith('ship-') || body.label.startsWith('projectile-')
      );
  }, []);

  const getAllBodies = useCallback(() => {
      if (!engineRef.current) return [];
      return Composite.allBodies(engineRef.current.world);
  }, []);

  // Return the necessary values and functions
  return {
    engine: engineRef.current,
    shipBodies: shipBodiesRef, // Pass the ref itself
    getDynamicBodies,
    getAllBodies,
    fireProjectile,
    setShipAim,
    getShipAngle,
    resetPhysics,
  };
}; 