'use strict';

console.log('Kick Cartel Gallery Ultra WOW Upgrade running');

const $ = (sel, ctx = document) => ctx.querySelector(sel);
const $$ = (sel, ctx = document) => [...ctx.querySelectorAll(sel)];
const isGallery     = document.body.classList.contains('gallery-page');
const isTouchDevice = window.matchMedia('(hover: none)').matches;
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const isMouseDevice = window.matchMedia('(hover: hover) and (pointer: fine)').matches;

/* ─── CART UTILITY ──────────────────────────── */
const Cart = {
  KEY: 'snd_cart',

  get() {
    try { return JSON.parse(localStorage.getItem(this.KEY) || '[]'); } catch { return []; }
  },

  save(items) {
    localStorage.setItem(this.KEY, JSON.stringify(items));
    Cart._updateBadges();
    Cart._renderSection();
    Cart._updateBillingTotal();
  },

  add(item) {
    const items = Cart.get();
    const found = items.find(i => i.id === item.id);
    found ? found.qty++ : items.push({ ...item, qty: 1 });
    Cart.save(items);
  },

  remove(id) { Cart.save(Cart.get().filter(i => i.id !== id)); },

  adjustQty(id, delta) {
    const items = Cart.get();
    const item  = items.find(i => i.id === id);
    if (!item) return;
    item.qty = Math.max(1, item.qty + delta);
    Cart.save(items);
  },

  count()  { return Cart.get().reduce((n, i) => n + i.qty, 0); },
  subtotal(){ return Cart.get().reduce((n, i) => n + (i.priceNum * i.qty), 0); },
  shipping(){ const s = Cart.subtotal(); return s === 0 ? 0 : s >= 3000 ? 0 : 99; },
  total()  { return Cart.subtotal() + Cart.shipping(); },
  fmt(n)   { return `R${n.toLocaleString('en-ZA')}`; },
  clear()  { localStorage.removeItem(this.KEY); Cart.save([]); },

  _updateBadges() {
    const n = Cart.count();
    $$('.cart-badge').forEach(b => {
      b.textContent = n || '';
      b.classList.toggle('visible', n > 0);
    });
  },

  _updateBillingTotal() {
    const el = $('#billingTotal');
    if (el) el.textContent = Cart.count()
      ? `Order Total: ${Cart.fmt(Cart.total())}`
      : 'Add items from the gallery to place an order.';
  },

  _renderSection() {
    const emptyEl   = $('#cartEmpty');
    const itemsEl   = $('#cartItems');
    const summaryEl = $('#cartSummary');
    if (!emptyEl && !itemsEl) return;

    const items = Cart.get();
    const empty = items.length === 0;

    if (emptyEl)   emptyEl.style.display   = empty ? 'flex' : 'none';
    if (summaryEl) summaryEl.style.display = empty ? 'none' : 'block';

    if (itemsEl) {
      itemsEl.innerHTML = items.map(item => `
        <div class="cart-item" data-id="${item.id}">
          <img class="cart-item-img" src="${item.img}" alt="${item.name}" loading="lazy" />
          <div class="cart-item-info">
            <div class="cart-item-name">${item.name}</div>
            <div class="cart-item-price">${item.price}</div>
          </div>
          <div class="cart-item-qty">
            <button class="qty-btn" data-action="dec" data-id="${item.id}" aria-label="Less">−</button>
            <span class="qty-val">${item.qty}</span>
            <button class="qty-btn" data-action="inc" data-id="${item.id}" aria-label="More">+</button>
          </div>
          <button class="cart-item-remove" data-id="${item.id}" aria-label="Remove item">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="15" height="15">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>`).join('');
    }

    if (summaryEl && !empty) {
      const free = Cart.shipping() === 0;
      summaryEl.innerHTML = `
        <div class="cart-summary-rows">
          <div class="cart-sum-row"><span>Subtotal</span><span>${Cart.fmt(Cart.subtotal())}</span></div>
          <div class="cart-sum-row"><span>Shipping</span><span class="${free ? 'free' : ''}">${free ? (Cart.subtotal() > 0 ? 'Free' : '—') : Cart.fmt(Cart.shipping())}</span></div>
          ${Cart.subtotal() > 0 && free ? '<div class="cart-free-note">Free delivery on orders over R3 000</div>' : ''}
          <div class="cart-sum-row cart-sum-total"><span>Total</span><span>${Cart.fmt(Cart.total())}</span></div>
        </div>
        <a href="#billing" class="btn btn-primary cart-to-checkout">Proceed to Payment</a>
      `;
    }
  },
};

