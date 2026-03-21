const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });

// Only checking mac-arm64 for now as per workspace info
const appPath = path.join(__dirname, '../release/mac-arm64/Sonar Code Editor.app/Contents/Resources');
const asarPath = path.join(appPath, 'app.asar');
const sealPath = path.join(appPath, 'integrity.seal');

if (!fs.existsSync(asarPath)) {
  console.error('app.asar not found at', asarPath);
  process.exit(1);
}

if (!fs.existsSync(sealPath)) {
  console.error('integrity.seal not found at', sealPath);
  process.exit(1);
}

const sealContent = fs.readFileSync(sealPath, 'utf8');
const { checksum: expectedChecksum, signature } = JSON.parse(sealContent);

console.log('Expected Checksum:', expectedChecksum);

const hash = crypto.createHash('sha256');
const asarBuffer = fs.readFileSync(asarPath);
hash.update(asarBuffer);
const actualChecksum = hash.digest('hex');

console.log('Actual Checksum:  ', actualChecksum);

if (expectedChecksum === actualChecksum) {
  console.log('Checksum Match! The seal is valid for the current app.asar.');
  
  // Verify signature
  const publicKey = process.env.SEAL_PUBLIC_KEY;
  if (!publicKey) {
    console.error('Missing required env var: SEAL_PUBLIC_KEY');
    process.exit(1);
  }
  const normalizedPublicKey = publicKey.replace(/\\n/g, '\n');

  const verify = crypto.createVerify('SHA256');
  verify.update(expectedChecksum);
  verify.end();
  
    if (verify.verify(normalizedPublicKey, signature, 'hex')) {
      console.log('Signature Verification Passed!');
  } else {
      console.error('Signature Verification Failed!');
  }

} else {
  console.error('Checksum Mismatch! The app.asar has changed since the seal was generated.');
}
