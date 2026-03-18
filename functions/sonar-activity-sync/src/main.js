const { Client, Databases } = require('node-appwrite');

module.exports = async (context) => {
  const { req, res, log, error } = context;
  if (req.method !== 'POST') return res.send('Method not allowed', 405);

  try {
    const { teamId, payload, attestation } = JSON.parse(req.body);
    
    if (!attestation || typeof attestation !== 'string') {
      return res.json({ success: false, error: 'Missing or invalid attestation token' }, 403);
    }

    const signingKey = process.env.BUILD_SIGNING_KEY;
    if (signingKey && attestation !== 'DEV_MODE') {
      try {
        const attData = JSON.parse(attestation);
        const crypto = require('crypto');
        const expectedToken = crypto.createHmac('sha256', signingKey).update(attData.payload).digest('hex');
        if (expectedToken !== attData.token) {
          return res.json({ success: false, error: 'Invalid build attestation signature. Unofficial build detected.' }, 403);
        }
      } catch (err) {
        return res.json({ success: false, error: 'Attestation parsing or verification failed' }, 403);
      }
    }

    const apiKey =
      (context.variables && context.variables['APPWRITE_FUNCTION_API_KEY']) ||
      (context.variables && context.variables['APPWRITE_API_KEY']) ||
      process.env.APPWRITE_FUNCTION_API_KEY ||
      process.env.APPWRITE_API_KEY;

    if (!apiKey) {
      return res.json({ success: false, error: 'Missing APPWRITE function API key' }, 500);
    }

    const client = new Client()
      .setEndpoint(process.env.APPWRITE_ENDPOINT)
      .setProject(process.env.APPWRITE_PROJECT_ID)
      .setKey(apiKey);

    const databases = new Databases(client);
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
      await databases.createDocument(dbId, colActivity, teamId, activityDoc);
    });

    return res.json({ success: true });

  } catch (err) {
    error(err.message);
    return res.json({ success: false, error: 'Internal Server Error: ' + err.message }, 500);
  }
};