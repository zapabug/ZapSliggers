import { useRef, useCallback, useState } from 'react';
import Matter from 'matter-js';

// Assuming ProjectileBody interface is defined elsewhere and imported,
// or defined here if not shared.
// For now, let's define it here for clarity, ensure it matches GameRenderer.
interface ProjectileBody extends Matter.Body {
  custom: {
    createdAt: number;
    firedByPlayerIndex: 0 | 1;
    ownerShipLabel: string;
  };
  // Trail storage must be on the body for the update loop to easily access it
  trail?: Matter.Vector[];
}

const MAX_TRAIL_LENGTH = 150; // Max points for active trail
const MAX_SAVED_TRACES = 10; // Keep history of last 10 shots per player

export function useShotTracers() {
  const projectileTrailsRef = useRef<Map<number, Matter.Vector[]>>(new Map());
  // Use useState for historical traces to trigger re-renders in consuming component
  const [lastShotTraces, setLastShotTraces] = useState<{ [key in 0 | 1]: Matter.Vector[][] }>({ 0: [], 1: [] });

  const handleProjectileFired = useCallback((projectile: ProjectileBody) => {
    if (!projectile.trail) {
        console.warn("Projectile fired without an initialized trail array.", projectile.id);
        projectile.trail = []; // Initialize if missing
    }
    // No need to update lastShotTraces state here
    projectileTrailsRef.current.set(projectile.id, projectile.trail);
    console.log(`[useShotTracers] Started tracking trail for projectile ${projectile.id}`);
  }, []);

  const handleProjectileUpdate = useCallback((projectile: ProjectileBody) => {
    // Ensure the trail is being tracked
    if (!projectileTrailsRef.current.has(projectile.id) || !projectile.trail) {
        // This might happen if the update loop runs before the fire handler somehow?
        // console.warn(`[useShotTracers] Update called for untracked projectile ${projectile.id}`);
        return;
    }

    // Add current position
    projectile.trail.push(Matter.Vector.clone(projectile.position));

    // Limit trail length
    if (projectile.trail.length > MAX_TRAIL_LENGTH) {
      projectile.trail.shift(); // Remove the oldest point
    }
  }, []);

  const handleProjectileRemoved = useCallback((projectile: ProjectileBody) => {
    let traceStored = false; // Flag for logging
    // Ensure the trail exists and has points before storing it
    if (projectile.trail && projectile.trail.length > 1) {
      const playerIndex = projectile.custom.firedByPlayerIndex;
      const newTrace = [...projectile.trail]; // Create a copy of the trail

      // Update state using the setter function
      setLastShotTraces(prevTraces => {
          const playerTraces = prevTraces[playerIndex];
          const updatedTraces = [...playerTraces, newTrace]; // Add the new trace copy
          
          // Limit history
          if (updatedTraces.length > MAX_SAVED_TRACES) {
              updatedTraces.shift(); // Remove the oldest
          }
          
          // Return the new state object for this player
          // Important: Create a new object wrapper to ensure state change detection
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

    // Remove the active trail from the map
    const deleted = projectileTrailsRef.current.delete(projectile.id);
    console.log(`[useShotTracers] Stopped tracking active trail for projectile ${projectile.id}. Existed in map: ${deleted}. Trace stored: ${traceStored}`);
  }, []);

  const resetTraces = useCallback(() => {
    projectileTrailsRef.current.clear();
    // Reset state using the setter
    setLastShotTraces({ 0: [], 1: [] });
    console.log('[useShotTracers] All traces reset.');
  }, []);

  return {
    projectileTrails: projectileTrailsRef.current, // Active trails can still use ref 
    lastShotTraces, // Return the state variable directly
    handleProjectileFired,
    handleProjectileUpdate,
    handleProjectileRemoved,
    resetTraces,
  };
} 