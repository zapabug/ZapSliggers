import React, { useRef, useEffect, useState } from 'react';
import Matter from 'matter-js';
import { ProjectileBody } from '../../hooks/useShotTracers';
// import { InitialGamePositions } from '../../hooks/useGameInitialization'; // Removed unused import
import { MatterPhysicsHandles } from '../../hooks/useMatterPhysics';
import { useDynamicViewport } from '../../hooks/useDynamicViewport';
import { UseGameLogicReturn } from '../../hooks/useGameLogic';
import { GameSettingsProfile } from '../../config/gameSettings'; // <-- Import settings type

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
  settings: GameSettingsProfile; // <-- Add settings prop
  aimStates: [{ angle: number; power: number }, { angle: number; power: number }]; // <-- Add aimStates prop
}

// Ref interface removed

// Drawing Helpers
// Ensure SHIP_RADIUS and PLANET_MIN_RADIUS are available if needed by helpers
// const SHIP_RADIUS_DRAW = 50; // Decreased for visual scale
const PLANET_MIN_RADIUS_DRAW = 100; // Increased to match settings minimum
const drawBackground = (ctx: CanvasRenderingContext2D, img: HTMLImageElement | null) => {
    const canvas = ctx.canvas;
    const canvasWidth = canvas.width;
    const canvasHeight = canvas.height;

    if (img && img.naturalWidth && img.naturalHeight) {
        const imgRatio = img.naturalWidth / img.naturalHeight;
        const canvasRatio = canvasWidth / canvasHeight;

        let drawWidth = canvasWidth;
        let drawHeight = canvasHeight;

        if (imgRatio > canvasRatio) {
            // Image is wider than canvas aspect ratio -> fit height, crop width
            drawHeight = canvasHeight;
            drawWidth = drawHeight * imgRatio;
        } else {
            // Image is taller than canvas aspect ratio (or same) -> fit width, crop height
            drawWidth = canvasWidth;
            drawHeight = drawWidth / imgRatio;
        }

        // Draw the image to cover the *actual* canvas, centered
        // Note: We draw relative to the current transform, so 0,0 is the top-left
        // IF the viewport transform wasn't applied before calling this.
        // HOWEVER, the viewport transform *IS* applied before this.
        // So we need to draw relative to the *transformed* origin.
        // The easiest way is to draw relative to the canvas dimensions
        // *before* the viewport transform, assuming the transform centers the view.

        // Let's adjust based on the viewport translation applied before this function
        // The viewport centers on (0,0) of the virtual world, mapping it to canvas center.
        // So, drawing at (0,0) in canvas coords requires drawing at
        // (-canvasWidth/2 / scale, -canvasHeight/2 / scale) in world coords after scaling.
        // OR, simpler: draw directly in canvas coords before restoring the ctx state.
        // BUT this func IS called *after* save/translate/scale.

        // Let's draw relative to the canvas *viewport*, not the virtual world coordinates
        // used by other elements. We need to draw covering canvasWidth/Height
        // starting from (0,0) *in the canvas coordinate system*.
        // Since the context is already translated and scaled, drawing at 0,0
        // will be off-center relative to the canvas itself.
        // We need to undo the translation *for the background*.

        // Get current transform (includes viewport scale and offset)
        const transform = ctx.getTransform();
        // Invert the transform to map canvas coords back to the 'world' coords
        // expected by drawImage after the transform is applied
        const pt = new DOMPoint(0, 0).matrixTransform(transform.inverse());
        const scaledPt = new DOMPoint(canvasWidth, canvasHeight).matrixTransform(transform.inverse());

        const drawX = pt.x;
        const drawY = pt.y;
        const effectiveDrawWidth = scaledPt.x - pt.x;
        const effectiveDrawHeight = scaledPt.y - pt.y;


        // Calculate scale to cover the effective drawing area
        const effectiveRatio = effectiveDrawWidth / effectiveDrawHeight;
        let finalDrawWidth, finalDrawHeight, finalDrawX, finalDrawY;

        if (imgRatio > effectiveRatio) {
            // Fit height, crop width (relative to effective area)
            finalDrawHeight = effectiveDrawHeight;
            finalDrawWidth = finalDrawHeight * imgRatio;
            finalDrawX = drawX + (effectiveDrawWidth - finalDrawWidth) / 2;
            finalDrawY = drawY;
        } else {
            // Fit width, crop height (relative to effective area)
            finalDrawWidth = effectiveDrawWidth;
            finalDrawHeight = finalDrawWidth / imgRatio;
            finalDrawX = drawX;
            finalDrawY = drawY + (effectiveDrawHeight - finalDrawHeight) / 2;
        }


        ctx.drawImage(img, finalDrawX, finalDrawY, finalDrawWidth, finalDrawHeight);

    } else {
         // Fallback: Fill the visible area with a solid color
         // Use the inverse transform logic similar to above to find the corners
        const transform = ctx.getTransform();
        const pt00 = new DOMPoint(0, 0).matrixTransform(transform.inverse());
        const ptWH = new DOMPoint(canvasWidth, canvasHeight).matrixTransform(transform.inverse());
        ctx.fillStyle = '#000020';
        ctx.fillRect(pt00.x, pt00.y, ptWH.x - pt00.x, ptWH.y - pt00.y);
    }
};
const drawBorder = (ctx: CanvasRenderingContext2D, scale: number) => {
    ctx.strokeStyle = 'rgba(207, 145, 30, 0.76)';
    ctx.lineWidth = 2 / scale;
    const borderX = -VIRTUAL_WIDTH / 2;
    const borderY = -VIRTUAL_HEIGHT;
    const borderWidth = VIRTUAL_WIDTH * 2;
    const borderHeight = VIRTUAL_HEIGHT * 3;
    ctx.strokeRect(borderX, borderY, borderWidth, borderHeight);
 }; // Removed unused vars
