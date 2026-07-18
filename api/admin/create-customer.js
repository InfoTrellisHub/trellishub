const crypto = require('crypto');
const { getSupabase } = require('../../lib/supabase');
const { getAdminSession } = require('../../lib/auth');
const { isValidEmail, clean } = require('../../lib/validate');

function generatePassword() {
  return crypto.randomBytes(9).toString('base64').replace(/[+/=]/g, '').slice(0, 12);
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ success: false, error: 'Method not allowed' });
    return;
  }
  if (!getAdminSession(req)) {
    res.status(401).json({ success: false, error: 'Not authenticated' });
    return;
  }

  const body = req.body || {};
  const name = clean(body.name, 120);
  const email = clean(body.email, 200).toLowerCase();
  let password = typeof body.password === 'string' ? body.password : '';

  if (!name) {
    res.status(400).json({ success: false, error: 'Name is required.' });
    return;
  }
  if (!isValidEmail(email)) {
    res.status(400).json({ success: false, error: 'A valid email is required.' });
    return;
  }
  if (password && password.length < 8) {
    res.status(400).json({ success: false, error: 'Password must be at least 8 characters.' });
    return;
  }

  const generated = !password;
  if (generated) password = generatePassword();

  try {
    const supabase = getSupabase();

    const { data: existing } = await supabase.from('customers').select('id').eq('email', email).maybeSingle();
    if (existing) {
      res.status(409).json({ success: false, error: 'A customer with that email already exists.' });
      return;
    }

    const { data: created, error: createError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: name }
    });
    if (createError) {
      const msg = /already been registered|already exists/i.test(createError.message || '')
        ? 'A login already exists for that email.'
        : (createError.message || 'Could not create the login.');
      res.status(409).json({ success: false, error: msg });
      return;
    }

    const { data: customer, error: insertError } = await supabase
      .from('customers')
      .insert({ name, email })
      .select('id, name, email')
      .single();

    if (insertError) {
      await supabase.auth.admin.deleteUser(created.user.id).catch(() => {});
      throw insertError;
    }

    res.status(200).json({
      success: true,
      customer,
      password: generated ? password : undefined
    });
  } catch (e) {
    console.error('admin/create-customer.js error:', e);
    res.status(500).json({ success: false, error: 'Could not create the customer.' });
  }
};
