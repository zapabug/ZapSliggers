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
    hasSplit?: boolean; // Optional flag for splitter projectiles
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
    // DEBUG LOG
    // console.log(`[useShotTracers DEBUG] Started tracking trail for projectile ${projectile.id}. Initial trail length: ${projectile.trail?.length ?? 0}`);
  }, []);

  const handleProjectileUpdate = useCallback((projectile: ProjectileBody) => {
    // DEBUG LOG
    // const currentPosition = Matter.Vector.clone(projectile.position); // COMMENTED OUT - For verbose log below

    // MODIFICATION START: Update state immutably
    setProjectileTrails(prevTrails => {
        const currentTrailData = prevTrails.get(projectile.id);
        if (!currentTrailData) {
            // If the trail isn't in the map (e.g., removed just before update), do nothing
            console.warn(`[useShotTracers Update] Trail for ${projectile.id} not found in state map.`);
            return prevTrails; 
        }

        // Create a *new* trail array with the new point
        const newTrail = [...currentTrailData.trail, Matter.Vector.clone(projectile.position)];

        // Trim the new array if necessary
        if (newTrail.length > MAX_TRAIL_LENGTH) {
            newTrail.shift();
        }

        // Create a new map with the updated trail data
        const newTrails = new Map(prevTrails);
        newTrails.set(projectile.id, { 
            ...currentTrailData, // Keep ownerIndex
            trail: newTrail 
        });
        
        // DEBUG LOG - COMMENTED OUT FOR LESS NOISE
        // console.log(`[useShotTracers DEBUG] Update state for ${projectile.id}. Prev length: ${currentTrailData.trail.length}, New length: ${newTrail.length}. Position: (${currentPosition.x.toFixed(1)}, ${currentPosition.y.toFixed(1)})`);

        return newTrails; // Return the updated map
    });
    // MODIFICATION END

    // --- Keep the original trail update on the body itself? ---
    // This might still be needed if other physics logic relies on it,
    // but the rendering should now solely rely on the state map.
    // Let's keep it for now to minimize potential side effects.
    if (!projectile.trail) { projectile.trail = []; }
    projectile.trail.push(Matter.Vector.clone(projectile.position));
    if (projectile.trail.length > MAX_TRAIL_LENGTH) {
        projectile.trail.shift();
    }
    // --- End keep original trail update ---

    // DEBUG LOG
    // const bodyTrailLengthAfterUpdate = projectile.trail?.length ?? -1; // COMMENTED OUT - Unused after removing log
    // REMOVED Check using stateTrailLengthBeforeUpdate
    // console.log(`[useShotTracers DEBUG] Updated body trail for ${projectile.id}. Body trail length: ${bodyTrailLengthAfterUpdate}.`);
    

  }, []); // REMOVED projectileTrails dependency

  const handleProjectileRemoved = useCallback((projectile: ProjectileBody) => {
    // let traceStored = false; // Unused
    // const trailLengthOnRemove = projectile.trail?.length ?? 0; // Unused
    // DEBUG LOG
    // console.log(`[useShotTracers DEBUG] Attempting remove for ${projectile.id}. Trail length on body: ${trailLengthOnRemove}`);

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
    } else {
        console.log(`[useShotTracers] Projectile ${projectile.id} removed with no significant trail to store.`);
    }

    // --- Update Active Trails State (Remove) ---
    setProjectileTrails(prevTrails => {
        // DEBUG LOG
        // const trailExistsBeforeDelete = prevTrails.has(projectile.id); // Unused
        // const stateTrailLengthBeforeDelete = prevTrails.get(projectile.id)?.trail.length ?? -1; // Unused

        const newTrails = new Map(prevTrails);
        const deleted = newTrails.delete(projectile.id);
        // DEBUG LOG
        // console.log(`[useShotTracers DEBUG] Stopped tracking active trail for projectile ${projectile.id}. Existed in map: ${trailExistsBeforeDelete} -> ${deleted}. State trail length: ${stateTrailLengthBeforeDelete}. Trace stored: ${traceStored}`);

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