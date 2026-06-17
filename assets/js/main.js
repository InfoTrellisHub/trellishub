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
  const revealTargets = qsa('[data-reveal]');
  if ('IntersectionObserver' in window && revealTargets.length) {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-visible');
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.12 }
    );
    revealTargets.forEach((el, i) => {
      el.style.transitionDelay = prefersReducedMotion() ? '0ms' : `${Math.min(i % 4, 3) * 80}ms`;
      observer.observe(el);
    });
  } else {
    revealTargets.forEach((el) => el.classList.add('is-visible'));
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
