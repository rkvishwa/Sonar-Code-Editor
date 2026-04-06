const { Client, Databases, Query, Users } = require('node-appwrite');
const jwt = require('jsonwebtoken');
const { randomInt } = require('node:crypto');

const HACKATHON_ID_LENGTH = 12;

function normalizeHackathonId(value) {
  return String(value || '').replace(/\D+/g, '');
}

function getLuhnChecksum(value) {
  let sum = 0;
  const parity = value.length % 2;

  for (let index = 0; index < value.length; index += 1) {
    let digit = Number(value[index] || 0);

    if (index % 2 === parity) {
      digit *= 2;
      if (digit > 9) {
        digit -= 9;
      }
    }

    sum += digit;
  }

  return sum;
}

function calculateLuhnCheckDigit(baseDigits) {
  const normalizedBase = normalizeHackathonId(baseDigits);
  const sum = getLuhnChecksum(`${normalizedBase}0`);
  return String((10 - (sum % 10)) % 10);
}

function isValidHackathonId(value) {
  const normalized = normalizeHackathonId(value);
  return (
    normalized.length === HACKATHON_ID_LENGTH &&
    /^\d+$/.test(normalized) &&
    getLuhnChecksum(normalized) % 10 === 0
  );
}

function generateHackathonId() {
  let value = String(randomInt(1, 10));

  while (value.length < HACKATHON_ID_LENGTH - 1) {
    value += String(randomInt(0, 10));
  }

  return `${value}${calculateLuhnCheckDigit(value)}`;
}

async function generateAvailableHackathonId(databases, dbId, collectionId) {
  for (let attempt = 0; attempt < 25; attempt += 1) {
    const candidate = generateHackathonId();
    const conflict = await findHackathonByPublicId(
      databases,
      dbId,
      collectionId,
      candidate,
    );

    if (!conflict) {
      return candidate;
    }
  }

  throw new Error('Unable to generate a unique hackathon ID right now.');
}

function isAdminUser(user) {
  const prefsRole = String(user?.prefs?.role || '').toLowerCase();
  const labels = Array.isArray(user?.labels) ? user.labels : [];
  return prefsRole === 'admin' || labels.includes('admin');
}

