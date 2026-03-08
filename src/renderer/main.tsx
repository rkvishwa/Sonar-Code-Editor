// Monaco Editor local setup — MUST be imported before any Monaco component renders.
// This configures @monaco-editor/react to use the bundled monaco-editor instead
// of loading from CDN, which fixes the "stuck on Loading..." issue on Windows
// clients without internet access or with restrictive CSP.
import './monacoSetup';

import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './styles/global.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
