const { Client, Users, Query, ID } = require('node-appwrite');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');

function normalizeTeamName(value) {
  if (typeof value !== 'string') return '';
  return value.trim().toLowerCase();
}

function buildTeamEmail(teamName) {
  return `${teamName.replace(/[^a-zA-Z0-9]/g, '.').toLowerCase()}@sonar.knurdz.org`;
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

    const { action, attestation, devKey } = bodyObj || {};

    const signingKey = process.env.BUILD_SIGNING_KEY;
    const gatedActions = new Set(['getNonce', 'register', 'verifyAccess', 'checkVersionGate']);

    if (gatedActions.has(action)) {
      const accessGranted = hasValidBuildAccess(signingKey, attestation, devKey);
      if (!accessGranted) {
        return res.json({ success: false, error: 'Forbidden: Invalid Build Attestation or Developer Key' }, 403);
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

    if (action === 'getNonce') {
      const nonce = require('crypto').randomBytes(16).toString('hex');
      const token = jwt.sign({ nonce }, apiKey, { expiresIn: '5m' });
      return res.json({ success: true, nonce, nonceToken: token });
    }

    if (action === 'register') {
      const { teamName, password, studentIds } = bodyObj;
      const trimmedTeamName = typeof teamName === 'string' ? teamName.trim() : '';
      const normalizedTeamName = normalizeTeamName(teamName);

      if (!normalizedTeamName || !password) {
        return res.json({ success: false, error: 'Missing teamName or password' }, 400);
      }

      const email = buildTeamEmail(trimmedTeamName);
      
      try {
        // Prevent duplicate team names regardless of case and outer spaces.
        let offset = 0;
        const pageSize = 100;

        while (true) {
          const existingUsers = await users.list([
            Query.limit(pageSize),
            Query.offset(offset),
          ]);

          const hasDuplicateTeamName = existingUsers.users.some((existingUser) => {
            const existingName = normalizeTeamName(existingUser.name);
            return existingName && existingName === normalizedTeamName;
          });

          if (hasDuplicateTeamName) {
            return res.json({ success: false, error: 'Team name already exists' }, 409);
          }

          if (existingUsers.users.length < pageSize) break;
          offset += existingUsers.users.length;
        }

        // 1. Create User
        // Note: Appwrite Users.create varies by version. 
        // SDK v7+: create(userId, email, phone, password, name)
        // SDK v5-6: create(userId, email, password, name) (no phone)
        // Assuming reasonably modern node-appwrite from context. If it fails, we catch it.
        // Trying versatile approach:
        const user = await users.create(ID.unique(), email, undefined, password, trimmedTeamName);

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
