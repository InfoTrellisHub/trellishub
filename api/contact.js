const { getSupabase } = require('../lib/supabase');
const { sendMail, sendTeamNotification } = require('../lib/mailer');
const { validateContact, isHoneypotTripped } = require('../lib/validate');
const { isRateLimited } = require('../lib/rateLimit');
const { getCustomerSession } = require('../lib/auth');

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

  if (isRateLimited(req, { key: 'contact', max: 5, windowMs: 10 * 60 * 1000 })) {
    res.status(429).json({ success: false, error: 'Too many submissions — please try again later.' });
    return;
  }

  const { valid, errors, data } = validateContact(req.body || {});
  if (!valid) {
    res.status(400).json({ success: false, error: errors.join(' ') });
    return;
  }

  try {
    const supabase = getSupabase();
    const { data: row, error } = await supabase
      .from('leads')
      .insert({ ...data, customer_id: session ? session.customer_id : null, ip_country: req.body.ip_country || null, user_agent: req.headers['user-agent'] || null })
      .select('id')
      .single();

    if (error) throw error;

    await sendTeamNotification(
      `New contact form submission — ${data.name}`,
      `Name: ${data.name}\nEmail: ${data.email}\nPhone: ${data.phone || '—'}\nCompany: ${data.company || '—'}\n\nMessage:\n${data.message}`
    );

    sendMail({
      to: data.email,
      subject: "Thanks for reaching out to Trellis",
      text: `Hi ${data.name},\n\nThanks for your message — we've received it and will be in touch within 24 hours.\n\n— The Trellis team`
    }).catch((e) => console.warn('Visitor ack email failed:', e.message));

    res.status(200).json({ success: true, id: row.id });
  } catch (e) {
    console.error('contact.js error:', {
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
