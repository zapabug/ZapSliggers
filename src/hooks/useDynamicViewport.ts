import { useRef, useEffect, useState, useCallback } from 'react';
import Matter from 'matter-js';
import { GameSettingsProfile } from '../config/gameSettings';

// --- Constants ---
const ZOOM_LERP_FACTOR = 0.16; 
const MAX_ZOOM_FACTOR = 1.5;   
const MAX_VIEW_FACTOR = 1.5;   
const VIEWPORT_PADDING = 100;  

// --- Interfaces ---
interface UseDynamicViewportProps {
    engine: Matter.Engine | null;
    getDynamicBodies: () => Matter.Body[]; 
    settings: GameSettingsProfile;
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
    settings, // <-- Destructure settings
    canvasSize,
}: UseDynamicViewportProps): DynamicViewportResult => {
    // Initialize refs using settings
    const currentVirtualWidthRef = useRef(settings.VIRTUAL_WIDTH);
    const currentVirtualHeightRef = useRef(settings.VIRTUAL_HEIGHT);
    const currentCenterXRef = useRef(settings.VIRTUAL_WIDTH / 2);
    const currentCenterYRef = useRef(settings.VIRTUAL_HEIGHT / 2);
    const targetVirtualWidthRef = useRef(settings.VIRTUAL_WIDTH);
    const targetVirtualHeightRef = useRef(settings.VIRTUAL_HEIGHT);
    const targetCenterXRef = useRef(settings.VIRTUAL_WIDTH / 2);
    const targetCenterYRef = useRef(settings.VIRTUAL_HEIGHT / 2);

    const [viewport, setViewport] = useState<DynamicViewportResult>({ scale: 1, offsetX: 0, offsetY: 0 });

    const updateTargetViewport = useCallback(() => {
        if (!engine) return;
        
        // Calculate designAspectRatio internally
        const designAspectRatio = settings.VIRTUAL_WIDTH / settings.VIRTUAL_HEIGHT;

        // Use getDynamicBodies
        const dynamicBodies = getDynamicBodies(); 
        const hasDynamicBodies = dynamicBodies.length > 0;

        // Use settings for initial bounds if no dynamic bodies
        let minX = settings.VIRTUAL_WIDTH, maxX = 0, minY = settings.VIRTUAL_HEIGHT, maxY = 0;

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
            // Default view uses central 60% of settings dimensions
            minX = settings.VIRTUAL_WIDTH * 0.2;
            maxX = settings.VIRTUAL_WIDTH * 0.8;
            minY = settings.VIRTUAL_HEIGHT * 0.2;
            maxY = settings.VIRTUAL_HEIGHT * 0.8;
        } 
        
        // Add padding
        let requiredWidth = (maxX - minX) + 2 * VIEWPORT_PADDING;
        let requiredHeight = (maxY - minY) + 2 * VIEWPORT_PADDING;
        
        const centerX = (minX + maxX) / 2;
        const centerY = (minY + maxY) / 2;

        // Adjust for aspect ratio (calculated internally)
        if (requiredWidth / requiredHeight > designAspectRatio) {
            requiredHeight = requiredWidth / designAspectRatio;
        } else {
            requiredWidth = requiredHeight * designAspectRatio;
        }

        // Clamp zoom using settings dimensions
        requiredWidth = Math.max(requiredWidth, settings.VIRTUAL_WIDTH / MAX_ZOOM_FACTOR);
        requiredHeight = Math.max(requiredHeight, settings.VIRTUAL_HEIGHT / MAX_ZOOM_FACTOR);
        requiredWidth = Math.min(requiredWidth, settings.VIRTUAL_WIDTH * MAX_VIEW_FACTOR);
        requiredHeight = Math.min(requiredHeight, settings.VIRTUAL_HEIGHT * MAX_VIEW_FACTOR);

        // Set target refs
        targetVirtualWidthRef.current = requiredWidth;
        targetVirtualHeightRef.current = requiredHeight;
        targetCenterXRef.current = centerX;
        targetCenterYRef.current = centerY;

    }, [engine, getDynamicBodies, settings]); 

    useEffect(() => {
        let animationFrameId: number;
        const lerpAndUpdate = () => {
            currentVirtualWidthRef.current += (targetVirtualWidthRef.current - currentVirtualWidthRef.current) * ZOOM_LERP_FACTOR;
            currentVirtualHeightRef.current += (targetVirtualHeightRef.current - currentVirtualHeightRef.current) * ZOOM_LERP_FACTOR;
            currentCenterXRef.current += (targetCenterXRef.current - currentCenterXRef.current) * ZOOM_LERP_FACTOR;
            currentCenterYRef.current += (targetCenterYRef.current - currentCenterYRef.current) * ZOOM_LERP_FACTOR;
            if (canvasSize.width > 0 && canvasSize.height > 0) {
                const scaleX = canvasSize.width / currentVirtualWidthRef.current; 
                const scaleY = canvasSize.height / currentVirtualHeightRef.current;
                const finalScale = Math.min(scaleX, scaleY);
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
        const intervalId = setInterval(updateTargetViewport, 50);
        return () => clearInterval(intervalId);
    }, [updateTargetViewport]);

    return viewport;
}; 