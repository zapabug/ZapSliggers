import React, { useRef, useEffect, useState, forwardRef, useImperativeHandle, ForwardedRef, useMemo } from 'react';
import Matter from 'matter-js'; // Keep base import for Composite
import { useShotTracers, ProjectileBody } from '../../hooks/useShotTracers';
import { generateInitialPositions, InitialGamePositions } from '../../hooks/useGameInitialization';
import { AbilityType } from '../ui_overlays/ActionButtons';
import { useMatterPhysics, MatterPhysicsHandles } from '../../hooks/useMatterPhysics';
import { useDynamicViewport } from '../../hooks/useDynamicViewport';

// Removed unused Matter destructuring

// --- Constants --- (Keep only those needed for rendering/layout)
const VIRTUAL_WIDTH = 2400;
const VIRTUAL_HEIGHT = 1200;
const DESIGN_ASPECT_RATIO = VIRTUAL_WIDTH / VIRTUAL_HEIGHT;
const SHIP_RADIUS = 63; // Needed for drawing
const PLANET_MIN_RADIUS = 30; // Needed for drawing fallback
// Removed unused GRAVITY_CONSTANT etc.

// Define props for the GameRenderer component
interface GameRendererProps {
  levelData: InitialGamePositions;
  onPlayerHit: (hitPlayerIndex: 0 | 1, firingPlayerIndex: 0 | 1, projectileType: AbilityType | 'standard') => void; // Updated signature
  onLevelReset?: () => void; // Made optional
}

// Define the interface for the methods exposed via the ref
export interface GameRendererRef {
  fireProjectile: (playerIndex: 0 | 1, power: number, abilityType: AbilityType | null) => void;
  setShipAim: (playerIndex: 0 | 1, angleDegrees: number) => void;
  getShipAngle: (playerIndex: 0 | 1) => number | undefined;
  resetGame: () => void; // NEW: Add reset function
}

// --- Drawing Helper Functions ---
const drawBackground = (ctx: CanvasRenderingContext2D, img: HTMLImageElement | null) => {
    const bgX = -VIRTUAL_WIDTH / 2;
    const bgY = -VIRTUAL_HEIGHT;
    const bgWidth = VIRTUAL_WIDTH * 2;
    const bgHeight = VIRTUAL_HEIGHT * 3;
    if (img) {
        ctx.drawImage(img, bgX, bgY, bgWidth, bgHeight);
    } else {
        ctx.fillStyle = '#000020'; 
        ctx.fillRect(bgX, bgY, bgWidth, bgHeight);
    }
};

const drawBorder = (ctx: CanvasRenderingContext2D) => {
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.lineWidth = 4;
    const borderX = -VIRTUAL_WIDTH / 2;
    const borderY = -VIRTUAL_HEIGHT;
    const borderWidth = VIRTUAL_WIDTH * 2;
    const borderHeight = VIRTUAL_HEIGHT * 3;
    ctx.strokeRect(borderX, borderY, borderWidth, borderHeight);
};

const drawPlanet = (ctx: CanvasRenderingContext2D, body: Matter.Body) => {
        const radius = body.plugin?.klunkstr?.radius || PLANET_MIN_RADIUS;
        ctx.beginPath();
        ctx.arc(body.position.x, body.position.y, radius, 0, 2 * Math.PI);
    ctx.fillStyle = body.render.fillStyle || '#888'; // Use render prop if defined
        ctx.fill();
};

const drawShip = (ctx: CanvasRenderingContext2D, body: Matter.Body) => {
        const playerIndex = parseInt(body.label.split('-')[1], 10);
        ctx.save(); 
        ctx.translate(body.position.x, body.position.y);
        ctx.rotate(body.angle);
        ctx.beginPath();
    ctx.moveTo(SHIP_RADIUS, 0);
    ctx.lineTo(-SHIP_RADIUS / 2, -SHIP_RADIUS / 2);
    ctx.lineTo(-SHIP_RADIUS / 2, SHIP_RADIUS / 2);
        ctx.closePath();
        ctx.fillStyle = playerIndex === 0 ? '#00f' : '#f00'; 
        ctx.fill();
        ctx.restore(); 
};

