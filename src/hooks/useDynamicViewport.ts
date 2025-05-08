import { useRef, useEffect, useState, useCallback } from 'react';
import Matter from 'matter-js';

// --- Constants ---
const ZOOM_LERP_FACTOR = 0.08; // Controls how smoothly the camera transitions (lower = smoother)
const MAX_ZOOM_FACTOR = 1.5;   // Maximum zoom level (1.5x the base size)
const MAX_VIEW_FACTOR = 1.5;   // Maximum view size multiplier
const VIEWPORT_PADDING = 300;  // Padding around objects to ensure they're fully visible

// Props for the dynamic viewport hook that manages camera and scaling
interface UseDynamicViewportProps {
    engine: Matter.Engine | null; // Matter.js physics engine instance
    bodies: Matter.Body[]; // Array of Matter.js bodies to be tracked by the viewport
    virtualWidth: number; // Base width of the virtual game space
    virtualHeight: number; // Base height of the virtual game space
    designAspectRatio: number; // Target aspect ratio for the game view
    canvasSize: { width: number; height: number }; // Current dimensions of the canvas element
}

// Result object containing viewport transformation values
interface DynamicViewportResult { 
    scale: number; // Current scale factor for rendering
    offsetX: number; // X-axis offset for camera positioning
    offsetY: number; // Y-axis offset for camera positioning
}

/**
 * Hook that manages dynamic viewport scaling and camera positioning
 * to ensure all game objects remain visible while maintaining aspect ratio
 */
export const useDynamicViewport = ({
    engine,
    bodies,
    virtualWidth,
    virtualHeight,
    designAspectRatio, 
    canvasSize,
}: UseDynamicViewportProps): DynamicViewportResult => {
    // Current viewport dimensions and center point
    const currentVirtualWidthRef = useRef(virtualWidth);
    const currentVirtualHeightRef = useRef(virtualHeight);
    const currentCenterXRef = useRef(virtualWidth / 1.5);
    const currentCenterYRef = useRef(virtualHeight / 2);
    
    // Target viewport dimensions and center point for smooth transitions
    const targetVirtualWidthRef = useRef(virtualWidth);
    const targetVirtualHeightRef = useRef(virtualHeight);
    const targetCenterXRef = useRef(virtualWidth / 2);
    const targetCenterYRef = useRef(virtualHeight / 2);

    const [viewport, setViewport] = useState<DynamicViewportResult>({ scale: 1, offsetX: 0, offsetY: 0 });

    const updateTargetViewport = useCallback(() => {
        if (!engine) return;

        // Use the bodies prop directly
        const dynamicBodies = bodies; 
        const hasDynamicBodies = dynamicBodies && dynamicBodies.length > 0;

        let minX = virtualWidth, maxX = 0, minY = virtualHeight, maxY = 0;

        if (hasDynamicBodies) {
            // Calculate bounds based on dynamic bodies
            minX = Infinity; maxX = -Infinity;
            minY = Infinity; maxY = -Infinity;
            dynamicBodies.forEach(body => {
                const bounds = body.bounds;
                minX = Math.min(minX, bounds.min.x);
                maxX = Math.max(maxX, bounds.max.x);
                minY = Math.min(minY, bounds.min.y);
                maxY = Math.max(maxY, bounds.max.y);
            });
        } else {
            // Default view uses central 60%
            minX = virtualWidth * 0.1;
            maxX = virtualWidth * 0.9;
            minY = virtualHeight * 0.1;
            maxY = virtualHeight * 0.9;
        } 
        
        // Add padding
        let requiredWidth = (maxX - minX) + 2 * VIEWPORT_PADDING;
        let requiredHeight = (maxY - minY) + 2 * VIEWPORT_PADDING;
        
        const centerX = (minX + maxX) / 2;
        const centerY = (minY + maxY) / 2;

        // Adjust for aspect ratio
        if (requiredWidth / requiredHeight > designAspectRatio) {
            requiredHeight = requiredWidth / designAspectRatio;
        } else {
            requiredWidth = requiredHeight * designAspectRatio;
        }

        // Clamp zoom
        requiredWidth = Math.max(requiredWidth, virtualWidth / MAX_ZOOM_FACTOR);
        requiredHeight = Math.max(requiredHeight, virtualHeight / MAX_ZOOM_FACTOR);
        requiredWidth = Math.min(requiredWidth, virtualWidth * MAX_VIEW_FACTOR);
        requiredHeight = Math.min(requiredHeight, virtualHeight * MAX_VIEW_FACTOR);

        // Set target refs
        targetVirtualWidthRef.current = requiredWidth;
        targetVirtualHeightRef.current = requiredHeight;
        targetCenterXRef.current = centerX;
        targetCenterYRef.current = centerY;

    }, [engine, bodies, virtualWidth, virtualHeight, designAspectRatio]); 

    useEffect(() => {
        let animationFrameId: number;
        const lerpAndUpdate = () => {
            currentVirtualWidthRef.current += (targetVirtualWidthRef.current - currentVirtualWidthRef.current) * ZOOM_LERP_FACTOR;
            currentVirtualHeightRef.current += (targetVirtualHeightRef.current - currentVirtualHeightRef.current) * ZOOM_LERP_FACTOR;
            currentCenterXRef.current += (targetCenterXRef.current - currentCenterXRef.current) * ZOOM_LERP_FACTOR;
            currentCenterYRef.current += (targetCenterYRef.current - currentCenterYRef.current) * ZOOM_LERP_FACTOR;
            if (canvasSize.width > 0 && canvasSize.height > 0) {
                const scaleX = canvasSize.width / currentVirtualWidthRef.current; 
                const finalScale = scaleX; // Always fit width, force landscape
                const viewWidth = currentVirtualWidthRef.current * finalScale; 
                const viewHeight = currentVirtualHeightRef.current * finalScale;
                const finalOffsetX = (canvasSize.width - viewWidth) / 2 - (currentCenterXRef.current - currentVirtualWidthRef.current / 2) * finalScale;
                const finalOffsetY = (canvasSize.height - viewHeight) / 2 - (currentCenterYRef.current - currentVirtualHeightRef.current / 2) * finalScale;
                setViewport({ scale: finalScale, offsetX: finalOffsetX, offsetY: finalOffsetY });
            } else {
                 setViewport({ scale: 1, offsetX: 0, offsetY: 0 });
            }
            animationFrameId = requestAnimationFrame(lerpAndUpdate);
        };
        lerpAndUpdate();
        return () => cancelAnimationFrame(animationFrameId);
    }, [canvasSize, targetVirtualWidthRef, targetVirtualHeightRef, targetCenterXRef, targetCenterYRef]); 

    useEffect(() => {
        updateTargetViewport(); 
        const intervalId = setInterval(updateTargetViewport, 100);
        return () => clearInterval(intervalId);
    }, [updateTargetViewport]);

    return viewport;
}; 