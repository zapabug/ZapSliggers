import { useRef, useEffect, useState, useCallback } from 'react';
import Matter from 'matter-js';
import { GameSettingsProfile } from '../config/gameSettings';

// --- Constants ---
// const ZOOM_LERP_FACTOR = 0.16; // REMOVED Unused
const MAX_ZOOM_FACTOR = 1.2;   
const MAX_VIEW_FACTOR = 1.5;   
const VIEWPORT_PADDING = 200;  

// --- Interfaces ---
interface UseDynamicViewportProps {
    engine: Matter.Engine | null;
    getDynamicBodies: () => Matter.Body[];
    getStaticBodies: () => Matter.Body[];
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
    getStaticBodies, // Added
    settings, // <-- Destructure settings
    canvasSize,
}: UseDynamicViewportProps): DynamicViewportResult => {
    // Refs for the calculated target viewport parameters
    const targetVirtualWidthRef = useRef(settings.VIRTUAL_WIDTH);
    const targetVirtualHeightRef = useRef(settings.VIRTUAL_HEIGHT);
    const targetCenterXRef = useRef(settings.VIRTUAL_WIDTH / 2);
    const targetCenterYRef = useRef(settings.VIRTUAL_HEIGHT / 2);

    // State for the final calculated viewport
    const [viewport, setViewport] = useState<DynamicViewportResult>({ 
        scale: 1, 
        offsetX: canvasSize.width / 2, // Initial estimate based on canvas size
        offsetY: canvasSize.height / 2 
    });

    // Function to calculate the target bounds and center
    const updateTargetViewport = useCallback(() => {
        if (!engine) return;
        
        const designAspectRatio = settings.VIRTUAL_WIDTH / settings.VIRTUAL_HEIGHT;
        const dynamicBodies = getDynamicBodies();
        const staticBodies = getStaticBodies(); // Get static bodies (ships)
        const allBodies = [...staticBodies, ...dynamicBodies]; // Combine for bounds calculation

        // Explicitly type the variables
        let minX: number, maxX: number, minY: number, maxY: number;

        // Always calculate bounds based on ALL relevant bodies (static + dynamic)
        if (allBodies.length > 0) {
            minX = Infinity; maxX = -Infinity;
            minY = Infinity; maxY = -Infinity;
            allBodies.forEach(body => {
                // Use body center for points, or bounds for broader coverage?
                // Let's stick to bounds for now as before.
                const bounds = body.bounds;
                minX = Math.min(minX, bounds.min.x);
                maxX = Math.max(maxX, bounds.max.x);
                minY = Math.min(minY, bounds.min.y);
                maxY = Math.max(maxY, bounds.max.y);
            });
        } else {
            // Fallback ONLY if NO bodies exist at all (shouldn't happen with ships)
            // Default view centers on the initial setup
            console.warn("[useDynamicViewport] No bodies found for viewport calculation. Centering.");
            minX = settings.VIRTUAL_WIDTH * 0.2;
            maxX = settings.VIRTUAL_WIDTH * 0.8;
            minY = settings.VIRTUAL_HEIGHT * 0.2;
            maxY = settings.VIRTUAL_HEIGHT * 0.8;
            // Alternative: Use the initial ship positions if staticBodies was somehow empty but shouldnt be?
        }
        
        let requiredWidth = (maxX - minX) + 2 * VIEWPORT_PADDING;
        let requiredHeight = (maxY - minY) + 2 * VIEWPORT_PADDING;
        const centerX = (minX + maxX) / 2;
        const centerY = (minY + maxY) / 2;

        if (requiredWidth / requiredHeight > designAspectRatio) {
            requiredHeight = requiredWidth / designAspectRatio;
        } else {
            requiredWidth = requiredHeight * designAspectRatio;
        }

        requiredWidth = Math.max(requiredWidth, settings.VIRTUAL_WIDTH / MAX_ZOOM_FACTOR);
        requiredHeight = Math.max(requiredHeight, settings.VIRTUAL_HEIGHT / MAX_ZOOM_FACTOR);
        requiredWidth = Math.min(requiredWidth, settings.VIRTUAL_WIDTH * MAX_VIEW_FACTOR);
        requiredHeight = Math.min(requiredHeight, settings.VIRTUAL_HEIGHT * MAX_VIEW_FACTOR);

        // Update target refs directly
        targetVirtualWidthRef.current = requiredWidth;
        targetVirtualHeightRef.current = requiredHeight;
        targetCenterXRef.current = centerX;
        targetCenterYRef.current = centerY;

        // Return the calculated values so the other effect can use them immediately
        return { requiredWidth, requiredHeight, centerX, centerY };

    }, [engine, getDynamicBodies, getStaticBodies, settings]); 

    // Effect to calculate and set the final viewport state when targets or canvasSize change
    useEffect(() => {
        // --- REMOVED LOG --- 

        // Get the latest calculated target dimensions
        const targets = updateTargetViewport();
        if (!targets) {
             // --- REMOVED LOG --- 
             return; 
        }

        const { requiredWidth, requiredHeight, centerX, centerY } = targets;

        if (canvasSize.width > 0 && canvasSize.height > 0) {
            // Calculate scale based on target dimensions and canvas size
            const scaleX = canvasSize.width / requiredWidth; 
            const scaleY = canvasSize.height / requiredHeight;
            const finalScale = Math.min(scaleX, scaleY);

            // Calculate offset to center the target center point on the canvas center
            const finalOffsetX = (canvasSize.width / 2) - (centerX * finalScale);
            const finalOffsetY = (canvasSize.height / 2) - (centerY * finalScale);
            
            // --- REMOVED LOG --- 

            // Set the state directly - NO LERPING
            setViewport({ scale: finalScale, offsetX: finalOffsetX, offsetY: finalOffsetY });
        } else {
             // --- REMOVED LOG --- 
             // If canvas size is invalid, use default
             setViewport({ scale: 1, offsetX: 0, offsetY: 0 });
        }
        
        // This effect now depends on canvasSize and the stable updateTargetViewport callback
    }, [canvasSize, updateTargetViewport]); 

    // Effect to periodically update the target based on physics changes
    useEffect(() => {
        const intervalId = setInterval(updateTargetViewport, 50);
        return () => clearInterval(intervalId);
    }, [updateTargetViewport]); // Depends only on the stable callback

    return viewport;
}; 