const drawPlanet = (ctx: CanvasRenderingContext2D, body: Matter.Body) => {
    const { x, y } = body.position;
    const radius = body.plugin?.Zapsliggers?.radius || PLANET_MIN_RADIUS_DRAW;

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
const GameRenderer: React.FC<GameRendererProps> = ({ physicsHandles, shotTracerHandlers, settings, aimStates }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [backgroundImage, setBackgroundImage] = useState<HTMLImageElement | null>(null);
  // Add state for ship images
  const [blueShipImage, setBlueShipImage] = useState<HTMLImageElement | null>(null);
  const [redShipImage, setRedShipImage] = useState<HTMLImageElement | null>(null);

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
      // Load background
      const bgImg = new Image();
      bgImg.onload = () => setBackgroundImage(bgImg);
      bgImg.onerror = () => console.error("Failed to load background image.");
      bgImg.src = '/images/backdrop.png'; 

      // Load blue ship
      const blueShip = new Image();
      blueShip.onload = () => setBlueShipImage(blueShip);
      blueShip.onerror = () => console.error("Failed to load blue ship image.");
      blueShip.src = '/images/spaceship_small_blue.png';

      // Load red ship
      const redShip = new Image();
      redShip.onload = () => setRedShipImage(redShip);
      redShip.onerror = () => console.error("Failed to load red ship image.");
      redShip.src = '/images/spaceship_small_red.png'; // Assuming this is the name

  }, []); // Run only once on mount

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
        drawBorder(ctx, viewport.scale);

        // Get bodies and remove conditional logging
        const bodies = bodiesGetter();

        // Iterate and draw
        bodies.forEach(body => {
            if (body.label === 'planet' || body.label === 'orange-planet') {
                 drawPlanet(ctx, body);
            } else if (body.label.startsWith('ship-')) {
                drawShip(ctx, body, blueShipImage, redShipImage, settings); 
                
                // Aiming indicator based on settings.SHIP_RADIUS and aim power
                const playerIndex = parseInt(body.label.split('-')[1], 10) as 0 | 1;
                const currentPower = aimStates[playerIndex]?.power || 0; // Get power for this ship
                const minIndicatorLength = settings.SHIP_RADIUS * 0.5; 
                const maxIndicatorLength = settings.SHIP_RADIUS * 2.5; 
                const aimLength = minIndicatorLength + (maxIndicatorLength - minIndicatorLength) * (currentPower / 100);
                
                // Use the RAW physics angle for the indicator direction
                const angle = body.angle;
                // Increase startOffset to create a gap between ship and line start
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
                // Invert dash pattern (gap longer than dash) and scale
                ctx.setLineDash([8 / viewport.scale, 3 / viewport.scale]);
                ctx.stroke();
                // Reset line dash for other drawing operations
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
  }, [viewport, physicsHandles, backgroundImage, blueShipImage, redShipImage, settings, aimStates]); 

  return (
      <canvas 
          ref={canvasRef} 
          className="w-full h-full block bg-black"
      />
  );
};

export default GameRenderer;