/* ─── PAGE LOADER ───────────────────────────── */
(function initLoader() {
  if (!isGallery) return;
  const loader = $('#pageLoader');
  if (!loader) return;
  window.addEventListener('load', () => {
    setTimeout(() => { loader.classList.add('fade-out'); setTimeout(() => loader.remove(), 650); }, 600);
  });
})();

/* ─── NAVBAR SCROLL ────────────────────────── */
const navbar = $('.navbar');
if (navbar) {
  window.addEventListener('scroll', () => {
    navbar.classList.toggle('scrolled', window.scrollY > 60);
  }, { passive: true });
}

/* ─── HAMBURGER ────────────────────────────── */
const hamburger = $('#hamburger');
const navLinks   = $('.nav-links');
if (hamburger && navLinks) {
  hamburger.addEventListener('click', () => {
    const open = navLinks.classList.toggle('mobile-open');
    document.body.classList.toggle('mobile-nav-open', open);
    hamburger.setAttribute('aria-expanded', open);
  });
  navLinks.addEventListener('click', e => {
    if (e.target.tagName === 'A') {
      navLinks.classList.remove('mobile-open');
      document.body.classList.remove('mobile-nav-open');
    }
  });
}

/* ─── CART NAV BUTTON ───────────────────────── */
(function initCartNav() {
  Cart._updateBadges();
  $$('.cart-nav-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      if (isGallery) { window.location.href = '/portfolio/shipndrip/index.html#cart'; return; }
      const cart = document.getElementById('cart');
      if (cart) cart.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  });
})();

/* ─── TEASER SNEAKER (homepage) ────────────── */
(function initTeaserSneaker() {
  const sneaker = $('#teaserSneaker');
  if (!sneaker) return;
  document.addEventListener('mousemove', e => {
    const xR = (e.clientX / window.innerWidth  - 0.5) * 2;
    const yR = (e.clientY / window.innerHeight - 0.5) * 2;
    sneaker.style.transform = `translateY(-50%) perspective(800px) rotateX(${yR * -8}deg) rotateY(${xR * 12}deg)`;
  }, { passive: true });
  document.addEventListener('mouseleave', () => { sneaker.style.transform = 'translateY(-50%)'; });
})();

/* ─── SCROLL REVEAL ────────────────────────── */
(function initScrollReveal() {
  const items = $$('.scroll-reveal');
  if (!items.length) return;
  const obs = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      const delay = parseInt(entry.target.dataset.index || 0, 10) * 80;
      setTimeout(() => entry.target.classList.add('revealed'), delay);
      obs.unobserve(entry.target);
    });
  }, { threshold: 0.1, rootMargin: '0px 0px -30px 0px' });
  items.forEach((el, i) => { el.dataset.index = i % 8; obs.observe(el); });
})();

/* ─── FEATURED STAGGER (homepage) ──────────── */
(function initFeaturedStagger() {
  const cards = $$('.featured-card');
  if (!cards.length) return;
  const obs = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      const d = parseInt(entry.target.dataset.index || 0, 10) * 120;
      entry.target.style.transitionDelay = `${d}ms`;
      entry.target.style.opacity   = '1';
      entry.target.style.transform = 'translateY(0)';
      obs.unobserve(entry.target);
    });
  }, { threshold: 0.15 });
  cards.forEach((c, i) => {
    c.dataset.index = i;
    c.style.opacity   = '0';
    c.style.transform = 'translateY(40px)';
    c.style.transition = 'opacity .6s ease, transform .6s ease';
    obs.observe(c);
  });
})();

