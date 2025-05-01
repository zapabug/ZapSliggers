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

// const MAX_TRAIL_LENGTH = 150; // REMOVED - No longer trimming active trails
const MAX_SAVED_TRACES = 5; // Keep history of last 5 shots per player

export function useShotTracers() {
  // --- REMOVED useState for Active Trails ---
  // const [projectileTrails, setProjectileTrails] = useState<Map<number, { trail: Matter.Vector[], ownerIndex: 0 | 1 }>>(new Map());
  
  // Use useState for historical traces as before
  const [lastShotTraces, setLastShotTraces] = useState<{ [key in 0 | 1]: Matter.Vector[][] }>({ 0: [], 1: [] });

  const handleProjectileFired = useCallback((projectile: ProjectileBody) => {
    // Ensure trail property exists and starts with the initial position
    projectile.trail = [Matter.Vector.clone(projectile.position)];
    console.log(`[useShotTracers] Projectile ${projectile.id} fired. Initialized trail.`);
    // --- REMOVED Update to non-existent Active Trails State ---
  }, []);

  const handleProjectileUpdate = useCallback((projectile: ProjectileBody) => {
    // --- REMOVED Update to non-existent Active Trails State ---
    
    // --- Keep the original trail update on the body itself? ---
    // YES - this now stores the *full* untrimmed trail
    if (!projectile.trail) { 
        // Should not happen if fired handler worked, but good fallback
        projectile.trail = [Matter.Vector.clone(projectile.position)]; 
    } else {
        projectile.trail.push(Matter.Vector.clone(projectile.position));
    }
    // --- REMOVED trimming based on MAX_TRAIL_LENGTH ---
    // --- End keep original trail update ---
  }, []); 

  const handleProjectileRemoved = useCallback((projectile: ProjectileBody) => {
    // Read the full trail from the projectile body property
    if (projectile.trail && projectile.trail.length > 1) {
      const playerIndex = projectile.custom.firedByPlayerIndex;
      const newTrace = [...projectile.trail]; // Copy the full trail

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

    // --- REMOVED Update to non-existent Active Trails State ---
  }, []);

  const resetTraces = useCallback(() => {
    // --- REMOVED Reset of non-existent Active Trails State ---
    setLastShotTraces({ 0: [], 1: [] });
    console.log('[useShotTracers] All historical traces reset.');
  }, []);

  return {
    // projectileTrails, // REMOVED - No longer exposing active trails state
    lastShotTraces, 
    handleProjectileFired,
    handleProjectileUpdate,
    handleProjectileRemoved,
    resetTraces,
  };
} 