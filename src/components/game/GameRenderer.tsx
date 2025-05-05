import React, { useRef, useEffect, useState } from 'react';
import Matter from 'matter-js';
import { ProjectileBody } from '../../hooks/useShotTracers';
import { MatterPhysicsHandles } from '../../hooks/useMatterPhysics';
import { UseGameLogicReturn } from '../../hooks/useGameLogic';
import { GameSettingsProfile } from '../../config/gameSettings';

// Interfaces
interface GameAssetsStructure {
  ship0?: HTMLImageElement | null;
  ship1?: HTMLImageElement | null;
  planet?: HTMLImageElement | null;
  sligger?: HTMLImageElement | null;
  backdrop?: HTMLImageElement | null;
}

interface GameRendererProps {
  physicsHandles: MatterPhysicsHandles | null;
  shotTracerHandlers: UseGameLogicReturn['shotTracerHandlers'];
  settings: GameSettingsProfile;
  aimStates: [{ angle: number; power: number }, { angle: number; power: number }];
  gameAssets: GameAssetsStructure | null;
}

// Constants & Drawing Helpers
const PLANET_MIN_RADIUS_DRAW = 100;

const drawPlanet = (ctx: CanvasRenderingContext2D, body: Matter.Body) => {
    const { x, y } = body.position;
    const radius = body.circleRadius || PLANET_MIN_RADIUS_DRAW;
    const isSligger = body.label === 'sligger';

    ctx.beginPath();
    ctx.arc(x, y, radius, 0, 2 * Math.PI);
    ctx.fillStyle = isSligger ? '#FF8800' : '#888888';
    ctx.fill();
    
    /* // Original complex drawing logic commented out */
};

const drawShip = (
    ctx: CanvasRenderingContext2D,
    body: Matter.Body,
    settings: GameSettingsProfile
) => {
    const playerIndex = parseInt(body.label.split('-')[1], 10);
    const shipRadius = body.circleRadius || settings.SHIP_RADIUS;

    ctx.save();
    ctx.translate(body.position.x, body.position.y);
    ctx.rotate(body.angle + Math.PI / 2);
    
    ctx.beginPath();
    ctx.arc(0, 0, shipRadius, 0, Math.PI * 2);
    ctx.fillStyle = playerIndex === 0 ? '#0000FF' : '#FF0000';
    ctx.fill();
    
    const lineLength = shipRadius * 1.5;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(lineLength, 0);
    ctx.strokeStyle = '#FFFF00';
    ctx.lineWidth = 2 / ctx.getTransform().a;
    ctx.stroke();
    
    ctx.restore();

    /* // Original complex drawing logic commented out */
};

