const { getCustomerSession } = require('../../lib/auth');
const { getSupabase } = require('../../lib/supabase');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const session = getCustomerSession(req);
  if (!session) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  const { name } = req.body || {};
  if (!name || typeof name !== 'string' || !name.trim()) {
    return res.status(400).json({ error: 'name is required' });
  }

  const trimmedName = name.trim();
  const supabase = getSupabase();

  const { error } = await supabase
    .from('customers')
    .update({ name: trimmedName })
    .eq('id', session.customer_id);

  if (error) {
    return res.status(500).json({ error: 'Failed to update profile' });
  }

  return res.status(200).json({ name: trimmedName });
};
