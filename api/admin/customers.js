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

  const limit = Math.min(parseInt(req.query.limit, 10) || 100, 300);
  const offset = parseInt(req.query.offset, 10) || 0;

  try {
    const supabase = getSupabase();
    const { data: customers, error, count } = await supabase
      .from('customers')
      .select('id, created_at, name, email, last_login_at', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);
    if (error) throw error;

    const ids = (customers || []).map((c) => c.id);
    let plansByCustomer = {};
    if (ids.length) {
      const { data: plans, error: plansError } = await supabase
        .from('care_plans')
        .select('id, customer_id, status, currency, monthly_price, start_date, renewal_date')
        .in('customer_id', ids);
      if (plansError) throw plansError;
      plansByCustomer = (plans || []).reduce((acc, p) => {
        acc[p.customer_id] = p;
        return acc;
      }, {});
    }

    const result = (customers || []).map((c) => ({ ...c, carePlan: plansByCustomer[c.id] || null }));
    res.status(200).json({ customers: result, total: count || 0 });
  } catch (e) {
    console.error('admin/customers.js error:', e);
    res.status(500).json({ error: 'Could not load customers' });
  }
};
