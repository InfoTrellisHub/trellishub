const { getSupabase } = require('../../lib/supabase');
const { getAdminSession } = require('../../lib/auth');

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }
  if (!getAdminSession(req)) {
    res.status(401).json({ error: 'Not authenticated' });
    return;
  }

  const limit = Math.min(parseInt(req.query.limit, 10) || 50, 200);
  const offset = parseInt(req.query.offset, 10) || 0;

  try {
    const supabase = getSupabase();
    let query = supabase
      .from('leads')
      .select('id, created_at, name, email, phone, company, message, status', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (req.query.status) query = query.eq('status', req.query.status);

    const { data, error, count } = await query;
    if (error) throw error;
    res.status(200).json({ leads: data || [], total: count || 0 });
  } catch (e) {
    console.error('admin/leads.js error:', e);
    res.status(500).json({ error: 'Could not load leads' });
  }
};
