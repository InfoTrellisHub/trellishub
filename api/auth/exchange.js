const { getSupabase } = require('../../lib/supabase');
const { setCustomerCookie } = require('../../lib/auth');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { access_token } = req.body || {};
  if (!access_token) {
    return res.status(400).json({ error: 'access_token required' });
  }

  const supabase = getSupabase();

  const { data: { user }, error: userError } = await supabase.auth.getUser(access_token);
  if (userError || !user) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }

  // Find or create customer in our customers table
  let customer;
  const { data: existing } = await supabase
    .from('customers')
    .select('id, name, email')
    .eq('email', user.email)
    .maybeSingle();

  if (existing) {
    customer = existing;
    await supabase
      .from('customers')
      .update({ last_login_at: new Date().toISOString() })
      .eq('id', existing.id);
  } else {
    const name =
      (user.user_metadata && (user.user_metadata.full_name || user.user_metadata.name)) ||
      user.email.split('@')[0];
    const { data: created, error: insertError } = await supabase
      .from('customers')
      .insert({ email: user.email, name, last_login_at: new Date().toISOString() })
      .select('id, name, email')
      .single();
    if (insertError) {
      return res.status(500).json({ error: 'Failed to create customer record' });
    }
    customer = created;
  }

  setCustomerCookie(res, {
    role: 'customer',
    customer_id: customer.id,
    name: customer.name,
    email: customer.email,
  });

  return res.status(200).json({
    authenticated: true,
    customer: { name: customer.name, email: customer.email },
  });
};
