const { getSupabase } = require('../../lib/supabase');
const { getCustomerSession } = require('../../lib/auth');
const { isRateLimited } = require('../../lib/rateLimit');
const payfast = require('../../lib/payfast');

const SITE_URL = process.env.SITE_URL || 'https://trellishub.vercel.app';

function splitName(fullName) {
  const parts = (fullName || '').trim().split(/\s+/).filter(Boolean);
  const nameFirst = parts[0] || 'Customer';
  const nameLast = parts.slice(1).join(' ') || nameFirst;
  return { nameFirst, nameLast };
}

function addOneMonth(date) {
  const d = new Date(date);
  d.setMonth(d.getMonth() + 1);
  return d;
}

function toDateStr(date) {
  return date.toISOString().slice(0, 10);
}

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

  if (isRateLimited(req, { key: 'payments-checkout', max: 10, windowMs: 10 * 60 * 1000 })) {
    res.status(429).json({ success: false, error: 'Too many requests. Please try again later.' });
    return;
  }

  const { type, invoice_id: invoiceId } = req.body || {};
  if (type !== 'invoice' && type !== 'subscription') {
    res.status(400).json({ success: false, error: 'Invalid payment type' });
    return;
  }

  let config;
  try {
    config = payfast.getConfig();
  } catch (err) {
    res.status(500).json({ success: false, error: `PayFast config error: ${err.message}` });
    return;
  }

  try {
    const supabase = getSupabase();

    const { data: customer, error: custErr } = await supabase
      .from('customers')
      .select('name, email')
      .eq('id', session.customer_id)
      .single();
    if (custErr) throw custErr;

    const { nameFirst, nameLast } = splitName(customer.name);
    const urls = payfast.getUrls(config.mode);

    const common = {
      merchantId: config.merchantId,
      merchantKey: config.merchantKey,
      returnUrl: `${SITE_URL}/payment-success`,
      cancelUrl: `${SITE_URL}/payment-cancelled`,
      notifyUrl: `${SITE_URL}/api/payments/notify`,
      nameFirst,
      nameLast,
      email: customer.email,
    };

    let fields;

    if (type === 'invoice') {
      if (!invoiceId) {
        res.status(400).json({ success: false, error: 'invoice_id is required' });
        return;
      }

      const { data: invoice, error: invErr } = await supabase
        .from('invoices')
        .select('id, invoice_no, amount, currency, status')
        .eq('id', invoiceId)
        .eq('customer_id', session.customer_id)
        .maybeSingle();
      if (invErr) throw invErr;
      if (!invoice) {
        res.status(404).json({ success: false, error: 'Invoice not found' });
        return;
      }
      if (invoice.status !== 'unpaid') {
        res.status(400).json({ success: false, error: 'This invoice is not payable online.' });
        return;
      }
      if (invoice.currency && invoice.currency !== 'ZAR') {
        res.status(400).json({ success: false, error: 'This invoice cannot be paid online — please contact support.' });
        return;
      }

      fields = payfast.buildOnceOffFields({
        ...common,
        mPaymentId: `inv-${invoice.id}`,
        amount: invoice.amount,
        itemName: `Invoice #${invoice.invoice_no || invoice.id}`,
        itemDescription: 'Trellishub invoice payment',
        customStr1: 'invoice',
        customInt1: invoice.id,
      });
    } else {
      const { data: plan, error: planErr } = await supabase
        .from('care_plans')
        .select('id, status, currency, monthly_price, renewal_date, payfast_token')
        .eq('customer_id', session.customer_id)
        .eq('status', 'active')
        .maybeSingle();
      if (planErr) throw planErr;
      if (!plan) {
        res.status(400).json({ success: false, error: 'No active Care Plan found.' });
        return;
      }
      if (plan.payfast_token) {
        res.status(400).json({ success: false, error: 'Recurring billing is already set up.' });
        return;
      }
      if (plan.currency && plan.currency !== 'ZAR') {
        res.status(400).json({ success: false, error: 'This Care Plan cannot be billed online — please contact support.' });
        return;
      }

      const renewal = plan.renewal_date ? new Date(plan.renewal_date) : null;
      const billingDate = renewal && renewal.getTime() > Date.now()
        ? toDateStr(renewal)
        : toDateStr(addOneMonth(new Date()));

      fields = payfast.buildSubscriptionFields({
        ...common,
        mPaymentId: `careplan-${plan.id}-${Date.now()}`,
        amount: plan.monthly_price,
        recurringAmount: plan.monthly_price,
        billingDate,
        frequency: 3,
        cycles: 0,
        itemName: 'Trellis Care Plan — Monthly Billing',
        itemDescription: 'Recurring monthly Care Plan billing',
        customStr1: 'subscription',
        customInt1: plan.id,
      });
    }

    const signedFields = payfast.finalizeFields(fields, config.passphrase);
    res.status(200).json({ success: true, action: urls.processUrl, fields: signedFields });
  } catch (e) {
    console.error('payments/checkout.js error:', e);
    res.status(500).json({ success: false, error: 'Something went wrong. Please try again or contact support.' });
  }
};
