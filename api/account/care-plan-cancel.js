const { getSupabase } = require('../../lib/supabase');
const { getCustomerSession } = require('../../lib/auth');
const { sendTeamNotification } = require('../../lib/mailer');
const { isRateLimited } = require('../../lib/rateLimit');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ success: false, error: 'Method not allowed' });
    return;
  }

  const session = getCustomerSession(req);
  if (!session) {
    res.status(401).json({ success: false, error: 'Not authenticated' });
    return;
  }

  if (isRateLimited(req, { key: 'care-plan-cancel', max: 10, windowMs: 10 * 60 * 1000 })) {
    res.status(429).json({ success: false, error: 'Too many requests' });
    return;
  }

  try {
    const supabase = getSupabase();
    const { data: plan, error: fetchError } = await supabase
      .from('care_plans')
      .select('id, status')
      .eq('customer_id', session.customer_id)
      .order('start_date', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (fetchError) throw fetchError;
    if (!plan || plan.status === 'cancelled' || plan.status === 'inactive') {
      res.status(400).json({ success: false, error: 'No active Care Plan to cancel.' });
      return;
    }

    await supabase
      .from('care_plans')
      .update({ status: 'cancellation_requested', cancellation_requested_at: new Date().toISOString() })
      .eq('id', plan.id);

    // Fires every time, same no-throttle pattern as the chatbot escalation alert.
    await sendTeamNotification(
      `Care Plan cancellation requested — ${session.name}`,
      `${session.name} <${session.email}> has requested to cancel their Care Plan. Please follow up to confirm and update billing accordingly.`
    );

    res.status(200).json({ success: true });
  } catch (e) {
    console.error('account/care-plan-cancel.js error:', e);
    res.status(500).json({ success: false, error: 'Something went wrong. Please email us directly.' });
  }
};
