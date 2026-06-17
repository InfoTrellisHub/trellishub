const { getSupabase } = require('../../lib/supabase');
const { getAdminSession } = require('../../lib/auth');

const VALID_STATUSES = ['inactive', 'active', 'cancellation_requested', 'cancelled'];

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
  if (!body.customer_id) {
    res.status(400).json({ success: false, error: 'customer_id is required' });
    return;
  }
  if (body.status && !VALID_STATUSES.includes(body.status)) {
    res.status(400).json({ success: false, error: 'Invalid status' });
    return;
  }

  const updates = {};
  ['status', 'currency', 'monthly_price', 'start_date', 'renewal_date', 'notes'].forEach((key) => {
    if (body[key] !== undefined) updates[key] = body[key];
  });
  if (updates.status === 'cancelled') updates.cancelled_at = new Date().toISOString();

  try {
    const supabase = getSupabase();
    const { data: existing, error: fetchError } = await supabase
      .from('care_plans')
      .select('id')
      .eq('customer_id', body.customer_id)
      .order('start_date', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (fetchError) throw fetchError;

    if (existing) {
      const { error } = await supabase.from('care_plans').update(updates).eq('id', existing.id);
      if (error) throw error;
    } else {
      const { error } = await supabase.from('care_plans').insert({ customer_id: body.customer_id, ...updates });
      if (error) throw error;
    }

    res.status(200).json({ success: true });
  } catch (e) {
    console.error('admin/care-plan.js error:', e);
    res.status(500).json({ success: false, error: 'Could not update Care Plan' });
  }
};
