const { Client, Users, Query, ID, Databases } = require('node-appwrite');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { verifyAccess } = require('./verify');

const HACKATHON_ID_LENGTH = 12;
const DEFAULT_HACKATHON_SETTINGS = {
  blockInternetAccess: true,
  blockNonEmptyWorkspace: true,
};

function normalizeTeamName(value) {
  if (typeof value !== 'string') return '';
  return value.trim().toLowerCase();
}

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

function isValidHackathonId(value) {
  const normalized = normalizeHackathonId(value);
  return (
    normalized.length === HACKATHON_ID_LENGTH &&
    /^\d+$/.test(normalized) &&
    getLuhnChecksum(normalized) % 10 === 0
  );
}

function toBooleanSetting(value, fallback) {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (normalized === 'true') return true;
    if (normalized === 'false') return false;
  }
  return fallback;
}

function parseHackathonSettings(raw) {
  let parsed = raw;

  if (typeof parsed === 'string') {
    const trimmed = parsed.trim();
    if (!trimmed) {
      parsed = {};
    } else {
      try {
        parsed = JSON.parse(trimmed);
      } catch {
        parsed = {};
      }
    }
  }

  if (!parsed || typeof parsed !== 'object') {
    parsed = {};
  }

  return {
    blockInternetAccess: toBooleanSetting(
      parsed.blockInternetAccess,
      DEFAULT_HACKATHON_SETTINGS.blockInternetAccess,
    ),
    blockNonEmptyWorkspace: toBooleanSetting(
      parsed.blockNonEmptyWorkspace,
      DEFAULT_HACKATHON_SETTINGS.blockNonEmptyWorkspace,
    ),
  };
}

function buildTeamEmail(teamName) {
  return `${teamName.replace(/[^a-zA-Z0-9]/g, '.').toLowerCase()}@sonar.knurdz.org`;
}

function buildHackathonTeamEmail(hackathonId, teamName) {
  const normalizedHackathonId = normalizeHackathonId(hackathonId);
  const normalizedTeam = normalizeTeamName(teamName)
    .replace(/[^a-z0-9]+/g, '.')
    .replace(/\.+/g, '.')
    .replace(/^\.+|\.+$/g, '')
    .slice(0, 96);

  return `${normalizedTeam || 'team'}--${normalizedHackathonId}@teams.sonar.knurdz.org`;
}

function normalizeStudentId(value) {
  return String(value || '').trim().toUpperCase();
}

function normalizeStudentIds(raw) {
  if (!Array.isArray(raw)) return [];

  return raw
    .map((value) => normalizeStudentId(value))
    .filter(Boolean);
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

async function findHackathon(databases, dbId, collectionId, hackathonId) {
  const normalizedHackathonId = normalizeHackathonId(hackathonId);
  if (!normalizedHackathonId) return null;

  const result = await databases.listDocuments(dbId, collectionId, [
    Query.equal('hackathonId', normalizedHackathonId),
    Query.limit(1),
  ]);

  if (!result.documents || result.documents.length === 0) {
    return null;
  }

  return result.documents[0];
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

function getUserStudentIds(user) {
  const prefs = user?.prefs || {};
  const currentIds = normalizeStudentIds(prefs.studentIds);
  if (currentIds.length > 0) return currentIds;

  return normalizeStudentIds([
    prefs.primaryStudentId,
    ...(Array.isArray(prefs.teamMemberIds) ? prefs.teamMemberIds : []),
  ]);
}

function mapParticipantRecord(participant, fallbackHackathonId, fallbackStudentId) {
  return {
    hackathonId: normalizeHackathonId(participant?.hackathonId || fallbackHackathonId),
    studentId: normalizeStudentId(participant?.studentId || fallbackStudentId),
    teamId: String(participant?.teamId || ''),
    teamName: String(participant?.teamName || '').trim(),
  };
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
      getUserStudentIds(user).includes(normalizedStudentId)
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
        return mapParticipantRecord(participant, normalizedHackathonId, normalizedStudentId);
      }
    } catch (err) {
      if (!isLookupCollectionUnavailable(err)) {
        throw err;
      }
    }
  }

  const fallback = await findParticipantInUsers(users, normalizedHackathonId, normalizedStudentId);
  if (!fallback) return null;

  if (collectionId) {
    try {
      await createParticipantRecord(databases, dbId, collectionId, fallback);
    } catch (err) {
      if (!isLookupCollectionUnavailable(err) && Number(err?.code) !== 409) {
        throw err;
      }
    }
  }

  return fallback;
}

