import React, { useRef, useEffect, useCallback } from 'react';
import Matter from 'matter-js';
import { ProjectileBody } from './useShotTracers'; // Assuming ProjectileBody export
import { InitialGamePositions } from './useGameInitialization';
import { AbilityType } from '../components/ui_overlays/ActionButtons';
import { ProjectilePathData } from '../types/game'; // Import path type
import { GameSettingsProfile } from '../config/gameSettings'; // Import the settings profile type

// Define the expected shape for shotTracerHandlers prop
interface ShotTracerHandlers {
    handleProjectileFired: (projectile: ProjectileBody) => void;
    handleProjectileUpdate: (projectile: ProjectileBody) => void;
    handleProjectileRemoved: (projectile: ProjectileBody) => void;
    getLastCompletedPath: () => ProjectilePathData | null;
    resetTraces: () => void;
}

const { Engine, Runner, Bodies, World, Composite, Vector, Body, Events } = Matter;

// Constants removed - now passed via settings object

interface UseMatterPhysicsProps {
  settings: GameSettingsProfile | null; // Add settings prop
  levelData: InitialGamePositions | null; // Allow levelData to be null initially
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
  settings,
  levelData: initialLevelData,
  shotTracerHandlers,
  onPlayerHit,
  onProjectileResolved,
}: UseMatterPhysicsProps): MatterPhysicsHandles => {
  const engineRef = useRef<Matter.Engine | null>(null);
  const runnerRef = useRef<Matter.Runner | null>(null);
  const shipBodiesRef = useRef<(Matter.Body | null)[]>([null, null]);
  const currentLevelDataRef = useRef(initialLevelData);
  const currentSettingsRef = useRef(settings); // Ref to hold current settings

  // --- Ref to store the latest callbacks --- 
  const onPlayerHitRef = useRef<OnPlayerHitCallback>(onPlayerHit);
  const onProjectileResolvedRef = useRef<OnProjectileResolvedCallback>(onProjectileResolved);
  const shotTracerHandlersRef = useRef<ShotTracerHandlers>(shotTracerHandlers);

  // --- Effect to keep the refs updated --- 
  useEffect(() => { onPlayerHitRef.current = onPlayerHit; }, [onPlayerHit]);
  useEffect(() => { onProjectileResolvedRef.current = onProjectileResolved; }, [onProjectileResolved]);
  useEffect(() => { shotTracerHandlersRef.current = shotTracerHandlers; }, [shotTracerHandlers]);
  useEffect(() => { currentLevelDataRef.current = initialLevelData; }, [initialLevelData]);
  useEffect(() => { currentSettingsRef.current = settings; }, [settings]); // Update settings ref

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

  // --- Physics Update Logic (Needs Settings) ---
  const updateProjectilesAndApplyGravity = useCallback(() => {
    const currentEngine = engineRef.current;
    const localSettings = currentSettingsRef.current; // Get settings from ref
    if (!currentEngine || !localSettings) return; // Ensure settings are available

    // Destructure settings needed within this callback
    const {
        PLANET_MIN_RADIUS,
        GRAVITY_AOE_BONUS_FACTOR,
        VIRTUAL_WIDTH, 
        GRAVITY_CONSTANT,
        // --- Sligger Settings ---
        SLIGGER_ATTRACTION_FACTOR,
        SLIGGER_REPULSION_FACTOR,
        // ----------------------
        PLASTIC_GRAVITY_FACTOR,
        SHIP_GRAVITY_RANGE_FACTOR,
        SHIP_RADIUS,
        SHIP_GRAVITY_CONSTANT,
        SPLITTER_FRAGMENT_RADIUS,
        DEFAULT_FRICTION_AIR
    } = localSettings;

    const SHIP_GRAVITY_RANGE_SQ = Math.pow(SHIP_RADIUS * SHIP_GRAVITY_RANGE_FACTOR, 2);

    const bodiesToRemove: ProjectileBody[] = [];
    const bodiesToAdd: Matter.Body[] = [];
    const projectilesToNotifyFired: ProjectileBody[] = [];

    Composite.allBodies(currentEngine.world).forEach(body => {
      if (body.label.startsWith('projectile-')) {
        const projectileBody = body as ProjectileBody;

        // --- SPLITTER LOGIC ---
        if (
          projectileBody.custom?.abilityType === 'splitter' &&
          !projectileBody.custom?.hasSplit &&
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
            const fragment: ProjectileBody = Bodies.circle(originalPos.x, originalPos.y, SPLITTER_FRAGMENT_RADIUS, {
              label: fragmentLabel,
              frictionAir: DEFAULT_FRICTION_AIR, // Fragments use default friction
              restitution: 0.6,
              density: 0.04, 
              collisionFilter: { group: -1 }
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
            projectileBody.trail = projectileBody.trail || [Vector.clone(projectileBody.position)]; 
        } else {
            projectileBody.trail.push(Vector.clone(projectileBody.position));
        }

        shotTracerHandlersRef.current.handleProjectileUpdate(projectileBody);

        // --- Apply Planet Gravity / Repulsion ---
        Composite.allBodies(currentEngine.world).forEach(staticBody => {
          // Skip if not a planet type or sligger
          if (staticBody.label !== 'planet' && staticBody.label !== 'sligger') return;

          const distanceVector = Vector.sub(staticBody.position, projectileBody.position);
          const distanceSq = Vector.magnitudeSquared(distanceVector);
          if (distanceSq <= 10) return; // Avoid extreme forces at very close range (reduced threshold slightly)

          const planetRadius = staticBody.plugin?.Zapsliggers?.radius || PLANET_MIN_RADIUS;
          let netForce = Vector.create(0, 0); // Start with zero net force from this planet

          // --- Calculate Base Attractive Force (Always applies unless overridden) ---
          const effectiveRadius = planetRadius * (1 + GRAVITY_AOE_BONUS_FACTOR * (planetRadius / VIRTUAL_WIDTH));
          let attractiveForceMagnitude = (GRAVITY_CONSTANT * projectileBody.mass * effectiveRadius) / distanceSq;

          // Adjust attraction for Plastic ability 
          if (projectileBody.custom?.abilityType === 'plastic') {
              attractiveForceMagnitude *= PLASTIC_GRAVITY_FACTOR;
          }
          
          const attractiveForce = Vector.mult(Vector.normalise(distanceVector), attractiveForceMagnitude);
          netForce = Vector.add(netForce, attractiveForce); // Add attraction to net force

          // --- Apply Sligger specific forces (Attraction/Repulsion based on core) ---
          if (staticBody.label === 'sligger') {
              const coreRadius = staticBody.plugin?.Zapsliggers?.coreRadius;
              const distance = Vector.magnitude(distanceVector); // Need actual distance now
              
              if (coreRadius && distance <= coreRadius) {
                  // --- Repulsion Zone (Inside Core) ---
                  // Calculate base repulsive force magnitude (similar to attraction, but using coreRadius? Or planetRadius? Let's use coreRadius for scaling)
                  // We will scale the standard GRAVITY_CONSTANT by the SLIGGER_REPULSION_FACTOR.
                  const baseRepulsiveMagnitude = (GRAVITY_CONSTANT * projectileBody.mass * coreRadius) / distanceSq;
                  const finalRepulsiveMagnitude = baseRepulsiveMagnitude * SLIGGER_REPULSION_FACTOR; // Scale by factor
                  const repulsiveForce = Vector.mult(Vector.normalise(distanceVector), -finalRepulsiveMagnitude); // Negative for repulsion

                  // *Replace* the default attraction with repulsion
                  netForce = repulsiveForce; 
                  
                  // Optional: Log when repulsion is active
                  // console.log(`Sligger ${staticBody.id} core hit! Repulsion applied. Dist: ${distance.toFixed(1)}, CoreRadius: ${coreRadius.toFixed(1)}`);

              } else {
                  // --- Attraction Zone (Outside Core) ---
                  // Scale the already calculated attractive force by the SLIGGER_ATTRACTION_FACTOR
                  // The base attractive force is already in netForce from the calculation above.
                  // We need to scale it.
                  // Note: If FACTOR is 1, it remains unchanged. If > 1, stronger attraction. If < 1, weaker.
                  netForce = Vector.mult(netForce, SLIGGER_ATTRACTION_FACTOR); 
              }
          } 

          // Apply the final net force (attraction + optional repulsion)
          if (Vector.magnitudeSquared(netForce) > 0) {
              Body.applyForce(projectileBody, projectileBody.position, netForce);
          }
        });
        // --- End Planet Gravity / Repulsion ---

        // --- Apply Opponent Ship Gravity (for 'gravity' ability) ---
        if (projectileBody.custom?.abilityType === 'gravity') {
            const firingPlayerIndex = projectileBody.custom.firedByPlayerIndex;
            const opponentPlayerIndex = firingPlayerIndex === 0 ? 1 : 0;
            const opponentShipBody = shipBodiesRef.current[opponentPlayerIndex];

            if (opponentShipBody) {
                const shipDistanceVector = Vector.sub(opponentShipBody.position, projectileBody.position);
                const shipDistanceSq = Vector.magnitudeSquared(shipDistanceVector);

                // Use calculated SHIP_GRAVITY_RANGE_SQ from settings
                if (shipDistanceSq > 100 && shipDistanceSq < SHIP_GRAVITY_RANGE_SQ) { 
                    // Use SHIP_GRAVITY_CONSTANT from settings
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
  }, [removeProjectileAndNotify]); // Still only depends on this stable callback

  // --- Function to Initialize/Reset the Matter.js World (Needs Settings) ---
  const initializeWorld = useCallback((levelData: InitialGamePositions | undefined) => {
    const engine = engineRef.current;
    const localSettings = currentSettingsRef.current; // Get settings from ref

    // ADD LOGGING HERE
    console.log('[Physics initializeWorld] Called. levelData arg:', levelData, 'localSettings from ref:', localSettings);

    if (!engine || !localSettings) {
        console.error("[Physics Hook] Engine or Settings not available during world initialization.");
        return;
    }
    // Destructure settings needed here
    const { SHIP_RADIUS, VIRTUAL_WIDTH, VIRTUAL_HEIGHT } = localSettings;

    if (!levelData || !levelData.ships || levelData.ships.length < 2 || !levelData.planets) {
        console.error("[Physics Hook] Invalid or undefined levelData provided to initializeWorld:", levelData);
        World.clear(engine.world, false);
        Events.off(engine, 'beforeUpdate');
        Events.off(engine, 'collisionStart');
        shipBodiesRef.current = [null, null];
        return;
    }

    console.log("[Physics Hook] Initializing/Resetting World with valid data and settings...");

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
    const extendedWidth = VIRTUAL_WIDTH * 2;
    const extendedHeight = VIRTUAL_HEIGHT * 3;
    const boundaries = [
        Bodies.rectangle(VIRTUAL_WIDTH / 2, -VIRTUAL_HEIGHT, extendedWidth, wallThickness, { isStatic: true, label: 'boundary' }),
        Bodies.rectangle(VIRTUAL_WIDTH / 2, VIRTUAL_HEIGHT * 2, extendedWidth, wallThickness, { isStatic: true, label: 'boundary' }),
        Bodies.rectangle(-VIRTUAL_WIDTH / 2, VIRTUAL_HEIGHT / 2, wallThickness, extendedHeight, { isStatic: true, label: 'boundary' }),
        Bodies.rectangle(VIRTUAL_WIDTH * 1.5, VIRTUAL_HEIGHT / 2, wallThickness, extendedHeight, { isStatic: true, label: 'boundary' })
    ];

    const allBodies = [ship1Body, ship2Body, ...levelData.planets, ...boundaries];
    World.add(engine.world, allBodies);

    Events.on(engine, 'beforeUpdate', updateProjectilesAndApplyGravity);
    Events.on(engine, 'collisionStart', handleCollisions);

    console.log("[Physics Hook] World setup complete.");
    // Dependencies still okay as they use refs or are stable callbacks
  }, [handleCollisions, updateProjectilesAndApplyGravity]);

  // --- Main Setup and Cleanup useEffect ---
  useEffect(() => {
    console.log("[Physics Hook] Initializing Engine & Runner...");
    const engine = Engine.create();
    engineRef.current = engine;
    engine.world.gravity.y = 0;
    engine.world.gravity.x = 0;

    const runner = Runner.create();
    runnerRef.current = runner;

    // Check if settings and initial data are available before initializing
    if (currentSettingsRef.current && currentLevelDataRef.current) {
        initializeWorld(currentLevelDataRef.current);
    } else {
        console.warn("[Physics Hook] Initial settings or levelData undefined. World will be initialized when valid data is provided via resetPhysics.");
        if (engineRef.current) World.clear(engineRef.current.world, false);
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
  // Depends only on initializeWorld (stable callback) now
  }, [initializeWorld]);

  // --- Exposed Control Functions ---
  const fireProjectile = useCallback((playerIndex: 0 | 1, power: number, abilityType: AbilityType | null) => {
    const engine = engineRef.current;
    const localSettings = currentSettingsRef.current; // Get settings from ref
    const shipBody = shipBodiesRef.current[playerIndex];
    if (!engine || !shipBody || !localSettings) return;

    // Destructure settings needed here
    const {
        SHIP_RADIUS,
        DEFAULT_FRICTION_AIR,
        PLASTIC_FRICTION_AIR,
        GRAVITY_FRICTION_AIR,
        STANDARD_PROJECTILE_RADIUS
    } = localSettings;

    const angle = shipBody.angle;
    const speed = 10 + power * 1.5; 
    const velocity = Vector.mult(Vector.rotate({ x: 1, y: 0 }, angle), speed);

    // Use SHIP_RADIUS from settings
    const startOffset = Vector.mult(Vector.rotate({ x: 1, y: 0 }, angle), SHIP_RADIUS * 1.1);
    const startPosition = Vector.add(shipBody.position, startOffset);

    // Determine frictionAir based on ability type using settings
    let frictionAir = DEFAULT_FRICTION_AIR;
    if (abilityType === 'plastic') {
        frictionAir = PLASTIC_FRICTION_AIR;
    } else if (abilityType === 'gravity') {
        frictionAir = GRAVITY_FRICTION_AIR;
    }

    // Use STANDARD_PROJECTILE_RADIUS from settings
    const projectile: ProjectileBody = Bodies.circle(startPosition.x, startPosition.y, STANDARD_PROJECTILE_RADIUS, {
        label: `projectile-${playerIndex}-${Date.now()}`,
        frictionAir: frictionAir,
        restitution: 0.6,
        density: 0.05, 
        collisionFilter: { group: -1 }
    }) as ProjectileBody;

    // Assign custom properties and initialize trail *after* creation
    projectile.custom = {
        firedByPlayerIndex: playerIndex,
        abilityType: abilityType, // Assign null if abilityType is null, otherwise assign the AbilityType
        createdAt: Date.now(),
        ownerShipLabel: `projectile-${playerIndex}-${Date.now()}`, // Add the missing required property
        // Explicitly set hasSplit: false for splitter, undefined otherwise
        hasSplit: abilityType === 'splitter' ? false : undefined,
    };
    projectile.trail = [Vector.clone(startPosition)]; // Initialize trail here

    // Set initial velocity
    Body.setVelocity(projectile, velocity);

    World.add(engine.world, projectile);
    shotTracerHandlersRef.current.handleProjectileFired(projectile);
    console.log(`[Physics] Fired projectile ${projectile.id} by P${playerIndex}, Power: ${power}, Ability: ${abilityType || 'None'}`);

  }, []); // Depends only on refs now

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
      const localSettings = currentSettingsRef.current; // Check settings too
      if (!newLevelData || !localSettings) {
          console.error("[Physics Hook] Attempted resetPhysics with undefined newLevelData or missing settings.");
          return;
      }
      // Update the ref just in case anything else relies on it
      currentLevelDataRef.current = newLevelData;
      // Directly initialize world with the new data (initializeWorld uses settings ref)
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