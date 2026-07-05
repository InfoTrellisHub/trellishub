// PayFast (https://www.payfast.co.za) integration helpers: signature generation for
// outgoing checkout requests, and signature + postback verification for incoming ITN
// (Instant Transaction Notification) webhooks. Mirrors lib/mailer.js's lazy-init style.
const crypto = require('crypto');

function getConfig() {
  const mode = process.env.PAYFAST_MODE === 'live' ? 'live' : 'sandbox';
  const merchantId = process.env.PAYFAST_ID;
  const merchantKey = process.env.PAYFAST_KEY;
  const passphrase = process.env.PAYFAST_PASSPHRASE || '';
  if (!merchantId || !merchantKey) {
    throw new Error('PAYFAST_ID / PAYFAST_KEY are not set');
  }
  return { mode, merchantId, merchantKey, passphrase };
}

function getUrls(mode) {
  return mode === 'live'
    ? {
        processUrl: 'https://www.payfast.co.za/eng/process',
        validateUrl: 'https://www.payfast.co.za/eng/query/validate',
      }
    : {
        processUrl: 'https://sandbox.payfast.co.za/eng/process',
        validateUrl: 'https://sandbox.payfast.co.za/eng/query/validate',
      };
}

// Emulates PHP's urlencode() — NOT the same as encodeURIComponent(). PayFast's
// signature spec is defined against PHP's encoding, which escapes ! ' ( ) * ~ and
// encodes spaces as "+" rather than "%20". Getting this wrong silently breaks the
// signature only for values containing those characters.
function pfEncode(value) {
  return encodeURIComponent(String(value).trim())
    .replace(/%20/g, '+')
    .replace(/!/g, '%21')
    .replace(/'/g, '%27')
    .replace(/\(/g, '%28')
    .replace(/\)/g, '%29')
    .replace(/\*/g, '%2A')
    .replace(/~/g, '%7E');
}

// `fields` must be a plain object built in the exact order PayFast expects — object
// insertion order of string keys is preserved by JS and relied on here.
function buildSignature(fields, passphrase) {
  const parts = [];
  for (const [key, value] of Object.entries(fields)) {
    if (key === 'signature') continue;
    if (value === undefined || value === null || value === '') continue;
    parts.push(`${key}=${pfEncode(value)}`);
  }
  let str = parts.join('&');
  if (passphrase) str += `&passphrase=${pfEncode(passphrase)}`;
  return crypto.createHash('md5').update(str).digest('hex');
}

function buildOnceOffFields({
  merchantId, merchantKey, returnUrl, cancelUrl, notifyUrl,
  nameFirst, nameLast, email, mPaymentId, amount, itemName, itemDescription,
  customStr1, customInt1,
}) {
  return {
    merchant_id: merchantId,
    merchant_key: merchantKey,
    return_url: returnUrl,
    cancel_url: cancelUrl,
    notify_url: notifyUrl,
    name_first: nameFirst,
    name_last: nameLast,
    email_address: email,
    m_payment_id: mPaymentId,
    amount: Number(amount).toFixed(2),
    item_name: itemName,
    item_description: itemDescription,
    custom_str1: customStr1,
    custom_int1: customInt1,
  };
}

function buildSubscriptionFields({
  merchantId, merchantKey, returnUrl, cancelUrl, notifyUrl,
  nameFirst, nameLast, email, mPaymentId, amount, itemName, itemDescription,
  customStr1, customInt1, billingDate, recurringAmount, frequency = 3, cycles = 0,
}) {
  return {
    ...buildOnceOffFields({
      merchantId, merchantKey, returnUrl, cancelUrl, notifyUrl,
      nameFirst, nameLast, email, mPaymentId, amount, itemName, itemDescription,
      customStr1, customInt1,
    }),
    subscription_type: 1,
    billing_date: billingDate,
    recurring_amount: Number(recurringAmount).toFixed(2),
    frequency,
    cycles,
  };
}

function finalizeFields(fields, passphrase) {
  const signature = buildSignature(fields, passphrase);
  return { ...fields, signature };
}

// Rebuilds the hash from the raw incoming body's own field order (URLSearchParams
// preserves arrival order) and compares to the signature PayFast sent.
function verifyItnSignature(rawBody, passphrase) {
  const params = new URLSearchParams(rawBody);
  const received = params.get('signature');
  if (!received) return false;
  params.delete('signature');
  const parts = [];
  for (const [key, value] of params) {
    if (value === '') continue;
    parts.push(`${key}=${pfEncode(value)}`);
  }
  let str = parts.join('&');
  if (passphrase) str += `&passphrase=${pfEncode(passphrase)}`;
  const computed = crypto.createHash('md5').update(str).digest('hex');
  return computed === received;
}

// Mandatory server-to-server confirmation: PayFast requires posting the raw ITN body
// back to their own validate endpoint. Signature checking alone is not sufficient.
async function postbackValidate(rawBody, validateUrl) {
  const res = await fetch(validateUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: rawBody,
  });
  const text = (await res.text()).trim();
  return text === 'VALID';
}

module.exports = {
  getConfig,
  getUrls,
  pfEncode,
  buildSignature,
  buildOnceOffFields,
  buildSubscriptionFields,
  finalizeFields,
  verifyItnSignature,
  postbackValidate,
};
