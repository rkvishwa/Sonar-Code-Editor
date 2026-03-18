const { Client, Databases, ID } = require('node-appwrite');

module.exports = async (context) => {
  const { req, res, log, error } = context;
  if (req.method !== 'POST') return res.send('Method not allowed', 405);

  try {
    const { teamId, payload, attestation } = JSON.parse(req.body);
    
    if (!attestation || typeof attestation !== 'string') {
      return res.json({ success: false, error: 'Missing or invalid attestation token' }, 403);
    }

    const signingKey = process.env.BUILD_SIGNING_KEY;
    if (signingKey) {
      if (attestation === 'DEV_MODE') {
        return res.json({ success: false, error: 'Unofficial DEV client build not permitted.' }, 403);
      }
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

    // Batch insert logs
    const promises = payload.map(logData => 
      databases.createDocument(dbId, colActivity, ID.unique(), {
        teamId,
        ...logData
      })
    );

    await Promise.all(promises);

    return res.json({ success: true });

  } catch (err) {
    error(err.message);
    return res.json({ success: false, error: 'Internal Server Error' }, 500);
  }
};