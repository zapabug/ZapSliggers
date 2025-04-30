import React, { useRef, useEffect, useState, useCallback } from 'react';
import Matter from 'matter-js';
import { ProjectileBody } from './useShotTracers'; // Assuming ProjectileBody export
import { InitialGamePositions } from './useGameInitialization';
import { AbilityType } from '../components/ui_overlays/ActionButtons';

// Define the expected shape for shotTracerHandlers prop
interface ShotTracerHandlers {
    handleProjectileFired: (projectile: ProjectileBody) => void;
    handleProjectileUpdate: (projectile: ProjectileBody) => void;
    handleProjectileRemoved: (projectile: ProjectileBody) => void;
    resetTraces: () => void;
}

const { Engine, Runner, Bodies, World, Composite, Vector, Body, Events } = Matter;

// Constants from GameRenderer relevant to physics
const SHIP_RADIUS = 63;
const PLANET_MIN_RADIUS = 30;
const GRAVITY_CONSTANT = 0.5;
const GRAVITY_AOE_BONUS_FACTOR = 0.1;

interface UseMatterPhysicsProps {
  levelData: InitialGamePositions;
  virtualWidth: number;
  virtualHeight: number;
  shotTracerHandlers: ShotTracerHandlers;
  onPlayerHit: (hitPlayerIndex: 0 | 1, firingPlayerIndex: 0 | 1, projectileType: AbilityType | 'standard') => void;
}

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
}: UseMatterPhysicsProps): MatterPhysicsHandles => {
  const engineRef = useRef<Matter.Engine | null>(null);
  const runnerRef = useRef<Matter.Runner | null>(null);
  const shipBodiesRef = useRef<(Matter.Body | null)[]>([null, null]);
  const [currentLevelData, setCurrentLevelData] = useState<InitialGamePositions>(initialLevelData);
  const currentLevelDataRef = useRef(initialLevelData);

  // Keep level data in sync
  useEffect(() => {
    currentLevelDataRef.current = currentLevelData;
  }, [currentLevelData]);


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
            if (!projectile.custom) {
                console.warn(`[Collision] Projectile ${projectile.id} missing custom data.`);
                shotTracerHandlers.handleProjectileRemoved(projectile);
                World.remove(currentEngine.world, projectile);
                return;
            }

            const firedByPlayerIndex = projectile.custom.firedByPlayerIndex;
            const projectileType = projectile.custom.abilityType || 'standard';
            let projectileRemoved = false;

            if (otherBody.label === 'planet') {
                console.log(`[Collision] Proj ${projectile.id} hit planet ${otherBody.id}`);
                shotTracerHandlers.handleProjectileRemoved(projectile);
                World.remove(currentEngine.world, projectile);
                projectileRemoved = true;
            } else if (otherBody.label.startsWith('ship-')) {
                const hitPlayerIndex = parseInt(otherBody.label.split('-')[1], 10) as 0 | 1;
                console.log(`[Collision] Proj ${projectile.id} (P${firedByPlayerIndex}, Type: ${projectileType}) hit P${hitPlayerIndex}`);
                onPlayerHit(hitPlayerIndex, firedByPlayerIndex, projectileType);
                
                shotTracerHandlers.handleProjectileRemoved(projectile);
                World.remove(currentEngine.world, projectile);
                projectileRemoved = true;
            } else if (otherBody.label === 'boundary') {
                console.log(`[Collision] Proj ${projectile.id} hit boundary`);
                shotTracerHandlers.handleProjectileRemoved(projectile);
                World.remove(currentEngine.world, projectile);
                projectileRemoved = true;
            }

            if (!projectileRemoved) {
                 console.warn(`[Collision Warning] Proj ${projectile.id} collided with unhandled body: ${otherBody.label}. Removing.`);
                 shotTracerHandlers.handleProjectileRemoved(projectile);
                 World.remove(currentEngine.world, projectile);
            }
        }
    });
  }, [onPlayerHit, shotTracerHandlers]);

  // --- Physics Update Logic ---
  const updateProjectilesAndApplyGravity = useCallback(() => {
    const currentEngine = engineRef.current;
    if (!currentEngine) return;

    Composite.allBodies(currentEngine.world).forEach(body => {
      if (body.label.startsWith('projectile-')) {
        const projectileBody = body as ProjectileBody;
        if (!projectileBody.custom || !projectileBody.trail) {
            console.warn(`[Physics Update] Proj ${projectileBody.id} missing data/trail.`);
            projectileBody.trail = projectileBody.trail || [Vector.clone(projectileBody.position)]; // Ensure trail exists
            // Maybe remove if custom data is missing? For now, let it continue
            // return;
        } else {
            projectileBody.trail.push(Vector.clone(projectileBody.position));
        }

        shotTracerHandlers.handleProjectileUpdate(projectileBody);

        // Apply gravity
        Composite.allBodies(currentEngine.world).forEach(staticBody => {
          if (staticBody.label === 'planet') {
             const distanceVector = Vector.sub(staticBody.position, projectileBody.position);
             const distanceSq = Vector.magnitudeSquared(distanceVector);
             if (distanceSq > 100) { // Min distance^2
                 const planetRadius = staticBody.plugin?.klunkstr?.radius || PLANET_MIN_RADIUS;
                 const effectiveRadius = planetRadius * (1 + GRAVITY_AOE_BONUS_FACTOR * (planetRadius / virtualWidth));
                 const forceMagnitude = (GRAVITY_CONSTANT * projectileBody.mass * effectiveRadius) / distanceSq;
                 const forceVector = Vector.mult(Vector.normalise(distanceVector), forceMagnitude);
                 Body.applyForce(projectileBody, projectileBody.position, forceVector);
             }
          }
        });

        // Check timeout
        const now = Date.now();
        if (projectileBody.custom && now - projectileBody.custom.createdAt > 45000) {
            console.log(`[Timeout] Removing proj ${projectileBody.id}`);
            shotTracerHandlers.handleProjectileRemoved(projectileBody);
            World.remove(currentEngine.world, projectileBody);
        }
      }
    });
  }, [shotTracerHandlers, virtualWidth]);

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

    shotTracerHandlers.resetTraces();

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
  }, [virtualWidth, virtualHeight, shotTracerHandlers, handleCollisions, updateProjectilesAndApplyGravity]);

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
    const speed = 10 + power; // Base speed + power scaling
    const velocity = Vector.mult(Vector.rotate({ x: 1, y: 0 }, angle), speed);

    // Start position slightly in front of the ship
    const startOffset = Vector.mult(Vector.rotate({ x: 1, y: 0 }, angle), SHIP_RADIUS * 1.1);
    const startPosition = Vector.add(shipBody.position, startOffset);

    // Create body without custom initially to satisfy types
    const projectile: ProjectileBody = Bodies.circle(startPosition.x, startPosition.y, 5, {
        label: `projectile-${playerIndex}-${Date.now()}`,
        frictionAir: 0.01, 
        restitution: 0.6, 
        density: 0.01, 
        plugin: {},
        // custom property removed from initial definition
    }) as ProjectileBody;

    // Attach custom data and trail AFTER creation
    projectile.custom = { 
        firedByPlayerIndex: playerIndex,
        ownerShipLabel: shipBody.label,
        abilityType: abilityType || 'standard', 
        createdAt: Date.now()
    };
    projectile.trail = [Vector.clone(startPosition)];

    // Set initial velocity
    Body.setVelocity(projectile, velocity);

    World.add(engine.world, projectile);
    shotTracerHandlers.handleProjectileFired(projectile);
    console.log(`[Physics] Fired projectile ${projectile.id} by P${playerIndex}, Power: ${power}, Ability: ${abilityType || 'None'}`);

  }, [shotTracerHandlers]);

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
      setCurrentLevelData(newLevelData);
      initializeWorld(newLevelData);
  }, [initializeWorld]);

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