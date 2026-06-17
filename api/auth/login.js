const { getSupabase } = require('../../lib/supabase');
const { comparePassword, setCustomerCookie } = require('../../lib/auth');
const { isValidEmail, clean } = require('../../lib/validate');
const { isRateLimited } = require('../../lib/rateLimit');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ success: false, error: 'Method not allowed' });
    return;
  }

  if (isRateLimited(req, { key: 'auth-login', max: 10, windowMs: 10 * 60 * 1000 })) {
    res.status(429).json({ success: false, error: 'Too many attempts — please try again later.' });
    return;
  }

  const body = req.body || {};
  const email = clean(body.email, 200).toLowerCase();
  const password = typeof body.password === 'string' ? body.password : '';

  if (!isValidEmail(email) || !password) {
    res.status(400).json({ success: false, error: 'Please enter your email and password.' });
    return;
  }

  try {
    const supabase = getSupabase();
    const { data: customer } = await supabase
      .from('customers')
      .select('id, name, email, password_hash')
      .eq('email', email)
      .maybeSingle();

    const ok = customer && (await comparePassword(password, customer.password_hash));
    if (!ok) {
      res.status(401).json({ success: false, error: 'Incorrect email or password.' });
      return;
    }

    await supabase.from('customers').update({ last_login_at: new Date().toISOString() }).eq('id', customer.id);

    setCustomerCookie(res, { role: 'customer', customer_id: customer.id, name: customer.name, email: customer.email });
    res.status(200).json({ success: true, customer: { name: customer.name, email: customer.email } });
  } catch (e) {
    console.error('auth/login.js error:', e);
    res.status(500).json({ success: false, error: 'Something went wrong logging you in.' });
  }
};
