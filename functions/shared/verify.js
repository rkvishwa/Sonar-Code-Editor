// Helper to verify access
// Checks if the request has a valid build attestation or a valid developer key
const crypto = require('crypto');

function verifyAccess(req, env) {
  const { attestation, devKey } = req.bodySource || JSON.parse(req.body || '{}');
  
  // 1. Developer Override
  if (devKey && env.BUILD_SIGNING_KEY && devKey === env.BUILD_SIGNING_KEY) {
    return true; // Valid Developer
  }

  // 2. Official Build Verification
  if (attestation && attestation.token && attestation.payload) {
    // attestation.token is signed with BUILD_SIGNING_KEY
    // attestation.payload contains version|timestamp|sonar-official
    if (!env.BUILD_SIGNING_KEY) {
       console.error("BUILD_SIGNING_KEY missing in environment");
       return false;
    }

    const expectedToken = crypto.createHmac('sha256', env.BUILD_SIGNING_KEY)
      .update(attestation.payload)
      .digest('hex');
      
    if (attestation.token === expectedToken) {
       return true; // Valid Official Build
    }
    
    console.warn("Invalid attestation token provided");
  }

  return false;
}

module.exports = { verifyAccess };
