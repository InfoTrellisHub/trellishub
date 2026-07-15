(function () {
  const { qs, qsa, prefersReducedMotion } = window.TrellisUtils;

  // Mobile nav toggle
  const navToggle = qs('#navToggle');
  const navLinks = qs('#navLinks');
  if (navToggle && navLinks) {
    navToggle.addEventListener('click', () => {
      const isOpen = navLinks.classList.toggle('is-open');
      navToggle.setAttribute('aria-expanded', String(isOpen));
    });
    qsa('a', navLinks).forEach((link) => {
      link.addEventListener('click', () => {
        navLinks.classList.remove('is-open');
        navToggle.setAttribute('aria-expanded', 'false');
      });
    });
  }

  // Smooth scroll for in-page anchors, respecting reduced motion
  qsa('a[href^="#"]').forEach((link) => {
    link.addEventListener('click', (e) => {
      const id = link.getAttribute('href');
      if (!id || id === '#') return;
      const target = qs(id);
      if (!target) return;
      e.preventDefault();
      target.scrollIntoView({ behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
      history.pushState(null, '', id);
    });
  });

  // Scroll-reveal via IntersectionObserver
  let revealObserver = null;

  function observeRevealTargets() {
    const targets = qsa('[data-reveal]:not(.is-visible)');
    if (!targets.length) return;
    if ('IntersectionObserver' in window) {
      if (!revealObserver) {
        revealObserver = new IntersectionObserver(
          (entries) => {
            entries.forEach((entry) => {
              if (entry.isIntersecting) {
                entry.target.classList.add('is-visible');
                revealObserver.unobserve(entry.target);
              }
            });
          },
          { threshold: 0.12 }
        );
      }
      targets.forEach((el, i) => {
        el.style.transitionDelay = prefersReducedMotion() ? '0ms' : `${Math.min(i % 4, 3) * 80}ms`;
        revealObserver.observe(el);
      });
    } else {
      targets.forEach((el) => el.classList.add('is-visible'));
    }
  }

  window.TrellisReveal = observeRevealTargets;

  const revealTargets = qsa('[data-reveal]');
  if ('IntersectionObserver' in window && revealTargets.length) {
    observeRevealTargets();
  } else {
    revealTargets.forEach((el) => el.classList.add('is-visible'));
  }

  // Launch special promo bar dismiss (persists across visits)
  const promoBar = qs('#promoBar');
  const promoBarClose = qs('#promoBarClose');
  if (promoBar && promoBarClose) {
    if (localStorage.getItem('trellis_promo_dismissed') === '1') {
      promoBar.hidden = true;
    }
    promoBarClose.addEventListener('click', () => {
      promoBar.hidden = true;
      localStorage.setItem('trellis_promo_dismissed', '1');
    });
  }

  // Footer year
  const yearEl = qs('#footerYear');
  if (yearEl) yearEl.textContent = String(new Date().getFullYear());

  // Deep-link helper: scroll to a target section/booking type, used by chatbot + pricing CTAs
  window.TrellisNav = {
    scrollToBooking(bookingType) {
      if (bookingType) sessionStorage.setItem('trellis_booking_type', bookingType);
      const target = qs('#booking');
      if (target) target.scrollIntoView({ behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
    },
    scrollToSection(id) {
      const target = qs(id);
      if (target) target.scrollIntoView({ behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
    }
  };
})();
