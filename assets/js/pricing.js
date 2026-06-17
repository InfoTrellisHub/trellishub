(function () {
  const { qs, qsa, api } = window.TrellisUtils;

  // Mirrors lib/pricing-zones.js server-side — keep both in sync if these numbers ever change.
  const PRICING_BY_ZONE = {
    africa: { currency: 'ZAR', symbol: 'R', website: 3999, websiteBundled: 3199, carePlan: 399 },
    americas: { currency: 'USD', symbol: '$', website: 500, websiteBundled: 400, carePlan: 70 },
    australia: { currency: 'AUD', symbol: 'A$', website: 500, websiteBundled: 400, carePlan: 70 },
    europe: { currency: 'EUR', symbol: '€', website: 500, websiteBundled: 400, carePlan: 70 },
    fallback_usd: { currency: 'USD', symbol: '$', website: 500, websiteBundled: 400, carePlan: 70 }
  };

  const CURRENCY_TO_ZONE = { ZAR: 'africa', USD: 'americas', AUD: 'australia', EUR: 'europe' };
  const OVERRIDE_KEY = 'trellis_currency_override';

  function formatMoney(amount, zoneData) {
    return `${zoneData.symbol}${amount.toLocaleString()}`;
  }

  function render(zoneKey) {
    const zone = PRICING_BY_ZONE[zoneKey] || PRICING_BY_ZONE.fallback_usd;
    const save = zone.website - zone.websiteBundled;
    const pct = Math.round((save / zone.website) * 100);

    const setText = (key, value) => {
      const el = qs(`[data-price="${key}"]`);
      if (el) el.textContent = value;
    };

    setText('essential-current', `${formatMoney(zone.website, zone)}`);
    setText('bundled-original', `${formatMoney(zone.website, zone)}`);
    setText('bundled-current', `${formatMoney(zone.websiteBundled, zone)}`);
    setText('bundled-save', `Save ${formatMoney(save, zone)} (${pct}%) on your website build`);
    setText('careplan-current', `${formatMoney(zone.carePlan, zone)}`);

    qsa('.currency-pill').forEach((pill) => {
      pill.classList.toggle('is-active', pill.dataset.currency === zone.currency);
    });
  }

  function applyZoneFromCurrency(currency, opts) {
    const zoneKey = CURRENCY_TO_ZONE[currency] || 'fallback_usd';
    render(zoneKey);
    if (opts && opts.persistOverride) {
      localStorage.setItem(OVERRIDE_KEY, currency);
    }
  }

  async function detectZone() {
    const override = localStorage.getItem(OVERRIDE_KEY);
    const note = qs('#currencyDetectNote');
    if (override) {
      applyZoneFromCurrency(override);
      if (note) note.textContent = `Showing prices in ${override} (your saved preference).`;
      return;
    }

    // Render a sensible default immediately so pricing never blocks on the network.
    render('fallback_usd');

    try {
      const result = await api('/api/geo');
      const zoneKey = result && result.zone ? result.zone : 'fallback_usd';
      render(zoneKey);
      if (note) {
        note.textContent = result && result.country
          ? `Prices shown in your local currency, detected from your region (${result.country}). You can switch currency above.`
          : 'Prices shown in USD by default. You can switch currency above.';
      }
    } catch (e) {
      if (note) note.textContent = 'Prices shown in USD by default. You can switch currency above.';
    }
  }

  qsa('.currency-pill').forEach((pill) => {
    pill.addEventListener('click', () => {
      applyZoneFromCurrency(pill.dataset.currency, { persistOverride: true });
      const note = qs('#currencyDetectNote');
      if (note) note.textContent = `Showing prices in ${pill.dataset.currency}. `;
      const undo = document.createElement('a');
      undo.href = '#';
      undo.textContent = 'Use detected currency instead';
      undo.addEventListener('click', (e) => {
        e.preventDefault();
        localStorage.removeItem(OVERRIDE_KEY);
        detectZone();
      });
      if (note) note.appendChild(undo);
    });
  });

  qsa('[data-booking-cta]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const type = btn.dataset.bookingType || 'quote';
      if (window.TrellisBooking) {
        window.TrellisBooking.startBooking(type);
      } else {
        window.TrellisNav.scrollToBooking(type);
      }
    });
  });

  detectZone();

  window.TrellisPricing = { PRICING_BY_ZONE, render, detectZone };
})();
