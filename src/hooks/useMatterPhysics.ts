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
            } else if (otherBody.label.startsWith('boundary')) {
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

  // --- Helper to create boundaries (ensure this is defined) ---
  const createBoundaries = (localSettings: GameSettingsProfile) => {
      const wallThickness = 100;
      return [
          // Centered boundaries, using VIRTUAL dimensions
          Bodies.rectangle(0, -localSettings.VIRTUAL_HEIGHT / 2 - wallThickness / 2, localSettings.VIRTUAL_WIDTH, wallThickness, { isStatic: true, label: 'boundary 1' }), // Top
          Bodies.rectangle(0, localSettings.VIRTUAL_HEIGHT / 2 + wallThickness / 2, localSettings.VIRTUAL_WIDTH, wallThickness, { isStatic: true, label: 'boundary 2' }), // Bottom
          Bodies.rectangle(-localSettings.VIRTUAL_WIDTH / 2 - wallThickness / 2, 0, wallThickness, localSettings.VIRTUAL_HEIGHT, { isStatic: true, label: 'boundary 3' }), // Left
          Bodies.rectangle(localSettings.VIRTUAL_WIDTH / 2 + wallThickness / 2, 0, wallThickness, localSettings.VIRTUAL_HEIGHT, { isStatic: true, label: 'boundary 4' }), // Right
      ];
  };

  // --- Physics Update Logic (Needs Settings) ---
  const updateProjectilesAndApplyGravity = useCallback(() => {
    const currentEngine = engineRef.current;
    const localSettings = currentSettingsRef.current; // Get settings from ref
    if (!currentEngine || !localSettings) return; // Ensure settings are available

    // Destructure settings needed within this callback
    const {
        PLANET_MIN_RADIUS,
        GRAVITY_AOE_BONUS_FACTOR,
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
      // --- SPLITTER LOGIC ---
      if (body.label.startsWith('projectile-')) { 
        const projectileBody = body as ProjectileBody; // <<< RESTORED variable and type assertion

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
          // removeProjectileAndNotify(projectileBody, currentEngine.world); // Called later for all removals

          const spreadAngle = 0.15; // Radians, adjust as needed
          const velocities = [
            Vector.rotate(originalVel, -spreadAngle),
            originalVel, // Center fragment keeps original velocity
            Vector.rotate(originalVel, spreadAngle),
          ];

          // Create 3 fragments
          for (let i = 0; i < 3; i++) {
            const fragmentLabel = `${originalLabel}-frag${i}`;
            // Use destructured constants
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
          // Skip further processing for the original projectile that just split
          return; 
        }
        // --- END SPLITTER LOGIC ---

        // --- Standard Update & Trail ---
        if (!projectileBody.custom || !projectileBody.trail) {
            console.warn(`[Physics Update] Proj ${projectileBody.id} missing data/trail.`);
            // Ensure trail exists even if custom data was missing initially
            projectileBody.trail = projectileBody.trail || [Vector.clone(projectileBody.position)]; 
        } else {
            projectileBody.trail.push(Vector.clone(projectileBody.position));
        }
        shotTracerHandlersRef.current.handleProjectileUpdate(projectileBody); // Update tracer
        // --- End Standard Update & Trail ---

        // --- Apply Planet/Sligger/Ship Forces ---
        let netCustomForce = Vector.create(0, 0); // Accumulate forces here

        Composite.allBodies(currentEngine.world).forEach(staticBody => {
          if (staticBody.label !== 'planet' && staticBody.label !== 'sligger') return;
          
          const distanceVector = Vector.sub(staticBody.position, projectileBody.position);
          const distanceSq = Vector.magnitudeSquared(distanceVector);
          if (distanceSq <= 10) return; 

          const planetRadius = staticBody.plugin?.Zapsliggers?.radius || PLANET_MIN_RADIUS;
          let planetForce = Vector.create(0, 0); // Force from THIS planet
          
          const effectiveRadius = planetRadius * (1 + GRAVITY_AOE_BONUS_FACTOR * (planetRadius / localSettings.VIRTUAL_WIDTH));
          let attractiveForceMagnitude = (localSettings.GRAVITY_CONSTANT * projectileBody.mass * effectiveRadius) / distanceSq;

          if (projectileBody.custom?.abilityType === 'plastic') {
              attractiveForceMagnitude *= PLASTIC_GRAVITY_FACTOR;
          }
          planetForce = Vector.add(planetForce, Vector.mult(Vector.normalise(distanceVector), attractiveForceMagnitude));

          if (staticBody.label === 'sligger') {
              const coreRadius = staticBody.plugin?.Zapsliggers?.coreRadius;
              const distance = Vector.magnitude(distanceVector); 
              if (coreRadius && distance <= coreRadius) {
                  const baseRepulsiveMagnitude = (localSettings.GRAVITY_CONSTANT * projectileBody.mass * coreRadius) / distanceSq;
                  const finalRepulsiveMagnitude = baseRepulsiveMagnitude * SLIGGER_REPULSION_FACTOR;
                  const repulsiveForce = Vector.mult(Vector.normalise(distanceVector), -finalRepulsiveMagnitude);
                  planetForce = repulsiveForce; // Repulsion overrides attraction for this sligger
              } else {
                  planetForce = Vector.mult(planetForce, SLIGGER_ATTRACTION_FACTOR); // Scale attraction
              }
          }
          netCustomForce = Vector.add(netCustomForce, planetForce); // Add this planet's force to total
        });
        
        // Apply Opponent Ship Gravity (for 'gravity' ability)
        if (projectileBody.custom?.abilityType === 'gravity') {
            const firingPlayerIndex = projectileBody.custom.firedByPlayerIndex;
            const opponentPlayerIndex = firingPlayerIndex === 0 ? 1 : 0;
            const opponentShipBody = shipBodiesRef.current[opponentPlayerIndex];
            if (opponentShipBody) {
                const shipDistanceVector = Vector.sub(opponentShipBody.position, projectileBody.position);
                const shipDistanceSq = Vector.magnitudeSquared(shipDistanceVector);
                if (shipDistanceSq > 100 && shipDistanceSq < SHIP_GRAVITY_RANGE_SQ) { 
                    const shipForceMagnitude = (SHIP_GRAVITY_CONSTANT * projectileBody.mass * opponentShipBody.mass) / shipDistanceSq;
                    const shipForceVector = Vector.mult(Vector.normalise(shipDistanceVector), shipForceMagnitude);
                    netCustomForce = Vector.add(netCustomForce, shipForceVector); // Add ship force to total
                }
            }
        }
        // Apply accumulated Planet/Sligger/Ship forces
        if (Vector.magnitudeSquared(netCustomForce) > 0) {
             Body.applyForce(projectileBody, projectileBody.position, netCustomForce);
        }
        // --- End Planet/Sligger/Ship Forces ---

        // *** REMOVE Manual World Gravity Application ***
        // const worldGravityForce = { x: 0, y: localSettings.GRAVITY_CONSTANT * projectileBody.mass };
        // Body.applyForce(projectileBody, projectileBody.position, worldGravityForce);
        // *** END REMOVAL ***

        // --- Timeout Check ---
        const projectileAge = Date.now() - (projectileBody.custom?.createdAt ?? Date.now());
        if (projectileAge > 45000) { 
          console.log(`[Physics Update] Proj ${projectileBody.id} timed out.`);
          bodiesToRemove.push(projectileBody);
        }
        // --- End Timeout Check ---
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
    const { SHIP_RADIUS } = localSettings;

    // Check for valid level data STRUCTURE (PlanetData array)
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

    // --- Create Ship Bodies ---
    const ship1Body = Bodies.circle(levelData.ships[0].x, levelData.ships[0].y, SHIP_RADIUS, {
        label: 'ship-0',
        isStatic: true,
        restitution: 0.5,
        friction: 0.1,
        frictionAir: 0, // Set explicit zero air friction
        angle: 0
    });
    const ship2Body = Bodies.circle(levelData.ships[1].x, levelData.ships[1].y, SHIP_RADIUS, {
        label: 'ship-1',
        isStatic: true,
        restitution: 0.5,
        friction: 0.1,
        frictionAir: 0, // Set explicit zero air friction
        angle: Math.PI
    });
    shipBodiesRef.current = [ship1Body, ship2Body];

    // --- Create Boundary Bodies ---
    const boundaries = createBoundaries(localSettings); // Use helper
    
    // --- Create Planet Bodies from PlanetData ---
    const planetBodies = levelData.planets.map((p: PlanetData) => 
        Bodies.circle(p.x, p.y, p.radius, {
            isStatic: true,
            label: p.isSligger ? 'sligger' : 'planet_standard',
            friction: 0.5, 
            restitution: 0.5,
            plugin: {
                Zapsliggers: {
                    radius: p.radius,
                    coreRadius: p.isSligger ? p.coreRadius : undefined,
                    isSligger: p.isSligger,
                },
            },
        })
    );

    // --- Add all bodies to world ---
    const allBodiesToAdd = [ship1Body, ship2Body, ...boundaries, ...planetBodies];
    World.add(engine.world, allBodiesToAdd);
    console.log(`[Physics initializeWorld] Added ${allBodiesToAdd.length} total bodies.`);

    Events.on(engine, 'beforeUpdate', updateProjectilesAndApplyGravity);
    Events.on(engine, 'collisionStart', handleCollisions);

    console.log("[Physics Hook] World setup complete.");
  }, [handleCollisions, updateProjectilesAndApplyGravity, createBoundaries]); // Added createBoundaries dependency

  // --- Main Setup and Cleanup useEffect ---
  useEffect(() => {
    console.log("[Physics Hook] Initializing Engine & Runner...");
    const engine = Engine.create();
    engineRef.current = engine;
    // *** Set world gravity to ZERO ***
    engine.world.gravity.y = 0; 
    engine.world.gravity.x = 0;
    console.log(`[Physics Main Setup] World gravity explicitly set to 0.`);

    const runner = Runner.create();
    runnerRef.current = runner;

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
  // *** REMOVED initializeWorld dependency - This effect runs only once on mount ***
  }, []); 

  // --- Effect to Initialize World When levelData Becomes Available --- 
  const hasInitializedOnceRef = useRef(false); // Ref to track initialization
  useEffect(() => {
    const currentLevelData = initialLevelData;
    const localSettings = currentSettingsRef.current;
    
    console.log(`[Physics LevelData Effect] Running. Has LevelData: ${!!currentLevelData}, Has Settings: ${!!localSettings}, Engine: ${!!engineRef.current}, InitializedOnce: ${hasInitializedOnceRef.current}`);

    // Conditions to initialize:
    // 1. Have valid levelData and settings.
    // 2. Engine exists.
    // 3. Haven't initialized with *this specific levelData* yet (or perhaps just run once?).
    //    Let's simplify: Run initializeWorld only the FIRST time valid data arrives.
    //    Subsequent updates should use resetPhysics explicitly if needed.
    if (currentLevelData && localSettings && engineRef.current && !hasInitializedOnceRef.current) {
      console.log(`[Physics LevelData Effect] First valid levelData/settings detected. Calling initializeWorld.`);
      initializeWorld(currentLevelData);
      hasInitializedOnceRef.current = true; // Mark as initialized
    } else if (!currentLevelData || !localSettings) {
      // If settings or level data become invalid later, reset the flag
      // Maybe clear the world too?
      console.log(`[Physics LevelData Effect] Settings or LevelData became invalid. Resetting init flag.`);
      hasInitializedOnceRef.current = false; 
      // Optionally clear world if engine exists?
      if (engineRef.current) {
          World.clear(engineRef.current.world, false); 
          Events.off(engineRef.current, 'beforeUpdate');
          Events.off(engineRef.current, 'collisionStart');
          shipBodiesRef.current = [null, null];
          // Apply default gravity again? Or rely on resetPhysics?
           engineRef.current.world.gravity.y = currentSettingsRef.current?.GRAVITY_CONSTANT ?? 0;
      }
    } else {
       console.log(`[Physics LevelData Effect] Conditions not met for initial auto-initialization (Already initialized: ${hasInitializedOnceRef.current}, Missing engine: ${!engineRef.current}).`);
    }
    
  }, [initialLevelData, settings, initializeWorld]); // Keep initializeWorld dependency for now, but logic prevents loop

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

  // --- Reset Physics Logic ---
  const resetPhysics = useCallback((newLevelData: InitialGamePositions) => {
    const currentEngine = engineRef.current;
    const localSettings = currentSettingsRef.current; // Get current settings
    console.log('[Physics] Resetting physics...');
    if (!currentEngine || !localSettings || !newLevelData) { // Added !newLevelData check
        console.warn('[Physics] Cannot reset: Engine, settings, or newLevelData not available.');
        return;
    }

    // Reset refs and state
    currentLevelDataRef.current = newLevelData;
    shipBodiesRef.current = [null, null]; // Clear ship body refs
    shotTracerHandlersRef.current.resetTraces(); // Reset shot traces

    // Clear the world
    World.clear(currentEngine.world, false); // Keep world properties like gravity
    Engine.clear(currentEngine); // Clear engine state if needed

    // *** RE-APPLY WORLD GRAVITY FROM SETTINGS ***
    currentEngine.world.gravity.y = 0;
    currentEngine.world.gravity.x = 0;
    console.log(`[Physics Reset] World gravity explicitly reset to 0.`);

    // Add boundaries
    const boundaries = createBoundaries(localSettings);
    World.add(currentEngine.world, boundaries);

    // Add planets (This map creates Matter.Body objects)
    const planetBodies = newLevelData.planets.map((p: PlanetData) => // Use PlanetData type annotation
        Bodies.circle(p.x, p.y, p.radius, { // Access properties directly from 'p'
            isStatic: true,
            label: p.isSligger ? 'sligger' : 'planet_standard', // Use label from data
            friction: 0.5, // Example friction
            restitution: 0.5, // Example restitution
            plugin: {
                Zapsliggers: { // Add custom plugin data for Sliggers
                    radius: p.radius,
                    coreRadius: p.isSligger ? p.coreRadius : undefined,
                    isSligger: p.isSligger,
                },
            },
        })
    );
    // Add the created Matter.Body objects
    World.add(currentEngine.world, planetBodies); 

    // Add ships and store references
    const ship1 = Bodies.circle(newLevelData.ships[0].x, newLevelData.ships[0].y, localSettings.SHIP_RADIUS, {
        label: 'ship-0',
        isStatic: true,
        frictionAir: 0, // Set explicit zero air friction
        restitution: 0.8
    });
    const ship2 = Bodies.circle(newLevelData.ships[1].x, newLevelData.ships[1].y, localSettings.SHIP_RADIUS, {
        label: 'ship-1',
        isStatic: true,
        frictionAir: 0, // Set explicit zero air friction
        restitution: 0.8
    });
    shipBodiesRef.current = [ship1, ship2];
    World.add(currentEngine.world, [ship1, ship2]);

    console.log('[Physics] Reset complete. World populated.');

    // REMOVED redundant call to initializeWorld

  }, [createBoundaries]); // Added createBoundaries dependency

  const getDynamicBodies = useCallback(() => {
      if (!engineRef.current) return [];
      return Composite.allBodies(engineRef.current.world).filter(
          body => body.label.startsWith('ship-') || body.label.startsWith('projectile-')
      );
  }, []);

  const getAllBodies = useCallback(() => {
      if (!engineRef.current) return [];
      const allBodies = Composite.allBodies(engineRef.current.world);
      // --- Remove Diagnostic Log ---
      // console.log(`[Physics getAllBodies] Returning ${allBodies.length} bodies.`);
      return allBodies;
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