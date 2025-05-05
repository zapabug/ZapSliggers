import React, { useRef, useEffect, useState, useCallback } from 'react';
import Matter from 'matter-js';
import { ProjectileBody } from '../../hooks/useShotTracers'; // Keep ProjectileBody if needed by drawProjectile
// import { ShotTracerHandlers } from '../../hooks/useShotTracers'; // <<< REMOVE Unnecessary Import
import { MatterPhysicsHandles } from '../../hooks/useMatterPhysics';
import { useDynamicViewport } from '../../hooks/useDynamicViewport';
import { UseGameLogicReturn } from '../../hooks/useGameLogic';
import { GameSettingsProfile } from '../../config/gameSettings';
// import { GameAssets } from '../../hooks/useGameAssets'; // <<< REMOVE Import

// Constants for rendering/layout
// Remove local constants
// const VIRTUAL_WIDTH = 2400;
// const VIRTUAL_HEIGHT = 1200;
// const DESIGN_ASPECT_RATIO = VIRTUAL_WIDTH / VIRTUAL_HEIGHT;
// const SHIP_RADIUS = 63; // Keep if needed by drawing helpers below
// const PLANET_MIN_RADIUS = 40; // Keep if needed by drawing helpers below

// Define props for the GameRenderer component
interface GameRendererProps {
  physicsHandles: MatterPhysicsHandles | null;
  shotTracerHandlers: UseGameLogicReturn['shotTracerHandlers'];
  settings: GameSettingsProfile;
  aimStates: [{ angle: number; power: number }, { angle: number; power: number }];
  gameAssets: { [key: string]: HTMLImageElement | null } | null; // <<< Define inline type for gameAssets
}

// Ref interface removed

// Drawing Helpers
// Ensure SHIP_RADIUS and PLANET_MIN_RADIUS are available if needed by helpers
// const SHIP_RADIUS_DRAW = 50; // Decreased for visual scale
const PLANET_MIN_RADIUS_DRAW = 100; // Increased to match settings minimum
const drawBorder = (ctx: CanvasRenderingContext2D, scale: number, settings: GameSettingsProfile) => {
    ctx.strokeStyle = 'rgba(207, 145, 30, 0.76)';
    ctx.lineWidth = 2 / scale;
    // Use settings values
    const borderX = -settings.VIRTUAL_WIDTH / 2;
    const borderY = -settings.VIRTUAL_HEIGHT / 2; // Centered vertically
    const borderWidth = settings.VIRTUAL_WIDTH;
    const borderHeight = settings.VIRTUAL_HEIGHT;
    ctx.strokeRect(borderX, borderY, borderWidth, borderHeight);
 };
const drawPlanet = (ctx: CanvasRenderingContext2D, body: Matter.Body) => {
    const { x, y } = body.position;
    // Prioritize plugin radius, then physics radius, then fallback
    const radius = body.plugin?.Zapsliggers?.radius || body.circleRadius || PLANET_MIN_RADIUS_DRAW;
    const coreRadius = body.plugin?.Zapsliggers?.coreRadius; // Get coreRadius, might be undefined for normal planets

    let gradient: CanvasGradient;

    // --- Sligger Styling ---
    if (body.label === 'sligger') {
        // Orange/Red glowing gradient for Sliggers
        const centerColor = '#EF4444'; // Tailwind red-500 (Glowing Center)
        const midColor = '#F97316';    // Tailwind orange-500 (Mid Gradient)
        const edgeColor = '#B45309';    // Tailwind orange-700 (Darker Edge)

        gradient = ctx.createRadialGradient(x, y, radius * 0.1, x, y, radius); // Start gradient closer to center for glow
        gradient.addColorStop(0, centerColor); 
        gradient.addColorStop(0.5, midColor); // Transition faster to orange
        gradient.addColorStop(1, edgeColor); // Use edgeColor for the outer stop
        
        // Draw the main Sligger body
        ctx.beginPath();
        ctx.arc(x, y, radius, 0, 2 * Math.PI);
        ctx.fillStyle = gradient; 
        ctx.fill();

        // Optional: Draw core indicator if coreRadius exists
        if (coreRadius && coreRadius > 0) {
            ctx.beginPath();
            ctx.arc(x, y, coreRadius, 0, 2 * Math.PI);
            // Use a subtle overlay or outline for the core
            ctx.strokeStyle = 'rgba(230, 230, 255, 0.4)'; // Light purple-ish glow
            ctx.lineWidth = 2; // Adjust as needed
            ctx.stroke();
        }

    // --- Default Planet Styling ---
    } else if (body.label === 'planet_standard') {
        // Default planet: Subtle gray radial gradient for 3D effect
        const centerGray = '#A0A0A0'; // Lighter gray
        const edgeGray = '#606060';   // Darker gray

        gradient = ctx.createRadialGradient(x, y, radius * 0.2, x, y, radius);
        gradient.addColorStop(0, centerGray);  
        gradient.addColorStop(1, edgeGray);    

        // Draw the main planet body
        ctx.beginPath();
        ctx.arc(x, y, radius, 0, 2 * Math.PI);
        ctx.fillStyle = gradient; // Use the gradient
        ctx.fill();
    } 
    // Removed obsolete orange-planet check

    // Optional: Add a subtle inner shadow or highlight for more 3D effect (Could apply to both)
    /*
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, 2 * Math.PI);
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.2)';
    ctx.lineWidth = radius * 0.05;
    ctx.stroke();
    */
};
const drawShip = (
    ctx: CanvasRenderingContext2D, 
    body: Matter.Body, 
    blueShipImg: HTMLImageElement | null, 
    redShipImg: HTMLImageElement | null,
    settings: GameSettingsProfile // <-- Accept settings
) => {
    const playerIndex = parseInt(body.label.split('-')[1], 10);
    const shipImage = playerIndex === 0 ? blueShipImg : redShipImg;

    if (!shipImage || shipImage.width === 0) { // Check width to prevent division by zero
        return; 
    }

    // Calculate desired draw size based on SHIP_RADIUS
    const targetDiameter = settings.SHIP_RADIUS * 2;
    const aspectRatio = shipImage.height / shipImage.width;
    const drawWidth = targetDiameter;
    const drawHeight = targetDiameter * aspectRatio;

    ctx.save();
    ctx.translate(body.position.x, body.position.y);
    // Change offset: Rotate based on physics angle, assuming sprite faces UP by default (+90 deg offset)
    ctx.rotate(body.angle + Math.PI / 2); 
    
    // Draw the image centered, scaled to the calculated size
    ctx.drawImage(
        shipImage, 
        -drawWidth / 2, 
        -drawHeight / 2,
        drawWidth,
        drawHeight
    );
    
    ctx.restore();
 };