/* ─── MULTI-LAYER PARALLAX (5 layers) ──────── */
(function initMultiLayerParallax() {
  const hero = $('#galleryHero');
  if (!hero || isTouchDevice || reducedMotion) return;
  const layers = [
    { el: $('#parallaxDeep'),     speed: 0.05 },
    { el: $('#parallaxMid'),      speed: 0.15 },
    { el: $('#parallaxSmoke'),    speed: 0.25 },
    { el: $('#parallaxSneakers'), speed: 0.42 },
    { el: $('#parallaxFore'),     speed: 0.55 },
  ].filter(l => l.el);
  let ticking = false;
  let wc = false, wcTimer = null;
  function update() {
    ticking = false;
    const rect = hero.getBoundingClientRect();
    if (rect.bottom < 0 || rect.top > window.innerHeight) return;
    const p = -rect.top;
    layers.forEach(({ el, speed }) => { el.style.transform = `translateY(${p * speed}px)`; });
  }
  window.addEventListener('scroll', () => {
    if (!wc) { layers.forEach(({ el }) => { el.style.willChange = 'transform'; }); wc = true; }
    clearTimeout(wcTimer);
    wcTimer = setTimeout(() => { layers.forEach(({ el }) => { el.style.willChange = ''; }); wc = false; }, 180);
    if (!ticking) { requestAnimationFrame(update); ticking = true; }
  }, { passive: true });
  update();
})();

/* ─── 3D CAROUSEL ──────────────────────────── */
(function initCarousel() {
  const carousel = $('#carousel3d');
  if (!carousel) return;
  const items    = $$('.carousel-item', carousel);
  const total    = items.length;
  const ctrEl    = $('#carouselCounter');
  const nameEl   = $('#carouselName');
  const iNameEl  = $('#infoName');
  const iPriceEl = $('#infoPrice');
  const iDescEl  = $('#infoDesc');
  const dotsEl   = $$('#carouselDots .dot');

  let current = 0, autoTimer = null, isAnim = false;

  function pad(n) { return String(n + 1).padStart(2, '0'); }
  function cls(o) {
    if (o === 0)                      return 'active';
    if (o === 1)                      return 'next-1';
    if (o === 2)                      return 'next-2';
    if (o === -1 || o === total - 1)  return 'prev-1';
    if (o === -2 || o === total - 2)  return 'prev-2';
    return 'hidden';
  }

  function update(animate = true) {
    items.forEach((item, i) => {
      let o = (i - current + total) % total;
      if (o > total / 2) o -= total;
      item.className = 'carousel-item ' + cls(o);
    });
    const a = items[current];
    if (ctrEl)  ctrEl.textContent  = `${pad(current)} / ${pad(total - 1)}`;
    if (nameEl) nameEl.textContent = a.dataset.name || '';
    if (animate && iNameEl) {
      iNameEl.style.opacity = '0'; iNameEl.style.transform = 'translateY(10px)';
      setTimeout(() => {
        iNameEl.textContent = a.dataset.name || '';
        iNameEl.style.transition = 'opacity .3s ease, transform .3s ease';
        iNameEl.style.opacity = '1'; iNameEl.style.transform = 'translateY(0)';
      }, 180);
    } else if (iNameEl) { iNameEl.textContent = a.dataset.name || ''; }
    if (iPriceEl) iPriceEl.textContent = a.dataset.price || '';
    if (iDescEl)  iDescEl.textContent  = a.dataset.desc  || '';
    dotsEl.forEach((d, i) => d.classList.toggle('active', i === current));
    // Keep carousel cart button in sync with active slide
    const cartBtn = $('#carouselInfo .add-to-cart-btn');
    if (cartBtn) {
      cartBtn.dataset.name  = a.dataset.name  || '';
      cartBtn.dataset.price = a.dataset.price || '';
      cartBtn.dataset.img   = a.querySelector('img')?.src || '';
    }
  }

  function goTo(idx, anim = true) {
    if (isAnim) return; isAnim = true;
    current = ((idx % total) + total) % total;
    update(anim);
    setTimeout(() => { isAnim = false; }, 700);
  }

  const next = () => goTo(current + 1);
  const prev = () => goTo(current - 1);
  function startAuto() { stopAuto(); autoTimer = setInterval(next, 3800); }
  function stopAuto()  { clearInterval(autoTimer); autoTimer = null; }

  const btnP = $('#arrowPrev'), btnN = $('#arrowNext');
  if (btnP) btnP.addEventListener('click', () => { stopAuto(); prev(); startAuto(); });
  if (btnN) btnN.addEventListener('click', () => { stopAuto(); next(); startAuto(); });
  dotsEl.forEach(d => d.addEventListener('click', () => { stopAuto(); goTo(+d.dataset.dot); startAuto(); }));
  items.forEach((item, i) => {
    item.addEventListener('click', () => {
      if (!item.classList.contains('active')) { stopAuto(); goTo(i); startAuto(); }
    });
  });

  let tX = 0, tY = 0;
  const stage = $('#carouselStage');
  if (stage) {
    stage.addEventListener('touchstart', e => { tX = e.changedTouches[0].screenX; tY = e.changedTouches[0].screenY; }, { passive: true });
    stage.addEventListener('touchend',   e => {
      const dx = e.changedTouches[0].screenX - tX;
      const dy = e.changedTouches[0].screenY - tY;
      if (Math.abs(dx) < 30 || Math.abs(dy) > Math.abs(dx)) return;
      stopAuto(); if (dx < 0) next(); else prev(); startAuto();
    }, { passive: true });
    stage.addEventListener('mouseenter', stopAuto);
    stage.addEventListener('mouseleave', startAuto);
  }
  update(false); startAuto();
})();

