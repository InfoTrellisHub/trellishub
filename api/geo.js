const { zoneForCountry } = require('../lib/pricing-zones');
const { getClientIp } = require('../lib/rateLimit');

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    res.status(405).json({ country: null, zone: 'fallback_usd' });
    return;
  }

  const ip = getClientIp(req);

  // Local/dev or unresolvable IPs (e.g. ::1) can't be geolocated — fall back immediately.
  if (!ip || ip === 'unknown' || ip.startsWith('127.') || ip === '::1') {
    res.status(200).json({ country: null, zone: 'fallback_usd' });
    return;
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 2500);
    const response = await fetch(`https://ipapi.co/${ip}/json/`, { signal: controller.signal });
    clearTimeout(timeout);

    if (!response.ok) {
      res.status(200).json({ country: null, zone: 'fallback_usd' });
      return;
    }

    const data = await response.json();
    const country = data && data.country_code ? data.country_code : null;
    res.status(200).json({ country, zone: zoneForCountry(country) });
  } catch (e) {
    res.status(200).json({ country: null, zone: 'fallback_usd' });
  }
};
