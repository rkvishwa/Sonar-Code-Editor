const { Client, Databases } = require('node-appwrite');
const jwt = require('jsonwebtoken');

module.exports = async (context) => {
  const { req, res, log, error } = context;
  if (req.method !== 'POST') return res.send('Method not allowed', 405);

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    const { teamId, payload, attestation, nonceToken } = body;
    
    if (!attestation || typeof attestation !== 'string') {
      return res.json({ success: false, error: 'Missing or invalid attestation token' }, 403);
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
    
    // Strict ownership: You can only log activity for your own account
    if (userId !== teamId) {
      return res.json({ success: false, error: 'Forbidden: not your team' }, 403);
    }

    const client = new Client()
      .setEndpoint(process.env.APPWRITE_ENDPOINT)
      .setProject(process.env.APPWRITE_PROJECT_ID)
      .setKey(apiKey);

    const databases = new Databases(client);
    // Explicitly import Permission/Role from node-appwrite
    const { Permission, Role } = require('node-appwrite');

    const dbId = process.env.DB_ID;
    const colActivity = process.env.COL_ACTIVITY_LOGS;

    if (!Array.isArray(payload) || payload.length === 0) {
      return res.json({ success: false, error: 'Missing or invalid payload' }, 400);
    }

    // Keep one up-to-date activity row per team so admin dashboards can read latest state quickly.
    const latest = payload[payload.length - 1] || {};
    const { activityEvents, ...rest } = latest;

    const activityDoc = {
      teamId,
      teamName: rest.teamName || '',
      currentWindow: rest.currentWindow || '',
      currentFile: rest.currentFile || '',
      status: rest.status || 'online',
      timestamp: rest.timestamp || new Date().toISOString(),
      event: rest.event,
      appName: rest.appName,
      ...((rest.windowTitle || activityEvents) ? { windowTitle: rest.windowTitle || JSON.stringify(activityEvents) } : {}),
    };

    await databases.updateDocument(dbId, colActivity, teamId, activityDoc).catch(async () => {
      // Ensure "users" can read, and owner can update
      await databases.createDocument(dbId, colActivity, teamId, activityDoc, [
        Permission.read(Role.users()),
        Permission.update(Role.user(userId)),
        Permission.delete(Role.user(userId)),
      ]);
    });

    return res.json({ success: true });

  } catch (err) {
    error(err.message);
    return res.json({ success: false, error: 'Internal Server Error: ' + err.message }, 500);
  }
};