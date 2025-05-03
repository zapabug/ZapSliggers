import React, { useRef, useEffect, useState } from 'react';
import Matter from 'matter-js';
import { ProjectileBody } from '../../hooks/useShotTracers';
// import { InitialGamePositions } from '../../hooks/useGameInitialization'; // Removed unused import
import { MatterPhysicsHandles } from '../../hooks/useMatterPhysics';
import { useDynamicViewport } from '../../hooks/useDynamicViewport';
import { UseGameLogicReturn } from '../../hooks/useGameLogic';

// Constants for rendering/layout
const VIRTUAL_WIDTH = 2400;
const VIRTUAL_HEIGHT = 1200;
const DESIGN_ASPECT_RATIO = VIRTUAL_WIDTH / VIRTUAL_HEIGHT;
// const SHIP_RADIUS = 63; // Keep if needed by drawing helpers below
// const PLANET_MIN_RADIUS = 40; // Keep if needed by drawing helpers below
const PROJECTILE_RADIUS = 5; 

// Define props for the GameRenderer component
interface GameRendererProps {
  physicsHandles: MatterPhysicsHandles | null;
  shotTracerHandlers: UseGameLogicReturn['shotTracerHandlers'];
}

// Ref interface removed

// Drawing Helpers
// Ensure SHIP_RADIUS and PLANET_MIN_RADIUS are available if needed by helpers
const SHIP_RADIUS_DRAW = 50; // Decreased for visual scale
const PLANET_MIN_RADIUS_DRAW = 100; // Increased to match settings minimum
const drawBackground = (ctx: CanvasRenderingContext2D, img: HTMLImageElement | null) => { 
    // Log the state of img when drawing
    console.log(`[GameRenderer drawBackground] Drawing with backgroundImage: ${img ? 'Exists' : 'NULL'}`); 

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
}; // Removed unused vars
const drawBorder = (ctx: CanvasRenderingContext2D) => {
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.lineWidth = 4;
    const borderX = -VIRTUAL_WIDTH / 2;
    const borderY = -VIRTUAL_HEIGHT;
    const borderWidth = VIRTUAL_WIDTH * 2;
    const borderHeight = VIRTUAL_HEIGHT * 3;
    ctx.strokeRect(borderX, borderY, borderWidth, borderHeight);
 }; // Removed unused vars
const drawPlanet = (ctx: CanvasRenderingContext2D, body: Matter.Body) => {
    const { x, y } = body.position;
    const radius = body.plugin?.klunkstr?.radius || PLANET_MIN_RADIUS_DRAW;

    let gradient: CanvasGradient;

    if (body.label === 'orange-planet') {
        // Orange planet: Radial gradient, brighter for larger planets
        const baseOrange = '#D97706'; // Tailwind orange-600
        const brightOrange = '#F59E0B'; // Tailwind amber-500
        const veryBrightOrange = '#FCD34D'; // Tailwind amber-300
        const maxRadius = 250; // Example max radius for full brightness
        const brightnessFactor = Math.min(1, Math.max(0, radius / maxRadius));
        const centerColor = brightnessFactor < 0.5 ? brightOrange : veryBrightOrange;

        gradient = ctx.createRadialGradient(x, y, radius * 0.1, x, y, radius);
        gradient.addColorStop(0, centerColor); 
        gradient.addColorStop(0.7, brightOrange);
        gradient.addColorStop(1, baseOrange); 

    } else {
        // Default planet: Subtle gray radial gradient for 3D effect
        const centerGray = '#A0A0A0'; // Lighter gray
        const edgeGray = '#606060';   // Darker gray

        gradient = ctx.createRadialGradient(x, y, radius * 0.2, x, y, radius);
        gradient.addColorStop(0, centerGray);  
        gradient.addColorStop(1, edgeGray);    
    }

    ctx.beginPath();
    ctx.arc(x, y, radius, 0, 2 * Math.PI);
    ctx.fillStyle = gradient; // Use the gradient
    ctx.fill();

    // Optional: Add a subtle inner shadow or highlight for more 3D effect
    /*
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, 2 * Math.PI);
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.2)';
    ctx.lineWidth = radius * 0.05;
    ctx.stroke();
    */
};
const drawShip = (ctx: CanvasRenderingContext2D, body: Matter.Body) => {
    const playerIndex = parseInt(body.label.split('-')[1], 10);
    ctx.save();
    ctx.translate(body.position.x, body.position.y);
    ctx.rotate(body.angle);
    ctx.beginPath();
    ctx.moveTo(SHIP_RADIUS_DRAW, 0);
    ctx.lineTo(-SHIP_RADIUS_DRAW / 2, -SHIP_RADIUS_DRAW / 2);
    ctx.lineTo(-SHIP_RADIUS_DRAW / 2, SHIP_RADIUS_DRAW / 2);
    ctx.closePath();
    ctx.fillStyle = playerIndex === 0 ? '#00f' : '#f00';
    ctx.fill();
    ctx.restore();
 };
const drawProjectile = (ctx: CanvasRenderingContext2D, body: ProjectileBody) => {
    ctx.beginPath();
    ctx.arc(body.position.x, body.position.y, PROJECTILE_RADIUS, 0, 2 * Math.PI);
    const ownerIndex = body.custom?.firedByPlayerIndex ?? 0;
    ctx.fillStyle = ownerIndex === 0 ? '#add8e6' : '#ffcccb';
    ctx.fill();
 };
