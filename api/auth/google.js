const { getSupabase } = require('../../lib/supabase');
const { verifyGoogleIdToken, setCustomerCookie } = require('../../lib/auth');
const { isRateLimited } = require('../../lib/rateLimit');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ success: false, error: 'Method not allowed' });
    return;
  }

  if (isRateLimited(req, { key: 'auth-google', max: 20, windowMs: 10 * 60 * 1000 })) {
    res.status(429).json({ success: false, error: 'Too many attempts — please try again later.' });
    return;
  }

  const idToken = req.body && req.body.idToken;
  if (!idToken) {
    res.status(400).json({ success: false, error: 'Missing Google credential.' });
    return;
  }

  try {
    const { googleId, email, name } = await verifyGoogleIdToken(idToken);
    const supabase = getSupabase();

    let { data: customer } = await supabase
      .from('customers')
      .select('id, name, email, google_id')
      .eq('google_id', googleId)
      .maybeSingle();

    if (!customer) {
      const { data: byEmail } = await supabase.from('customers').select('id, name, email, google_id').eq('email', email).maybeSingle();
      if (byEmail) {
        await supabase.from('customers').update({ google_id: googleId }).eq('id', byEmail.id);
        customer = byEmail;
      }
    }

    if (!customer) {
      const { data: created, error } = await supabase
        .from('customers')
        .insert({ name: name || email, email, google_id: googleId, last_login_at: new Date().toISOString() })
        .select('id, name, email')
        .single();
      if (error) throw error;
      customer = created;
    } else {
      await supabase.from('customers').update({ last_login_at: new Date().toISOString() }).eq('id', customer.id);
    }

    setCustomerCookie(res, { role: 'customer', customer_id: customer.id, name: customer.name, email: customer.email });
    res.status(200).json({ success: true, customer: { name: customer.name, email: customer.email } });
  } catch (e) {
    console.error('auth/google.js error:', e);
    res.status(401).json({ success: false, error: 'Could not verify your Google account.' });
  }
};
