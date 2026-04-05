const { Client, Users, Databases, Query } = require('node-appwrite');
const crypto = require('crypto');
const { verifyAccess } = require('./verify');

function normalizeHackathonId(value) {
  if (typeof value !== 'string') return '';
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64);
}

function normalizeStudentId(value) {
  return String(value || '').trim().toUpperCase();
}

function normalizeMemberIds(raw) {
  let value = raw;

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return [];

    if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
      try {
        value = JSON.parse(trimmed);
      } catch {
        value = trimmed;
      }
    }
  }

  if (Array.isArray(value)) {
    return value
      .map((item) => {
        if (typeof item === 'string') return normalizeStudentId(item);
        if (typeof item === 'number') return normalizeStudentId(String(item));
        if (item && typeof item === 'object') {
          const candidate = item.studentId ?? item.id ?? item.value;
          if (typeof candidate === 'string') return normalizeStudentId(candidate);
          if (typeof candidate === 'number') return normalizeStudentId(String(candidate));
        }
        return '';
      })
      .filter(Boolean);
  }

  if (typeof value === 'string') {
    return value
      .split(/[\n,]/)
      .map((id) => normalizeStudentId(id))
      .filter(Boolean);
  }

  return [];
}

function getHackathonParticipantsCollectionId() {
  return String(
    process.env.COL_HACKATHON_PARTICIPANTS ||
      process.env.VITE_APPWRITE_COLLECTION_HACKATHON_PARTICIPANTS ||
      'hackathonParticipants',
  ).trim();
}

function buildParticipantLookupId(hackathonId, studentId) {
  const seed = `${normalizeHackathonId(hackathonId)}::${normalizeStudentId(studentId)}`;
  const hash = crypto.createHash('sha256').update(seed).digest('hex').slice(0, 30);
  return `hp_${hash}`;
}

function isLookupCollectionUnavailable(err) {
  const message = String(err?.message || '').toLowerCase();
  return (
    message.includes('collection with the requested id could not be found') ||
    message.includes('table with the requested id could not be found') ||
    message.includes('attribute not found') ||
    message.includes('column not found') ||
    message.includes('document structure is invalid')
  );
}

async function findParticipantRecord(databases, dbId, collectionId, hackathonId, studentId) {
  const normalizedHackathonId = normalizeHackathonId(hackathonId);
  const normalizedStudentId = normalizeStudentId(studentId);
  if (!collectionId || !normalizedHackathonId || !normalizedStudentId) return null;

  try {
    return await databases.getDocument(
      dbId,
      collectionId,
      buildParticipantLookupId(normalizedHackathonId, normalizedStudentId),
    );
  } catch (err) {
    if (Number(err?.code) === 404 || isLookupCollectionUnavailable(err)) {
      return null;
    }
    throw err;
  }
}

async function createParticipantRecord(databases, dbId, collectionId, participant) {
  if (!collectionId) return { created: false };

  try {
    await databases.createDocument(
      dbId,
      collectionId,
      buildParticipantLookupId(participant.hackathonId, participant.studentId),
      {
        hackathonId: normalizeHackathonId(participant.hackathonId),
        studentId: normalizeStudentId(participant.studentId),
        teamId: String(participant.teamId || ''),
        teamName: String(participant.teamName || '').trim(),
      },
    );

    return { created: true };
  } catch (err) {
    if (Number(err?.code) === 409) {
      const conflict = new Error('Student ID already registered for this hackathon');
      conflict.code = 409;
      conflict.type = 'participant_conflict';
      conflict.studentId = normalizeStudentId(participant.studentId);
      throw conflict;
    }

    if (isLookupCollectionUnavailable(err)) {
      return { created: false };
    }

    throw err;
  }
}

async function deleteParticipantRecord(databases, dbId, collectionId, hackathonId, studentId) {
  if (!collectionId) return;

  try {
    await databases.deleteDocument(
      dbId,
      collectionId,
      buildParticipantLookupId(hackathonId, studentId),
    );
  } catch {
    // Best-effort rollback only.
  }
}

async function listAllUsers(users) {
  const pageSize = 100;
  const allUsers = [];
  let offset = 0;

  while (true) {
    const queries = [Query.limit(pageSize)];
    if (typeof Query.offset === 'function' && offset > 0) {
      queries.push(Query.offset(offset));
    }

    const result = await users.list(queries);
    const batch = Array.isArray(result?.users) ? result.users : [];
    allUsers.push(...batch);

    if (batch.length < pageSize || typeof Query.offset !== 'function') {
      break;
    }

    offset += batch.length;
  }

  return allUsers;
}

async function findParticipantInUsers(users, hackathonId, studentId) {
  const normalizedHackathonId = normalizeHackathonId(hackathonId);
  const normalizedStudentId = normalizeStudentId(studentId);
  if (!normalizedHackathonId || !normalizedStudentId) return null;

  const allUsers = await listAllUsers(users);
  const match = allUsers.find((user) => {
    const prefs = user?.prefs || {};
    return (
      normalizeHackathonId(prefs.hackathonId || '') === normalizedHackathonId &&
      normalizeMemberIds(
        prefs.studentIds ||
          (prefs.primaryStudentId
            ? [prefs.primaryStudentId]
            : prefs.teamMemberIds || []),
      ).includes(normalizedStudentId)
    );
  });

  if (!match) return null;

  return {
    hackathonId: normalizedHackathonId,
    studentId: normalizedStudentId,
    teamId: String(match.$id || ''),
    teamName: String(match.name || '').trim(),
  };
}

