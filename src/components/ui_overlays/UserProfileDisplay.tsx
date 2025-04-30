import { nip19 } from 'nostr-tools';
import { useEffect, useState } from 'react';
import NDK, { NDKUserProfile } from '@nostr-dev-kit/ndk'; // Import NDK type and NDKUserProfile

interface UserProfileDisplayProps {
    pubkey: string;
    ndk: NDK; // Keep NDK prop
}

export function UserProfileDisplay({ pubkey, ndk }: UserProfileDisplayProps) {
    // Remove useProfile hook
    // const profile = useProfile({ pubkey, ndk }); 

    // State for profile data
    const [profile, setProfile] = useState<NDKUserProfile | null>(null);
    const [npub, setNpub] = useState<string>('');
    const [imageError, setImageError] = useState(false);

    // Effect to fetch profile manually
    useEffect(() => {
        if (pubkey && ndk) {
            console.log(`[UserProfileDisplay] Fetching profile for pubkey: ${pubkey}`);
            const user = ndk.getUser({ pubkey });
            user.fetchProfile().then((fetchedProfile) => {
                console.log(`[UserProfileDisplay] Fetched profile for ${pubkey}:`, fetchedProfile);
                setProfile(fetchedProfile); // fetchedProfile can be null
            }).catch(error => {
                console.error(`[UserProfileDisplay] Error fetching profile for ${pubkey}:`, error);
                setProfile(null);
            });
        } else {
            setProfile(null); // Reset profile if pubkey or ndk is missing
        }
    }, [pubkey, ndk]); // Re-run if pubkey or ndk instance changes

    useEffect(() => {
        if (pubkey) {
            try {
                setNpub(nip19.npubEncode(pubkey));
            } catch (e) {
                console.error("Error encoding npub", pubkey, e);
                setNpub('invalid_npub');
            }
        } else {
            setNpub('');
        }
    }, [pubkey]);

    useEffect(() => {
        setImageError(false);
    }, [pubkey]);

    const displayName = profile?.displayName || profile?.name || (npub ? `${npub.substring(0, 10)}...${npub.substring(npub.length - 4)}` : '...');
    const avatarUrl = profile?.image;

    const DefaultAvatar = () => (
        <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-purple-400 via-pink-500 to-red-500 flex items-center justify-center text-white font-bold text-xs shrink-0">
            {displayName && displayName !== '...' ? displayName.substring(0, 2).toUpperCase() : '??'}
        </div>
    );

    return (
        <div className="flex items-center space-x-2 min-w-0">
            {avatarUrl && !imageError ? (
                <img
                    src={avatarUrl}
                    alt={`${displayName}'s avatar`}
                    className="w-10 h-10 rounded-full border-2 border-gray-600 shrink-0"
                    onError={() => setImageError(true)}
                 />
            ) : (
                 <DefaultAvatar />
            )}

            <span className="font-semibold text-gray-200 truncate">{displayName}</span>
        </div>
    );
} 