// Server-side mirror of assets/js/pricing.js's PRICING_BY_ZONE — keep both in sync
// if these numbers ever change. Used by api/geo.js to map a visitor's country to a
// pricing zone key; the actual currency amounts are rendered client-side.
const ZONE_BY_COUNTRY = {
  // Africa
  ZA: 'africa', NG: 'africa', KE: 'africa', EG: 'africa', GH: 'africa', NA: 'africa',
  BW: 'africa', ZM: 'africa', ZW: 'africa', MZ: 'africa', TZ: 'africa', UG: 'africa',
  // Americas
  US: 'americas', CA: 'americas', MX: 'americas', BR: 'americas', AR: 'americas',
  CL: 'americas', CO: 'americas', PE: 'americas',
  // Australia (NZ grouped in for simplicity — same pricing pattern)
  AU: 'australia', NZ: 'australia',
  // Europe
  GB: 'uk',
  DE: 'europe', FR: 'europe', ES: 'europe', IT: 'europe', NL: 'europe',
  PT: 'europe', IE: 'europe', BE: 'europe', SE: 'europe', PL: 'europe', AT: 'europe'
};

function zoneForCountry(countryCode) {
  if (!countryCode) return 'fallback_usd';
  return ZONE_BY_COUNTRY[countryCode.toUpperCase()] || 'fallback_usd';
}

module.exports = { ZONE_BY_COUNTRY, zoneForCountry };
