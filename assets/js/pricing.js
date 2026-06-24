(function () {
  const { qs, qsa } = window.TrellisUtils;

  const PRICES = {
    ZAR: {
      symbol: 'R', code: 'ZAR',
      starter: { build: 3999,  care: 499  },
      growth:  { build: 6499,  care: 999  },
      premium: { build: 12999, care: 1999 },
    },
    USD: {
      symbol: '$', code: 'USD',
      starter: { build: 599,  care: 50  },
      growth:  { build: 1199, care: 100 },
      premium: { build: 2499, care: 200 },
    },
    GBP: {
      symbol: '£', code: 'GBP',
      starter: { build: 499,  care: 40  },
      growth:  { build: 999,  care: 80  },
      premium: { build: 1999, care: 160 },
    },
    EUR: {
      symbol: '€', code: 'EUR',
      starter: { build: 599,  care: 50  },
      growth:  { build: 1199, care: 100 },
      premium: { build: 2499, care: 200 },
    },
    AUD: {
      symbol: 'A$', code: 'AUD',
      starter: { build: 899,  care: 75  },
      growth:  { build: 1699, care: 150 },
      premium: { build: 3499, care: 300 },
    },
  };

  // Maps geo API zone names → currency code
  const ZONE_TO_CURRENCY = {
    africa:       'ZAR',
    americas:     'USD',
    australia:    'AUD',
    europe:       'EUR',
    uk:           'GBP',
    fallback_usd: 'ZAR',
  };

  // Maps browser locale region tag → currency code
  const REGION_TO_CURRENCY = {
    ZA: 'ZAR',
    US: 'USD', CA: 'USD', MX: 'USD',
    GB: 'GBP',
    AU: 'AUD', NZ: 'AUD',
    DE: 'EUR', FR: 'EUR', IT: 'EUR', ES: 'EUR', NL: 'EUR',
    BE: 'EUR', AT: 'EUR', PT: 'EUR', IE: 'EUR', FI: 'EUR',
    GR: 'EUR', LU: 'EUR', SK: 'EUR', SI: 'EUR', EE: 'EUR',
    LV: 'EUR', LT: 'EUR', CY: 'EUR', MT: 'EUR',
  };

  function fmt(symbol, amount) {
    return `${symbol}${amount.toLocaleString()}`;
  }

  function render(currencyCode) {
    const p = PRICES[currencyCode] || PRICES.ZAR;
    const set = (key, val) => {
      qsa(`[data-price="${key}"]`).forEach((el) => { el.textContent = val; });
    };
    set('starter-build', fmt(p.symbol, p.starter.build));
    set('starter-care',  fmt(p.symbol, p.starter.care));
    set('growth-build',  fmt(p.symbol, p.growth.build));
    set('growth-care',   fmt(p.symbol, p.growth.care));
    set('premium-build', fmt(p.symbol, p.premium.build));
    set('premium-care',  fmt(p.symbol, p.premium.care));
  }

  function currencyFromLocale() {
    const lang = (navigator.language || navigator.languages && navigator.languages[0] || 'en-ZA');
    const region = lang.split('-')[1] || '';
    return REGION_TO_CURRENCY[region.toUpperCase()] || 'ZAR';
  }

  async function detectAndRender() {
    // Apply locale guess immediately so pricing is never blank
    render(currencyFromLocale());

    try {
      const res = await fetch('/api/geo');
      if (res.ok) {
        const data = await res.json();
        const currency = ZONE_TO_CURRENCY[data.zone] || currencyFromLocale();
        render(currency);
      }
    } catch (_) {
      // locale fallback already applied above
    }
  }

  // Wire booking CTAs
  qsa('[data-booking-cta]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const type = btn.dataset.bookingType || 'quote';
      if (window.TrellisBooking) {
        window.TrellisBooking.startBooking(type);
      } else if (window.TrellisNav) {
        window.TrellisNav.scrollToBooking(type);
      }
    });
  });

  detectAndRender();

  window.TrellisPricing = { PRICES, render, detectAndRender };
})();
