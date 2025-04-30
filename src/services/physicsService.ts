import Matter from 'matter-js';

// Define categories for collision filtering
const CollisionCategory = {
    PLAYER: 0x0001,
    PLANET: 0x0002,
    PROJECTILE_P1: 0x0004,
    PROJECTILE_P2: 0x0008,
    // Add more categories as needed (e.g., for different power-ups)
};

// Aliases
const Engine = Matter.Engine;
const World = Matter.World;
const Bodies = Matter.Bodies;
const Body = Matter.Body;
const Vector = Matter.Vector;
const Events = Matter.Events;

let engine: Matter.Engine;
let world: Matter.World;

// Store bodies with their IDs for easy lookup
const bodiesMap = new Map<string, Matter.Body>();

// Define the gravity listener function here so it's accessible in initPhysics
const gravityUpdateListener = () => {
    if (!world || !engine) return; // Guard clause

    const bodies = Matter.Composite.allBodies(world);
    const planets = bodies.filter(body => body.label === 'planet');
    const projectiles = bodies.filter(body => body.label.startsWith('projectile'));

    projectiles.forEach(projectile => {
        planets.forEach(planet => {
            const planetBody = planet as Matter.Body & { plugin: { gravityMagnitude?: number } }; // Type assertion
            const forceMagnitude = planetBody.plugin?.gravityMagnitude ?? 0.005; // Default gravity if not set
            const direction = Vector.sub(planetBody.position, projectile.position);
            const distanceSq = Vector.magnitudeSquared(direction) || 1; // Avoid division by zero
            const normalizedDirection = Vector.normalise(direction);
            // Ensure planet mass is considered if needed, Matter.js bodies have mass based on density/area
            const planetMass = planetBody.mass || 100; // Example placeholder mass if needed
            const force = Vector.mult(normalizedDirection, (forceMagnitude * projectile.mass * planetMass) / distanceSq); // Adjusted gravity calculation
            Body.applyForce(projectile, projectile.position, force);
        });
    });
};

export function initPhysics(gravity = { x: 0, y: 0, scale: 0.001 }) {
    engine = Engine.create();
    world = engine.world;
    world.gravity = gravity; // Disable global gravity initially, apply forces locally

    console.log("Physics engine initialized");

    // Setup collision events
    Events.on(engine, 'collisionStart', (event) => {
        const pairs = event.pairs;
        for (let i = 0; i < pairs.length; i++) {
            const pair = pairs[i];
            const bodyA = pair.bodyA;
            const bodyB = pair.bodyB;

            // Basic collision logging - expand for game logic
            console.log(`Collision between ${bodyA.label} and ${bodyB.label}`);

            // Example: Projectile hits Planet
            if (
                (bodyA.label === 'planet' && bodyB.label.startsWith('projectile')) ||
                (bodyB.label === 'planet' && bodyA.label.startsWith('projectile'))
            ) {
                const projectileBody = bodyA.label.startsWith('projectile') ? bodyA : bodyB;
                // TODO: Remove projectile from world and visual scene
                console.log(`Projectile ${projectileBody.id} hit planet`);
                // World.remove(world, projectileBody);
                // bodiesMap.delete(projectileBody.id.toString()); // Assuming ID is used as key
            }

            // TODO: Add logic for projectile-player hits, power-up interactions, etc.
        }
    });

    // Add the gravity update listener during initialization
    Events.on(engine, 'beforeUpdate', gravityUpdateListener);
    console.log("Added gravity update listener");

    return { engine, world };
}

export function stepPhysics(delta: number = 1000 / 60) {
    if (!engine) return;
    Engine.update(engine, delta);
}

export function addPlanet(id: string, x: number, y: number, radius: number, gravityMagnitude: number) {
    if (!world) return;
    const planetBody = Bodies.circle(x, y, radius, {
        isStatic: true,
        label: 'planet',
        plugin: {
            gravityMagnitude: gravityMagnitude // Custom property to store gravity strength
        },
        collisionFilter: {
            category: CollisionCategory.PLANET,
            mask: CollisionCategory.PROJECTILE_P1 | CollisionCategory.PROJECTILE_P2 // Only collide with projectiles
        }
    });
    World.add(world, planetBody);
    bodiesMap.set(id, planetBody);
    console.log(`Added planet ${id} at (${x}, ${y})`);
    return planetBody;
}

export function addPlayer(id: string, x: number, y: number, width: number, height: number) {
    if (!world) return;
    // Using a rectangle for now, could be a more complex shape
    const playerBody = Bodies.rectangle(x, y, width, height, {
        isStatic: true, // Players don't move due to physics in this game
        label: `player-${id}`,
        collisionFilter: {
            category: CollisionCategory.PLAYER,
            mask: CollisionCategory.PROJECTILE_P1 | CollisionCategory.PROJECTILE_P2 // Only collide with projectiles
        }
    });
    World.add(world, playerBody);
    bodiesMap.set(id, playerBody);
    console.log(`Added player ${id} at (${x}, ${y})`);
    return playerBody;
}

// Keep track of projectile IDs
let nextProjectileId = 0;

export function launchProjectile(playerId: 'P1' | 'P2', startX: number, startY: number, angleRad: number, power: number, radius: number = 5) {
    if (!world || !engine) return null;

    const projectileId = `proj-${playerId}-${nextProjectileId++}`;
    const category = playerId === 'P1' ? CollisionCategory.PROJECTILE_P1 : CollisionCategory.PROJECTILE_P2;
    // Collide with Player, Planet, and the *other* player's projectiles
    const mask = CollisionCategory.PLAYER | CollisionCategory.PLANET | (playerId === 'P1' ? CollisionCategory.PROJECTILE_P2 : CollisionCategory.PROJECTILE_P1);

    const projectileBody = Bodies.circle(startX, startY, radius, {
        label: `projectile-${playerId}-${projectileId}`, // More specific label
        frictionAir: 0, // No air friction in space!
        friction: 0.1,
        restitution: 0.6, // Bounciness
        density: 0.01, // Affects mass
        collisionFilter: {
            category: category,
            mask: mask,
        },
    });

    // Calculate initial velocity vector
    const velocity = Vector.mult(Vector.create(Math.cos(angleRad), Math.sin(angleRad)), power * 0.05); // Adjust multiplier as needed

    // Apply the velocity
    Body.setVelocity(projectileBody, velocity);

    // Gravity is now handled by the 'beforeUpdate' listener added in initPhysics
    // Remove the listener addition logic from here

    World.add(world, projectileBody);
    bodiesMap.set(projectileId, projectileBody);
    console.log(`Launched projectile ${projectileId} from (${startX}, ${startY})`);

    return { id: projectileId, body: projectileBody };
}

export function getBody(id: string): Matter.Body | undefined {
    return bodiesMap.get(id);
}

export function getAllBodies(): Matter.Body[] {
    return Matter.Composite.allBodies(world);
}

export function removeBody(id: string) {
    const body = bodiesMap.get(id);
    if (body && world) {
        World.remove(world, body);
        bodiesMap.delete(id);
        console.log(`Removed body ${id}`);
    }
}

export function cleanupPhysics() {
    if (engine && world) { // Check world exists too
        // It's safer to remove listeners specifically if needed, but Engine.clear might handle it.
        // Events.off(engine, 'beforeUpdate', gravityUpdateListener); // Example if needed

        World.clear(world, false);
        Engine.clear(engine);
        bodiesMap.clear();
        nextProjectileId = 0; // Reset projectile counter
        console.log("Physics engine cleaned up");
        // Removed the broad Events.off(engine) call
    }
} 