function safeTokenEquals(left, right) {
  if (typeof left !== 'string' || typeof right !== 'string') return false;
  const leftBuf = Buffer.from(left, 'utf8');
  const rightBuf = Buffer.from(right, 'utf8');
  if (leftBuf.length !== rightBuf.length) return false;
  return crypto.timingSafeEqual(leftBuf, rightBuf);
}

function hasValidBuildAccess(signingKey, attestation, devKey) {
  if (!signingKey) return false;

  if (typeof devKey === 'string' && safeTokenEquals(devKey, signingKey)) {
    return true;
  }

  if (attestation && typeof attestation === 'object' && attestation.token && attestation.payload) {
    const expectedToken = crypto
      .createHmac('sha256', signingKey)
      .update(attestation.payload)
      .digest('hex');
    return safeTokenEquals(attestation.token, expectedToken);
  }

  return false;
}

function parseSemver(version) {
  const raw = String(version || '').trim();
  if (!raw) return null;

  const cleaned = raw.replace(/^v/i, '');
  const dashIndex = cleaned.indexOf('-');
  const core = dashIndex >= 0 ? cleaned.slice(0, dashIndex) : cleaned;
  const prerelease = dashIndex >= 0 ? cleaned.slice(dashIndex + 1) : '';
  const parts = core.split('.').map((p) => Number(p));
  if (parts.some((p) => !Number.isFinite(p) || p < 0)) return null;

  while (parts.length < 3) parts.push(0);

  return {
    major: parts[0] || 0,
    minor: parts[1] || 0,
    patch: parts[2] || 0,
    prerelease,
  };
}

function comparePrerelease(left, right) {
  const leftEmpty = !left;
  const rightEmpty = !right;

  if (leftEmpty && rightEmpty) return 0;
  if (leftEmpty) return 1;
  if (rightEmpty) return -1;

  const leftParts = String(left).split('.');
  const rightParts = String(right).split('.');
  const max = Math.max(leftParts.length, rightParts.length);

  for (let i = 0; i < max; i++) {
    const l = leftParts[i];
    const r = rightParts[i];
    if (l === undefined) return -1;
    if (r === undefined) return 1;

    const lNum = /^\d+$/.test(l) ? Number(l) : null;
    const rNum = /^\d+$/.test(r) ? Number(r) : null;

    if (lNum !== null && rNum !== null) {
      if (lNum > rNum) return 1;
      if (lNum < rNum) return -1;
      continue;
    }

    if (lNum !== null && rNum === null) return -1;
    if (lNum === null && rNum !== null) return 1;

    if (l > r) return 1;
    if (l < r) return -1;
  }

  return 0;
}

