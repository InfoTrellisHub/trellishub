const { getSupabase } = require('../../lib/supabase');
const { hashPassword, setCustomerCookie } = require('../../lib/auth');
const { isRateLimited } = require('../../lib/rateLimit');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ success: false, error: 'Method not allowed' });
    return;
  }

  if (isRateLimited(req, { key: 'auth-reset', max: 10, windowMs: 15 * 60 * 1000 })) {
    res.status(429).json({ success: false, error: 'Too many attempts — please try again later.' });
    return;
  }

  const { token, newPassword } = req.body || {};
  if (!token || !newPassword || newPassword.length < 8) {
    res.status(400).json({ success: false, error: 'Invalid request. Password must be at least 8 characters.' });
    return;
  }

  try {
    const supabase = getSupabase();
    const { data: customer } = await supabase
      .from('customers')
      .select('id, name, email, reset_token_expires_at')
      .eq('reset_token', token)
      .maybeSingle();

    if (!customer || !customer.reset_token_expires_at || new Date(customer.reset_token_expires_at) < new Date()) {
      res.status(400).json({ success: false, error: 'This reset link is invalid or has expired.' });
      return;
    }

    const passwordHash = await hashPassword(newPassword);
    await supabase
      .from('customers')
      .update({ password_hash: passwordHash, reset_token: null, reset_token_expires_at: null })
      .eq('id', customer.id);

    setCustomerCookie(res, { role: 'customer', customer_id: customer.id, name: customer.name, email: customer.email });
    res.status(200).json({ success: true });
  } catch (e) {
    console.error('auth/reset-password.js error:', e);
    res.status(500).json({ success: false, error: 'Something went wrong resetting your password.' });
  }
};
