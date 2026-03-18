const { Client, Databases } = require('node-appwrite');
const jwt = require('jsonwebtoken');

module.exports = async (context) => {
  const { req, res, log, error } = context;
  if (req.method !== 'POST') return res.send('Method not allowed', 405);

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    const { teamId, teamName, status, attestation, nonceToken } = body;
    let buildType = 'unknown';
    
    if (!attestation || typeof attestation !== 'string') {
      return res.json({ success: false, error: 'Missing or invalid attestation token' }, 403);
    }

    if (attestation === 'DEV_MODE') {
      buildType = 'dev';
    } else {
      try {
        JSON.parse(attestation);
        buildType = 'official';
      } catch {
        buildType = 'unknown';
      }
    }
    
    const signingKey = process.env.BUILD_SIGNING_KEY;
    const apiKey =
      (context.variables && context.variables['APPWRITE_FUNCTION_API_KEY']) ||
      (context.variables && context.variables['APPWRITE_API_KEY']) ||
      process.env.APPWRITE_FUNCTION_API_KEY ||
      process.env.APPWRITE_API_KEY;

    if (signingKey) {
      if (!nonceToken) {
        return res.json({ success: false, error: 'Missing nonce token. Replay attacks are blocked.' }, 403);
      }
      try {
        const decodedNonce = jwt.verify(nonceToken, apiKey);
        if (!decodedNonce.nonce) throw new Error('Invalid nonce token payload');
        
        if (attestation === 'DEV_MODE') throw new Error('Dev builds blocked by server security policy');
        const attData = JSON.parse(attestation);
        const crypto = require('crypto');
        const expectedPayload = `${attData.version}|${attData.buildTimestamp}|sonar-official|${decodedNonce.nonce}`;
        const expectedToken = crypto.createHmac('sha256', signingKey).update(expectedPayload).digest('hex');
        
        if (expectedToken !== attData.token) {
          return res.json({ success: false, error: 'Invalid build attestation signature. Unofficial build detected.' }, 403);
        }
      } catch (err) {
        return res.json({ success: false, error: 'Attestation parsing or verification failed: ' + err.message }, 403);
      }
    }

    if (!apiKey) {
      return res.json({ success: false, error: 'Missing APPWRITE function API key' }, 500);
    }

    const userId = req.headers['x-appwrite-user-id'];
    if (!userId) {
      return res.json({ success: false, error: 'Unauthorized: missing user context' }, 401);
    }

    // Strict ownership check: You can only update your own session
    // If admin access is needed, we would fetch user prefs here
    if (userId !== teamId) {
      // Allow if admin? For now, enforcing strict ownership
      // To check admin, we'd need to fetch user details which adds latency
      return res.json({ success: false, error: 'Forbidden: not your team' }, 403);
    }

    const client = new Client()
      .setEndpoint(process.env.APPWRITE_ENDPOINT)
      .setProject(process.env.APPWRITE_PROJECT_ID)
      .setKey(apiKey);

    const databases = new Databases(client);
    const dbId = process.env.DB_ID;
    const colSessions = process.env.COL_SESSIONS;

    const sessionData = {
      teamId,
      teamName,
      status,
      lastSeen: new Date().toISOString(),
      buildType,
    };

    const upsertSessionDoc = async (data) => {
      await databases.updateDocument(dbId, colSessions, teamId, data).catch(async () => {
        // Create if it doesn't exist
        await databases.createDocument(dbId, colSessions, teamId, data);
      });
    };

    try {
      await upsertSessionDoc(sessionData);
    } catch (writeErr) {
      const msg = String(writeErr?.message || '').toLowerCase();
      const schemaMismatch = msg.includes('buildtype') || msg.includes('unknown attribute') || msg.includes('document structure');
      if (!schemaMismatch) throw writeErr;

      // Backward compatible write for projects where sessions schema is not migrated yet.
      await upsertSessionDoc({
        teamId,
        teamName,
        status,
        lastSeen: sessionData.lastSeen,
      });
    }

    return res.json({ success: true });

  } catch (err) {
    error(err.message);
    return res.json({ success: false, error: 'Internal Server Error: ' + err.message }, 500);
  }
};