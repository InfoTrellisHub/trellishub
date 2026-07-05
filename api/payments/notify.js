// PayFast ITN (Instant Transaction Notification) webhook. Called server-to-server by
// PayFast — no customer session is available here. Trust nothing from the payload
// until the signature AND PayFast's own postback validation both pass.
const { getSupabase } = require('../../lib/supabase');
const { sendTeamNotification } = require('../../lib/mailer');
const { isRateLimited } = require('../../lib/rateLimit');
const payfast = require('../../lib/payfast');

// Raw body is required for exact-byte signature recomputation and for reposting to
// PayFast's validate endpoint unmodified.
module.exports.config = { api: { bodyParser: false } };

function readRawBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (chunk) => { data += chunk; });
    req.on('end', () => resolve(data));
    req.on('error', reject);
  });
}

function amountsMatch(a, b) {
  return Math.abs(parseFloat(a) - parseFloat(b)) < 0.01;
}

function addOneMonth(date) {
  const d = new Date(date);
  d.setMonth(d.getMonth() + 1);
  return d.toISOString().slice(0, 10);
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).send('Method not allowed');
    return;
  }

  // This URL only ever receives ITNs for our own PayFast transactions, so volume is
  // naturally bounded by real payment activity — this just guards against garbage/spam.
  if (isRateLimited(req, { key: 'payments-notify', max: 30, windowMs: 10 * 60 * 1000 })) {
    res.status(429).send('Too many requests');
    return;
  }

  let rawBody;
  try {
    rawBody = await readRawBody(req);
  } catch (e) {
    console.error('payments/notify.js: failed to read body', e);
    res.status(400).send('Bad request');
    return;
  }

  let config;
  try {
    config = payfast.getConfig();
  } catch (e) {
    console.error('payments/notify.js: PayFast config error', e);
    res.status(500).send('Config error');
    return;
  }

  // 1. Signature check — reject silently (200, no retry) if forged/garbled.
  const signatureOk = payfast.verifyItnSignature(rawBody, config.passphrase);
  if (!signatureOk) {
    console.error('payments/notify.js: ITN signature mismatch', rawBody);
    res.status(200).send('OK');
    return;
  }

  // 2. Mandatory server-to-server confirmation with PayFast. Not optional.
  const urls = payfast.getUrls(config.mode);
  let postbackOk;
  try {
    postbackOk = await payfast.postbackValidate(rawBody, urls.validateUrl);
  } catch (e) {
    console.error('payments/notify.js: postback validate request failed', e);
    res.status(500).send('Validation request failed');
    return;
  }
  if (!postbackOk) {
    console.error('payments/notify.js: ITN postback validation failed', rawBody);
    res.status(500).send('Validation failed');
    return;
  }

  const pfData = Object.fromEntries(new URLSearchParams(rawBody));
  const {
    pf_payment_id: pfPaymentId,
    payment_status: paymentStatus,
    amount_gross: amountGross,
    token,
    custom_str1: customStr1,
    custom_int1: customInt1,
  } = pfData;

  try {
    const supabase = getSupabase();

    // 3. Idempotency — PayFast retries ITN on any non-2xx response or timeout.
    if (pfPaymentId) {
      const { data: existing, error: existingErr } = await supabase
        .from('payments')
        .select('id')
        .eq('payfast_pf_payment_id', pfPaymentId)
        .maybeSingle();
      if (existingErr) throw existingErr;
      if (existing) {
        res.status(200).send('OK');
        return;
      }
    }

    if (paymentStatus !== 'COMPLETE') {
      console.log('payments/notify.js: non-complete ITN', paymentStatus, pfData);
      res.status(200).send('OK');
      return;
    }

    const customInt = parseInt(customInt1, 10);

    if (customStr1 === 'invoice') {
      const { data: invoice, error: invErr } = await supabase
        .from('invoices')
        .select('id, amount, customer_id')
        .eq('id', customInt)
        .maybeSingle();
      if (invErr) throw invErr;

      if (!invoice || !amountsMatch(invoice.amount, amountGross)) {
        console.error('payments/notify.js: invoice amount/id mismatch', pfData);
        await sendTeamNotification('PayFast ITN mismatch', `Invoice ITN did not match a known invoice/amount.\n${JSON.stringify(pfData, null, 2)}`);
        res.status(200).send('OK');
        return;
      }

      const { error: payErr } = await supabase.from('payments').insert({
        customer_id: invoice.customer_id,
        invoice_id: invoice.id,
        amount: amountGross,
        currency: 'ZAR',
        method: 'PayFast',
        date: new Date().toISOString(),
        type: 'invoice',
        payfast_pf_payment_id: pfPaymentId,
        raw_itn: pfData,
      });
      if (payErr) throw payErr;

      const { error: updErr } = await supabase
        .from('invoices')
        .update({ status: 'paid', paid_at: new Date().toISOString() })
        .eq('id', invoice.id);
      if (updErr) throw updErr;
    } else if (customStr1 === 'subscription') {
      const { data: plan, error: planErr } = await supabase
        .from('care_plans')
        .select('id, monthly_price, customer_id, payfast_token, renewal_date')
        .eq('id', customInt)
        .maybeSingle();
      if (planErr) throw planErr;

      if (!plan || !amountsMatch(plan.monthly_price, amountGross)) {
        console.error('payments/notify.js: care plan amount/id mismatch', pfData);
        await sendTeamNotification('PayFast ITN mismatch', `Subscription ITN did not match a known Care Plan/amount.\n${JSON.stringify(pfData, null, 2)}`);
        res.status(200).send('OK');
        return;
      }

      const paymentType = plan.payfast_token ? 'subscription_recurring' : 'subscription_initial';

      const { error: payErr } = await supabase.from('payments').insert({
        customer_id: plan.customer_id,
        amount: amountGross,
        currency: 'ZAR',
        method: 'PayFast',
        date: new Date().toISOString(),
        type: paymentType,
        payfast_pf_payment_id: pfPaymentId,
        raw_itn: pfData,
      });
      if (payErr) throw payErr;

      const updates = { renewal_date: addOneMonth(plan.renewal_date || new Date()) };
      if (paymentType === 'subscription_initial' && token) {
        updates.payfast_token = token;
        updates.payfast_token_set_at = new Date().toISOString();
      }

      const { error: updErr } = await supabase
        .from('care_plans')
        .update(updates)
        .eq('id', plan.id);
      if (updErr) throw updErr;
    } else {
      console.error('payments/notify.js: unrecognised custom_str1', pfData);
    }

    res.status(200).send('OK');
  } catch (e) {
    console.error('payments/notify.js: unexpected error', e, pfData);
    res.status(500).send('Internal error');
  }
};
