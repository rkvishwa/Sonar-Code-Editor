const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });

exports.default = async function(context) {
  const { appOutDir, packager } = context;
  const platform = context.electronPlatformName;
  const productName = packager.appInfo.productFilename;
  
  console.log("Generating ASAR integrity seal...");

  let resourcesDir;
  if (platform === 'darwin') {
    resourcesDir = path.join(appOutDir, `${productName}.app`, 'Contents', 'Resources');
  } else {
    resourcesDir = path.join(appOutDir, 'resources');
  }

  const asarPath = path.join(resourcesDir, 'app.asar');
  const sealPath = path.join(resourcesDir, 'integrity.seal');

  if (!fs.existsSync(asarPath)) {
    console.warn(`No app.asar found at ${asarPath}, skipping seal generation.`);
    return;
  }

  const hash = crypto.createHash('sha256');
  const asarBuffer = fs.readFileSync(asarPath);
  hash.update(asarBuffer);
  const checksum = hash.digest('hex');

  // Sign the checksum with a private key loaded from environment only.
  const privateKey = process.env.SEAL_PRIVATE_KEY;
  if (!privateKey) {
    throw new Error('Missing required env var: SEAL_PRIVATE_KEY');
  }
  const normalizedPrivateKey = privateKey.replace(/\\n/g, '\n');

  if (normalizedPrivateKey.includes('BEGIN OPENSSH PRIVATE KEY')) {
    throw new Error(
      'SEAL_PRIVATE_KEY is OpenSSH format. Use an RSA PEM private key (BEGIN PRIVATE KEY or BEGIN RSA PRIVATE KEY).'
    );
  }

  let keyForSigning;
  try {
    keyForSigning = crypto.createPrivateKey(normalizedPrivateKey);
  } catch (err) {
    throw new Error(
      `Invalid SEAL_PRIVATE_KEY format. Expected RSA PEM key. Underlying error: ${err.message}`
    );
  }

  const sign = crypto.createSign('SHA256');
  sign.update(checksum);
  sign.end();
  const signature = sign.sign(keyForSigning, 'hex');

  // We write the original checksum and the signature
  const sealContent = JSON.stringify({ checksum, signature });
  fs.writeFileSync(sealPath, sealContent, 'utf8');
  console.log(`Seal generated successfully at ${sealPath}`);
};