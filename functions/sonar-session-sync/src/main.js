const { Client, Databases, Query } = require('node-appwrite');
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
    const { teamId, teamName, status, attestation, devKey, buildType } = bodyObj || {};
    const normalizedBuildType = (buildType === 'dev' || buildType === 'official') ? buildType : 'unknown';

    if (!teamId) {
      return res.json({ success: false, error: 'Missing teamId' }, 400);
    }

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

    // Strict ownership check: You can only update your own session
    // If admin access is needed, we would fetch user prefs here
    if (userId !== teamId) {
      // Allow if admin? For now, enforcing strict ownership
      // To check admin, we'd need to fetch user details which adds latency
      return res.json({ success: false, error: 'Forbidden: not your team' }, 403);
    }

    const dbId = process.env.DB_ID || 'devwatch_db';
    const colSessions = process.env.COL_SESSIONS || 'sessions';

    const sessionData = {
      teamId,
      teamName: teamName || 'Unknown',
      status: status || 'online',
      lastSeen: new Date().toISOString(),
      buildType: normalizedBuildType,
    };

    const upsertSessionDoc = async (data) => {
      const isDocumentNotFoundError = (err) => {
        const msg = String(err?.message || '').toLowerCase();
        return (
          msg.includes('not found') ||
          msg.includes('could not be found') ||
          msg.includes('requested id')
        );
      };

      const findExistingByTeamId = async () => {
        const list = await databases.listDocuments(dbId, colSessions, [
          Query.equal('teamId', teamId),
          Query.limit(1),
        ]);
        return list.documents && list.documents.length > 0 ? list.documents[0].$id : null;
      };

      const existingDocId = await findExistingByTeamId();
      if (existingDocId) {
        try {
          await databases.updateDocument(dbId, colSessions, existingDocId, data);
          return;
        } catch (updateErr) {
          const notFound = isDocumentNotFoundError(updateErr);
          if (!notFound) {
            throw updateErr;
          }
          // The found doc is gone (race condition), fallback to create logic
        }
      }

      try {
        await databases.updateDocument(dbId, colSessions, teamId, data);
        return;
      } catch (updateErr) {
        const notFound = isDocumentNotFoundError(updateErr);
        if (!notFound) {
          throw updateErr;
        }
      }

      try {
        await databases.createDocument(dbId, colSessions, teamId, data);
      } catch (createErr) {
        // If create races/duplicates with an existing teamId row, re-query and update that row.
        const recoveredDocId = await findExistingByTeamId();
        if (!recoveredDocId) {
          throw createErr;
        }
        await databases.updateDocument(dbId, colSessions, recoveredDocId, data);
      }
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