const drawProjectile = (ctx: CanvasRenderingContext2D, body: ProjectileBody) => {
    ctx.beginPath();
    const radius = body.circleRadius ?? 5;
    ctx.arc(body.position.x, body.position.y, radius, 0, 2 * Math.PI);
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

// Helper to draw physics boundary outlines
const drawBoundaryBody = (ctx: CanvasRenderingContext2D, body: Matter.Body) => {
    if (!body.vertices || body.vertices.length < 2) return;

    ctx.beginPath();
    ctx.moveTo(body.vertices[0].x, body.vertices[0].y);
    for (let i = 1; i < body.vertices.length; i++) {
        ctx.lineTo(body.vertices[i].x, body.vertices[i].y);
    }
    ctx.closePath(); // Close the shape

    // Style the boundary - make it visible but perhaps subtle
    ctx.strokeStyle = '#FFFF00'; // Yellow, as per GameplayTroubles notes
    ctx.lineWidth = 2 / ctx.getTransform().a; // Adjust based on scale
    ctx.setLineDash([5, 5]); // Dashed line
    ctx.stroke();
    ctx.setLineDash([]); // Reset dash pattern
};

// Simplified drawBackground to use actual canvas dimensions and fix linter errors
const drawBackground = (
    ctx: CanvasRenderingContext2D,
    canvasWidth: number,
    canvasHeight: number,
    assets: GameAssetsStructure | null
    // settings: GameSettingsProfile // Removed as BACKGROUND_COLOR wasn't present
) => {
    const backgroundImage = assets?.backdrop;

    // Clear the entire canvas first
    ctx.clearRect(0, 0, canvasWidth, canvasHeight);

    if (backgroundImage && backgroundImage.naturalWidth > 0 && backgroundImage.naturalHeight > 0) {
        // Simplest approach: draw image stretched/squashed to fill the canvas
        ctx.drawImage(backgroundImage, 0, 0, canvasWidth, canvasHeight);
    } else {
        // Fallback: Fill with a default background color
        ctx.fillStyle = '#000020'; // Hardcoded fallback color
        ctx.fillRect(0, 0, canvasWidth, canvasHeight);
    }
};

// --- GameRenderer Component ---
const GameRenderer: React.FC<GameRendererProps> = ({ physicsHandles, shotTracerHandlers, settings, aimStates, gameAssets }) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 });
    const animationFrameId = useRef<number | null>(null);

    const { lastShotTraces } = shotTracerHandlers;
    const latestTracesRef = useRef(lastShotTraces);
    useEffect(() => {
        latestTracesRef.current = lastShotTraces;
    }, [lastShotTraces]);

    // --- Resize Handling ---
    useEffect(() => {
        if (!canvasRef.current) return;
        const canvas = canvasRef.current;

        const resizeObserver = new ResizeObserver(entries => {
            for (const entry of entries) {
                // Use integer values for canvas dimensions to avoid potential floating point issues
                const width = Math.floor(entry.contentRect.width);
                const height = Math.floor(entry.contentRect.height);

                // Update React state
                setCanvasSize({ width, height });

                // Crucially, update the canvas element's actual width and height attributes
                // This ensures the drawing buffer matches the display size, preventing distortion.
                canvas.width = width;
                canvas.height = height;
            }
        });
        resizeObserver.observe(canvas);
        const rect = canvas.getBoundingClientRect();
        setCanvasSize({ width: rect.width, height: rect.height });
        return () => resizeObserver.disconnect();
    }, []);

    // --- Main Render Loop ---
    useEffect(() => {
        const canvas = canvasRef.current;
        const ctx = canvas?.getContext('2d');

        if (!ctx || !physicsHandles || !settings) {
            console.log("[GameRenderer] Render loop waiting for context, physicsHandles, or settings...");
            if (animationFrameId.current) {
                cancelAnimationFrame(animationFrameId.current);
                animationFrameId.current = null;
            }
            return;
        }

        // Define the drawing function
        const draw = () => {
            if (canvasSize.width <= 0 || canvasSize.height <= 0) {
                animationFrameId.current = requestAnimationFrame(draw);
                return;
            }

            // Fixed Viewport Calculation
            const virtualWidth = settings.VIRTUAL_WIDTH;
            const virtualHeight = settings.VIRTUAL_HEIGHT;
            const scaleX = canvasSize.width / virtualWidth;
            const scaleY = canvasSize.height / virtualHeight;
            const scale = Math.min(scaleX, scaleY);
            const offsetX = canvasSize.width / 2;
            const offsetY = canvasSize.height / 2;

            // ***** LOG DRAW PARAMETERS *****
            // Reduce log frequency if needed: if (Math.random() < 0.02) ...
            // console.log(`[Draw] Canvas: ${canvasSize.width}x${canvasSize.height}, Scale: ${scale.toFixed(3)}, Offset: (${offsetX.toFixed(1)}, ${offsetY.toFixed(1)})`);

            // ClearRect is now handled within drawBackground to ensure full clear
            // ctx.clearRect(0, 0, canvasSize.width, canvasSize.height);

            // 1. Draw Background FIRST (before transforms) using actual canvas dimensions
            drawBackground(ctx, canvasSize.width, canvasSize.height, gameAssets);

            // Now apply transformations for the game world view
            ctx.save();
            ctx.translate(offsetX, offsetY);
            ctx.scale(scale, scale);

            // --- Game World Drawing --- 

            // 2. Draw Historical Traces
            const traces = latestTracesRef.current;
            if (traces) {
                traces[0]?.forEach((tracePath: Matter.Vector[]) => {
                    if (tracePath) drawHistoricalTrace(ctx, tracePath);
                });
                traces[1]?.forEach((tracePath: Matter.Vector[]) => {
                    if (tracePath) drawHistoricalTrace(ctx, tracePath);
                });
            }

            // 3. Draw Physics Bodies
            const bodies = physicsHandles.getAllBodies();
            // ***** LOG BODY COUNT *****
            console.log(`[Draw] Found ${bodies.length} physics bodies.`); 

            bodies.forEach(body => {
                 // ***** LOG INDIVIDUAL BODY INFO *****
                 console.log(`[Draw Body] Label: ${body.label}, Pos: (${body.position.x.toFixed(1)}, ${body.position.y.toFixed(1)}), Radius: ${body.circleRadius?.toFixed(1)}`);
                 
                 if (body.label === 'planet' || body.label === 'sligger') {
                     drawPlanet(ctx, body);
                 } else if (body.label.startsWith('ship-')) {
                     drawShip(ctx, body, settings);
                 } else if (body.label.startsWith('projectile-')) {
                     drawProjectile(ctx, body as ProjectileBody);
                 } else if (body.label.startsWith('boundary')) {
                     // Draw the physics boundaries
                     drawBoundaryBody(ctx, body);
                 }
            });

            // --- End Game World Drawing --- 

            ctx.restore(); // Restore from world transforms

            // Request next frame
            animationFrameId.current = requestAnimationFrame(draw);
        };

        // Start the loop
        console.log("[GameRenderer] Starting render loop...");
        animationFrameId.current = requestAnimationFrame(draw);

        // Cleanup
        return () => {
            if (animationFrameId.current) {
                cancelAnimationFrame(animationFrameId.current);
                console.log("[GameRenderer] Render loop stopped (Effect cleanup).", animationFrameId.current);
                animationFrameId.current = null;
            }
        };
    }, [physicsHandles, shotTracerHandlers, settings, aimStates, gameAssets, canvasSize]);

    return <canvas ref={canvasRef} className="w-full h-full"></canvas>;
};

export default GameRenderer;