const { Client, Users } = require('node-appwrite');

module.exports = async (context) => {
  const { req, res, log, error } = context;

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
    const { action, teamId, studentId, oldPassword, newPassword } = bodyObj || {};

    const apiKey = 
      (context.variables && context.variables['APPWRITE_FUNCTION_API_KEY']) ||
      process.env.APPWRITE_FUNCTION_API_KEY ||
      (context.variables && context.variables['APPWRITE_API_KEY']) ||
      process.env.APPWRITE_API_KEY;

    if (!apiKey) {
      error('API Key not found. Ensure APPWRITE_FUNCTION_API_KEY (dynamic) or APPWRITE_API_KEY is available.');
      return res.json({ success: false, error: 'Internal Server Error: Missing API Key' }, 500);
    }

    const userId = req.headers['x-appwrite-user-id'];

    if (!userId) {
       return res.json({ success: false, error: 'Unauthorized: missing user context' }, 401);
    }

    const client = new Client()
      .setEndpoint(process.env.APPWRITE_ENDPOINT)
      .setProject(process.env.APPWRITE_PROJECT_ID)
      .setKey(apiKey);
    
    const users = new Users(client);

    // Verify caller permissions
    let isCallerAdmin = false;
    try {
        const caller = await users.get(userId);
        isCallerAdmin = (caller.labels && caller.labels.includes('admin')) || (caller.prefs && caller.prefs.role === 'admin');
    } catch (e) {
        return res.json({ success: false, error: 'Failed to verifying caller identity' }, 500);
    }

    // Determine target user
    const targetUserId = teamId || userId;

    if (targetUserId !== userId && !isCallerAdmin) {
        return res.json({ success: false, error: 'Forbidden: You can only modify your own team' }, 403);
    }

    if (action === 'addMember') {
      if (!studentId) {
        return res.json({ success: false, error: 'Missing studentId' }, 400);
      }
      try {
        const targetUser = await users.get(targetUserId);
        const prefs = targetUser.prefs || {};
        const currentIds = prefs.studentIds || [];
        
        if (currentIds.length >= 5) {
            return res.json({ success: false, error: 'Team already has 5 members' }, 400);
        }
        if (currentIds.includes(studentId)) {
            return res.json({ success: false, error: 'Member already exists' }, 400);
        }

        await users.updatePrefs(targetUserId, {
            ...prefs,
            studentIds: [...currentIds, studentId]
        });
        return res.json({ success: true });
      } catch (e) {
        return res.json({ success: false, error: e.message }, 500);
      }
    }

    if (action === 'updateTeamName') {
       if (!bodyObj.newName) return res.json({ success: false, error: 'Missing newName' }, 400);
       
       await users.updateName(targetUserId, bodyObj.newName);
       return res.json({ success: true });
    }

    if (action === 'changePassword') {
      if (!newPassword) {
          return res.json({ success: false, error: 'Missing new password' }, 400);
      }
      
      await users.updatePassword(targetUserId, newPassword);
      return res.json({ success: true });
    }

    return res.json({ success: false, error: 'Invalid action' }, 400);

  } catch (err) {
    error(err.message);
    return res.json({ success: false, error: err.message }, 500);
  }
};
