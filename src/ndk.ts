import NDK from '@nostr-dev-kit/ndk';

// Define default relays
export const explicitRelayUrls = [
  'wss://relay.damus.io',
  'wss://nos.lol',
  'wss://relay.primal.net',
  'wss://relay.nsec.app',
];

// Instantiate the NDK singleton
const ndkInstance = new NDK({
  explicitRelayUrls: explicitRelayUrls,
  // Add other NDK options here if needed, like signer, cache adapter, etc.
});

// Export the singleton instance
export default ndkInstance; 