const { clearCustomerCookie } = require('../../lib/auth');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ success: false, error: 'Method not allowed' });
    return;
  }
  clearCustomerCookie(res);
  res.status(200).json({ success: true });
};
