const { getSupabase } = require('../../lib/supabase');
const { hashPassword, setCustomerCookie } = require('../../lib/auth');
const { isValidEmail, clean } = require('../../lib/validate');
const { isRateLimited } = require('../../lib/rateLimit');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ success: false, error: 'Method not allowed' });
    return;
  }

  if (isRateLimited(req, { key: 'auth-signup', max: 10, windowMs: 10 * 60 * 1000 })) {
    res.status(429).json({ success: false, error: 'Too many attempts — please try again later.' });
    return;
  }

  const body = req.body || {};
  const name = clean(body.name, 120);
  const email = clean(body.email, 200).toLowerCase();
  const password = typeof body.password === 'string' ? body.password : '';

  if (!name) {
    res.status(400).json({ success: false, error: 'Please enter your name.' });
    return;
  }
  if (!isValidEmail(email)) {
    res.status(400).json({ success: false, error: 'Please enter a valid email.' });
    return;
  }
  if (password.length < 8) {
    res.status(400).json({ success: false, error: 'Password must be at least 8 characters.' });
    return;
  }

  try {
    const supabase = getSupabase();

    const { data: existing } = await supabase.from('customers').select('id').eq('email', email).maybeSingle();
    if (existing) {
      res.status(409).json({ success: false, error: 'An account with that email already exists. Try logging in instead.' });
      return;
    }

    const passwordHash = await hashPassword(password);
    const { data: customer, error } = await supabase
      .from('customers')
      .insert({ name, email, password_hash: passwordHash, last_login_at: new Date().toISOString() })
      .select('id, name, email')
      .single();

    if (error) throw error;

    setCustomerCookie(res, { role: 'customer', customer_id: customer.id, name: customer.name, email: customer.email });
    res.status(200).json({ success: true, customer: { name: customer.name, email: customer.email } });
  } catch (e) {
    console.error('auth/signup.js error:', e);
    res.status(500).json({ success: false, error: 'Something went wrong creating your account.' });
  }
};
