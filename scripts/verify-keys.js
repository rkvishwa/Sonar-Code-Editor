const crypto = require('crypto');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });

const privateKey = process.env.SEAL_PRIVATE_KEY;
if (!privateKey) {
  throw new Error('Missing required env var: SEAL_PRIVATE_KEY');
}
const normalizedPrivateKey = privateKey.replace(/\\n/g, '\n');

const publicKey = process.env.SEAL_PUBLIC_KEY;
if (!publicKey) {
  throw new Error('Missing required env var: SEAL_PUBLIC_KEY');
}
const normalizedPublicKey = publicKey.replace(/\\n/g, '\n');

const data = 'test data';

try {
  const sign = crypto.createSign('SHA256');
  sign.update(data);
  sign.end();
  const signature = sign.sign(normalizedPrivateKey, 'hex');

  const verify = crypto.createVerify('SHA256');
  verify.update(data);
  verify.end();
  const result = verify.verify(normalizedPublicKey, signature, 'hex');

  console.log('Verification result:', result);
} catch (error) {
  console.error('Error:', error);
}