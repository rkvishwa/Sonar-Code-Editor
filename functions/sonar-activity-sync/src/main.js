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