/* ─── HOLOGRAM TILT (desktop only) ─────────── */
(function initHologramTilt() {
  if (!isMouseDevice) return;
  const cards = $$('.grid-card.hologram');
  if (!cards.length) return;
  cards.forEach(card => {
    card.addEventListener('mouseenter', () => { card.style.willChange = 'transform'; });
    card.addEventListener('mouseleave', () => { card.style.willChange = ''; card.style.transform = ''; });
    card.addEventListener('mousemove', e => {
      const r = card.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width;
      const y = (e.clientY - r.top)  / r.height;
      card.style.setProperty('--mx', `${x * 100}%`);
      card.style.setProperty('--my', `${y * 100}%`);
      card.style.transform = `perspective(700px) rotateX(${(y - 0.5) * -14}deg) rotateY(${(x - 0.5) * 14}deg) translateY(-10px) scale(1.03)`;
    }, { passive: true });
  });
})();

/* ─── GRID FILTER ──────────────────────────── */
(function initFilter() {
  const btns  = $$('.filter-btn');
  const cards = $$('.grid-card');
  if (!btns.length) return;
  btns.forEach(btn => {
    btn.addEventListener('click', () => {
      btns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const f = btn.dataset.filter;
      cards.forEach((card, i) => {
        const match = f === 'all' || card.dataset.category === f;
        card.classList.toggle('hidden-filter', !match);
        if (match) card.style.transitionDelay = `${(i % 8) * 60}ms`;
      });
    });
  });
})();

/* ─── SHUFFLE ───────────────────────────────── */
(function initShuffle() {
  const btn  = $('#shuffleBtn');
  const grid = $('#sneakerGrid');
  if (!btn || !grid) return;

  btn.addEventListener('click', () => {
    if (btn.disabled) return;
    const cards = $$('.grid-card:not(.hidden-filter)', grid);
    if (cards.length < 2) return;
    btn.disabled = true; btn.style.opacity = '0.45';

    cards.forEach(card => {
      const a = (Math.random() - 0.5) * 50;
      card.style.transition = 'transform 0.3s ease, opacity 0.25s ease';
      card.style.transform  = `rotate(${a}deg) scale(0.85)`;
      card.style.opacity    = '0';
    });

    setTimeout(() => {
      const arr = [...cards];
      for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
      }
      arr.forEach(card => {
        card.style.transition = 'none'; card.style.transform = ''; card.style.opacity = '0';
        card.classList.remove('revealed'); grid.appendChild(card);
      });
      requestAnimationFrame(() => requestAnimationFrame(() => {
        arr.forEach((card, i) => {
          const d = i * 55;
          card.style.transition = `opacity 0.4s ease ${d}ms, transform 0.5s cubic-bezier(0.34,1.56,0.64,1) ${d}ms`;
          card.style.opacity = ''; card.style.transform = '';
          setTimeout(() => { card.classList.add('revealed'); card.style.transition = ''; }, 500 + d);
        });
        setTimeout(() => { btn.disabled = false; btn.style.opacity = ''; }, 520 + arr.length * 55);
      }));
    }, 320);
  });
})();

