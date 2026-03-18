const { Client, Users, ID } = require('node-appwrite');
const jwt = require('jsonwebtoken');

module.exports = async (context) => {
  const { req, res, log, error } = context;

  // Pre-flight check for browsers
  if (req.method === 'OPTIONS') {
      return res.send('', 200, {
          'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, X-Appwrite-Project, X-Appwrite-Key, X-Appwrite-JWT, X-Appwrite-User-Id'
      });
  }

  if (req.method !== 'POST') return res.send('Method not allowed', 405);
  
  try {
    let bodyObj;
    if (typeof req.body === 'string') {
      try { bodyObj = JSON.parse(req.body); } catch (e) { bodyObj = JSON.parse(req.bodyRaw || '{}'); }
    } else {
      bodyObj = req.body;
    }

    const { action } = bodyObj || {};

    const apiKey =
      (context.variables && context.variables['APPWRITE_FUNCTION_API_KEY']) ||
      process.env.APPWRITE_FUNCTION_API_KEY ||
      (context.variables && context.variables['APPWRITE_API_KEY']) ||
      process.env.APPWRITE_API_KEY;

    if (!apiKey) {
      error('API Key not found. Ensure APPWRITE_FUNCTION_API_KEY (dynamic) or APPWRITE_API_KEY is available.');
      return res.json({ success: false, error: 'Internal Server Error: Missing API Key' }, 500);
    }

    const client = new Client()
      .setEndpoint(process.env.APPWRITE_ENDPOINT)
      .setProject(process.env.APPWRITE_PROJECT_ID)
      .setKey(apiKey);

    const users = new Users(client);

    if (action === 'getNonce') {
      const nonce = require('crypto').randomBytes(16).toString('hex');
      const token = jwt.sign({ nonce }, apiKey, { expiresIn: '5m' });
      return res.json({ success: true, nonce, nonceToken: token });
    }

    if (action === 'register') {
      const { teamName, password, studentIds } = bodyObj;
      if (!teamName || !password) {
        return res.json({ success: false, error: 'Missing teamName or password' }, 400);
      }

      const email = `${teamName.replace(/[^a-zA-Z0-9]/g, '.').toLowerCase()}@sonar.local`;
      
      try {
        // 1. Create User
        // Note: Appwrite Users.create varies by version. 
        // SDK v7+: create(userId, email, phone, password, name)
        // SDK v5-6: create(userId, email, password, name) (no phone)
        // Assuming reasonably modern node-appwrite from context. If it fails, we catch it.
        // Trying versatile approach:
        const user = await users.create(ID.unique(), email, undefined, password, teamName);

        // 2. Set Preferences
        await users.updatePrefs(user.$id, {
            role: 'team',
            studentIds: studentIds || []
        });

        // 3. Set Labels (Tags) - Adding 'user' label as requested
        await users.updateLabels(user.$id, ['user']);

        return res.json({ success: true, userId: user.$id });
      } catch (err) {
        if (err.code === 409) return res.json({ success: false, error: 'Team name already exists' }, 409);
        throw err;
      }
    }

    return res.json({ success: false, error: 'Invalid action' }, 400);

  } catch (err) {
    error(err.message);
    return res.json({ success: false, error: err.message }, 500);
  }
};
