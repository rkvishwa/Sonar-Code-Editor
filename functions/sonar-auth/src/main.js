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
    const { teamName, password } = bodyObj || {};

    const client = new Client()
      .setEndpoint(process.env.APPWRITE_ENDPOINT)
      .setProject(process.env.APPWRITE_PROJECT_ID)
      .setKey(context.variables && context.variables['APPWRITE_API_KEY'] ? context.variables['APPWRITE_API_KEY'] : process.env.APPWRITE_API_KEY);
    const databases = new Databases(client);
    
    const dbId = process.env.DB_ID;
    const colTeams = process.env.COL_TEAMS;

    if (!teamName || !password) {
      return res.json({ success: false, error: 'Missing teamName or password' }, 400);
    }

    const result = await databases.listDocuments(dbId, colTeams, [
      Query.equal('teamName', teamName)
    ]);

    if (result.documents.length === 0) {
      return res.json({ success: false, error: 'Team not found' }, 401);
    }
    
    const team = result.documents[0];
    const isMatch = await bcrypt.compare(password, team.password);
    if (!isMatch) {
      return res.json({ success: false, error: 'Invalid password' }, 401);
    }

    return res.json({
      success: true,
      teamId: team.$id,
      studentIds: team.studentIds || [],
      role: team.role || 'team'
    });

  } catch (err) {
    error(err.message);
    return res.json({ success: false, error: err.message }, 500);
  }
};
