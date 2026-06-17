const { comparePassword, setAdminCookie } = require('../../lib/auth');
const { isRateLimited } = require('../../lib/rateLimit');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ success: false, error: 'Method not allowed' });
    return;
  }

  if (isRateLimited(req, { key: 'admin-login', max: 10, windowMs: 15 * 60 * 1000 })) {
    res.status(429).json({ success: false, error: 'Too many attempts — please try again later.' });
    return;
  }

  const password = (req.body || {}).password;
  if (!password) {
    res.status(400).json({ success: false, error: 'Password is required.' });
    return;
  }

  const admins = [
    { name: process.env.ADMIN_NAME_1, hash: process.env.ADMIN_PASSWORD_HASH_1 },
    { name: process.env.ADMIN_NAME_2, hash: process.env.ADMIN_PASSWORD_HASH_2 }
  ].filter((a) => a.hash);

  try {
    for (const admin of admins) {
      if (await comparePassword(password, admin.hash)) {
        setAdminCookie(res, { role: 'admin', name: admin.name || 'Developer' });
        res.status(200).json({ success: true, name: admin.name || 'Developer' });
        return;
      }
    }
    res.status(401).json({ success: false, error: 'Incorrect password.' });
  } catch (e) {
    console.error('admin/login.js error:', e);
    res.status(500).json({ success: false, error: 'Something went wrong.' });
  }
};