/* ─── ADD TO CART (gallery) ─────────────────── */
(function initAddToCart() {
  document.addEventListener('click', e => {
    const btn = e.target.closest('.add-to-cart-btn');
    if (!btn) return;
    e.preventDefault();
    e.stopPropagation();

    // Data from spotlight data-attrs if inside spotlight, else from closest card
    const card     = btn.closest('.grid-card') || btn.closest('[data-spotlight-card]');
    const name     = btn.dataset.name  || card?.dataset.name  || card?.querySelector('h3')?.textContent || '';
    const priceStr = btn.dataset.price || card?.dataset.price || card?.querySelector('.grid-price')?.textContent || '';
    const img      = btn.dataset.img   || card?.dataset.img   || card?.querySelector('img')?.src || '';
    const priceNum = parseInt(priceStr.replace(/\D/g, '')) || 0;
    const id       = name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');

    if (!name) return;
    Cart.add({ id, name, price: priceStr, priceNum, img });

    // Visual feedback on button
    const prev = btn.textContent;
    btn.textContent = '✓ Added';
    btn.classList.add('added');
    setTimeout(() => { btn.textContent = prev; btn.classList.remove('added'); }, 1400);
  });
})();

/* ─── SPOTLIGHT + 360° DRAG ─────────────────── */
(function initSpotlight() {
  const overlay  = $('#spotlightOverlay');
  const closeBtn = $('#spotlightClose');
  const imgEl    = $('#spotlightImg');
  const nameEl   = $('#spotlightName');
  const priceEl  = $('#spotlightPrice');
  const descEl   = $('#spotlightDesc');
  const imgWrap  = $('.spotlight-img-wrap');
  const rotHint  = $('#spotlightRotateHint');
  if (!overlay) return;

  let spotDragging = false, spotStartX = 0, spotRotY = 0;

  function openSpotlight(card) {
    const img   = card.dataset.img   || card.querySelector('img')?.src || '';
    const name  = card.dataset.name  || card.querySelector('h3')?.textContent || '';
    const price = card.dataset.price || card.querySelector('.grid-price')?.textContent || '';
    const desc  = card.dataset.desc  || '';

    if (imgEl)   { imgEl.src = img; imgEl.alt = name; imgEl.style.transform = ''; }
    if (nameEl)  nameEl.textContent  = name;
    if (priceEl) priceEl.textContent = price;
    if (descEl)  descEl.textContent  = desc;
    spotRotY = 0;

    // Pass data to Add to Cart button inside spotlight
    const cartBtn = overlay.querySelector('.add-to-cart-btn');
    if (cartBtn) { cartBtn.dataset.name = name; cartBtn.dataset.price = price; cartBtn.dataset.img = img; }

    overlay.classList.add('open');
    document.body.style.overflow = 'hidden';
    if (closeBtn) closeBtn.focus();
    if (rotHint) { rotHint.style.opacity = '1'; setTimeout(() => { rotHint.style.opacity = '0'; }, 2800); }
  }

  function closeSpotlight() {
    overlay.classList.remove('open');
    document.body.style.overflow = '';
    spotRotY = 0;
    setTimeout(() => { if (imgEl) { imgEl.src = ''; imgEl.style.transform = ''; } }, 420);
  }

  if (imgWrap) {
    imgWrap.style.cursor = 'grab';
    const sStart = x => { spotDragging = true; spotStartX = x; imgWrap.style.cursor = 'grabbing'; };
    const sMove  = x => {
      if (!spotDragging || !overlay.classList.contains('open')) return;
      spotRotY += (x - spotStartX) * 0.75;
      if (imgEl) imgEl.style.transform = `perspective(600px) rotateY(${spotRotY}deg) scale(1.02)`;
      spotStartX = x;
      if (rotHint) rotHint.style.opacity = '0';
    };
    const sEnd = () => { spotDragging = false; imgWrap.style.cursor = 'grab'; };
    imgWrap.addEventListener('mousedown',  e => sStart(e.clientX));
    document.addEventListener('mousemove', e => sMove(e.clientX));
    document.addEventListener('mouseup',   sEnd);
    imgWrap.addEventListener('touchstart', e => sStart(e.touches[0].clientX), { passive: true });
    imgWrap.addEventListener('touchmove',  e => sMove(e.touches[0].clientX),  { passive: true });
    imgWrap.addEventListener('touchend',   sEnd, { passive: true });
  }

  document.addEventListener('click', e => {
    if (overlay.contains(e.target)) return;
    const trigger = e.target.closest('.spotlight-trigger');
    if (trigger) { e.preventDefault(); const c = trigger.closest('.grid-card'); if (c) openSpotlight(c); return; }
    if (e.target.closest('.grid-overlay')) return;
    if (e.target.closest('.add-to-cart-btn')) return;
    const card = e.target.closest('.grid-card');
    if (card) openSpotlight(card);
  });

  if (closeBtn) closeBtn.addEventListener('click', closeSpotlight);
  overlay.addEventListener('click', e => {
    if (e.target === overlay || e.target.classList.contains('spotlight-backdrop')) closeSpotlight();
  });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && overlay.classList.contains('open')) closeSpotlight();
  });
})();

