import { useRef, useEffect, useState, useCallback } from 'react';
import Matter from 'matter-js';

// --- Constants ---
const ZOOM_LERP_FACTOR = 0.08; 
const MAX_ZOOM_FACTOR = 1.5;   
const MAX_VIEW_FACTOR = 1.5;   
const VIEWPORT_PADDING = 100;  

// --- Interfaces ---
interface UseDynamicViewportProps {
    engine: Matter.Engine | null;
    // Changed back to getDynamicBodies
    getDynamicBodies: () => Matter.Body[]; 
    virtualWidth: number;
    virtualHeight: number;
    designAspectRatio: number; 
    canvasSize: { width: number; height: number };
}
interface DynamicViewportResult { 
    scale: number;
    offsetX: number;
    offsetY: number;
}

export const useDynamicViewport = ({
    engine,
    getDynamicBodies, // Use getDynamicBodies
    virtualWidth,
    virtualHeight,
    designAspectRatio, 
    canvasSize,
}: UseDynamicViewportProps): DynamicViewportResult => {
    const currentVirtualWidthRef = useRef(virtualWidth);
    const currentVirtualHeightRef = useRef(virtualHeight);
    const currentCenterXRef = useRef(virtualWidth / 2);
    const currentCenterYRef = useRef(virtualHeight / 2);
    const targetVirtualWidthRef = useRef(virtualWidth);
    const targetVirtualHeightRef = useRef(virtualHeight);
    const targetCenterXRef = useRef(virtualWidth / 2);
    const targetCenterYRef = useRef(virtualHeight / 2);

    const [viewport, setViewport] = useState<DynamicViewportResult>({ scale: 1, offsetX: 0, offsetY: 0 });

    const updateTargetViewport = useCallback(() => {
        if (!engine) return;

        // Use getDynamicBodies
        const dynamicBodies = getDynamicBodies(); 
        const hasDynamicBodies = dynamicBodies.length > 0;

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
            minX = virtualWidth * 0.2;
            maxX = virtualWidth * 0.8;
            minY = virtualHeight * 0.2;
            maxY = virtualHeight * 0.8;
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

    }, [engine, getDynamicBodies, virtualWidth, virtualHeight, designAspectRatio]); 

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