import { useState, useEffect } from 'react';

// Define the asset paths (relative to /public)
// Adjust these names to match your actual files in /public/images
const ASSET_PATHS = {
    backdrop: '/images/backdrop.png',
    ship0: '/images/spaceship_small_blue.png', // <<< Corrected key and filename
    ship1: '/images/spaceship_small_red.png',   // <<< Corrected key and filename
    planet: '/images/planet_1.png', // <<< Renamed key (assuming single planet graphic for now)
    // sligger: '/images/planet_orange.png', // <<< TEMPORARILY COMMENTED OUT
    // planet1: '/images/planet_1.png', // Example: Replace/add actual planet images
    // planet2: '/images/planet_2.png',
    // Add other planets, projectiles, effects sprites here as needed
    // e.g., projectileStandard: '/images/projectile_std.png',
    //       projectileSplitter: '/images/projectile_split.png',
};

type AssetName = keyof typeof ASSET_PATHS;
type LoadedAssets = { [key in AssetName]?: HTMLImageElement };
type LoadingState = 'idle' | 'loading' | 'loaded' | 'error';

export interface UseGameAssetsReturn {
    assets: LoadedAssets;
    loadingState: LoadingState;
    error: string | null;
}

/**
 * Hook to preload game image assets defined in ASSET_PATHS.
 */
export const useGameAssets = (): UseGameAssetsReturn => {
    const [assets, setAssets] = useState<LoadedAssets>({});
    const [loadingState, setLoadingState] = useState<LoadingState>('idle');
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        setLoadingState('loading');
        const promises: Promise<void>[] = [];
        const loaded: LoadedAssets = {};
        let loadError = false;

        Object.entries(ASSET_PATHS).forEach(([name, path]) => {
            const assetName = name as AssetName;
            const promise = new Promise<void>((resolve) => {
                const img = new Image();
                img.onload = () => {
                    loaded[assetName] = img;
                    resolve();
                };
                img.onerror = () => {
                    loadError = true;
                    // Don't reject the promise here, let Promise.all finish
                    // Mark error and resolve so Promise.all doesn't fail early
                    resolve(); 
                };
                img.src = path;
            });
            promises.push(promise);
        });

        Promise.all(promises)
            .then(() => {
                if (!loadError) {
                    setAssets(loaded);
                    setLoadingState('loaded');
                    setError(null);
                } else {
                   setAssets(loaded); // Set partially loaded assets anyway
                   setLoadingState('error');
                   setError('One or more assets failed to load. Check console for details.');
                }
            })
            .catch((err) => {
                // Should ideally not be reached if individual errors just resolve
                setLoadingState('error');
                setError(err.message || 'An unexpected error occurred during Promise.all.');
            });

        // Cleanup function is generally not needed for image loading
    }, []); // Run only once on mount

    return { assets, loadingState, error };
}; 