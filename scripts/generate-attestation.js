const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
require('dotenv').config();

const key = process.env.BUILD_SIGNING_KEY;
if (!key) {
  console.warn('WARNING: BUILD_SIGNING_KEY is not set. Creating a mock attestation for development, but true build requires a real key.');
}

const signingKey = key || 'mock-dev-key';

const packageJsonPath = path.join(__dirname, '..', 'package.json');
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));

const version = packageJson.version;
const buildTimestamp = Date.now().toString();

const payload = `${version}|${buildTimestamp}|sonar-official`;
const token = crypto.createHmac('sha256', signingKey).update(payload).digest('hex');

const outDir = path.join(__dirname, '..', 'dist', 'main');
if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true });
}

const attestation = {
  token,
  version,
  buildTimestamp,
  payload
  // signingKey REMOVED for security - implementation should not expose private keys in build artifacts
};

const outputPath = path.join(outDir, 'build-attestation.json');
fs.writeFileSync(outputPath, JSON.stringify(attestation, null, 2), 'utf8');
console.log(`Build attestation generated successfully at ${outputPath}`);
