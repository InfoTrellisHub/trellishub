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

  const { data: plan } = await supabase
    .from('care_plans')
    .select('status, currency, monthly_price, renewal_date, start_date')
    .eq('customer_id', session.customer_id)
    .eq('status', 'active')
    .maybeSingle();

  if (!plan) {
    return res.status(200).json({ plan: null, invoices: [] });
  }

  const renewal = plan.renewal_date
    ? new Date(plan.renewal_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
    : null;

  return res.status(200).json({
    plan: 'Essential Website + Care Plan',
    currency: plan.currency || '',
    monthly_price: plan.monthly_price ? `${plan.currency || ''} ${plan.monthly_price}`.trim() : null,
    renewal_date: renewal,
    invoices: [],
  });
};