function compareSemver(left, right) {
  const a = parseSemver(left);
  const b = parseSemver(right);
  if (!a || !b) return null;

  if (a.major !== b.major) return a.major > b.major ? 1 : -1;
  if (a.minor !== b.minor) return a.minor > b.minor ? 1 : -1;
  if (a.patch !== b.patch) return a.patch > b.patch ? 1 : -1;

  return comparePrerelease(a.prerelease, b.prerelease);
}

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

    const gatedActions = new Set(['getNonce', 'register', 'verifyAccess', 'checkVersionGate', 'getHackathon', 'resolveParticipant']);

    if (gatedActions.has(action)) {
        // Init Verify
        const client = new Client()
            .setEndpoint(process.env.APPWRITE_ENDPOINT || 'https://cloud.appwrite.io/v1')
            .setProject(process.env.APPWRITE_PROJECT_ID)
            .setKey(process.env.APPWRITE_API_KEY);
        const databases = new Databases(client);

        const accessGranted = await verifyAccess(req, process.env, databases);
        if (!accessGranted) {
           return res.json({ success: false, error: 'Authorization Failed' }, 403);
        }

      if (action === 'verifyAccess') {
        return res.json({ success: true });
      }

      if (action === 'checkVersionGate') {
        const currentVersion = String(bodyObj.currentVersion || '').trim();
        const latestVersion = String(
          process.env.LATEST_APP_VERSION || process.env.APP_LATEST_VERSION || ''
        ).trim();

        if (!latestVersion) {
          return res.json(
            {
              success: false,
              error: 'Version gate misconfigured: LATEST_APP_VERSION is not set',
            },
            503
          );
        }

        if (!currentVersion) {
          return res.json({ success: false, error: 'Missing currentVersion' }, 400);
        }

        const comparison = compareSemver(currentVersion, latestVersion);
        if (comparison === null) {
          return res.json({ success: false, error: 'Invalid version format' }, 400);
        }

        const upToDate = comparison >= 0;
        return res.json({
          success: true,
          upToDate,
          currentVersion,
          latestVersion,
          forceUpdate: !upToDate,
          message: upToDate
            ? 'Version check passed'
            : `Update required. Please install version ${latestVersion} to continue.`,
        });
      }

      if (action === 'getHackathon') {
        const dbId = process.env.DB_ID || 'devwatch_db';
        const colHackathons = process.env.COL_HACKATHONS || 'hackathons';
        const normalizedHackathonId = normalizeHackathonId(bodyObj.hackathonId);

        if (!normalizedHackathonId) {
          return res.json({ success: false, error: 'Missing hackathonId' }, 400);
        }

        if (!isValidHackathonId(normalizedHackathonId)) {
          return res.json({ success: false, error: 'Invalid hackathon ID' }, 400);
        }

        const hackathon = await findHackathon(databases, dbId, colHackathons, normalizedHackathonId);
        if (!hackathon) {
          return res.json({ success: false, error: 'Hackathon not found' }, 404);
        }

        return res.json({
          success: true,
          hackathon: {
            hackathonId: normalizedHackathonId,
            name: String(hackathon.name || normalizedHackathonId),
            status: String(hackathon.status || 'draft'),
            description: String(hackathon.description || ''),
            startDate: String(hackathon.startDate || ''),
            endDate: String(hackathon.endDate || ''),
            settings: parseHackathonSettings(hackathon.settingsJson || hackathon.settings),
          },
        });
      }

      if (action === 'resolveParticipant') {
        const dbId = process.env.DB_ID || 'devwatch_db';
        const colHackathonParticipants = getHackathonParticipantsCollectionId();
        const normalizedHackathonId = normalizeHackathonId(bodyObj.hackathonId);
        const normalizedStudentId = normalizeStudentId(bodyObj.studentId);

        if (!normalizedHackathonId || !normalizedStudentId) {
          return res.json({ success: false, error: 'Missing hackathonId or studentId' }, 400);
        }

        if (!isValidHackathonId(normalizedHackathonId)) {
          return res.json({ success: false, error: 'Invalid hackathon ID' }, 400);
        }

        const users = new Users(client);
        const participant = await resolveParticipant(
          databases,
          users,
          dbId,
          colHackathonParticipants,
          normalizedHackathonId,
          normalizedStudentId,
        );

        if (!participant) {
          return res.json({ success: false, error: 'Participant not found' }, 404);
        }

        return res.json({ success: true, participant });
      }
    }

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
    const databases = new Databases(client);

    if (action === 'getNonce') {
      const nonce = require('crypto').randomBytes(16).toString('hex');
      const token = jwt.sign({ nonce }, apiKey, { expiresIn: '5m' });
      return res.json({ success: true, nonce, nonceToken: token });
    }

    if (action === 'register') {
      const { hackathonId, teamName, password, studentIds, primaryStudentId, teamMemberIds } = bodyObj;
      const trimmedTeamName = typeof teamName === 'string' ? teamName.trim() : '';
      const normalizedHackathonId = normalizeHackathonId(hackathonId);
      const providedStudentIds = normalizeStudentIds(studentIds);
      const legacyPrimaryId = normalizeStudentId(primaryStudentId);
      const legacyExtraIds = normalizeStudentIds(teamMemberIds);
      const allStudentIds = Array.from(new Set([...providedStudentIds, legacyPrimaryId, ...legacyExtraIds].filter(Boolean)));

      if (!normalizedHackathonId || !trimmedTeamName || !password) {
        return res.json({ success: false, error: 'Missing hackathonId, teamName, or password' }, 400);
      }

      if (!isValidHackathonId(normalizedHackathonId)) {
        return res.json({ success: false, error: 'Hackathon ID must be a valid 12-digit event ID.' }, 400);
      }

      if (allStudentIds.length === 0) {
        return res.json({ success: false, error: 'At least one student ID is required' }, 400);
      }

      if (allStudentIds.length > 5) {
        return res.json({ success: false, error: 'A team can include at most 5 student IDs' }, 400);
      }

      const dbId = process.env.DB_ID || 'devwatch_db';
      const colHackathons = process.env.COL_HACKATHONS || 'hackathons';
      const colHackathonParticipants = getHackathonParticipantsCollectionId();
      const hackathon = await findHackathon(databases, dbId, colHackathons, normalizedHackathonId);

      if (!hackathon) {
        return res.json({ success: false, error: 'Hackathon ID not found' }, 404);
      }

      if (String(hackathon.status || '').toLowerCase() === 'archived') {
        return res.json({ success: false, error: 'This hackathon is archived and no longer accepts registrations' }, 403);
      }

      const email = buildHackathonTeamEmail(normalizedHackathonId, trimmedTeamName);
      const duplicateIds = [];

      for (const studentId of allStudentIds) {
        const existingParticipant = await resolveParticipant(
          databases,
          users,
          dbId,
          colHackathonParticipants,
          normalizedHackathonId,
          studentId,
        );

        if (existingParticipant) {
          duplicateIds.push(existingParticipant.studentId);
        }
      }

      if (duplicateIds.length > 0) {
        return res.json(
          {
            success: false,
            error: `Student IDs already registered for this hackathon: ${duplicateIds.join(', ')}`,
          },
          409,
        );
      }

      let user = null;
      const createdParticipantIds = [];

      try {
        user = await users.create(ID.unique(), email, undefined, password, trimmedTeamName);

        await users.updatePrefs(user.$id, {
          role: 'team',
          hackathonId: normalizedHackathonId,
          hackathonName: String(hackathon.name || normalizedHackathonId),
          studentIds: allStudentIds,
        });

        await users.updateLabels(user.$id, ['user']);

        for (const studentId of allStudentIds) {
          const result = await createParticipantRecord(
            databases,
            dbId,
            colHackathonParticipants,
            {
              hackathonId: normalizedHackathonId,
              studentId,
              teamId: user.$id,
              teamName: trimmedTeamName,
            },
          );

          if (result.created) {
            createdParticipantIds.push(studentId);
          }
        }

        return res.json({
          success: true,
          userId: user.$id,
          hackathonId: normalizedHackathonId,
          hackathonName: String(hackathon.name || normalizedHackathonId),
        });
      } catch (err) {
        if (user?.$id) {
          for (const studentId of createdParticipantIds) {
            await deleteParticipantRecord(
              databases,
              dbId,
              colHackathonParticipants,
              normalizedHackathonId,
              studentId,
            );
          }

          await users.delete(user.$id).catch(() => {});
        }

        if (err?.type === 'participant_conflict') {
          return res.json(
            {
              success: false,
              error: `Student ID already registered for this hackathon: ${err.studentId}`,
            },
            409,
          );
        }

        if (err.code === 409) return res.json({ success: false, error: 'That team name is already registered for this hackathon' }, 409);
        throw err;
      }
    }

    return res.json({ success: false, error: 'Invalid action' }, 400);

  } catch (err) {
    error(err.message);
    return res.json({ success: false, error: err.message }, 500);
  }
};