const drawProjectile = (ctx: CanvasRenderingContext2D, body: ProjectileBody) => {
        ctx.beginPath();
        ctx.arc(body.position.x, body.position.y, 5, 0, 2 * Math.PI);
    const ownerIndex = body.custom?.firedByPlayerIndex ?? 0;
        ctx.fillStyle = ownerIndex === 0 ? '#add8e6' : '#ffcccb'; 
        ctx.fill();
};

const drawActiveTrail = (ctx: CanvasRenderingContext2D, trailData: { trail: Matter.Vector[], ownerIndex: 0 | 1 }) => {
    if (trailData.trail.length < 2) return;
        ctx.beginPath();
        ctx.moveTo(trailData.trail[0].x, trailData.trail[0].y);
        for (let i = 1; i < trailData.trail.length; i++) {
            ctx.lineTo(trailData.trail[i].x, trailData.trail[i].y);
        }
        ctx.strokeStyle = trailData.ownerIndex === 0 ? '#00f' : '#f00'; 
        ctx.lineWidth = 2;
        ctx.stroke();
};

const drawHistoricalTrace = (ctx: CanvasRenderingContext2D, trace: Matter.Vector[]) => {
        if (trace.length < 2) return;
        ctx.beginPath();
        ctx.moveTo(trace[0].x, trace[0].y);
        for (let i = 1; i < trace.length; i++) {
          ctx.lineTo(trace[i].x, trace[i].y);
        }
        ctx.strokeStyle = '#0f0'; 
        ctx.lineWidth = 1;
        ctx.setLineDash([5, 5]); 
        ctx.stroke();
        ctx.setLineDash([]); 
};

