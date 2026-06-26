const { getCustomerSession } = require('../../lib/auth');
const { getSupabase } = require('../../lib/supabase');

const DATE_FMT = { day: 'numeric', month: 'short', year: 'numeric' };

function fmtDate(val) {
  if (!val) return null;
  return new Date(val).toLocaleDateString('en-GB', DATE_FMT);
}

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const session = getCustomerSession(req);
  if (!session) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  let supabase;
  try {
    supabase = getSupabase();
  } catch (err) {
    return res.status(500).json({ error: `Supabase init failed: ${err.message}` });
  }

  try {
    const cid = session.customer_id;

    const [
      { data: plan,     error: planErr },
      { data: invoices, error: invErr  },
      { data: payments, error: payErr  },
    ] = await Promise.all([
      supabase
        .from('care_plans')
        .select('status, currency, monthly_price, renewal_date')
        .eq('customer_id', cid)
        .eq('status', 'active')
        .maybeSingle(),

      supabase
        .from('invoices')
        .select('invoice_no, description, amount, currency, date')
        .eq('customer_id', cid)
        .order('date', { ascending: false }),

      supabase
        .from('payments')
        .select('date, amount, currency, method')
        .eq('customer_id', cid)
        .order('date', { ascending: false }),
    ]);

    if (planErr) return res.status(500).json({ error: `care_plans: ${planErr.message}` });
    if (invErr)  return res.status(500).json({ error: `invoices: ${invErr.message}` });
    if (payErr)  return res.status(500).json({ error: `payments: ${payErr.message}` });

    const carePlan = plan
      ? {
          name:          'Care Plan',
          monthly_price: plan.monthly_price ? `${plan.currency || ''} ${plan.monthly_price}`.trim() : null,
          renewal_date:  fmtDate(plan.renewal_date),
          status:        plan.status,
        }
      : null;

    const invoiceList = (invoices || []).map((inv) => ({
      invoice_no:  inv.invoice_no,
      description: inv.description || null,
      date:        fmtDate(inv.date),
      amount:      inv.amount != null ? `${inv.currency || ''} ${inv.amount}`.trim() : null,
    }));

    const paymentList = (payments || []).map((p) => ({
      date:   fmtDate(p.date),
      method: p.method || null,
      amount: p.amount != null ? `${p.currency || ''} ${p.amount}`.trim() : null,
    }));

    return res.status(200).json({
      care_plan: carePlan,
      invoices:  invoiceList,
      payments:  paymentList,
    });
  } catch (err) {
    return res.status(500).json({ error: `Unexpected error: ${err.message}` });
  }
};