/* ─── CART SECTION INIT (main page) ─────────── */
(function initCartSection() {
  if (!$('#cartSection')) return;

  // Render initial state
  Cart._renderSection();
  Cart._updateBillingTotal();

  // Qty and remove buttons (event delegation)
  document.addEventListener('click', e => {
    const qtyBtn    = e.target.closest('.qty-btn');
    const removeBtn = e.target.closest('.cart-item-remove');

    if (qtyBtn) {
      const id     = qtyBtn.dataset.id;
      const action = qtyBtn.dataset.action;
      if (action === 'inc') Cart.adjustQty(id, 1);
      if (action === 'dec') Cart.adjustQty(id, -1);
    }
    if (removeBtn) {
      Cart.remove(removeBtn.dataset.id);
    }
  });
})();

/* ─── BILLING FORM ──────────────────────────── */
(function initBillingForm() {
  const form = $('#billingForm');
  if (!form) return;

  // Card number auto-format
  const cardInput = form.querySelector('[name="card"]');
  if (cardInput) {
    cardInput.addEventListener('input', e => {
      const v = e.target.value.replace(/\D/g, '').slice(0, 16);
      e.target.value = v.replace(/(.{4})/g, '$1 ').trim();
    });
  }
  // Expiry auto-format
  const expInput = form.querySelector('[name="expiry"]');
  if (expInput) {
    expInput.addEventListener('input', e => {
      let v = e.target.value.replace(/\D/g, '').slice(0, 4);
      if (v.length > 2) v = v.slice(0, 2) + ' / ' + v.slice(2);
      e.target.value = v;
    });
  }
  // CVV digits only
  const cvvInput = form.querySelector('[name="cvv"]');
  if (cvvInput) cvvInput.addEventListener('input', e => { e.target.value = e.target.value.replace(/\D/g, '').slice(0, 4); });

  // Auto-fill shipping fields from saved address
  const saved = JSON.parse(localStorage.getItem('snd_address') || 'null');
  if (saved) {
    const f = (name, val) => { const el = form.querySelector(`[name="${name}"]`); if (el && !el.value) el.value = val || ''; };
    f('fullname', saved.fullname); f('address', saved.address);
    f('city',     saved.city);     f('postal',  saved.postal);
  }

  form.addEventListener('submit', e => {
    e.preventDefault();
    const items = Cart.get();
    if (!items.length) {
      showFormMsg(form, 'Your cart is empty — add items from the gallery first.', 'error');
      return;
    }

    const data = new FormData(form);
    const required = ['fullname', 'email', 'address', 'city', 'postal', 'card', 'expiry', 'cvv', 'cardname'];
    for (const key of required) {
      if (!(data.get(key) || '').trim()) {
        showFormMsg(form, 'Please fill in all fields before placing your order.', 'error');
        return;
      }
    }

    // Save order
    const orders = JSON.parse(localStorage.getItem('snd_orders') || '[]');
    const orderId = `SND-${Date.now().toString().slice(-7)}`;
    const order = {
      id:        orderId,
      timestamp: Date.now(),
      date:      new Date().toLocaleDateString('en-ZA', { day: '2-digit', month: 'short', year: 'numeric' }),
      items:     items.map(i => ({ name: i.name, qty: i.qty, price: i.price })),
      total:     Cart.fmt(Cart.total()),
      status:    'Processing',
      email:     data.get('email'),
      shipping: {
        name:    data.get('fullname'),
        address: data.get('address'),
        city:    data.get('city'),
        postal:  data.get('postal'),
      },
    };
    orders.push(order);
    localStorage.setItem('snd_orders', JSON.stringify(orders));
    Cart.clear();

    // Show confirmation
    const confirm = $('#orderConfirm');
    if (confirm) {
      const idEl = $('#confirmOrderId');
      if (idEl) idEl.textContent = orderId;
      confirm.classList.add('visible');
    }
    form.reset();
  });

  // Dismiss confirmation
  document.addEventListener('click', e => {
    if (e.target.id === 'orderConfirmClose' || e.target.id === 'orderConfirm') {
      $('#orderConfirm')?.classList.remove('visible');
    }
  });

  function showFormMsg(form, text, type) {
    let msg = form.querySelector('.form-msg');
    if (!msg) { msg = document.createElement('p'); msg.className = 'form-msg'; form.appendChild(msg); }
    msg.textContent = text;
    msg.className   = `form-msg ${type}`;
    msg.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    setTimeout(() => msg.remove(), 5000);
  }
})();