async function findHackathonByPublicId(databases, dbId, collectionId, hackathonId, currentRecordId) {
  const normalizedHackathonId = normalizeHackathonId(hackathonId);
  if (!normalizedHackathonId) {
    return null;
  }

  const result = await databases.listDocuments(dbId, collectionId, [
    Query.equal('hackathonId', normalizedHackathonId),
    Query.limit(10),
  ]);

  const documents = Array.isArray(result?.documents) ? result.documents : [];
  if (!currentRecordId) {
    return documents[0] || null;
  }

  return documents.find((doc) => doc.$id !== currentRecordId) || null;
}

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
    const { action, settingType, attestation, devKey } = bodyObj || {};

    // Verify Access Shared Logic
    const apiKey =
      (context.variables && context.variables['APPWRITE_FUNCTION_API_KEY']) ||
      process.env.APPWRITE_FUNCTION_API_KEY ||
      (context.variables && context.variables['APPWRITE_API_KEY']) ||
      process.env.APPWRITE_API_KEY;
    
    if (!apiKey) {
       error('API Key not found.');
       return res.json({ success: false, error: 'Internal Server Error' }, 500);
    }
    
    const { verifyAccess } = require('./verify');
    const client = new Client()
       .setEndpoint(process.env.APPWRITE_ENDPOINT || 'https://cloud.appwrite.io/v1')
       .setProject(process.env.APPWRITE_PROJECT_ID)
       .setKey(apiKey);
    const databases = new Databases(client);

    const isAccessValid = await verifyAccess(req, process.env, databases);
    
    if (!isAccessValid) {
       return res.json({ success: false, error: 'Forbidden: Invalid Build Attestation or Developer Key' }, 403);
    }
    
    const dbId = process.env.DB_ID || 'devwatch_db';

    const adminOnlyActions = new Set([
      'flushActivityLogs',
      'listDocuments',
    ]);
    const settingsActions = new Set([
      'updateSetting',
      'getSetting',
      'getSettingValue',
    ]);
    const hostActions = new Set([
      'listHackathons',
      'findHackathonByPublicId',
      'createHackathon',
      'updateHackathon',
      'deleteHackathon',
    ]);

    let currentUser = null;
    let currentUserIsAdmin = false;

    if (adminOnlyActions.has(action) || settingsActions.has(action) || hostActions.has(action)) {
      const userId = req.headers['x-appwrite-user-id'];
      if (!userId) {
         // No user context - 401
         return res.json({ success: false, error: 'Unauthorized: missing user context' }, 401);
      }

      const users = new Users(client);
      currentUser = await users.get(userId);
      currentUserIsAdmin = isAdminUser(currentUser);

      if (adminOnlyActions.has(action) && !currentUserIsAdmin) {
         return res.json({ success: false, error: 'Forbidden: admin only' }, 403);
      }
    }

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

    if (action === 'getSettingValue') {
      const colSettings = process.env.COL_SETTINGS || 'settings';
      const key = String(settingType || '').trim();
      if (!key) return res.json({ success: false, error: 'Missing settingType' }, 400);

      const settingsResult = await databases.listDocuments(dbId, colSettings, [
        Query.equal('settingType', key),
        Query.limit(1),
      ]);

      const value =
        settingsResult.documents.length > 0
          ? String(settingsResult.documents[0].settingValue ?? '')
          : null;
      return res.json({ success: true, value });
    }

    if (action === 'listAdmins') {
      // Return list of user IDs who are admins
      // This allows the dashboard to filter out admin sessions without needing a 'teams' collection
      try {
        const users = new Users(client);
        // Note: Querying users by label might require specific Appwrite version
        // Fallback: list users and filter by label in memory if query not supported or limited
        const result = await users.list([
          // Query.equal('labels', 'admin') // Ideally this works
        ]);
        
        // Manual filter to be safe across versions
        const adminIds = result.users
          .filter(u => u.labels && u.labels.includes('admin') || (u.prefs && u.prefs.role === 'admin'))
          .map(u => u.$id);
          
        return res.json({ success: true, adminIds });
      } catch (err) {
        return res.json({ success: false, error: err.message }, 500);
      }
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

    if (hostActions.has(action)) {
      const colHackathons = process.env.COL_HACKATHONS || 'hackathons';
      const callerId = String(currentUser?.$id || '');
      const callerName = String(currentUser?.name || 'Sonar Host').trim() || 'Sonar Host';

      if (action === 'listHackathons') {
        const targetUserId =
          currentUserIsAdmin && typeof bodyObj.hostUserId === 'string' && bodyObj.hostUserId.trim()
            ? bodyObj.hostUserId.trim()
            : callerId;

        const result = await databases.listDocuments(dbId, colHackathons, [
          Query.equal('hostUserId', targetUserId),
          Query.orderDesc('$createdAt'),
          Query.limit(100),
        ]);

        return res.json({ success: true, documents: result.documents || [] });
      }

      if (action === 'findHackathonByPublicId') {
        const conflict = await findHackathonByPublicId(
          databases,
          dbId,
          colHackathons,
          bodyObj.hackathonId,
          bodyObj.currentRecordId,
        );

        return res.json({
          success: true,
          document: conflict || null,
        });
      }

      if (action === 'createHackathon') {
        const payload = bodyObj.payload || {};
        let normalizedHackathonId = normalizeHackathonId(payload.hackathonId);
        const trimmedName = String(payload.name || '').trim();

        if (!trimmedName) {
          return res.json({ success: false, error: 'Hackathon name is required.' }, 400);
        }

        if (!isValidHackathonId(normalizedHackathonId)) {
          normalizedHackathonId = await generateAvailableHackathonId(
            databases,
            dbId,
            colHackathons,
          );
        }

        const conflict = await findHackathonByPublicId(
          databases,
          dbId,
          colHackathons,
          normalizedHackathonId,
        );
        if (conflict) {
          return res.json({ success: false, error: 'That hackathon ID is already in use.' }, 409);
        }

        const { ID } = require('node-appwrite');
        const created = await databases.createDocument(dbId, colHackathons, ID.unique(), {
          hackathonId: normalizedHackathonId,
          name: trimmedName,
          slug: String(payload.slug || '').trim(),
          description: String(payload.description || '').trim(),
          status:
            payload.status === 'live' || payload.status === 'archived' ? payload.status : 'draft',
          hostUserId: callerId,
          hostName: callerName,
          startDate: payload.startDate || null,
          endDate: payload.endDate || null,
          settingsJson: typeof payload.settingsJson === 'string' ? payload.settingsJson : '',
        });

        return res.json({ success: true, document: created });
      }

      if (action === 'updateHackathon') {
        const recordId = String(bodyObj.recordId || '').trim();
        const payload = bodyObj.payload || {};
        const normalizedHackathonId = normalizeHackathonId(payload.hackathonId);
        const trimmedName = String(payload.name || '').trim();

        if (!recordId || !trimmedName) {
          return res.json({ success: false, error: 'Record ID and name are required.' }, 400);
        }

        if (!isValidHackathonId(normalizedHackathonId)) {
          return res.json({ success: false, error: 'Hackathon ID must be a valid 12-digit event ID.' }, 400);
        }

        const existing = await databases.getDocument(dbId, colHackathons, recordId);
        if (!currentUserIsAdmin && String(existing.hostUserId || '') !== callerId) {
          return res.json({ success: false, error: 'Forbidden: you can only update your own hackathons.' }, 403);
        }

        const conflict = await findHackathonByPublicId(
          databases,
          dbId,
          colHackathons,
          normalizedHackathonId,
          recordId,
        );
        if (conflict) {
          return res.json({ success: false, error: 'That hackathon ID is already in use.' }, 409);
        }

        const updated = await databases.updateDocument(dbId, colHackathons, recordId, {
          hackathonId: normalizedHackathonId,
          name: trimmedName,
          slug: String(payload.slug || '').trim(),
          description: String(payload.description || '').trim(),
          status:
            payload.status === 'live' || payload.status === 'archived' ? payload.status : 'draft',
          hostUserId: String(existing.hostUserId || callerId),
          hostName: String(existing.hostName || callerName).trim() || callerName,
          startDate: payload.startDate || null,
          endDate: payload.endDate || null,
          settingsJson: typeof payload.settingsJson === 'string' ? payload.settingsJson : '',
        });

        return res.json({ success: true, document: updated });
      }

      if (action === 'deleteHackathon') {
        const recordId = String(bodyObj.recordId || '').trim();
        if (!recordId) {
          return res.json({ success: false, error: 'Record ID is required.' }, 400);
        }

        const existing = await databases.getDocument(dbId, colHackathons, recordId);
        if (!currentUserIsAdmin && String(existing.hostUserId || '') !== callerId) {
          return res.json({ success: false, error: 'Forbidden: you can only delete your own hackathons.' }, 403);
        }

        await databases.deleteDocument(dbId, colHackathons, recordId);
        return res.json({ success: true });
      }
    }

    return res.json({ success: false, error: 'Unknown action' }, 400);
  } catch (err) {
    error(err.message);
    return res.json({ success: false, error: err.message }, 500);
  }
};
