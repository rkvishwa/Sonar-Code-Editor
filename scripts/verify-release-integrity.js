const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

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
  
  if (verify.verify(publicKey, signature, 'hex')) {
      console.log('Signature Verification Passed!');
  } else {
      console.error('Signature Verification Failed!');
  }

} else {
  console.error('Checksum Mismatch! The app.asar has changed since the seal was generated.');
}
