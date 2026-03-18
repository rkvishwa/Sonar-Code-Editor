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

  // Sign the checksum with the private key
  const privateKey = process.env.SEAL_PRIVATE_KEY || `-----BEGIN PRIVATE KEY-----
MIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQCh89sXO9ovDqoT
uiphrcyD1eZyx30fM/lgs5WCS4tQbGo9Wj4NsALUt3wZiBlI03O1XDL8TqQ1u3Dc
iQFbEEfAmuIykfVKySKsN/J3Gc09PeTtBZm9zEQDykg/ExAG9a3asrZqX2jcctDI
LlLu+f2BnImD3kFggFtE+5B1uwKvpaojurGpbCkn5s4G+B18VpOzIy0EXvTUQAaj
3DRepG9CtOHFZ1GVsaAjTOj8iCzAWP1zCJGUsk0LQP+2yKfCClFIocKQQ1T6QoFu
uX1Zt+KaDQgYDVfBrd7rWz9dhIjMyakm0QyESVlxWTSfVL1n4bXFXwx50hxik0M7
4euCI1GhAgMBAAECggEAMzdQmozhh48uJxXxMDnL2wdqnPLMdXE01KmGRxHH6XOX
t3ZR+Hcotgeetd5ODLNePMT/FL5z/NAdtYiYRqmj31u72/0/otpv3iHFSnf86Xio
7HIgeB7ghYhTh6rqHyFTzT1GJeatXUXsE9pefNfPHU2ZSXwglbmR44Ng4HJ3O396
N9N051mrQfMOXFK+31iOhHTzeTjKiTC8T5cUu+NOHajQVOBxcS8ZJ09wMK8Tblch
H4m25BoqDqev9v+XPbCcKO6SCY/3UmVSgQxSrHlr3uTf7zt8RXCAci6rGlKRCR6g
2F8phNNKdd3Xop8WMAbotoDjZaMnNphgBsscbrkYNwKBgQDQgad1pts9HnX8o9Gr
wC/O9JZlBzuefuJC0UvxC0D8On6i40fO1LLYIINUQo5mGnIq5hgqjplBL0SmQnQU
kaYiJ/qaS/M+/QomsHZXdloXKHL2kDdVqaBx2E2Vf8M2GyPlwOq7RX2EOfz6Rfx3
9jCp/CZGiCW3RYG9INnrGw+GrwKBgQDG15G3IvCLDeCZXdmR0Wdgg6/qyctAnnYv
R8KP7szOHAgMrS976l+r/3HxqTE6gp4baZu+P8/CpT0rv/3P4HUoUjTBCkPPO5h6
e6zXO8lZ4E2Royplg/4ccFCzPDum80oy5iGVUrjk0itja2zgbCNg9bl7SePrM/yC
/ztFi23ArwKBgHmVoVjx25ZgVNzlijZk83vzFGAFP7bEtpvQAECnF1X9pirF7fGm
BkQRcYOI7BCOC1UIp77pOGTSc22gAqCb7gys0212LHnmhCzbaabG1PH8HE26+wlw
yKaaQ2OSBPtgCCbJwBdEBlU8m1A1z2sEnIwDBS7L5XJhja4Dog9+0CbxAoGAHFT2
5DtMPuP5TqD6sTY/Hpdk53VdSpXJjS8SX+PMtslztCqxC1z3yNAa8i4DX6zgzlMb
5927wqY8sxEmHwqCZv5fmenWg56gOUOJ+xj/tZiqNMgk8FYATRkLxp4cectMlTgJ
LPeedKwlloLl/owp9lTM2u5KVWcQ4bFwRpZ5Su0CgYEAq9qNB8oA1fLqcfP01d9b
af7qwthil4TO1f63jwF/UKYrvV9Wg3bnbacmJrz5yI6PCSbJc6/geJPCh0OPepdX
+rL6gBT0AEbZaJ2cY/ueX01vugzgL1h3ykJZEm1rpN9XDH5n6DpjDeTGC3Y4vRr8
x6uQFd0p63uU2kQiEhGYXLE=
-----END PRIVATE KEY-----`;

  const sign = crypto.createSign('SHA256');
  sign.update(checksum);
  sign.end();
  const signature = sign.sign(privateKey, 'hex');

  // We write the original checksum and the signature
  const sealContent = JSON.stringify({ checksum, signature });
  fs.writeFileSync(sealPath, sealContent, 'utf8');
  console.log(`Seal generated successfully at ${sealPath}`);
};