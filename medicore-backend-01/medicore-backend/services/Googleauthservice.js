/**
 * Google ID Token Verifier
 * Uses axios + jsonwebtoken to verify Google tokens
 * without requiring google-auth-library package
 */

const axios = require('axios');
const jwt   = require('jsonwebtoken');
const crypto = require('crypto');

let cachedCerts = null;
let certsExpiry = 0;

// Fetch Google's public certificates (cached for 1 hour)
async function getGoogleCerts() {
  if (cachedCerts && Date.now() < certsExpiry) return cachedCerts;

  const res = await axios.get('https://www.googleapis.com/oauth2/v1/certs', {
    timeout: 10000,
  });
  cachedCerts = res.data;
  certsExpiry = Date.now() + 60 * 60 * 1000; // 1 hour
  return cachedCerts;
}

// Convert RSA public key components to PEM (for x509 certs from Google)
function certToPem(cert) {
  // Google returns x509 PEM certificates directly
  if (cert.startsWith('-----BEGIN CERTIFICATE-----')) return cert;
  // Fallback: wrap in PEM headers
  const lines = cert.match(/.{1,64}/g).join('\n');
  return `-----BEGIN CERTIFICATE-----\n${lines}\n-----END CERTIFICATE-----`;
}

/**
 * Verify a Google ID token and return the payload
 * @param {string} idToken - The credential from Google Sign-In
 * @param {string} clientId - Your Google Client ID
 */
async function verifyGoogleToken(idToken, clientId) {
  // Step 1: Decode header to get key ID
  const decoded = jwt.decode(idToken, { complete: true });
  if (!decoded) throw new Error('Invalid Google token — could not decode');

  const { kid, alg } = decoded.header;

  // Step 2: Get Google's public certs
  const certs = await getGoogleCerts();
  const cert  = certs[kid];
  if (!cert) {
    // kid not found — try fetching fresh certs
    certsExpiry = 0;
    const freshCerts = await getGoogleCerts();
    const freshCert  = freshCerts[kid];
    if (!freshCert) throw new Error('Google public key not found for kid: ' + kid);
  }

  const publicKey = cert || certs[Object.keys(certs)[0]];

  // Step 3: Verify signature and claims
  const payload = jwt.verify(idToken, publicKey, {
    algorithms: ['RS256'],
    audience:   clientId,
    issuer:     ['accounts.google.com', 'https://accounts.google.com'],
  });

  return payload;
}

module.exports = { verifyGoogleToken };