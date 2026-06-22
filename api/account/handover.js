const { verifyCustomerCookie } = require('../../lib/auth');
const { getSupabase } = require('../../lib/supabase');

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const session = verifyCustomerCookie(req);
  if (!session) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('customers')
    .select('credentials_url')
    .eq('id', session.customer_id)
    .maybeSingle();

  if (error) {
    return res.status(500).json({ error: 'Failed to fetch handover data' });
  }

  return res.status(200).json({ credentials_url: data?.credentials_url || null });
};