/* ─── PROFILE ───────────────────────────────── */
(function initProfile() {
  const overlay      = $('#profileOverlay');
  const backdrop     = $('#profileBackdrop');
  const closeBtn     = $('#profileClose');
  const avatarEl     = $('#profileAvatar');
  const displayName  = $('#profileDisplayName');
  const memberSince  = $('#profileMemberSince');
  const nameInput    = $('#profileNameInput');
  const saveBtn      = $('#profileSaveBtn');
  const ordersEl     = $('#profileOrders');
  const paymentsEl   = $('#profilePayments');
  const daysEl       = $('#profileDays');
  const totalSpentEl = $('#profileTotalSpent');
  const orderCountEl = $('#profileOrderCount');
  const openBtns     = $$('.profile-nav-btn');
  if (!overlay) return;

  const STEPS = ['Placed', 'Processing', 'Shipped', 'Out for Delivery', 'Delivered'];

  function getStep(order) {
    const age = Date.now() - (order.timestamp || 0);
    if (age >= 1800000) return 4;
    if (age >= 1200000) return 3;
    if (age >=  600000) return 2;
    return 1;
  }

  function tracker(stepIdx) {
    return `<div class="order-tracker">${
      STEPS.map((label, i) => {
        const cls = i < stepIdx ? 'done' : i === stepIdx ? 'current' : '';
        return `<div class="track-step ${cls}"><div class="track-dot"></div><span class="track-label">${label}</span></div>`;
      }).join('')
    }</div>`;
  }

  function getInitials(name) {
    if (!name.trim()) return '?';
    return name.trim().split(/\s+/).map(w => w[0].toUpperCase()).join('').slice(0, 2);
  }

  function loadProfile() {
    const name   = localStorage.getItem('snd_name')   || '';
    const joined = localStorage.getItem('snd_joined') || String(Date.now());
    if (!localStorage.getItem('snd_joined')) localStorage.setItem('snd_joined', joined);
    const days   = Math.max(1, Math.ceil((Date.now() - parseInt(joined)) / 86400000));
    const orders = JSON.parse(localStorage.getItem('snd_orders') || '[]');
    const spent  = orders.reduce((n, o) => n + (parseInt((o.total || '').replace(/\D/g, '')) || 0), 0);

    if (avatarEl)     avatarEl.textContent    = getInitials(name);
    if (displayName)  displayName.textContent = name || 'Guest User';
    if (memberSince)  memberSince.textContent = `Member · ${days} day${days > 1 ? 's' : ''}`;
    if (nameInput)    nameInput.value         = name;
    if (daysEl)       daysEl.textContent      = days;
    if (orderCountEl) orderCountEl.textContent = orders.length;
    if (totalSpentEl) totalSpentEl.textContent = spent > 0 ? Cart.fmt(spent) : 'R0';

    // ── Orders tab ──
    if (ordersEl) {
      if (!orders.length) {
        ordersEl.innerHTML = `<div class="profile-no-orders">No orders yet. <a href="/portfolio/shipndrip/gallery.html">Shop the gallery →</a></div>`;
      } else {
        ordersEl.innerHTML = [...orders].reverse().map(order => {
          const stepIdx = getStep(order);
          const items   = order.items.map(i => `${i.name} ×${i.qty}`).join(', ');
          return `
            <div class="profile-order">
              <div class="profile-order-top">
                <span class="profile-order-id">${order.id}</span>
                <span class="profile-order-date">${order.date}</span>
              </div>
              ${tracker(stepIdx)}
              <div class="profile-order-items">${items}</div>
              <div class="profile-order-total">${order.total}</div>
            </div>`;
        }).join('');
      }
    }

    // ── Payments tab ──
    if (paymentsEl) {
      if (!orders.length) {
        paymentsEl.innerHTML = `<div class="profile-no-orders">No payment history yet.</div>`;
      } else {
        paymentsEl.innerHTML = [...orders].reverse().map(order => `
          <div class="payment-card">
            <div class="payment-top">
              <div class="payment-method">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" width="18" height="18">
                  <rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/>
                </svg>
                Card
              </div>
              <span class="payment-amount">${order.total}</span>
            </div>
            <div class="payment-bottom">
              <span class="payment-ref">${order.id}</span>
              <span class="payment-date-text">${order.date}</span>
              <span class="payment-paid">Paid</span>
            </div>
          </div>`).join('');
      }
    }

    // ── Address tab ──
    const saved = JSON.parse(localStorage.getItem('snd_address') || 'null');
    if (saved) {
      const f = (id, v) => { const el = document.getElementById(id); if (el) el.value = v || ''; };
      f('addrName', saved.fullname); f('addrStreet', saved.address);
      f('addrCity',  saved.city);    f('addrPostal', saved.postal);
    }
  }

  function saveAddress() {
    const g = id => (document.getElementById(id)?.value || '').trim();
    localStorage.setItem('snd_address', JSON.stringify({
      fullname: g('addrName'), address: g('addrStreet'),
      city:     g('addrCity'), postal:  g('addrPostal'),
    }));
    const msg = $('#addrSavedMsg');
    if (msg) { msg.textContent = '✓ Address saved'; msg.style.opacity = '1'; setTimeout(() => { msg.style.opacity = '0'; }, 2200); }
  }

  function open() {
    loadProfile();
    overlay.classList.add('open');
    document.body.style.overflow = 'hidden';
  }
  function close() { overlay.classList.remove('open'); document.body.style.overflow = ''; }
  function saveName() {
    localStorage.setItem('snd_name', (nameInput?.value || '').trim());
    loadProfile();
  }

  // Tab switching
  $$('.profile-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      $$('.profile-tab').forEach(t => t.classList.remove('active'));
      $$('.profile-tab-panel').forEach(p => p.classList.remove('active'));
      tab.classList.add('active');
      const id = 'tab' + tab.dataset.tab.charAt(0).toUpperCase() + tab.dataset.tab.slice(1);
      document.getElementById(id)?.classList.add('active');
    });
  });

  openBtns.forEach(btn => btn.addEventListener('click', open));
  if (closeBtn) closeBtn.addEventListener('click', close);
  if (backdrop) backdrop.addEventListener('click', close);
  if (saveBtn)  saveBtn.addEventListener('click', saveName);
  if (nameInput) nameInput.addEventListener('keydown', e => { if (e.key === 'Enter') saveName(); });
  const saveAddrBtn = $('#saveAddressBtn');
  if (saveAddrBtn) saveAddrBtn.addEventListener('click', saveAddress);
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && overlay.classList.contains('open')) close();
  });
})();

/* ─── SMOOTH ANCHOR SCROLL ─────────────────── */
$$('a[href^="#"]').forEach(a => {
  a.addEventListener('click', e => {
    const id = a.getAttribute('href').slice(1);
    const t  = document.getElementById(id);
    if (!t) return;
    e.preventDefault();
    t.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
});
