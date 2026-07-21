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

  // Last Chance Early Bird Discount: 30% off once-off build prices only, through Jul 31 2026.
  // Care plan pricing is untouched. Auto-expires after SALE_END so it can't linger unnoticed;
  // flip `active` to false manually to end it sooner.
  const SALE_END = new Date('2026-07-31T23:59:59+02:00');
  const SALE = {
    active: new Date() <= SALE_END,
    buildDiscountPercent: 30,
  };

  function fmt(symbol, amount) {
    return `${symbol}${amount.toLocaleString()}`;
  }

  // Discounts to a psychological price point ending in 9 (e.g. 1199.7 -> 1199).
  function psychoRound(amount) {
    return Math.round(amount / 10) * 10 - 1;
  }

  function render(currencyCode) {
    const p = PRICES[currencyCode] || PRICES.ZAR;
    const set = (key, val) => {
      qsa(`[data-price="${key}"]`).forEach((el) => { el.textContent = val; });
    };
    const setOriginal = (key, val) => {
      qsa(`[data-price-original="${key}"]`).forEach((el) => {
        el.textContent = val;
        el.hidden = !SALE.active;
      });
    };
    const setSave = (key, val) => {
      qsa(`[data-price-save="${key}"]`).forEach((el) => {
        el.textContent = val;
        el.hidden = !SALE.active;
      });
    };
    const setBuild = (key, tier) => {
      if (SALE.active) {
        const discounted = psychoRound(tier.build * (1 - SALE.buildDiscountPercent / 100));
        set(key, fmt(p.symbol, discounted));
        setOriginal(key, fmt(p.symbol, tier.build));
        setSave(key, `Save ${SALE.buildDiscountPercent}% — ${fmt(p.symbol, tier.build - discounted)} off`);
      } else {
        set(key, fmt(p.symbol, tier.build));
        setOriginal(key, '');
        setSave(key, '');
      }
    };

    setBuild('starter-build', p.starter);
    set('starter-care', fmt(p.symbol, p.starter.care));
    setBuild('growth-build', p.growth);
    set('growth-care', fmt(p.symbol, p.growth.care));
    setBuild('premium-build', p.premium);
    set('premium-care', fmt(p.symbol, p.premium.care));

    // Only force-hide when the sale is off; never force-show (a dismissed promo bar must stay dismissed).
    if (!SALE.active) {
      qsa('[data-sale-only]').forEach((el) => { el.hidden = true; });
    }
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

  // Live countdown to SALE_END for the Early Bird banner.
  function startCountdown() {
    const el = qs('#earlyBirdCountdown');
    if (!el || !SALE.active) return;

    const DAY = 24 * 60 * 60 * 1000;
    const values = {
      days: qs('[data-countdown="days"]', el),
      hours: qs('[data-countdown="hours"]', el),
      minutes: qs('[data-countdown="minutes"]', el),
      seconds: qs('[data-countdown="seconds"]', el),
    };

    const pad = (n) => String(n).padStart(2, '0');

    function tick() {
      const remaining = SALE_END.getTime() - Date.now();
      if (remaining <= 0) {
        clearInterval(timerId);
        el.hidden = true;
        return;
      }
      values.days.textContent = pad(Math.floor(remaining / DAY));
      values.hours.textContent = pad(Math.floor((remaining % DAY) / (60 * 60 * 1000)));
      values.minutes.textContent = pad(Math.floor((remaining % (60 * 60 * 1000)) / (60 * 1000)));
      values.seconds.textContent = pad(Math.floor((remaining % (60 * 1000)) / 1000));
      el.classList.toggle('is-ending-soon', remaining <= DAY);
    }

    tick();
    const timerId = setInterval(tick, 1000);
  }

  detectAndRender();
  startCountdown();

  window.TrellisPricing = { PRICES, SALE, SALE_END, render, detectAndRender };
})();
