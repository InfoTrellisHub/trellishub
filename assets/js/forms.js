// Contact + Booking form handling.
// Forms work for both guests and logged-in users.
// When logged in, name/email auto-fill via TrellisForms.prefillFromCustomer().
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

  // ---- Auto-fill from logged-in customer ----
  function prefillFromCustomer(customer) {
    if (!customer) return;
    const name = customer.name || '';
    const email = customer.email || '';

    const contactName = qs('#contactName');
    const contactEmail = qs('#contactEmail');
    if (contactName && !contactName.value) contactName.value = name;
    if (contactEmail && !contactEmail.value) contactEmail.value = email;

    const bookingName = qs('#bookingName');
    const bookingEmail = qs('#bookingEmail');
    if (bookingName && !bookingName.value) bookingName.value = name;
    if (bookingEmail && !bookingEmail.value) bookingEmail.value = email;
  }

  window.TrellisForms = { prefillFromCustomer };

  // ---- Outer contact tab switching ----
  const contactTabToggle = qs('#contactTabToggle');
  const tabPanelMessage = qs('#tabPanelMessage');
  const tabPanelBooking = qs('#tabPanelBooking');

  function switchContactTab(tab) {
    if (!contactTabToggle) return;
    qsa('[data-tab]', contactTabToggle).forEach((btn) => {
      const active = btn.dataset.tab === tab;
      btn.classList.toggle('is-active', active);
      btn.setAttribute('aria-selected', active);
    });
    if (tabPanelMessage) tabPanelMessage.hidden = tab !== 'message';
    if (tabPanelBooking) tabPanelBooking.hidden = tab !== 'booking';
  }

  if (contactTabToggle) {
    qsa('[data-tab]', contactTabToggle).forEach((btn) => {
      btn.addEventListener('click', () => switchContactTab(btn.dataset.tab));
    });
  }

  const switchToBookingBtn = qs('#switchToBookingBtn');
  if (switchToBookingBtn) {
    switchToBookingBtn.addEventListener('click', (e) => {
      e.preventDefault();
      switchContactTab('booking');
      const section = qs('#contact');
      if (section) section.scrollIntoView({ behavior: 'smooth' });
    });
  }

  if (window.location.hash === '#booking') switchContactTab('booking');

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

      submitBooking(data, statusEl);
    });
  }

  window.TrellisBooking = {
    startBooking(type, prefill) {
      switchContactTab('booking');
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

      submitContact(data, statusEl);
    });
  }
})();
