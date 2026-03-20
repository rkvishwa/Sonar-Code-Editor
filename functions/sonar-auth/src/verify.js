const crypto = require('crypto');
const { Query } = require('node-appwrite');

async function verifyAccess(req, env, databases) {
  let body = {};
  if (typeof req.body === 'string') {
      try { body = JSON.parse(req.body); } catch(e) { body = JSON.parse(req.bodyRaw || '{}'); }
  } else {
      body = req.body || {};
  }

  const { attestation, devUser, timestamp, signature, type } = body;
  const dbId = env.APPWRITE_DB_NAME || 'devwatch_db'; 
  
  // Debug Log
  console.log(`VerifyAccess: User=${devUser}, Type=${type}, NODE_ENV=${env.NODE_ENV}, DB=${dbId}`);

  // Log Request
  if (databases) {
      const logCollectionId = env.APPWRITE_COLLECTION_API_LOGS || 'api_logs';
      try {
        await databases.createDocument(
            dbId,
            logCollectionId,
            'unique()',
            {
                path: req.path,
                method: req.method,
                ip: req.headers['x-forwarded-for'] || req.headers['x-real-ip'] || '',
                timestamp: new Date().toISOString(),
                user: devUser || 'unknown',
                type: type || 'unknown'
            }
        ).catch((err) => console.log('Log write failed:', err.message)); 
      } catch (e) { console.log('Log block failed:', e.message); }
  }

  // 1. Official Build
  if (type === 'build' || (!type && attestation)) {
      if (!attestation || !attestation.token || !attestation.payload) return false;
      if (!env.BUILD_SIGNING_KEY) {
          console.error("Missing BUILD_SIGNING_KEY");
          return false;
      }
      const expectedToken = crypto.createHmac('sha256', env.BUILD_SIGNING_KEY)
        .update(attestation.payload)
        .digest('hex');
      return attestation.token === expectedToken;
  }

  // 2. Developer Access
  if (type === 'dev') {
      if (env.NODE_ENV !== 'development') {
          console.warn(`Dev access blocked: NODE_ENV is '${env.NODE_ENV}', expected 'development'`);
          return false;
      }
      if (!devUser || !timestamp || !signature || !databases) {
          console.warn('Dev access blocked: Missing required fields or database client');
          return false;
      }

      // Check replay (5 min)
      const sentTime = parseInt(timestamp);
      if (isNaN(sentTime) || Math.abs(Date.now() - sentTime) > 300000) {
          console.warn('Dev access blocked: Timestamp replay check failed');
          return false;
      }

      try {
          // Ensure dbId is a string
          const safeDbId = String(dbId);
          const docs = await databases.listDocuments(
              safeDbId,
              'development_keys',
              [ Query.equal('user_name', devUser) ]
          );
          if (docs.total === 0) {
              console.warn(`Dev access blocked: No key found for user ${devUser}`);
              return false;
          }
          
          const keyDoc = docs.documents[0];
          if (keyDoc.expire_time) {
             if (new Date(keyDoc.expire_time).getTime() < Date.now()) {
                 console.warn('Dev access blocked: Key expired');
                 return false;
             }
          }

          const secret = keyDoc.generated_key;
          const expectedSig = crypto.createHmac('sha256', secret)
             .update(String(timestamp))
             .digest('hex');
          
          if (signature === expectedSig) {
              return true;
          }
          console.warn('Dev access blocked: Invalid signature');
      } catch (e) {
          console.error('DB Verify Error Stack:', e.stack);
          console.error('DB Verify Error Message:', e.message);
          return false;
      }
  }

  return false;
}

module.exports = { verifyAccess };