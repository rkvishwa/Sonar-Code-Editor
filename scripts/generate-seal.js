const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

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

  fs.writeFileSync(sealPath, checksum, 'utf8');
  console.log(`Seal generated successfully at ${sealPath}`);
};