// --- GameRenderer Component ---
const GameRenderer = forwardRef<GameRendererRef, GameRendererProps>(({ levelData, onPlayerHit, onLevelReset }: GameRendererProps, ref: ForwardedRef<GameRendererRef>) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [backgroundImage, setBackgroundImage] = useState<HTMLImageElement | null>(null);
  const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 });
  const physicsRef = useRef<MatterPhysicsHandles | null>(null);

  // --- Hooks ---
  const tracers = useShotTracers(); // Get the full object
  const { projectileTrails, lastShotTraces } = tracers;

  // --- Memoize the handlers object to pass to useMatterPhysics ---
  const shotTracerHandlers = useMemo(() => ({
      handleProjectileFired: tracers.handleProjectileFired,
      handleProjectileUpdate: tracers.handleProjectileUpdate,
      handleProjectileRemoved: tracers.handleProjectileRemoved,
      resetTraces: tracers.resetTraces,
  }), [tracers.handleProjectileFired, tracers.handleProjectileUpdate, tracers.handleProjectileRemoved, tracers.resetTraces]);
  // --- END Memoization ---

  const physics = useMatterPhysics({
    levelData,
    virtualWidth: VIRTUAL_WIDTH,
    virtualHeight: VIRTUAL_HEIGHT,
    onPlayerHit,
    shotTracerHandlers, // Pass the memoized object
  });
  physicsRef.current = physics; // Keep ref updated for imperative handle

  const viewport = useDynamicViewport({
      engine: physics.engine,
      getDynamicBodies: physics.getDynamicBodies,
      virtualWidth: VIRTUAL_WIDTH,
      virtualHeight: VIRTUAL_HEIGHT,
      designAspectRatio: DESIGN_ASPECT_RATIO,
      canvasSize,
  });

  // Ref for historical traces to avoid stale closures in render loop
  const latestTracesRef = useRef(lastShotTraces);
  useEffect(() => {
    latestTracesRef.current = lastShotTraces;
  }, [lastShotTraces]);

  // --- Imperative Handle --- (Delegates to useMatterPhysics)
  useImperativeHandle(ref, () => ({
    fireProjectile: (playerIndex, power, abilityType) => {
        physicsRef.current?.fireProjectile(playerIndex, power, abilityType);
    },
    setShipAim: (playerIndex, angleDegrees) => {
        physicsRef.current?.setShipAim(playerIndex, angleDegrees);
    },
    getShipAngle: (playerIndex) => {
        return physicsRef.current?.getShipAngle(playerIndex);
    },
    resetGame: () => {
        console.log("[GameRenderer Ref] resetGame called.");
        // Generate new level layout outside and pass via props or trigger a state update
        // For now, assuming levelData prop will change externally triggering physics reset
        const newLevel = generateInitialPositions(VIRTUAL_WIDTH, VIRTUAL_HEIGHT);
        physicsRef.current?.resetPhysics(newLevel);
        onLevelReset?.(); // Notify parent if needed
    }
  }));

  // --- Effects ---
  // Load background image
  useEffect(() => {
    const img = new Image();
    img.onload = () => setBackgroundImage(img);
    img.onerror = () => console.error('Failed to load background image.');
    img.src = '/images/backdrop.png';
    return () => { img.onload = null; img.onerror = null; };
  }, []);

  // Handle canvas resize
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const handleResize = () => {
        const { width, height } = canvas.getBoundingClientRect();
        const dpr = window.devicePixelRatio || 1;
        canvas.width = width * dpr;
        canvas.height = height * dpr;
        setCanvasSize({ width: canvas.width, height: canvas.height }); // Update state for viewport hook
        console.log(`[Resize] Canvas resized: ${canvas.width}x${canvas.height}`);
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // --- Render Loop --- (Now simpler)
  useEffect(() => {
    let animationFrameId: number;
    const renderLoop = () => {
        const canvas = canvasRef.current;
        const engine = physics.engine; // Get current engine state
        if (!canvas || !engine) {
            animationFrameId = requestAnimationFrame(renderLoop);
            return;
        }
        const ctx = canvas.getContext('2d');
        if (!ctx) {
            animationFrameId = requestAnimationFrame(renderLoop);
            return;
        }

        // Apply Viewport Transformations from hook
        ctx.save();
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.translate(viewport.offsetX, viewport.offsetY);
        ctx.scale(viewport.scale, viewport.scale);

        // Draw Background & Border
        drawBackground(ctx, backgroundImage);
        drawBorder(ctx);

        // Draw Game Objects
        const bodies = Matter.Composite.allBodies(engine.world);
        bodies.forEach(body => {
            if (body.label === 'planet') drawPlanet(ctx, body);
            else if (body.label.startsWith('ship-')) drawShip(ctx, body);
            else if (body.label.startsWith('projectile-')) drawProjectile(ctx, body as ProjectileBody);
            // Skip drawing boundaries
        });

        // Draw Trails & Traces
        projectileTrails.forEach(trail => drawActiveTrail(ctx, trail));
        Object.values(latestTracesRef.current).forEach(traceSet => {
            traceSet.forEach(trace => drawHistoricalTrace(ctx, trace));
        });

        // Restore Canvas state
        ctx.restore();

        animationFrameId = requestAnimationFrame(renderLoop);
    };

    // Start the loop
    animationFrameId = requestAnimationFrame(renderLoop);

    // Cleanup
    return () => {
        cancelAnimationFrame(animationFrameId);
    };
  // Dependencies: viewport ensures re-render on scale/offset change.
  // physics.engine might change identity on reset, background, trails change state.
  }, [viewport, physics.engine, backgroundImage, projectileTrails]);

  // --- Component Render ---
  const canvasStyle: React.CSSProperties = {
    display: 'block', 
    width: '100%',
    height: '100%',
    backgroundColor: '#000020', 
  };

  return <canvas ref={canvasRef} style={canvasStyle} />;
});

export default GameRenderer;