async function resolveParticipant(databases, users, dbId, collectionId, hackathonId, studentId) {
  const normalizedHackathonId = normalizeHackathonId(hackathonId);
  const normalizedStudentId = normalizeStudentId(studentId);
  if (!normalizedHackathonId || !normalizedStudentId) return null;

  if (collectionId) {
    try {
      const participant = await findParticipantRecord(
        databases,
        dbId,
        collectionId,
        normalizedHackathonId,
        normalizedStudentId,
      );

      if (participant) {
        return {
          hackathonId: normalizedHackathonId,
          studentId: normalizedStudentId,
          teamId: String(participant.teamId || ''),
          teamName: String(participant.teamName || '').trim(),
        };
      }
    } catch (err) {
      if (!isLookupCollectionUnavailable(err)) {
        throw err;
      }
    }
  }

  return findParticipantInUsers(users, normalizedHackathonId, normalizedStudentId);
}

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

    // Init Verify Logic
    const client = new Client()
        .setEndpoint(process.env.APPWRITE_ENDPOINT || 'https://cloud.appwrite.io/v1') // Default or env
        .setProject(process.env.APPWRITE_PROJECT_ID)
        .setKey(apiKey);
    const databases = new Databases(client);

    const isAuthorized = await verifyAccess(req, process.env, databases);
    if (!isAuthorized) {
       return res.json({ success: false, error: 'Authorization Failed' }, 403);
    }

    const userId = req.headers['x-appwrite-user-id'];

    if (!userId) {
       return res.json({ success: false, error: 'Unauthorized: missing user context' }, 401);
    }

    const users = new Users(client);
    const dbId = process.env.DB_ID || 'devwatch_db';
    const colHackathonParticipants = getHackathonParticipantsCollectionId();

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
        const currentIds = normalizeMemberIds(
          prefs.studentIds ||
            (prefs.primaryStudentId
              ? [prefs.primaryStudentId]
              : prefs.teamMemberIds || []),
        );
        const newId = normalizeStudentId(studentId);
        const normalizedHackathonId = normalizeHackathonId(prefs.hackathonId || '');
        
        if (currentIds.length >= 5) {
            return res.json({ success: false, error: 'Team already has 5 members' }, 400);
        }
        if (!newId) {
            return res.json({ success: false, error: 'Missing studentId' }, 400);
        }
        if (currentIds.includes(newId)) {
            return res.json({ success: false, error: 'Student ID already exists on this team' }, 400);
        }

        if (!normalizedHackathonId) {
            return res.json({ success: false, error: 'This team is not linked to a hackathon' }, 400);
        }

        const existingParticipant = await resolveParticipant(
          databases,
          users,
          dbId,
          colHackathonParticipants,
          normalizedHackathonId,
          newId,
        );

        if (existingParticipant) {
          if (existingParticipant.teamId === targetUserId) {
            return res.json({ success: false, error: 'Student ID already exists on this team' }, 400);
          }

          return res.json(
            {
              success: false,
              error: `Student ID already registered for this hackathon: ${existingParticipant.studentId}`,
            },
            409,
          );
        }

        let createdLookup = false;
        try {
          const result = await createParticipantRecord(
            databases,
            dbId,
            colHackathonParticipants,
            {
              hackathonId: normalizedHackathonId,
              studentId: newId,
              teamId: targetUserId,
              teamName: String(targetUser.name || '').trim(),
            },
          );
          createdLookup = result.created;
        } catch (err) {
          if (err?.type === 'participant_conflict') {
            return res.json(
              {
                success: false,
                error: `Student ID already registered for this hackathon: ${err.studentId}`,
              },
              409,
            );
          }
          throw err;
        }

        try {
          await users.updatePrefs(targetUserId, {
              ...prefs,
              studentIds: [...currentIds, newId]
          });
        } catch (err) {
          if (createdLookup) {
            await deleteParticipantRecord(
              databases,
              dbId,
              colHackathonParticipants,
              normalizedHackathonId,
              newId,
            );
          }
          throw err;
        }

        return res.json({ success: true });
      } catch (e) {
        return res.json({ success: false, error: e.message }, 500);
      }
    }

    if (action === 'getMembers') {
      try {
        const targetUser = await users.get(targetUserId);
        const prefs = targetUser.prefs || {};
        return res.json({
          success: true,
          members: normalizeMemberIds(
            prefs.studentIds ||
              (prefs.primaryStudentId
                ? [prefs.primaryStudentId]
                : prefs.teamMemberIds || []),
          ),
        });
      } catch (e) {
        return res.json({ success: false, error: e.message }, 500);
      }
    }

     if (action === 'updateTeamEmail') {
       const normalizedEmail = typeof bodyObj.newEmail === 'string' ? bodyObj.newEmail.trim().toLowerCase() : '';
       if (!normalizedEmail) return res.json({ success: false, error: 'Missing newEmail' }, 400);
       if (!normalizedEmail.includes('@')) return res.json({ success: false, error: 'Invalid email format' }, 400);

       await users.updateEmail(targetUserId, normalizedEmail);
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
