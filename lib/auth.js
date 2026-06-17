// Shared JWT + bcrypt + Google-token verification + cookie helpers for both the
// admin (developer) and customer session types. Cookie names/payload shapes are
// kept distinct so the two session types never collide.
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { OAuth2Client } = require('google-auth-library');

const ADMIN_COOKIE = 'trellis_admin_session';
const CUSTOMER_COOKIE = 'trellis_customer_session';
const ADMIN_MAX_AGE = 60 * 60 * 12; // 12h
const CUSTOMER_MAX_AGE = 60 * 60 * 24 * 30; // 30 days

function getSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET is not set');
  return secret;
}

function signToken(payload, maxAgeSeconds) {
  return jwt.sign(payload, getSecret(), { expiresIn: maxAgeSeconds });
}

function verifyToken(token) {
  try {
    return jwt.verify(token, getSecret());
  } catch (e) {
    return null;
  }
}

function parseCookies(req) {
  const header = req.headers.cookie;
  const out = {};
  if (!header) return out;
  header.split(';').forEach((pair) => {
    const idx = pair.indexOf('=');
    if (idx === -1) return;
    const key = pair.slice(0, idx).trim();
    const value = pair.slice(idx + 1).trim();
    out[key] = decodeURIComponent(value);
  });
  return out;
}

function buildSetCookie(name, value, maxAgeSeconds) {
  const parts = [`${name}=${encodeURIComponent(value)}`, 'Path=/', 'HttpOnly', 'SameSite=Strict'];
  if (process.env.NODE_ENV !== 'development') parts.push('Secure');
  if (maxAgeSeconds === 0) {
    parts.push('Max-Age=0');
  } else {
    parts.push(`Max-Age=${maxAgeSeconds}`);
  }
  return parts.join('; ');
}

function setAdminCookie(res, payload) {
  const token = signToken(payload, ADMIN_MAX_AGE);
  res.setHeader('Set-Cookie', buildSetCookie(ADMIN_COOKIE, token, ADMIN_MAX_AGE));
}

function clearAdminCookie(res) {
  res.setHeader('Set-Cookie', buildSetCookie(ADMIN_COOKIE, '', 0));
}

function getAdminSession(req) {
  const cookies = parseCookies(req);
  const token = cookies[ADMIN_COOKIE];
  if (!token) return null;
  const payload = verifyToken(token);
  return payload && payload.role === 'admin' ? payload : null;
}

function setCustomerCookie(res, payload) {
  const token = signToken(payload, CUSTOMER_MAX_AGE);
  res.setHeader('Set-Cookie', buildSetCookie(CUSTOMER_COOKIE, token, CUSTOMER_MAX_AGE));
}

function clearCustomerCookie(res) {
  res.setHeader('Set-Cookie', buildSetCookie(CUSTOMER_COOKIE, '', 0));
}

function getCustomerSession(req) {
  const cookies = parseCookies(req);
  const token = cookies[CUSTOMER_COOKIE];
  if (!token) return null;
  const payload = verifyToken(token);
  return payload && payload.role === 'customer' ? payload : null;
}

async function hashPassword(password) {
  return bcrypt.hash(password, 12);
}

async function comparePassword(password, hash) {
  if (!hash) return false;
  return bcrypt.compare(password, hash);
}

let googleClient = null;
async function verifyGoogleIdToken(idToken) {
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
  if (!clientId) throw new Error('GOOGLE_OAUTH_CLIENT_ID is not set');
  if (!googleClient) googleClient = new OAuth2Client(clientId);
  const ticket = await googleClient.verifyIdToken({ idToken, audience: clientId });
  const payload = ticket.getPayload();
  return { googleId: payload.sub, email: payload.email, name: payload.name };
}

module.exports = {
  setAdminCookie,
  clearAdminCookie,
  getAdminSession,
  setCustomerCookie,
  clearCustomerCookie,
  getCustomerSession,
  hashPassword,
  comparePassword,
  verifyGoogleIdToken
};
