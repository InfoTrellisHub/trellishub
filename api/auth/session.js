const { getCustomerSession } = require('../../lib/auth');

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    res.status(405).json({ authenticated: false });
    return;
  }
  const session = getCustomerSession(req);
  if (!session) {
    res.status(200).json({ authenticated: false });
    return;
  }
  res.status(200).json({ authenticated: true, customer: { name: session.name, email: session.email } });
};
