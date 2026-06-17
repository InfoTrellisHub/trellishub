// Shared validation/sanitization for public-facing API payloads.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function isValidEmail(value) {
  return typeof value === 'string' && EMAIL_RE.test(value.trim());
}

function clean(value, maxLen) {
  if (typeof value !== 'string') return '';
  return value.trim().slice(0, maxLen || 1000);
}

function isHoneypotTripped(body) {
  return Boolean(body && typeof body.company_website === 'string' && body.company_website.trim() !== '');
}

function validateContact(body) {
  const errors = [];
  const data = {
    name: clean(body.name, 120),
    email: clean(body.email, 200).toLowerCase(),
    phone: clean(body.phone, 40),
    company: clean(body.company, 120),
    message: clean(body.message, 4000)
  };
  if (!data.name) errors.push('Name is required.');
  if (!isValidEmail(data.email)) errors.push('A valid email is required.');
  if (!data.message) errors.push('Message is required.');
  return { valid: errors.length === 0, errors, data };
}

function validateBooking(body) {
  const errors = [];
  const data = {
    name: clean(body.name, 120),
    email: clean(body.email, 200).toLowerCase(),
    phone: clean(body.phone, 40),
    booking_type: body.booking_type === 'care_plan' ? 'care_plan' : 'quote',
    preferred_date: clean(body.preferred_date, 20) || null,
    preferred_time: clean(body.preferred_time, 20) || null,
    notes: clean(body.notes, 4000)
  };
  if (!data.name) errors.push('Name is required.');
  if (!isValidEmail(data.email)) errors.push('A valid email is required.');
  return { valid: errors.length === 0, errors, data };
}

module.exports = { isValidEmail, clean, isHoneypotTripped, validateContact, validateBooking };
