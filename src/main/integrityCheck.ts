import { app, dialog } from 'electron';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { logSecurityEvent } from './securityLog';

export async function verifyAsarIntegrity(): Promise<void> {
  if (!app.isPackaged) {
    console.log('Skipping ASAR integrity check in development.');
    return;
  }

  try {
    const resourcesPath = process.resourcesPath;
    const asarPath = path.join(resourcesPath, 'app.asar');
    const sealPath = path.join(resourcesPath, 'integrity.seal');

    if (!fs.existsSync(asarPath)) {
      throw new Error('Missing application bundle (app.asar).');
    }

    if (!fs.existsSync(sealPath)) {
      throw new Error('Integrity seal (integrity.seal) is missing.');
    }

    const expectedChecksum = fs.readFileSync(sealPath, 'utf8').trim();

    const actualChecksum = await new Promise<string>((resolve, reject) => {
      const hash = crypto.createHash('sha256');
      const stream = fs.createReadStream(asarPath);
      
      stream.on('data', (data) => hash.update(data));
      stream.on('end', () => resolve(hash.digest('hex')));
      stream.on('error', (err) => reject(err));
    });

    if (actualChecksum !== expectedChecksum) {
      throw new Error('ASAR integrity checksum mismatch.');
    }

    console.log('ASAR integrity check passed.');
    logSecurityEvent('INTEGRITY_CHECK_PASSED');
  } catch (error) {
    console.error('TAMPERING_DETECTED:', error);
    logSecurityEvent('TAMPERING_DETECTED', String(error));
    dialog.showErrorBox(
      'Security Tampering Detected',
      'The application files have been modified or corrupted. Unapproved modifications are not allowed. The application will now exit.'
    );
    app.exit(1);
  }
}
