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

    // SECURITY: Verify Access
    const signingKey = process.env.BUILD_SIGNING_KEY;
    let accessGranted = false;
    
    // 1. Developer Override
    if (signingKey && devKey && devKey === signingKey) {
       accessGranted = true;
    } 
    // 2. Official Build Verification
    else if (attestation && attestation.token && attestation.payload) {
       if (signingKey) {
          const crypto = require('crypto');
          const expectedToken = crypto.createHmac('sha256', signingKey)
             .update(attestation.payload)
             .digest('hex');
          if (attestation.token === expectedToken) {
             accessGranted = true;
          }
       }
    }

    if (!accessGranted) {
       return res.json({ success: false, error: 'Forbidden: Invalid Build Attestation or Developer Key' }, 403);
    }
    
    const apiKey =
      (context.variables && context.variables['APPWRITE_FUNCTION_API_KEY']) ||
      (context.variables && context.variables['APPWRITE_API_KEY']) ||
      process.env.APPWRITE_FUNCTION_API_KEY ||
      process.env.APPWRITE_API_KEY;

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
      teamName: teamName || 'Unknown',
      status: status || 'online',
      lastSeen: new Date().toISOString(),
      buildType: normalizedBuildType,
    };

    const upsertSessionDoc = async (data) => {
      const findExistingByTeamId = async () => {
        const list = await databases.listDocuments(dbId, colSessions, [
          Query.equal('teamId', teamId),
          Query.limit(1),
        ]);
        return list.documents && list.documents.length > 0 ? list.documents[0].$id : null;
      };

      const existingDocId = await findExistingByTeamId();
      if (existingDocId) {
        await databases.updateDocument(dbId, colSessions, existingDocId, data);
        return;
      }

      try {
        await databases.updateDocument(dbId, colSessions, teamId, data);
        return;
      } catch (updateErr) {
        const notFound = String(updateErr?.message || '').toLowerCase().includes('not found');
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