const drawProjectile = (ctx: CanvasRenderingContext2D, body: ProjectileBody) => {
    ctx.beginPath();
    // Use the body's actual radius, falling back to a default if undefined
    const radius = body.circleRadius ?? 5; // Use body's radius, default 5
    ctx.arc(body.position.x, body.position.y, radius, 0, 2 * Math.PI);
    const ownerIndex = body.custom?.firedByPlayerIndex ?? 0;
    ctx.fillStyle = ownerIndex === 0 ? '#add8e6' : '#ffcccb'; // Example colors
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
const GameRenderer: React.FC<GameRendererProps> = ({ physicsHandles, shotTracerHandlers, settings, aimStates, gameAssets }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [backgroundImage, setBackgroundImage] = useState<HTMLImageElement | null>(null);
  const [blueShipImage, setBlueShipImage] = useState<HTMLImageElement | null>(null);
  const [redShipImage, setRedShipImage] = useState<HTMLImageElement | null>(null);
  const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 });

  const { lastShotTraces } = shotTracerHandlers;

  const viewport = useDynamicViewport({
      engine: physicsHandles?.engine ?? null,
      getDynamicBodies: physicsHandles?.getDynamicBodies ?? (() => []),
      settings: settings,
      canvasSize,
  });

  const latestTracesRef = useRef(lastShotTraces);
  useEffect(() => {
    latestTracesRef.current = lastShotTraces;
  }, [lastShotTraces]);

  // --- Refactor Resize Handling ---
   useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const resizeObserver = new ResizeObserver(entries => {
        for (const entry of entries) {
            const { width, height } = entry.contentRect;
            setCanvasSize({ width, height });
            canvas.width = width;
            canvas.height = height;
        }
    });
    resizeObserver.observe(canvas);

    // Initial size set
    const initialWidth = canvas.clientWidth;
    const initialHeight = canvas.clientHeight;
    if (initialWidth > 0 && initialHeight > 0 && (canvas.width !== initialWidth || canvas.height !== initialHeight)) {
        setCanvasSize({ width: initialWidth, height: initialHeight });
        canvas.width = initialWidth;
        canvas.height = initialHeight;
    }

    return () => resizeObserver.disconnect();
  }, []); // Empty dependency array: runs once on mount

  // --- Load Assets --- 
  useEffect(() => {
      const bgImg = new Image();
      bgImg.onload = () => setBackgroundImage(bgImg);
      bgImg.onerror = () => console.error("Failed to load background image.");
      bgImg.src = '/images/backdrop.png';

      const blueShip = new Image();
      blueShip.onload = () => setBlueShipImage(blueShip);
      blueShip.onerror = () => console.error("Failed to load blue ship image.");
      blueShip.src = '/images/spaceship_small_blue.png';

      const redShip = new Image();
      redShip.onload = () => setRedShipImage(redShip);
      redShip.onerror = () => console.error("Failed to load red ship image.");
      redShip.src = '/images/spaceship_small_red.png';
  }, []);

  // --- Define Render Loop using useCallback OUTSIDE useEffect ---
  const renderLoop = useCallback(() => {
    const canvas = canvasRef.current;
    const engine = physicsHandles?.engine;
    const bodiesGetter = physicsHandles?.getAllBodies;

    if (!canvas || !engine || !bodiesGetter || !physicsHandles || !settings) {
        requestAnimationFrame(renderLoop); // Request next frame even if not ready
        return;
    }

    const allBodies = bodiesGetter();
    const ctx = canvas.getContext('2d');
    if (!ctx) {
        requestAnimationFrame(renderLoop);
        return;
    }

    // *** ADD Viewport Logging (Adjusted) ***
    console.log(`[RenderLoop] Viewport: scale=${viewport.scale.toFixed(3)}, offsetX=${viewport.offsetX.toFixed(1)}, offsetY=${viewport.offsetY.toFixed(1)}`);

    // --- Start Drawing ---
    ctx.save();
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Apply viewport transform FIRST
    ctx.translate(viewport.offsetX, viewport.offsetY);
    ctx.scale(viewport.scale, viewport.scale);

    // Draw Background AFTER transform, covering the virtual world
    if (backgroundImage) {
        const worldWidth = settings.VIRTUAL_WIDTH;
        const worldHeight = settings.VIRTUAL_HEIGHT;
        const worldRatio = worldWidth / worldHeight;
        const imageRatio = backgroundImage.naturalWidth / backgroundImage.naturalHeight;

        let drawWidth = worldWidth;
        let drawHeight = worldHeight;
        let drawX = -worldWidth / 2;
        let drawY = -worldHeight / 2;

        if (imageRatio > worldRatio) {
            // Image wider than world aspect ratio: fit height, center width
            drawWidth = worldHeight * imageRatio;
            drawX = -drawWidth / 2;
        } else {
            // Image taller than world aspect ratio: fit width, center height
            drawHeight = worldWidth / imageRatio;
            drawY = -drawHeight / 2;
        }
        ctx.drawImage(backgroundImage, drawX, drawY, drawWidth, drawHeight);
    } else {
        // Fallback background color covering virtual world
        ctx.fillStyle = '#000020';
        ctx.fillRect(-settings.VIRTUAL_WIDTH / 2, -settings.VIRTUAL_HEIGHT / 2, settings.VIRTUAL_WIDTH, settings.VIRTUAL_HEIGHT);
    }

    // Draw Border
    drawBorder(ctx, viewport.scale, settings);

    // Draw game objects (Planets, Ships, Projectiles)
    allBodies.forEach((body) => {
        if (body.label === 'planet' || body.label === 'sligger' || body.label === 'planet_standard') {
            drawPlanet(ctx, body);
        } else if (body.label.startsWith('ship-')) {
            drawShip(ctx, body, blueShipImage, redShipImage, settings);
            // Aiming indicator logic (remains the same)
             const playerIndex = parseInt(body.label.split('-')[1], 10) as 0 | 1;
            const currentPower = aimStates[playerIndex]?.power || 0;
            const minIndicatorLength = settings.SHIP_RADIUS * 0.5;
            const maxIndicatorLength = settings.SHIP_RADIUS * 2.5;
            const aimLength = minIndicatorLength + (maxIndicatorLength - minIndicatorLength) * (currentPower / 100);
            const angle = body.angle;
            const startOffset = settings.SHIP_RADIUS * 1.;
            const centerOffsetX = Math.cos(angle) * startOffset;
            const centerOffsetY = Math.sin(angle) * startOffset;
            const startX = body.position.x + centerOffsetX;
            const startY = body.position.y + centerOffsetY;
            const endX = startX + Math.cos(angle) * aimLength;
            const endY = startY + Math.sin(angle) * aimLength;
            ctx.beginPath();
            ctx.moveTo(startX, startY);
            ctx.lineTo(endX, endY);
            ctx.strokeStyle = 'rgba(251, 126, 17, 0.86)';
            ctx.lineWidth = 2 / viewport.scale;
            ctx.setLineDash([8 / viewport.scale, 3 / viewport.scale]);
            ctx.stroke();
            ctx.setLineDash([]);
        } else if (body.label.startsWith('projectile-')) {
            drawProjectile(ctx, body as ProjectileBody);
        }
    });

    // Draw Historical Traces
    const currentTraces = latestTracesRef.current;
    currentTraces[0].forEach(trace => drawHistoricalTrace(ctx, trace));
    currentTraces[1].forEach(trace => drawHistoricalTrace(ctx, trace));

    ctx.restore(); // Restore context state

    requestAnimationFrame(renderLoop); // Request the next frame
  }, [physicsHandles, shotTracerHandlers, settings, aimStates, gameAssets, backgroundImage, blueShipImage, redShipImage, viewport]); // <<< Updated Dependencies for useCallback

  // --- Setup Animation Frame --- 
  useEffect(() => {
    // console.log("[GameRenderer Effect Setup] Running effect setup for animation frame.");
    const animationFrameId = requestAnimationFrame(renderLoop); // <<< Start loop and assign const
    
    // Cleanup function
    return () => {
        // console.log("[GameRenderer Effect Cleanup] Running effect cleanup. Cancelling Frame ID:", animationFrameId);
        cancelAnimationFrame(animationFrameId);
    };
  }, [renderLoop]); // <<< useEffect depends only on the memoized renderLoop

  return (
      <canvas
          ref={canvasRef}
          className="w-full h-full block bg-black"
      />
  );
};

export default GameRenderer;