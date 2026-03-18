const { Client, Databases, Query } = require('node-appwrite');
const bcrypt = require('bcryptjs');

module.exports = async (context) => {
  const { req, res, log, error } = context;
  if (req.method !== 'POST') return res.send('Method not allowed', 405);
  
  try {
    let bodyObj;
    if (typeof req.body === 'string') {
      try {
        bodyObj = JSON.parse(req.body);
      } catch (e) {
        bodyObj = JSON.parse(req.bodyRaw || '{}');
      }
    } else {
      bodyObj = req.body;
    }
    const { action, teamId, studentId, oldPassword, newPassword } = bodyObj || {};

    const client = new Client()
      .setEndpoint(process.env.APPWRITE_ENDPOINT)
      .setProject(process.env.APPWRITE_PROJECT_ID)
      .setKey(context.variables && context.variables['APPWRITE_API_KEY'] ? context.variables['APPWRITE_API_KEY'] : process.env.APPWRITE_API_KEY);
    const databases = new Databases(client);
    
    const dbId = process.env.DB_ID;
    const colTeams = process.env.COL_TEAMS;

    if (action === 'addMember') {
      if (!teamId || !studentId) {
        return res.json({ success: false, error: 'Missing teamId or studentId' }, 400);
      }
      try {
        const teamObj = await databases.getDocument(dbId, colTeams, teamId);
        const existing = teamObj.studentIds || [];
        if (existing.length >= 5) {
          return res.json({ success: false, error: 'Team already has 5 members' }, 400);
        }
        if (existing.includes(studentId)) {
          return res.json({ success: false, error: 'Member already exists' }, 400);
        }
        await databases.updateDocument(dbId, colTeams, teamId, {
          studentIds: [...existing, studentId],
        });
        return res.json({ success: true });
      } catch (e) {
        return res.json({ success: false, error: e.message }, 500);
      }
    }


    if (action === 'updateTeamName') {
      if (!teamId || !bodyObj.newName) {
        return res.json({ success: false, error: 'Missing teamId or newName' }, 400);
      }
      try {
        await databases.updateDocument(dbId, colTeams, teamId, {
          teamName: bodyObj.newName
        });
        return res.json({ success: true });
      } catch (e) {
        return res.json({ success: false, error: e.message }, 500);
      }
    }

    if (action === 'changePassword') {
      if (!teamId || !oldPassword || !newPassword) {
        return res.json({ success: false, error: 'Missing credentials' }, 400);
      }
      try {
        const teamObj = await databases.getDocument(dbId, colTeams, teamId);
        const isMatch = await bcrypt.compare(oldPassword, teamObj.password);
        if (!isMatch) {
          return res.json({ success: false, error: 'Incorrect old password' }, 401);
        }
        const hashedNewPassword = await bcrypt.hash(newPassword, 10);
        await databases.updateDocument(dbId, colTeams, teamId, {
          password: hashedNewPassword,
        });
        return res.json({ success: true });
      } catch (e) {
        return res.json({ success: false, error: e.message }, 500);
      }
    }

    return res.json({ success: false, error: 'Unknown action' }, 400);

  } catch (err) {
    error(err.message);
    return res.json({ success: false, error: err.message }, 500);
  }
};
