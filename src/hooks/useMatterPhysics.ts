import React, { useRef, useEffect, useCallback } from 'react';
import Matter from 'matter-js';
import { ProjectileBody } from './useShotTracers'; // Assuming ProjectileBody export
import { InitialGamePositions, PlanetData } from './useGameInitialization'; // Import PlanetData
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

// --- Internal Helper Function for World Setup --- 
const _initializePhysicsWorld = (
    engine: Matter.Engine,
    levelData: InitialGamePositions,
    settings: GameSettingsProfile,
    shipBodiesRef: React.MutableRefObject<(Matter.Body | null)[]>
): { shipBodies: (Matter.Body | null)[] } => {
    World.clear(engine.world, false); // Clear existing bodies, keep gravity etc.

    const allBodies: Matter.Body[] = [];

    // Destructure settings needed for setup
    const {
        VIRTUAL_WIDTH,
        VIRTUAL_HEIGHT,
        SHIP_RADIUS,
        // SHIP_DENSITY, // Removed - Use Matter.js defaults or existing values
        // PLANET_DENSITY, // Removed
        // SLIGGER_DENSITY // Removed
    } = settings;

    // 1. Boundaries
    const wallThickness = 100;
    const boundaries = [
        Bodies.rectangle(0, -VIRTUAL_HEIGHT / 2 - wallThickness / 2, VIRTUAL_WIDTH, wallThickness, { isStatic: true, label: 'boundary 1' }), // Top
        Bodies.rectangle(0, VIRTUAL_HEIGHT / 2 + wallThickness / 2, VIRTUAL_WIDTH, wallThickness, { isStatic: true, label: 'boundary 2' }), // Bottom
        Bodies.rectangle(-VIRTUAL_WIDTH / 2 - wallThickness / 2, 0, wallThickness, VIRTUAL_HEIGHT, { isStatic: true, label: 'boundary 3' }), // Left
        Bodies.rectangle(VIRTUAL_WIDTH / 2 + wallThickness / 2, 0, wallThickness, VIRTUAL_HEIGHT, { isStatic: true, label: 'boundary 4' }), // Right
    ];
    allBodies.push(...boundaries);

    // 2. Planets & Sliggers (Combined from levelData.planets)
    const staticObjects = levelData.planets.map((p: PlanetData) => {
        const bodyLabel = p.isSligger ? 'sligger' : 'planet';
        const bodyOptions: Matter.IBodyDefinition = {
            isStatic: true,
            label: bodyLabel,
            plugin: { planetData: p }
        };
        return Bodies.circle(p.x, p.y, p.radius, bodyOptions);
    });
    allBodies.push(...staticObjects);

    // 3. Ships
    const ships = levelData.ships.map((shipPos, index) => {
        const shipLabel = `ship-${index}` as 'ship-0' | 'ship-1';
        const shipBody = Bodies.circle(shipPos.x, shipPos.y, SHIP_RADIUS, { // Use setting
            label: shipLabel,
            isStatic: false,
            // density: Use Matter.js default or existing logic
            friction: 0.7,
            restitution: 0.3,
            frictionAir: 0.02, // Keep existing value
        });
        shipBodiesRef.current[index] = shipBody; // Update the ref directly
        return shipBody;
    });
    allBodies.push(...ships);

    // Add all bodies to the world
    World.add(engine.world, allBodies);

    console.log("[_initializePhysicsWorld] World initialized with:", {
        boundaries: boundaries.length,
        staticObjects: staticObjects.length, // Combined planets/sliggers
        ships: ships.length,
    });

    // Return references needed outside (like ships)
    return { shipBodies: shipBodiesRef.current };
};
// --- End Helper Function ---

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
  const currentSettingsRef = useRef(settings);

  const onPlayerHitRef = useRef<OnPlayerHitCallback>(onPlayerHit);
  const onProjectileResolvedRef = useRef<OnProjectileResolvedCallback>(onProjectileResolved);
  const shotTracerHandlersRef = useRef<ShotTracerHandlers>(shotTracerHandlers);

  useEffect(() => { onPlayerHitRef.current = onPlayerHit; }, [onPlayerHit]);
  useEffect(() => { onProjectileResolvedRef.current = onProjectileResolved; }, [onProjectileResolved]);
  useEffect(() => { shotTracerHandlersRef.current = shotTracerHandlers; }, [shotTracerHandlers]);
  useEffect(() => { currentLevelDataRef.current = initialLevelData; }, [initialLevelData]);
  useEffect(() => { currentSettingsRef.current = settings; }, [settings]);

  const removeProjectileAndNotify = useCallback((projectile: ProjectileBody, world: Matter.World) => {
    const tracerHandlers = shotTracerHandlersRef.current;
    if (!projectile.custom) {
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
  }, []);

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

            if (otherBody.label === 'planet' || otherBody.label === 'sligger') { // Added sligger check
                shouldRemove = true;
            } else if (otherBody.label.startsWith('ship-')) {
                const hitPlayerIndex = parseInt(otherBody.label.split('-')[1], 10) as 0 | 1;
                if (firedByPlayerIndex !== undefined) {
                    onPlayerHitRef.current(hitPlayerIndex, firedByPlayerIndex, projectileType);
                }
                shouldRemove = true;
            } else if (otherBody.label.startsWith('boundary')) {
                shouldRemove = true;
            } else if (otherBody.label.startsWith('projectile-')) {
                 // Ignore projectile-projectile collisions
            } else {
                // Hit something unknown? Remove projectile.
                console.warn(`Projectile hit unknown body label: ${otherBody.label}`);
                shouldRemove = true;
            }

            if (shouldRemove) {
                 removeProjectileAndNotify(projectile, currentEngine.world);
            }
        }
    });
  }, [removeProjectileAndNotify]);

  const updateProjectilesAndApplyGravity = useCallback(() => {
    const currentEngine = engineRef.current;
    const localSettings = currentSettingsRef.current;
    if (!currentEngine || !localSettings) return;

    const {
        PLANET_MIN_RADIUS,
        GRAVITY_CONSTANT,
        SLIGGER_ATTRACTION_FACTOR,
        SLIGGER_REPULSION_FACTOR,
        SLIGGER_CORE_RADIUS_FACTOR,
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

        if (
          projectileBody.custom?.abilityType === 'splitter' &&
          !projectileBody.custom?.hasSplit &&
          Date.now() - (projectileBody.custom?.createdAt ?? 0) > 1500
        ) {
          const originalPos = Vector.clone(projectileBody.position);
          const originalVel = Vector.clone(projectileBody.velocity);
          const firedBy = projectileBody.custom.firedByPlayerIndex;
          const originalLabel = projectileBody.custom.ownerShipLabel;

          bodiesToRemove.push(projectileBody);

          const spreadAngle = 0.15;
          const velocities = [
            Vector.rotate(originalVel, -spreadAngle),
            originalVel,
            Vector.rotate(originalVel, spreadAngle),
          ];

          for (let i = 0; i < 3; i++) {
            const fragmentLabel = `${originalLabel}-frag${i}`;
            const fragment: ProjectileBody = Bodies.circle(originalPos.x, originalPos.y, SPLITTER_FRAGMENT_RADIUS, {
              label: fragmentLabel,
              frictionAir: DEFAULT_FRICTION_AIR,
              restitution: 0.6,
              density: 0.04,
              collisionFilter: { group: -1 }
            }) as ProjectileBody;

            fragment.custom = {
              firedByPlayerIndex: firedBy,
              abilityType: 'splitter_fragment',
              createdAt: Date.now(),
              ownerShipLabel: fragmentLabel,
            };
            fragment.trail = [Vector.clone(originalPos)];

            Body.setVelocity(fragment, velocities[i]);
            bodiesToAdd.push(fragment);
            projectilesToNotifyFired.push(fragment);
          }
          return;
        }

        if (!projectileBody.custom) projectileBody.custom = { firedByPlayerIndex: 0, abilityType: null, createdAt: Date.now(), ownerShipLabel: 'unknown' };
        if (!projectileBody.trail) projectileBody.trail = [];
        projectileBody.trail.push(Vector.clone(projectileBody.position));
        shotTracerHandlersRef.current.handleProjectileUpdate(projectileBody);

        let netCustomForce = Vector.create(0, 0);

        Composite.allBodies(currentEngine.world).forEach(staticBody => {
          if (!staticBody.isStatic || !(staticBody.label === 'planet' || staticBody.label === 'sligger')) return;

          const distanceVector = Vector.sub(staticBody.position, projectileBody.position);
          const distanceSq = Vector.magnitudeSquared(distanceVector);
          if (distanceSq < 1e-6) return;

          const distance = Math.sqrt(distanceSq);
          const forceDirection = Vector.normalise(distanceVector);

          let forceMagnitude = 0;
          const planetData = staticBody.plugin?.planetData as PlanetData | undefined;
          const bodyRadius = planetData?.radius || PLANET_MIN_RADIUS;

          let baseGravity = (GRAVITY_CONSTANT * projectileBody.mass * staticBody.mass) / distanceSq;

          if (projectileBody.custom?.abilityType === 'plastic') {
             baseGravity *= PLASTIC_GRAVITY_FACTOR;
          }
          forceMagnitude += baseGravity;

          if (staticBody.label === 'sligger' && planetData) {
              const coreRadius = bodyRadius * SLIGGER_CORE_RADIUS_FACTOR;
              if (distance < coreRadius) {
                   forceMagnitude = -Math.abs(baseGravity) * SLIGGER_REPULSION_FACTOR;
              } else {
                  forceMagnitude *= SLIGGER_ATTRACTION_FACTOR;
              }
          }

          if (forceMagnitude !== 0) {
              const gravityForce = Vector.mult(forceDirection, forceMagnitude);
              netCustomForce = Vector.add(netCustomForce, gravityForce);
          }
        });

        if (projectileBody.custom?.abilityType === 'gravity' && SHIP_GRAVITY_CONSTANT > 0) {
            const firingPlayerIndex = projectileBody.custom.firedByPlayerIndex;
            const opponentPlayerIndex = firingPlayerIndex === 0 ? 1 : 0;
            const opponentShipBody = shipBodiesRef.current[opponentPlayerIndex];

            if (opponentShipBody) {
                const shipDistVec = Vector.sub(opponentShipBody.position, projectileBody.position);
                const shipDistSq = Vector.magnitudeSquared(shipDistVec);

                if (shipDistSq > 1e-6 && shipDistSq < SHIP_GRAVITY_RANGE_SQ) {
                     const shipGravityMag = (SHIP_GRAVITY_CONSTANT * opponentShipBody.mass * projectileBody.mass) / shipDistSq;
                     const shipForceDir = Vector.normalise(shipDistVec);
                     const shipGravityForce = Vector.mult(shipForceDir, shipGravityMag);
                     netCustomForce = Vector.add(netCustomForce, shipGravityForce);
                }
            }
        }

        if (Vector.magnitudeSquared(netCustomForce) > 0) {
             Body.applyForce(projectileBody, projectileBody.position, netCustomForce);
        }

        const projectileAge = Date.now() - (projectileBody.custom?.createdAt ?? Date.now());
        if (projectileAge > 45000) {
          bodiesToRemove.push(projectileBody);
        }
      }
      // ***** LOG SHIP FORCES/VELOCITY *****
      else if (body.label.startsWith('ship-')) {
          // Log ship's state at the *end* of the update loop (after forces might have been applied)
          // Reduce frequency if too noisy, e.g., using a counter: if (Math.random() < 0.05) ...
          console.log(`[Physics Update] Ship ${body.label} - Vel: (${body.velocity.x.toFixed(2)}, ${body.velocity.y.toFixed(2)}), Force: (${body.force.x.toFixed(4)}, ${body.force.y.toFixed(4)})`);
      }
    });

    if (bodiesToAdd.length > 0) {
        World.add(currentEngine.world, bodiesToAdd);
        projectilesToNotifyFired.forEach(p => shotTracerHandlersRef.current.handleProjectileFired(p));
    }
    if (bodiesToRemove.length > 0) {
        bodiesToRemove.forEach(body => {
             removeProjectileAndNotify(body, currentEngine.world);
        });
    }
  }, [removeProjectileAndNotify]);

  // --- Initial Setup Effect --- 
  useEffect(() => {
    if (!settings || !initialLevelData) { 
        console.log("[useMatterPhysics] Initial Setup: Waiting for settings or level data...");
        engineRef.current = null;
        runnerRef.current = null;
        shipBodiesRef.current = [null, null];
        return;
    }
    console.log("[useMatterPhysics] Initial Setup: Settings and Level Data ready. Initializing...");
    currentSettingsRef.current = settings;
    currentLevelDataRef.current = initialLevelData;
    
    const localSettings = settings; 
    const localLevelData = initialLevelData;

    const engine = Engine.create();
    console.log(`[Physics Setup] Initializing engine. Default Gravity: x=${engine.gravity.x}, y=${engine.gravity.y}, scale=${engine.gravity.scale}`);
    
    // ***** EXPLICITLY DISABLE ENGINE GRAVITY *****
    engine.gravity.scale = 0;
    console.log(`[Physics Setup] Engine gravity scale explicitly set to 0.`);
    // ***** ------------------------------------ *****
    
    engineRef.current = engine;

    const runner = Runner.create();
    runnerRef.current = runner;

    _initializePhysicsWorld(engine, localLevelData, localSettings, shipBodiesRef);

    Events.on(engine, 'collisionStart', handleCollisions);
    Events.on(engine, 'beforeUpdate', updateProjectilesAndApplyGravity);

    Runner.run(runner, engine);

    console.log("[useMatterPhysics] Initial Physics World Setup Complete.");

    // Cleanup function
    return () => {
      console.log("[useMatterPhysics] Cleanup: Stopping runner, clearing engine, removing listeners.");
      if (runnerRef.current && engineRef.current) {
        Runner.stop(runnerRef.current);
        const currentEngine = engineRef.current; 
        Events.off(currentEngine, 'collisionStart', handleCollisions); 
        Events.off(currentEngine, 'beforeUpdate', updateProjectilesAndApplyGravity);
        World.clear(currentEngine.world, false);
        Engine.clear(currentEngine);
      }
      engineRef.current = null;
      runnerRef.current = null;
      shipBodiesRef.current = [null, null];
    };
  }, [settings, initialLevelData, handleCollisions, updateProjectilesAndApplyGravity]);

  // --- resetPhysics Function ---
  const resetPhysics = useCallback((newLevelData: InitialGamePositions) => {
    console.log("[useMatterPhysics] resetPhysics called.");
    const engine = engineRef.current;
    const localSettings = currentSettingsRef.current;

    if (!engine || !localSettings) {
        console.error("[useMatterPhysics] Cannot reset: Engine or settings not available.");
        return;
    }

    currentLevelDataRef.current = newLevelData;
    shotTracerHandlersRef.current.resetTraces();

    const projectiles = Composite.allBodies(engine.world).filter(b => b.label.startsWith('projectile-'));
    console.log(`[useMatterPhysics] Reset: Removing ${projectiles.length} existing projectiles.`);
    for (let i = projectiles.length - 1; i >= 0; i--) {
        World.remove(engine.world, projectiles[i]);
    }

    console.log("[useMatterPhysics] Reset: Re-initializing world with new level data...");
    _initializePhysicsWorld(engine, newLevelData, localSettings, shipBodiesRef);
    console.log("[useMatterPhysics] Reset: World re-initialized.");

  }, []);

  // --- Exposed Control Functions ---
  const fireProjectile = useCallback((playerIndex: 0 | 1, power: number, abilityType: AbilityType | null) => {
    const engine = engineRef.current;
    const localSettings = currentSettingsRef.current;
    const shipBody = shipBodiesRef.current[playerIndex];
    if (!engine || !shipBody || !localSettings) return;

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

    const startOffset = Vector.mult(Vector.rotate({ x: 1, y: 0 }, angle), SHIP_RADIUS * 1.1);
    const startPosition = Vector.add(shipBody.position, startOffset);

    let frictionAir = DEFAULT_FRICTION_AIR;
    if (abilityType === 'plastic') {
        frictionAir = PLASTIC_FRICTION_AIR;
    } else if (abilityType === 'gravity') {
        frictionAir = GRAVITY_FRICTION_AIR;
    }

    const projectile: ProjectileBody = Bodies.circle(startPosition.x, startPosition.y, STANDARD_PROJECTILE_RADIUS, {
        label: `projectile-${playerIndex}-${Date.now()}`,
        frictionAir: frictionAir,
        restitution: 0.6,
        density: 0.05, 
        collisionFilter: { group: -1 }
    }) as ProjectileBody;

    projectile.custom = {
        firedByPlayerIndex: playerIndex,
        abilityType: abilityType,
        createdAt: Date.now(),
        ownerShipLabel: `projectile-${playerIndex}-${Date.now()}`,
        hasSplit: abilityType === 'splitter' ? false : undefined,
    };
    projectile.trail = [Vector.clone(startPosition)];

    Body.setVelocity(projectile, velocity);

    World.add(engine.world, projectile);
    shotTracerHandlersRef.current.handleProjectileFired(projectile);

  }, []);

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

  const getDynamicBodies = useCallback(() => {
      if (!engineRef.current) return [];
      return Composite.allBodies(engineRef.current.world).filter(
          body => body.label.startsWith('ship-') || body.label.startsWith('projectile-')
      );
  }, []);

  const getAllBodies = useCallback(() => {
      if (!engineRef.current) return [];
      const allBodies = Composite.allBodies(engineRef.current.world);
      return allBodies;
  }, []);

  // --- Return Handles ---
  return {
    engine: engineRef.current,
    shipBodies: shipBodiesRef,
    getDynamicBodies,
    getAllBodies,
    fireProjectile,
    setShipAim,
    getShipAngle,
    resetPhysics,
  };
};
