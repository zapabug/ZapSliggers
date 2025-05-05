import React, { useRef, useEffect, useState, useCallback } from 'react';
import Matter from 'matter-js';
import { ProjectileBody } from '../../hooks/useShotTracers'; // Keep ProjectileBody if needed by drawProjectile
// import { ShotTracerHandlers } from '../../hooks/useShotTracers'; // <<< REMOVE Unnecessary Import
import { MatterPhysicsHandles } from '../../hooks/useMatterPhysics';
import { useDynamicViewport } from '../../hooks/useDynamicViewport'; // Import hook only
import { UseGameLogicReturn } from '../../hooks/useGameLogic';
import { GameSettingsProfile } from '../../config/gameSettings';
// import { UseGameAssetsReturn } from '../../hooks/useGameAssets'; // Remove type import

// Constants for rendering/layout
// Remove local constants
// const VIRTUAL_WIDTH = 2400;
// const VIRTUAL_HEIGHT = 1200;
// const DESIGN_ASPECT_RATIO = VIRTUAL_WIDTH / VIRTUAL_HEIGHT;
// const SHIP_RADIUS = 63; // Keep if needed by drawing helpers below
// const PLANET_MIN_RADIUS = 40; // Keep if needed by drawing helpers below

// Keep the assumed structure, but define inline
interface GameAssetsStructure {
  ship0?: HTMLImageElement | null;
  ship1?: HTMLImageElement | null;
  planet?: HTMLImageElement | null;
  sligger?: HTMLImageElement | null;
  backdrop?: HTMLImageElement | null;
}

