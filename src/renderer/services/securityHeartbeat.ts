import { useEffect } from 'react';

let intervalStarted = false;

export function initSecurityHeartbeat() {
  if (intervalStarted) return;
  intervalStarted = true;

  async function start() {
    try {
      const nonce = await window.electronAPI?.security?.requestNonce();
      if (!nonce) return;

      // Send ping every 5 seconds
      setInterval(() => {
        window.electronAPI?.security?.sendHeartbeat(nonce);
      }, 5000);
      
      // also send immediate one
      window.electronAPI?.security?.sendHeartbeat(nonce);
    } catch (err) {
      console.error('Failed to init security heartbeat:', err);
    }
  }

  start();
}
