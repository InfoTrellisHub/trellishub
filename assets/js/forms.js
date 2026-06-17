// Contact + Booking form handling, gated behind the auth modal at submit time.
// Pricing CTAs and the chatbot's booking deep-link both call window.TrellisBooking.startBooking().
(function () {
  const { qs, qsa, api, setStatus, isValidEmail } = window.TrellisUtils;

  function formToObject(form) {
    const data = {};
    Array.from(form.elements).forEach((el) => {
      if (!el.name) return;
      data[el.name] = el.value;
    });
    return data;
  }

  function showFieldErrors(form, isValidMap) {
    Object.entries(isValidMap).forEach(([name, valid]) => {
      const input = form.elements[name];
      if (!input) return;
      const field = input.closest('.field');
      if (field) field.classList.toggle('has-error', !valid);
    });
  }

  // ---- Booking form ----
  const bookingForm = qs('#bookingForm');
  const bookingToggle = qs('#bookingToggle');
  const bookingTypeInput = qs('#bookingTypeInput');

  function setBookingType(type) {
    if (!bookingTypeInput) return;
    bookingTypeInput.value = type;
    if (bookingToggle) {
      qsa('button', bookingToggle).forEach((btn) => btn.classList.toggle('is-active', btn.dataset.bookingType === type));
    }
  }

  if (bookingToggle) {
    qsa('button', bookingToggle).forEach((btn) => {
      btn.addEventListener('click', () => setBookingType(btn.dataset.bookingType));
    });
  }

  function prefillBookingForm(prefill) {
    if (!bookingForm || !prefill) return;
    if (prefill.name && bookingForm.elements.name) bookingForm.elements.name.value = prefill.name;
    if (prefill.email && bookingForm.elements.email) bookingForm.elements.email.value = prefill.email;
    if (prefill.phone && bookingForm.elements.phone) bookingForm.elements.phone.value = prefill.phone;
  }

  async function submitBooking(data, statusEl) {
    try {
      await api('/api/booking', { method: 'POST', body: data });
      setStatus(statusEl, "Thanks! We've received your booking request and will confirm shortly.", 'success');
      bookingForm.reset();
      setBookingType(data.booking_type);
    } catch (err) {
      setStatus(statusEl, err.message, 'error');
    }
  }

  if (bookingForm) {
    bookingForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const statusEl = qs('#bookingStatus');
      const data = formToObject(bookingForm);

      const validMap = { name: Boolean(data.name && data.name.trim()), email: isValidEmail(data.email) };
      showFieldErrors(bookingForm, validMap);
      if (!validMap.name || !validMap.email) {
        setStatus(statusEl, 'Please fill in the required fields.', 'error');
        return;
      }

      if (!window.TrellisAuth.isAuthenticated()) {
        window.TrellisAuth.openModal({
          defaultTab: 'signup',
          prefill: { name: data.name, email: data.email },
          onSuccess: () => submitBooking(data, statusEl)
        });
        return;
      }

      submitBooking(data, statusEl);
    });
  }

  window.TrellisBooking = {
    startBooking(type, prefill) {
      setBookingType(type || 'quote');
      prefillBookingForm(prefill);
      window.TrellisNav.scrollToBooking(type);
    }
  };

  // Pre-select booking type if arriving via a deep-link set before this page load.
  const pendingType = sessionStorage.getItem('trellis_booking_type');
  if (pendingType) {
    setBookingType(pendingType);
    sessionStorage.removeItem('trellis_booking_type');
  }

  // ---- Contact form ----
  const contactForm = qs('#contactForm');

  async function submitContact(data, statusEl) {
    try {
      await api('/api/contact', { method: 'POST', body: data });
      setStatus(statusEl, "Thanks for reaching out! We'll be in touch within 24 hours.", 'success');
      contactForm.reset();
    } catch (err) {
      setStatus(statusEl, err.message, 'error');
    }
  }

  if (contactForm) {
    contactForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const statusEl = qs('#contactStatus');
      const data = formToObject(contactForm);

      const validMap = { name: Boolean(data.name && data.name.trim()), email: isValidEmail(data.email), message: Boolean(data.message && data.message.trim()) };
      showFieldErrors(contactForm, validMap);
      if (!validMap.name || !validMap.email || !validMap.message) {
        setStatus(statusEl, 'Please fill in the required fields.', 'error');
        return;
      }

      if (!window.TrellisAuth.isAuthenticated()) {
        window.TrellisAuth.openModal({
          defaultTab: 'signup',
          prefill: { name: data.name, email: data.email },
          onSuccess: () => submitContact(data, statusEl)
        });
        return;
      }

      submitContact(data, statusEl);
    });
  }
})();
