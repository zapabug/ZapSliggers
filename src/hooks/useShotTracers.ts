import { useState, useCallback } from 'react';
import Matter from 'matter-js';
import { AbilityType } from '../components/ui_overlays/ActionButtons'; // Import AbilityType

// Make sure ProjectileBody is exported
export interface ProjectileBody extends Matter.Body {
  custom: {
    createdAt: number;
    firedByPlayerIndex: 0 | 1;
    ownerShipLabel: string;
    abilityType: AbilityType | null; // Add optional ability type
  };
  // Trail storage must be on the body for the update loop to easily access it
  trail?: Matter.Vector[];
}

const MAX_TRAIL_LENGTH = 150; // Max points for active trail
const MAX_SAVED_TRACES = 10; // Keep history of last 10 shots per player

export function useShotTracers() {
  // --- Use useState for Active Trails to trigger re-renders ---
  const [projectileTrails, setProjectileTrails] = useState<Map<number, { trail: Matter.Vector[], ownerIndex: 0 | 1 }>>(new Map());
  
  // Use useState for historical traces as before
  const [lastShotTraces, setLastShotTraces] = useState<{ [key in 0 | 1]: Matter.Vector[][] }>({ 0: [], 1: [] });

  const handleProjectileFired = useCallback((projectile: ProjectileBody) => {
    if (!projectile.trail) {
        console.warn("Projectile fired without an initialized trail array.", projectile.id);
        projectile.trail = []; // Initialize if missing
    }
    // --- Update Active Trails State ---
    setProjectileTrails(prevTrails => {
        const newTrails = new Map(prevTrails); // Create a new map copy
        newTrails.set(projectile.id, { 
            trail: projectile.trail!, // Use non-null assertion as we initialize above
            ownerIndex: projectile.custom.firedByPlayerIndex 
        }); 
        return newTrails; // Return the new map
    });
    console.log(`[useShotTracers] Started tracking trail for projectile ${projectile.id}`);
  }, []);

  const handleProjectileUpdate = useCallback((projectile: ProjectileBody) => {
    // Update the trail directly on the projectile body
    // This doesn't require a state update here, as the trail array itself is mutated
    // and the render loop reads the latest trail data via projectileTrails state.
    if (!projectile.trail) return; // Should not happen if fired correctly

    projectile.trail.push(Matter.Vector.clone(projectile.position));
    if (projectile.trail.length > MAX_TRAIL_LENGTH) {
      projectile.trail.shift(); 
    }
    
    // We need to trigger a re-render so the renderLoop reads the updated trail length
    // We can do this by updating the state map with the *same* object reference,
    // but because we set the state, React knows to re-render.
    setProjectileTrails(prevTrails => {
        // Only update if the trail is actually being tracked
        if (prevTrails.has(projectile.id)) {
            // No need to create a new Map, just trigger the update
            return new Map(prevTrails); 
        }
        return prevTrails; // No change if not tracked
    });

  }, []);

  const handleProjectileRemoved = useCallback((projectile: ProjectileBody) => {
    let traceStored = false; 
    if (projectile.trail && projectile.trail.length > 1) {
      const playerIndex = projectile.custom.firedByPlayerIndex;
      const newTrace = [...projectile.trail]; 

      setLastShotTraces(prevTraces => {
          const playerTraces = prevTraces[playerIndex];
          const updatedTraces = [...playerTraces, newTrace]; 
          if (updatedTraces.length > MAX_SAVED_TRACES) {
              updatedTraces.shift(); 
          }
          return {
              ...prevTraces,
              [playerIndex]: updatedTraces
          };
      });
      console.log(`[useShotTracers] Stored trace for player ${playerIndex}. Trace points: ${newTrace.length}`);
      traceStored = true;
    } else {
        console.log(`[useShotTracers] Projectile ${projectile.id} removed with no significant trail to store.`);
    }

    // --- Update Active Trails State (Remove) ---
    setProjectileTrails(prevTrails => {
        const newTrails = new Map(prevTrails);
        const deleted = newTrails.delete(projectile.id);
        console.log(`[useShotTracers] Stopped tracking active trail for projectile ${projectile.id}. Existed in map: ${deleted}. Trace stored: ${traceStored}`);
        // Only return new map if deletion actually happened
        return deleted ? newTrails : prevTrails; 
    });
  }, []);

  const resetTraces = useCallback(() => {
    // --- Reset Active Trails State ---
    setProjectileTrails(new Map());
    setLastShotTraces({ 0: [], 1: [] });
    console.log('[useShotTracers] All traces reset.');
  }, []);

  return {
    projectileTrails, // Return the state variable directly
    lastShotTraces, 
    handleProjectileFired,
    handleProjectileUpdate,
    handleProjectileRemoved,
    resetTraces,
  };
} 