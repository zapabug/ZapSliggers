import React from 'react'
import ReactDOM from 'react-dom/client'
import './index.css'
import App from './App.tsx'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    {/* App will use useNDKInit internally */}
    <App />
  </React.StrictMode>,
)

// Service worker registration will be handled by vite-plugin-pwa
