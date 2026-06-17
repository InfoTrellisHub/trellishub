const { getSupabase } = require('../lib/supabase');
const { sendMail, sendTeamNotification } = require('../lib/mailer');
const { validateBooking, isHoneypotTripped } = require('../lib/validate');
const { isRateLimited } = require('../lib/rateLimit');
const { getCustomerSession } = require('../lib/auth');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ success: false, error: 'Method not allowed' });
    return;
  }

  const session = getCustomerSession(req);
  if (!session) {
    res.status(401).json({ success: false, error: 'Please log in to book a consultation.' });
    return;
  }

  if (isHoneypotTripped(req.body)) {
    res.status(200).json({ success: true, id: null });
    return;
  }

  if (isRateLimited(req, { key: 'booking', max: 5, windowMs: 10 * 60 * 1000 })) {
    res.status(429).json({ success: false, error: 'Too many submissions — please try again later.' });
    return;
  }

  const { valid, errors, data } = validateBooking(req.body || {});
  if (!valid) {
    res.status(400).json({ success: false, error: errors.join(' ') });
    return;
  }

  try {
    const supabase = getSupabase();
    const { data: row, error } = await supabase
      .from('bookings')
      .insert({ ...data, customer_id: session.customer_id })
      .select('id')
      .single();

    if (error) throw error;

    const typeLabel = data.booking_type === 'care_plan' ? 'Care Plan Inquiry' : 'Website Quote Request';
    const whenLine = data.preferred_date ? `${data.preferred_date} ${data.preferred_time || ''}`.trim() : 'No preferred time given';

    let confirmationSent = false;
    let notificationSent = false;

    try {
      await sendMail({
        to: data.email,
        subject: 'Your Trellis consultation request',
        text: `Hi ${data.name},\n\nWe've received your booking request (${typeLabel}) for ${whenLine}. We'll confirm shortly — no need to do anything else for now.\n\n— The Trellis team`
      });
      confirmationSent = true;
    } catch (e) {
      console.warn('Booking confirmation email failed:', e.message);
    }

    try {
      await sendTeamNotification(
        `New booking — ${typeLabel} — ${data.name}`,
        `Type: ${typeLabel}\nName: ${data.name}\nEmail: ${data.email}\nPhone: ${data.phone || '—'}\nPreferred: ${whenLine}\n\nNotes:\n${data.notes || '—'}`
      );
      notificationSent = true;
    } catch (e) {
      console.warn('Booking team notification email failed:', e.message);
    }

    await supabase
      .from('bookings')
      .update({ confirmation_email_sent: confirmationSent, notification_email_sent: notificationSent })
      .eq('id', row.id);

    res.status(200).json({ success: true, id: row.id });
  } catch (e) {
    console.error('booking.js error:', e);
    res.status(500).json({ success: false, error: 'Something went wrong. Please try again or email us directly.' });
  }
};
