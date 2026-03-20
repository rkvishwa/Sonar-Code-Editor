import { app, dialog } from 'electron';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
// @ts-ignore
import originalFs from 'original-fs';
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

    const { checksum: expectedChecksum, signature } = JSON.parse(fs.readFileSync(sealPath, 'utf8'));

    const publicKey = `-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAofPbFzvaLw6qE7oqYa3M
g9Xmcsd9HzP5YLOVgkuLUGxqPVo+DbAC1Ld8GYgZSNNztVwy/E6kNbtw3IkBWxBH
wJriMpH1SskirDfydxnNPT3k7QWZvcxEA8pIPxMQBvWt2rK2al9o3HLQyC5S7vn9
gZyJg95BYIBbRPuQdbsCr6WqI7qxqWwpJ+bOBvgdfFaTsyMtBF701EAGo9w0XqRv
QrThxWdRlbGgI0zo/IgswFj9cwiRlLJNC0D/tsinwgpRSKHCkENU+kKBbrl9Wbfi
mg0IGA1Xwa3e61s/XYSIzMmpJtEMhElZcVk0n1S9Z+G1xV8MedIcYpNDO+HrgiNR
oQIDAQAB
-----END PUBLIC KEY-----`;

    const verify = crypto.createVerify('SHA256');
    verify.update(expectedChecksum);
    verify.end();
    
    if (!verify.verify(publicKey, signature, 'hex')) {
        throw new Error('ASAR integrity signature verification failed.');
    }

    const actualChecksum = await new Promise<string>((resolve, reject) => {
      const hash = crypto.createHash('sha256');
      const stream = originalFs.createReadStream(asarPath);
      
      stream.on('data', (data: any) => hash.update(data));
      stream.on('end', () => resolve(hash.digest('hex')));
      stream.on('error', (err) => reject(err));
    });

    if (actualChecksum !== expectedChecksum) {
      throw new Error(`ASAR integrity checksum mismatch. Expected: ${expectedChecksum}, Actual: ${actualChecksum}`);
    }

    console.log('ASAR integrity check passed.');
    logSecurityEvent('INTEGRITY_CHECK_PASSED');
  } catch (error: any) {
    console.error('TAMPERING_DETECTED:', error);
    logSecurityEvent('TAMPERING_DETECTED', String(error));
    dialog.showErrorBox(
      'Security Tampering Detected',
      `The application files have been modified or corrupted. Unapproved modifications are not allowed. The application will now exit.\n\nError: ${error.message}`
    );
    app.exit(1);
  }
}
