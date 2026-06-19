const { Resend } = require('resend');
const { getSupabase } = require('../lib/supabase');
const { validateBooking, isHoneypotTripped } = require('../lib/validate');
const { isRateLimited } = require('../lib/rateLimit');
const { getCustomerSession } = require('../lib/auth');

function getResend() {
  const key = process.env.RESEND_API_KEY;
  if (!key) throw new Error('RESEND_API_KEY is not set');
  return new Resend(key);
}

const TEAM_EMAIL = process.env.TEAM_EMAIL || 'info.trellishub@gmail.com';
const FROM_EMAIL = process.env.FROM_EMAIL  || 'Trellis <noreply@trellishub.co.za>';

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ success: false, error: 'Method not allowed' });
    return;
  }

  const session = getCustomerSession(req);

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
      .insert({ ...data, customer_id: session ? session.customer_id : null })
      .select('id')
      .single();

    if (error) throw error;

    let confirmationSent = false;
    let notificationSent = false;

    try {
      const resend = getResend();

      try {
        await resend.emails.send({
          from: FROM_EMAIL,
          to: data.email,
          subject: 'Booking Confirmation - TrellisHub',
          text: 'Thank you for your booking. We\'ve received your request and will follow up shortly.',
        });
        confirmationSent = true;
      } catch (e) {
        console.error('Booking confirmation email failed:', e.message, e);
      }

      try {
        await resend.emails.send({
          from: FROM_EMAIL,
          to: TEAM_EMAIL,
          subject: 'New Booking Received',
          text: 'A new booking has been submitted. Please check the Supabase `bookings` table for details.',
        });
        notificationSent = true;
      } catch (e) {
        console.error('Booking team notification email failed:', e.message, e);
      }
    } catch (e) {
      console.error('Resend initialisation failed:', e.message, e);
    }

    await supabase
      .from('bookings')
      .update({ confirmation_email_sent: confirmationSent, notification_email_sent: notificationSent })
      .eq('id', row.id);

    res.status(200).json({ success: true, id: row.id });
  } catch (e) {
    console.error('booking.js error:', {
      message: e.message,
      code:    e.code,
      status:  e.status,
      details: e.details,
      hint:    e.hint,
      stack:   e.stack,
    });
    res.status(500).json({ success: false, error: e.message || 'Something went wrong. Please try again or email us directly.' });
  }
};
