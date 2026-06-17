const crypto = require('crypto');
const { getSupabase } = require('../../lib/supabase');
const { sendMail } = require('../../lib/mailer');
const { isValidEmail, clean } = require('../../lib/validate');
const { isRateLimited } = require('../../lib/rateLimit');

const RESET_TOKEN_TTL_MS = 60 * 60 * 1000; // 1 hour

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ success: false, error: 'Method not allowed' });
    return;
  }

  if (isRateLimited(req, { key: 'auth-forgot', max: 5, windowMs: 15 * 60 * 1000 })) {
    res.status(429).json({ success: false, error: 'Too many attempts — please try again later.' });
    return;
  }

  const email = clean((req.body || {}).email, 200).toLowerCase();
  // Always respond the same way whether or not the email exists, to avoid leaking
  // which addresses have accounts.
  const genericResponse = { success: true, message: "If that email has an account, we've sent a reset link." };

  if (!isValidEmail(email)) {
    res.status(200).json(genericResponse);
    return;
  }

  try {
    const supabase = getSupabase();
    const { data: customer } = await supabase.from('customers').select('id, name, email').eq('email', email).maybeSingle();

    if (customer) {
      const token = crypto.randomBytes(32).toString('hex');
      const expiresAt = new Date(Date.now() + RESET_TOKEN_TTL_MS).toISOString();
      await supabase.from('customers').update({ reset_token: token, reset_token_expires_at: expiresAt }).eq('id', customer.id);

      const siteUrl = process.env.SITE_URL || 'https://trellishub.vercel.app';
      const resetLink = `${siteUrl}/?reset_token=${token}`;

      await sendMail({
        to: customer.email,
        subject: 'Reset your Trellis password',
        text: `Hi ${customer.name},\n\nClick the link below to reset your password. This link expires in 1 hour.\n\n${resetLink}\n\nIf you didn't request this, you can ignore this email.`
      });
    }

    res.status(200).json(genericResponse);
  } catch (e) {
    console.error('auth/forgot-password.js error:', e);
    res.status(200).json(genericResponse);
  }
};
