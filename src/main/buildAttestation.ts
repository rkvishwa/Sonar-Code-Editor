import { app } from 'electron';
import fs from 'fs';
import path from 'path';
import { logSecurityEvent } from './securityLog';

export function getAttestationToken(): any {
  try {
    // Determine the path to the attestation file regardless of whether we are packed
    const attestationPath = path.join(__dirname, 'build-attestation.json');

    if (app.isPackaged && fs.existsSync(attestationPath)) {
      const data = JSON.parse(fs.readFileSync(attestationPath, 'utf8'));
      if (data && data.token) {
        logSecurityEvent('BUILD_ATTESTED', `Version: ${data.version}, Timestamp: ${data.buildTimestamp}`);
        // Return the static signed token. Backend will verify signature.
        return data; 
      }
    }
  } catch (err) {
    console.error('Failed to read attestation token:', err);
  }

  logSecurityEvent('DEV_MODE_CLIENT', 'Running in unofficial/dev mode');
  return null;
}
