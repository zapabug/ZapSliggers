import React from 'react'
import ReactDOM from 'react-dom/client'
import './index.css'
import App from './App.tsx'
// Import NDK
import NDK from '@nostr-dev-kit/ndk';

// Define and instantiate NDK here
export const explicitRelayUrls = [
  'wss://relay.damus.io',
  'wss://nos.lol',
  'wss://relay.primal.net',
  'wss://relay.nsec.app',
];

export const ndkInstance = new NDK({
  explicitRelayUrls: explicitRelayUrls,
  // Add other NDK options here if needed, like signer, cache adapter, etc.
});

// Remove the connect call here; the custom hook will handle it.
// ndkInstance.connect()... 

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    {/* App component will use the exported ndkInstance */}
    <App />
  </React.StrictMode>,
)
