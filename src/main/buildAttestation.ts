import { app } from 'electron';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { logSecurityEvent } from './securityLog';

export function getAttestationToken(nonce?: string): string {
  try {
    // Determine the path to the attestation file regardless of whether we are packed
    const attestationPath = path.join(__dirname, 'build-attestation.json');

    if (app.isPackaged && fs.existsSync(attestationPath)) {
      const data = JSON.parse(fs.readFileSync(attestationPath, 'utf8'));
      if (data && data.token && data.signingKey) {
        logSecurityEvent('BUILD_ATTESTED', `Version: ${data.version}, Timestamp: ${data.buildTimestamp}`);
        if (nonce) {
          const dynamicPayload = `${data.version}|${data.buildTimestamp}|sonar-official|${nonce}`;
          const dynamicToken = crypto.createHmac('sha256', data.signingKey).update(dynamicPayload).digest('hex');
          return JSON.stringify({ ...data, token: dynamicToken, dynamicPayload });
        }
        return JSON.stringify(data);
      }
    }
  } catch (err) {
    console.error('Failed to read attestation token:', err);
  }

  logSecurityEvent('DEV_MODE_CLIENT', 'Running in unofficial/dev mode');
  return 'DEV_MODE';
}
