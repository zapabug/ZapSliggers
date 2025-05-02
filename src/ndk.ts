import NDK from '@nostr-dev-kit/ndk';
// import NDKDebugger from 'debug'; // Import the debug library - REMOVED

// Create a debugger instance for NDK - REMOVED
// const ndkDebug = NDKDebugger('ndk');

// Define default relays
export const explicitRelayUrls = [
  // Remove bunker-specific relay, NDK will handle it
  // 'wss://relay.nsec.app',
  // Restore standard public relays
  'wss://relay.damus.io',
  'wss://nos.lol',
  'wss://relay.primal.net',
  `wss://nostr.mom`,
  // Add the game-specific community relay
  'wss://relay.degmods.com',
];

// Instantiate the NDK singleton
const ndkInstance = new NDK({
  explicitRelayUrls: explicitRelayUrls,
  // debug: ndkDebug, // Pass the debugger instance - REMOVED FOR TESTING
  // Add other NDK options here if needed, like signer, cache adapter, etc.
});

// Export the singleton instance
export default ndkInstance; 