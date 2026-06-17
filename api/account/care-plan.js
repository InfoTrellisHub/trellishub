const { getSupabase } = require('../../lib/supabase');
const { getCustomerSession } = require('../../lib/auth');

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const session = getCustomerSession(req);
  if (!session) {
    res.status(401).json({ error: 'Not authenticated' });
    return;
  }

  try {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('care_plans')
      .select('status, currency, monthly_price, start_date, renewal_date')
      .eq('customer_id', session.customer_id)
      .order('start_date', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) throw error;
    res.status(200).json({ carePlan: data || null });
  } catch (e) {
    console.error('account/care-plan.js error:', e);
    res.status(500).json({ error: 'Could not load Care Plan' });
  }
};