// Define props for the GameRenderer component
interface GameRendererProps {
  physicsHandles: MatterPhysicsHandles | null;
  shotTracerHandlers: UseGameLogicReturn['shotTracerHandlers'];
  settings: GameSettingsProfile;
  aimStates: [{ angle: number; power: number }, { angle: number; power: number }];
  // gameAssets: UseGameAssetsReturn | null; // Revert to inline structure
  gameAssets: GameAssetsStructure | null; 
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
const drawPlanet = (ctx: CanvasRenderingContext2D, body: Matter.Body, gameAssets: GameAssetsStructure | null) => {
    const { x, y } = body.position;
    const radius = body.plugin?.Zapsliggers?.radius || body.circleRadius || PLANET_MIN_RADIUS_DRAW;
    const coreRadius = body.plugin?.Zapsliggers?.coreRadius;
    const isSligger = body.plugin?.Zapsliggers?.isSligger ?? false;
    const assetKey = isSligger ? 'sligger' : 'planet';
    const asset = gameAssets ? gameAssets[assetKey] : null;

    // Draw using asset if available
    if (asset) {
        const diameter = radius * 2;
        ctx.save();
        ctx.translate(x, y);
        ctx.drawImage(asset, -radius, -radius, diameter, diameter);
        if (isSligger && coreRadius) {
            ctx.beginPath();
            ctx.arc(0, 0, coreRadius, 0, Math.PI * 2);
            ctx.strokeStyle = 'rgba(255, 0, 0, 0.5)'; 
            ctx.stroke();
        }
        ctx.restore();
    } 
    // Fallback drawing if asset is missing or gameAssets is null
    else {
        let gradient: CanvasGradient;
        if (isSligger) {
            const centerColor = '#EF4444'; const midColor = '#F97316'; const edgeColor = '#B45309';
            gradient = ctx.createRadialGradient(x, y, radius * 0.1, x, y, radius);
            gradient.addColorStop(0, centerColor); gradient.addColorStop(0.5, midColor); gradient.addColorStop(1, edgeColor);
        } else {
            const centerGray = '#A0A0A0'; const edgeGray = '#606060';
            gradient = ctx.createRadialGradient(x, y, radius * 0.2, x, y, radius);
            gradient.addColorStop(0, centerGray); gradient.addColorStop(1, edgeGray);
        }
        ctx.beginPath();
        ctx.arc(x, y, radius, 0, 2 * Math.PI);
        ctx.fillStyle = gradient;
        ctx.fill();
        if (isSligger && coreRadius) {
            ctx.beginPath();
            ctx.arc(x, y, coreRadius, 0, 2 * Math.PI);
            ctx.strokeStyle = 'rgba(255, 0, 0, 0.5)';
            ctx.stroke();
        }
    }
};
const drawShip = (
    ctx: CanvasRenderingContext2D, 
    body: Matter.Body, 
    gameAssets: GameAssetsStructure | null, 
    settings: GameSettingsProfile 
) => {
    const playerIndex = parseInt(body.label.split('-')[1], 10);
    const shipImage = gameAssets ? (playerIndex === 0 ? gameAssets.ship0 : gameAssets.ship1) : null;

    // Calculate desired draw size based on SHIP_RADIUS
    const targetDiameter = settings.SHIP_RADIUS * 2;
    const drawWidth = targetDiameter;
    let drawHeight = targetDiameter; // Default if aspect ratio cannot be determined
    if (shipImage && shipImage.naturalWidth > 0) {
        const aspectRatio = shipImage.naturalHeight / shipImage.naturalWidth;
        drawHeight = drawWidth * aspectRatio;
    }

    // Save/restore ONLY for rotation around the body's position 
    // within the already transformed main context.
    ctx.save(); 
    // Translate pivot to body position (which is already scaled/offset by main transform)
    ctx.translate(body.position.x, body.position.y); 
    ctx.rotate(body.angle + Math.PI / 2); // Rotate context (assuming sprite faces UP)
    
    // Draw the image centered AT THE NEW PIVOT (0,0 relative to translated/rotated context)
    if (shipImage) {
        ctx.drawImage(
            shipImage, 
            -drawWidth / 2, 
            -drawHeight / 2,
            drawWidth,
            drawHeight
        );
    } else {
        // Fallback drawing if asset missing or null
        const shipRadius = settings.SHIP_RADIUS;
        ctx.fillStyle = playerIndex === 0 ? 'blue' : 'red';
        ctx.beginPath();
        // Draw circle at the pivot (0,0 in this context)
        ctx.arc(0, 0, shipRadius, 0, Math.PI * 2);
        ctx.fill();
        // Fallback aiming line (optional)
        const lineLength = shipRadius * 1.5;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(lineLength, 0); // Line points along new x-axis (after rotation)
        ctx.strokeStyle = 'yellow';
        ctx.lineWidth = 3 / ctx.getTransform().a; // Attempt to scale line width based on current overall scale
        ctx.stroke();
    }
    ctx.restore(); // Restore from translate/rotate
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

// --- Refactor drawBackground HELPER ---
const drawBackground = (ctx: CanvasRenderingContext2D, settings: GameSettingsProfile, assets: GameAssetsStructure | null) => {
    const backgroundImage = assets?.backdrop;
    const worldWidth = settings.VIRTUAL_WIDTH;
    const worldHeight = settings.VIRTUAL_HEIGHT;
    // Target drawing area within the transformed context
    const drawX = -worldWidth / 2;
    const drawY = -worldHeight / 2;

    if (backgroundImage && backgroundImage.naturalWidth > 0 && backgroundImage.naturalHeight > 0) {
        // Calculate aspect ratios to cover the virtual world area, cropping the image if necessary
        const worldRatio = worldWidth / worldHeight;
        const imageRatio = backgroundImage.naturalWidth / backgroundImage.naturalHeight;

        let sourceX = 0;
        let sourceY = 0;
        let sourceWidth = backgroundImage.naturalWidth;
        let sourceHeight = backgroundImage.naturalHeight;

        if (imageRatio > worldRatio) {
            // Image is wider than the world aspect ratio: Use full height of image, crop width
            sourceWidth = backgroundImage.naturalHeight * worldRatio;
            sourceX = (backgroundImage.naturalWidth - sourceWidth) / 2;
        } else if (imageRatio < worldRatio) {
            // Image is taller than the world aspect ratio: Use full width of image, crop height
            sourceHeight = backgroundImage.naturalWidth / worldRatio;
            sourceY = (backgroundImage.naturalHeight - sourceHeight) / 2;
        }
        // else: aspect ratios match, use full image

        // Draw the potentially cropped image scaled to fill the virtual world rect
        ctx.drawImage(
            backgroundImage,
            sourceX,
            sourceY,
            sourceWidth,
            sourceHeight, // Source rectangle (cropped part of the image)
            drawX,
            drawY,
            worldWidth,
            worldHeight // Destination rectangle (the virtual world area)
        );

    } else {
        // Fallback: Simple dark background within the virtual world area
        ctx.fillStyle = '#000020'; // Dark blue/grey fallback
        ctx.fillRect(drawX, drawY, worldWidth, worldHeight);
    }
};
// --- END drawBackground HELPER ---

// --- GameRenderer Component (Standard Function) ---
const GameRenderer: React.FC<GameRendererProps> = ({ physicsHandles, shotTracerHandlers, settings, aimStates, gameAssets }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
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
    
    ctx.save(); // Save context state before transform

    // Apply viewport transform
    ctx.translate(viewport.offsetX, viewport.offsetY);
    ctx.scale(viewport.scale, viewport.scale);

    // --- Draw elements within the transformed virtual world --- 

    // Draw Background first (scaled to virtual world dimensions)
    drawBackground(ctx, settings, gameAssets); 

    // Draw Border next, framing the virtual world
    drawBorder(ctx, viewport.scale, settings);

    // Draw game objects (Planets, Ships, Projectiles)
    allBodies.forEach((body) => {
        if (body.label === 'planet' || body.label === 'sligger' || body.label === 'planet_standard') {
            drawPlanet(ctx, body, gameAssets);
        } else if (body.label.startsWith('ship-')) {
            drawShip(ctx, body, gameAssets, settings);
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

    // --- End drawing within transformed world --- 
    ctx.restore(); // Restore context state (removes transform)

    requestAnimationFrame(renderLoop); // Request the next frame
  }, [physicsHandles, shotTracerHandlers, settings, aimStates, gameAssets, viewport, latestTracesRef]); // Include gameAssets in dependencies

  // --- Setup Animation Frame --- 
  useEffect(() => {
    const animationFrameId = requestAnimationFrame(renderLoop);
    return () => {
        cancelAnimationFrame(animationFrameId);
    };
  }, [renderLoop]);

  return (
      <canvas
          ref={canvasRef}
          className="w-full h-full block bg-black"
      />
  );
};

export default GameRenderer;