const drawHistoricalTrace = (ctx: CanvasRenderingContext2D, trace: Matter.Vector[]) => {
    if (trace.length < 2) return;
    ctx.beginPath();
    ctx.moveTo(trace[0].x, trace[0].y);
    for (let i = 1; i < trace.length; i++) {
      ctx.lineTo(trace[i].x, trace[i].y);
    }
    ctx.strokeStyle = '#C0C0C0'; 
    ctx.lineWidth = 2; 
    ctx.setLineDash([8, 4]); 
    ctx.stroke();
    ctx.setLineDash([]); 
 };


// --- GameRenderer Component (Standard Function) ---
const GameRenderer: React.FC<GameRendererProps> = ({ physicsHandles, shotTracerHandlers }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [backgroundImage, setBackgroundImage] = useState<HTMLImageElement | null>(null);
  const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 });

  const { lastShotTraces } = shotTracerHandlers;

  const viewport = useDynamicViewport({
      engine: physicsHandles?.engine ?? null,
      getDynamicBodies: physicsHandles?.getDynamicBodies ?? (() => []),
      virtualWidth: VIRTUAL_WIDTH,
      virtualHeight: VIRTUAL_HEIGHT,
      designAspectRatio: DESIGN_ASPECT_RATIO,
      canvasSize,
  });

  const latestTracesRef = useRef(lastShotTraces);
  useEffect(() => {
    latestTracesRef.current = lastShotTraces;
  }, [lastShotTraces]);

  // Imperative Handle removed

  // Effects for background image and resize (no change)
  useEffect(() => { 
      const img = new Image();
      console.log(`[GameRenderer Effect] Attempting to load image: ${img.src}`); // Log start
      img.onload = () => {
        console.log(`[GameRenderer Effect] Image loaded successfully: ${img.src}`); // Log success
        setBackgroundImage(img);
      };
      img.onerror = (err) => {
          // Log the actual error if possible
          console.error(`[GameRenderer Effect] Failed to load background image: ${img.src}`, err); // Log failure
      };
      img.src = '/images/backdrop.png'; 
  }, []);

  // Re-implement Resize Handling
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Use ResizeObserver for modern browsers
    const resizeObserver = new ResizeObserver(entries => {
        for (const entry of entries) {
            const { width, height } = entry.contentRect;
            console.log(`[GameRenderer ResizeObserver] Canvas resized to: ${width}x${height}`);
            setCanvasSize({ width, height });
            // Also update canvas element dimensions directly
            // This is crucial for the drawing context resolution
            canvas.width = width;
            canvas.height = height;
        }
    });

    resizeObserver.observe(canvas);

    // Initial size check
    const initialWidth = canvas.clientWidth;
    const initialHeight = canvas.clientHeight;
    if (initialWidth > 0 && initialHeight > 0) {
        console.log(`[GameRenderer Resize] Setting initial canvas size: ${initialWidth}x${initialHeight}`);
        setCanvasSize({ width: initialWidth, height: initialHeight });
        canvas.width = initialWidth;
        canvas.height = initialHeight;
    }

    return () => {
        resizeObserver.disconnect();
    };
}, []); // Run only once on mount

  // --- Render Loop ---
  useEffect(() => {
    let animationFrameId: number;
    const renderLoop = () => {
        const canvas = canvasRef.current;
        const engine = physicsHandles?.engine; // Keep optional chaining
        const bodiesGetter = physicsHandles?.getAllBodies; // Keep optional chaining

        if (!canvas || !engine || !bodiesGetter) {
            animationFrameId = requestAnimationFrame(renderLoop);
            return;
        }
        const ctx = canvas.getContext('2d');
        if (!ctx) {
            animationFrameId = requestAnimationFrame(renderLoop);
            return;
        }

        ctx.save();
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.translate(viewport.offsetX, viewport.offsetY);
        ctx.scale(viewport.scale, viewport.scale);

        // Draw Background and Border first
        drawBackground(ctx, backgroundImage);
        drawBorder(ctx);

        // Get bodies and remove conditional logging
        const bodies = bodiesGetter();

        // Iterate and draw
        bodies.forEach(body => {
            if (body.label === 'planet' || body.label === 'orange-planet') {
                 drawPlanet(ctx, body);
            } else if (body.label.startsWith('ship-')) {
                drawShip(ctx, body);
                // Draw aiming indicator
                const aimLength = SHIP_RADIUS_DRAW * 1.5;
                const angle = body.angle;
                const startX = body.position.x + Math.cos(angle) * SHIP_RADIUS_DRAW;
                const startY = body.position.y + Math.sin(angle) * SHIP_RADIUS_DRAW;
                const endX = body.position.x + Math.cos(angle) * (SHIP_RADIUS_DRAW + aimLength);
                const endY = body.position.y + Math.sin(angle) * (SHIP_RADIUS_DRAW + aimLength);
                ctx.beginPath();
                ctx.moveTo(startX, startY);
                ctx.lineTo(endX, endY);
                ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
                ctx.lineWidth = 2;
                ctx.setLineDash([5, 5]);
                ctx.stroke();
                ctx.setLineDash([]);
            } else if (body.label.startsWith('projectile-')) {
                drawProjectile(ctx, body as ProjectileBody);
            }
        });

        // Draw Historical Traces (Corrected iteration)
        const currentTraces = latestTracesRef.current;
        currentTraces[0].forEach(trace => drawHistoricalTrace(ctx, trace)); // Player 0 traces
        currentTraces[1].forEach(trace => drawHistoricalTrace(ctx, trace)); // Player 1 traces

        ctx.restore(); 
        animationFrameId = requestAnimationFrame(renderLoop);
    };

    animationFrameId = requestAnimationFrame(renderLoop);
    return () => cancelAnimationFrame(animationFrameId);
  }, [viewport, physicsHandles, backgroundImage]); 

  return (
      <canvas 
          ref={canvasRef} 
          className="w-full h-full block bg-black"
      />
  );
};

export default GameRenderer;