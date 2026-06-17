// Exposes the (non-secret) Google OAuth client ID to the frontend so auth.js can
// initialize "Sign in with Google" without hardcoding it into static JS.
module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    res.status(405).json({ googleClientId: null });
    return;
  }
  res.status(200).json({ googleClientId: process.env.GOOGLE_OAUTH_CLIENT_ID || null });
};
