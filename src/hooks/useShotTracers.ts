import { useState, useCallback, useRef } from 'react';
import Matter from 'matter-js';
import { AbilityType } from '../components/ui_overlays/ActionButtons'; // Import AbilityType
import { ProjectilePathData, PathPoint } from '../types/game'; // Fix path and add PathPoint

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
  // Ref to store the most recently completed path before it might get shifted out of history
  const lastCompletedPathRef = useRef<ProjectilePathData | null>(null);

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
      // Clone the path for storage. Matter.Vector might have circular refs, ensure plain object.
      const newTrace: ProjectilePathData = projectile.trail.map(p => ({ x: p.x, y: p.y }));

      // Store this path temporarily in the ref
      lastCompletedPathRef.current = newTrace;

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
      console.log(`[useShotTracers] Stored trace for player ${playerIndex}. Path ref updated. Trace points: ${newTrace.length}`);
    } else {
        lastCompletedPathRef.current = null; // Clear ref if no significant trail
        console.log(`[useShotTracers] Projectile ${projectile.id} removed with no significant trail to store.`);
    }

    // --- REMOVED Update to non-existent Active Trails State ---
  }, []);

  // Function to add a trace received from the network for the opponent
  const addOpponentTrace = useCallback((playerIndex: 0 | 1, path: ProjectilePathData) => {
    if (path.length < 2) {
        console.log(`[useShotTracers] Received opponent trace for player ${playerIndex} is too short, ignoring.`);
        return;
    }

    // Convert PathPoint[] back to Matter.Vector[] for consistency with history storage?
    // OR change history storage to use PathPoint[]?
    // Let's keep history as Matter.Vector[][] for now, as rendering might use Vector methods.
    const opponentTraceVectors: Matter.Vector[] = path.map((p: PathPoint) => Matter.Vector.create(p.x, p.y)); // Add type to p

    setLastShotTraces(prevTraces => {
        const playerTraces = prevTraces[playerIndex];
        const updatedTraces = [...playerTraces, opponentTraceVectors];
        if (updatedTraces.length > MAX_SAVED_TRACES) {
            updatedTraces.shift();
        }
        console.log(`[useShotTracers] Added opponent trace for player ${playerIndex}. Points: ${path.length}`);
        return {
            ...prevTraces,
            [playerIndex]: updatedTraces
        };
    });
  }, []);

  const resetTraces = useCallback(() => {
    setLastShotTraces({ 0: [], 1: [] });
    lastCompletedPathRef.current = null; // Reset the ref too
    console.log('[useShotTracers] All historical traces reset.');
  }, []);

  return {
    // projectileTrails, // REMOVED - No longer exposing active trails state
    lastShotTraces, 
    // Expose the ref's value (read-only access intended)
    getLastCompletedPath: () => lastCompletedPathRef.current,
    handleProjectileFired,
    handleProjectileUpdate,
    handleProjectileRemoved,
    addOpponentTrace, // Expose the new function
    resetTraces,
  };
} 