import { useRef, useEffect, useState, useCallback } from 'react';
import Matter from 'matter-js';

// Constants for viewport behavior
const ZOOM_LERP_FACTOR = 0.08; // How fast to zoom/pan (0-1)
const MAX_ZOOM_FACTOR = 1.5;   // Prevents zooming in *too* much
const MAX_VIEW_FACTOR = 1.5;   // Allow zooming out to show 1.5x the virtual area
const VIEWPORT_PADDING = 100;  // Pixels to keep around edges

interface UseDynamicViewportProps {
    engine: Matter.Engine | null;
    getDynamicBodies: () => Matter.Body[]; // Function from useMatterPhysics
    virtualWidth: number;
    virtualHeight: number;
    designAspectRatio: number;
    canvasSize: { width: number; height: number }; // Current canvas pixel size
}

interface DynamicViewportResult {
    scale: number;
    offsetX: number;
    offsetY: number;
    // Optional: expose lerped values if needed elsewhere
    // lerpedViewport: { width: number, height: number, centerX: number, centerY: number };
}

export const useDynamicViewport = ({
    engine,
    getDynamicBodies,
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

    // Update Target Viewport based on Body Positions
    const updateTargetViewport = useCallback(() => {
        if (!engine) return;

        const dynamicBodies = getDynamicBodies();
        let minX = virtualWidth, maxX = 0, minY = virtualHeight, maxY = 0;
        const hasDynamicBodies = dynamicBodies.length > 0;

        if (hasDynamicBodies) {
            dynamicBodies.forEach(body => {
                const bounds = body.bounds;
                minX = Math.min(minX, bounds.min.x);
                maxX = Math.max(maxX, bounds.max.x);
                minY = Math.min(minY, bounds.min.y);
                maxY = Math.max(maxY, bounds.max.y);
            });
        } else {
            minX = 0;
            maxX = virtualWidth;
            minY = 0;
            maxY = virtualHeight;
        }

        // Calculate required size
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

    // Lerp and Calculate Final Viewport for Rendering
    useEffect(() => {
        let animationFrameId: number;

        const lerpAndUpdate = () => {
            // Lerp Viewport Towards Target
            currentVirtualWidthRef.current += (targetVirtualWidthRef.current - currentVirtualWidthRef.current) * ZOOM_LERP_FACTOR;
            currentVirtualHeightRef.current += (targetVirtualHeightRef.current - currentVirtualHeightRef.current) * ZOOM_LERP_FACTOR;
            currentCenterXRef.current += (targetCenterXRef.current - currentCenterXRef.current) * ZOOM_LERP_FACTOR;
            currentCenterYRef.current += (targetCenterYRef.current - currentCenterYRef.current) * ZOOM_LERP_FACTOR;

            // Calculate Final Viewport Scale and Offset for Rendering
            if (canvasSize.width > 0 && canvasSize.height > 0) {
                const scaleX = canvasSize.width / currentVirtualWidthRef.current;
                const scaleY = canvasSize.height / currentVirtualHeightRef.current;
                const finalScale = Math.min(scaleX, scaleY); // Maintain aspect ratio
                const viewWidth = currentVirtualWidthRef.current * finalScale;
                const viewHeight = currentVirtualHeightRef.current * finalScale;
                const finalOffsetX = (canvasSize.width - viewWidth) / 2 - (currentCenterXRef.current - currentVirtualWidthRef.current / 2) * finalScale;
                const finalOffsetY = (canvasSize.height - viewHeight) / 2 - (currentCenterYRef.current - currentVirtualHeightRef.current / 2) * finalScale;

                // Update state to trigger re-render in GameRenderer
                setViewport({ scale: finalScale, offsetX: finalOffsetX, offsetY: finalOffsetY });
            } else {
                 setViewport({ scale: 1, offsetX: 0, offsetY: 0 }); // Default if canvas size is zero
            }

            animationFrameId = requestAnimationFrame(lerpAndUpdate);
        };

        // Start the lerp loop
        lerpAndUpdate();

        return () => {
            cancelAnimationFrame(animationFrameId);
        };
    }, [canvasSize]); // Rerun effect if canvas size changes

    // Effect to update the target viewport when engine/bodies might change
    // This runs less frequently than the lerp loop
    useEffect(() => {
        updateTargetViewport();
        // We could potentially add a listener to the engine's 'afterUpdate'
        // event for more precise updates, but checking periodically might be sufficient
        const intervalId = setInterval(updateTargetViewport, 100); // Check every 100ms

        return () => clearInterval(intervalId);
    }, [updateTargetViewport]);

    return viewport;
}; 