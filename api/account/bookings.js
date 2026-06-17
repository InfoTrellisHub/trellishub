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
      .from('bookings')
      .select('id, booking_type, preferred_date, preferred_time, status, created_at')
      .eq('customer_id', session.customer_id)
      .order('created_at', { ascending: false });

    if (error) throw error;
    res.status(200).json({ bookings: data || [] });
  } catch (e) {
    console.error('account/bookings.js error:', e);
    res.status(500).json({ error: 'Could not load bookings' });
  }
};
