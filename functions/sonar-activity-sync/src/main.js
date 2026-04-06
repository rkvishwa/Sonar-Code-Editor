const { Client, Databases } = require('node-appwrite');
const jwt = require('jsonwebtoken');

module.exports = async (context) => {
  const { req, res, log, error } = context;
  if (req.method !== 'POST') return res.send('Method not allowed', 405);

  try {
    let bodyObj;
    if (typeof req.body === 'string') {
      try { bodyObj = JSON.parse(req.body); } catch (e) { bodyObj = JSON.parse(req.bodyRaw || '{}'); }
    } else {
      bodyObj = req.body;
    }
    const { teamId, payload } = bodyObj || {};

    const { verifyAccess } = require('./verify');

    // Initialize Appwrite SDK
    const apiKey =
      (context.variables && context.variables['APPWRITE_FUNCTION_API_KEY']) ||
      (context.variables && context.variables['APPWRITE_API_KEY']) ||
      process.env.APPWRITE_FUNCTION_API_KEY ||
      process.env.APPWRITE_API_KEY;

    if (!apiKey) {
      error('API Key not found.');
      return res.json({ success: false, error: 'Internal Server Error: No API Key' }, 500);
    }
    
    // Explicitly import Permission/Role from node-appwrite
    const { Permission, Role } = require('node-appwrite');

    const client = new Client()
      .setEndpoint(process.env.APPWRITE_ENDPOINT || 'https://cloud.appwrite.io/v1')
      .setProject(process.env.APPWRITE_PROJECT_ID)
      .setKey(apiKey);
    
    const databases = new Databases(client);

    // SECURITY: Verify Access
    const isAccessValid = await verifyAccess(req, process.env, databases);
    if (!isAccessValid) {
      return res.json({ success: false, error: 'Forbidden: Invalid Build Attestation or Developer Key' }, 403);
    }
    
    const userId = req.headers['x-appwrite-user-id'];
    if (!userId) {
      return res.json({ success: false, error: 'Unauthorized: missing user context' }, 401);
    }
    
    // Strict ownership: You can only log activity for your own account
    if (userId !== teamId) {
      return res.json({ success: false, error: 'Forbidden: not your team' }, 403);
    }
    
    const dbId = process.env.DB_ID || 'devwatch_db';
    const colActivity = process.env.COL_ACTIVITY_LOGS || 'activityLogs';

    if (!Array.isArray(payload) || payload.length === 0) {
      return res.json({ success: false, error: 'Missing or invalid payload' }, 400);
    }

    // Keep one up-to-date activity row per team so admin dashboards can read latest state quickly.
    const latest = payload[payload.length - 1] || {};
    const { activityEvents, ...rest } = latest;

    const activityDoc = {
      teamId,
      teamName: rest.teamName || '',
      ...(rest.hackathonId ? { hackathonId: String(rest.hackathonId).trim().toLowerCase() } : {}),
      currentWindow: rest.currentWindow || '',
      currentFile: rest.currentFile || '',
      status: rest.status || 'online',
      timestamp: rest.timestamp || new Date().toISOString(),
      event: rest.event,
      appName: rest.appName,
      ...((rest.windowTitle || activityEvents) ? { windowTitle: rest.windowTitle || JSON.stringify(activityEvents) } : {}),
    };

    const legacyActivityDoc = {
      teamId,
      teamName: activityDoc.teamName,
      currentWindow: activityDoc.currentWindow,
      currentFile: activityDoc.currentFile,
      status: activityDoc.status,
      timestamp: activityDoc.timestamp,
      event: activityDoc.event,
      appName: activityDoc.appName,
      ...(activityDoc.windowTitle ? { windowTitle: activityDoc.windowTitle } : {}),
    };

    const upsertActivityDoc = async (doc) => {
      await databases.updateDocument(dbId, colActivity, teamId, doc).catch(async () => {
        await databases.createDocument(dbId, colActivity, teamId, doc, [
          Permission.read(Role.users()),
          Permission.update(Role.user(userId)),
          Permission.delete(Role.user(userId)),
        ]);
      });
    };

    try {
      await upsertActivityDoc(activityDoc);
    } catch (writeErr) {
      const msg = String(writeErr?.message || '').toLowerCase();
      const schemaMismatch = msg.includes('hackathonid') || msg.includes('unknown attribute') || msg.includes('document structure');
      if (!schemaMismatch) throw writeErr;
      await upsertActivityDoc(legacyActivityDoc);
    }

    return res.json({ success: true });

  } catch (err) {
    error(err.message);
    return res.json({ success: false, error: 'Internal Server Error: ' + err.message }, 500);
  }
};
