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
const SHIP_RADIUS_DRAW = 63; // Example: Use specific drawing constants or keep globals
const PLANET_MIN_RADIUS_DRAW = 40;
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
    const radius = body.plugin?.klunkstr?.radius || PLANET_MIN_RADIUS_DRAW;
    ctx.beginPath();
    ctx.arc(body.position.x, body.position.y, radius, 0, 2 * Math.PI);
    ctx.fillStyle = body.render.fillStyle || '#888'; 
    ctx.fill();
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
  useEffect(() => { /* background */ });
  useEffect(() => { /* resize */ });

  // --- Render Loop ---
  useEffect(() => {
    let animationFrameId: number;
    const renderLoop = () => {
        const canvas = canvasRef.current;
        const engine = physicsHandles?.engine;
        const bodiesGetter = physicsHandles?.getAllBodies;
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

        drawBackground(ctx, backgroundImage);
        drawBorder(ctx);

        const bodies = bodiesGetter();
        bodies.forEach(body => {
            if (body.label === 'planet') {
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