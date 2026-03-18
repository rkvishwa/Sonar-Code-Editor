const { Client, Databases, Query } = require('node-appwrite');

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
    const { action, settingType } = bodyObj || {};

    const client = new Client()
      .setEndpoint(process.env.APPWRITE_ENDPOINT)
      .setProject(process.env.APPWRITE_PROJECT_ID)
      .setKey(context.variables && context.variables['APPWRITE_API_KEY'] ? context.variables['APPWRITE_API_KEY'] : process.env.APPWRITE_API_KEY);
    const databases = new Databases(client);
    
    const dbId = process.env.DB_ID;

    if (action === 'updateSetting') {
      const colSettings = process.env.COL_SETTINGS || 'settings';
      const key = String(settingType || '').trim();
      const val = String(bodyObj.settingValue);
      if (!key) return res.json({ success: false, error: 'Missing settingType' }, 400);

      const settingsResult = await databases.listDocuments(dbId, colSettings, [
        Query.equal('settingType', key),
        Query.limit(1),
      ]);

      if (settingsResult.documents.length > 0) {
        await databases.updateDocument(dbId, colSettings, settingsResult.documents[0].$id, {
          settingValue: val
        });
      } else {
        const { ID } = require('node-appwrite');
        await databases.createDocument(dbId, colSettings, ID.unique(), {
          settingType: key,
          settingValue: val
        });
      }
      return res.json({ success: true });
    }

    if (action === 'getSetting') {
      const colSettings = process.env.COL_SETTINGS || 'settings';
      const key = String(settingType || '').trim();
      if (!key) return res.json({ success: false, error: 'Missing settingType' }, 400);

      const settingsResult = await databases.listDocuments(dbId, colSettings, [
        Query.equal('settingType', key),
        Query.limit(1),
      ]);

      const value = settingsResult.documents.length > 0 && String(settingsResult.documents[0].settingValue).toLowerCase() === 'true';
      return res.json({ success: true, value });
    }


    if (action === 'flushActivityLogs') {
      const colLogs = process.env.COL_ACTIVITY_LOGS || 'activity_logs';
      let hasMore = true;
      while (hasMore) {
        const resList = await databases.listDocuments(dbId, colLogs, [
          Query.limit(100)
        ]);
        if (resList.documents.length === 0) {
          hasMore = false;
          break;
        }
        for (const doc of resList.documents) {
          await databases.deleteDocument(dbId, colLogs, doc.$id);
        }
      }

      try {
        const colSettings = process.env.COL_SETTINGS || 'settings';
        const flushDocs = await databases.listDocuments(dbId, colSettings, [
          Query.equal('settingType', 'latestActivityLogFlush'),
          Query.limit(1)
        ]);
        const now = new Date().toISOString();
        if (flushDocs.documents.length > 0) {
          await databases.updateDocument(dbId, colSettings, flushDocs.documents[0].$id, {
            settingValue: now
          });
        } else {
          const { ID } = require('node-appwrite');
          await databases.createDocument(dbId, colSettings, ID.unique(), {
            settingType: 'latestActivityLogFlush',
            settingValue: now
          });
        }
      } catch (err) {
        console.error('Failed to notify clients of flush:', err);
      }

      return res.json({ success: true });
    }


    if (action === 'flushActivityLogs') {
      const colLogs = process.env.COL_ACTIVITY_LOGS || 'activity_logs';
      let hasMore = true;
      while (hasMore) {
        const resList = await databases.listDocuments(dbId, colLogs, [
          Query.limit(100)
        ]);
        if (resList.documents.length === 0) {
          hasMore = false;
          break;
        }
        for (const doc of resList.documents) {
          await databases.deleteDocument(dbId, colLogs, doc.$id);
        }
      }

      try {
        const colSettings = process.env.COL_SETTINGS || 'settings';
        const flushDocs = await databases.listDocuments(dbId, colSettings, [
          Query.equal('settingType', 'latestActivityLogFlush'),
          Query.limit(1)
        ]);
        const now = new Date().toISOString();
        if (flushDocs.documents.length > 0) {
          await databases.updateDocument(dbId, colSettings, flushDocs.documents[0].$id, {
            settingValue: now
          });
        } else {
          const { ID } = require('node-appwrite');
          await databases.createDocument(dbId, colSettings, ID.unique(), {
            settingType: 'latestActivityLogFlush',
            settingValue: now
          });
        }
      } catch (err) {
        console.error('Failed to notify clients of flush:', err);
      }

      return res.json({ success: true });
    }

    if (action === 'listDocuments') {
      const { collectionId, queries } = bodyObj;
      if (!collectionId) return res.json({ success: false, error: 'Missing collectionId' }, 400);
      try {
        const result = await databases.listDocuments(dbId, collectionId, queries || []);
        return res.json({ success: true, documents: result.documents });
      } catch (err) {
        return res.json({ success: false, error: err.message }, 500);
      }
    }

    return res.json({ success: false, error: 'Unknown action' }, 400);
  } catch (err) {
    error(err.message);
    return res.json({ success: false, error: err.message }, 500);
  }
};
