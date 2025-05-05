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

const drawBackground = (ctx: CanvasRenderingContext2D, settings: GameSettingsProfile, assets: GameAssetsStructure | null) => {
    const backgroundImage = assets?.backdrop;
    const worldWidth = settings.VIRTUAL_WIDTH;
    const worldHeight = settings.VIRTUAL_HEIGHT;
    const drawX = -worldWidth / 2;
    const drawY = -worldHeight / 2;

    if (backgroundImage && backgroundImage.naturalWidth > 0 && backgroundImage.naturalHeight > 0) {
        const worldRatio = worldWidth / worldHeight;
        const imageRatio = backgroundImage.naturalWidth / backgroundImage.naturalHeight;
        let sourceX = 0, sourceY = 0, sourceWidth = backgroundImage.naturalWidth, sourceHeight = backgroundImage.naturalHeight;
        if (imageRatio > worldRatio) {
            sourceWidth = backgroundImage.naturalHeight * worldRatio;
            sourceX = (backgroundImage.naturalWidth - sourceWidth) / 2;
        } else if (imageRatio < worldRatio) {
            sourceHeight = backgroundImage.naturalWidth / worldRatio;
            sourceY = (backgroundImage.naturalHeight - sourceHeight) / 2;
        }
        ctx.drawImage(backgroundImage, sourceX, sourceY, sourceWidth, sourceHeight, drawX, drawY, worldWidth, worldHeight);
    } else {
        ctx.fillStyle = '#000020';
        ctx.fillRect(drawX, drawY, worldWidth, worldHeight);
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
        const canvas = canvasRef.current;
        if (!canvas) return;
        const resizeObserver = new ResizeObserver(entries => {
            for (const entry of entries) {
                const { width, height } = entry.contentRect;
                setCanvasSize({ width, height });
                console.log(`[GameRenderer] Canvas resized: ${width}x${height}`);
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
            console.log(`[Draw] Canvas: ${canvasSize.width}x${canvasSize.height}, Scale: ${scale.toFixed(3)}, Offset: (${offsetX.toFixed(1)}, ${offsetY.toFixed(1)})`);

            ctx.clearRect(0, 0, canvasSize.width, canvasSize.height);
            ctx.save();
            ctx.translate(offsetX, offsetY);
            ctx.scale(scale, scale);

            // 1. Draw Background
            drawBackground(ctx, settings, gameAssets);

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
                     // Boundaries invisible
                 }
            });

            ctx.restore();

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