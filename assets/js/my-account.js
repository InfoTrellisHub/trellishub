(function () {
  const { qs, api, setStatus } = window.TrellisUtils;

  function formatStatusLabel(status) {
    return (status || 'inactive').replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase());
  }

  async function loadBookings() {
    try {
      const { bookings } = await api('/api/account/bookings');
      const tableBody = qs('#bookingsTableBody');
      const table = qs('#bookingsTable');
      const empty = qs('#bookingsEmpty');
      if (!bookings.length) {
        empty.style.display = 'block';
        table.style.display = 'none';
        return;
      }
      table.style.display = 'table';
      empty.style.display = 'none';
      tableBody.innerHTML = bookings
        .map((b) => {
          const typeLabel = b.booking_type === 'care_plan' ? 'Care Plan Inquiry' : 'Website Quote';
          const when = b.preferred_date ? `${b.preferred_date} ${b.preferred_time || ''}`.trim() : '—';
          return `<tr><td>${typeLabel}</td><td>${when}</td><td>${formatStatusLabel(b.status)}</td></tr>`;
        })
        .join('');
    } catch (e) {
      console.warn('Could not load bookings:', e.message);
    }
  }

  async function loadCarePlan() {
    try {
      const { carePlan } = await api('/api/account/care-plan');
      const statusEl = qs('#carePlanStatus');
      const renewalEl = qs('#carePlanRenewal');
      const cancelBtn = qs('#cancelPlanBtn');

      const status = carePlan ? carePlan.status : 'inactive';
      statusEl.textContent = formatStatusLabel(status);
      statusEl.className = `care-plan-status status-${status}`;

      if (carePlan && carePlan.renewal_date) {
        renewalEl.textContent = `Renews: ${carePlan.renewal_date}`;
      } else {
        renewalEl.textContent = '';
      }

      cancelBtn.style.display = status === 'active' ? 'block' : 'none';
    } catch (e) {
      console.warn('Could not load Care Plan:', e.message);
    }
  }

  function wireCancelButton() {
    const cancelBtn = qs('#cancelPlanBtn');
    if (!cancelBtn) return;
    cancelBtn.addEventListener('click', async () => {
      const statusEl = qs('#cancelPlanStatus');
      cancelBtn.disabled = true;
      try {
        await api('/api/account/care-plan-cancel', { method: 'POST' });
        setStatus(statusEl, "Cancellation requested — we'll confirm shortly.", 'success');
        await loadCarePlan();
      } catch (err) {
        setStatus(statusEl, err.message, 'error');
        cancelBtn.disabled = false;
      }
    });
  }

  function wireLogout() {
    const logoutBtn = qs('#logoutBtn');
    if (!logoutBtn) return;
    logoutBtn.addEventListener('click', async () => {
      try {
        await api('/api/auth/logout', { method: 'POST' });
      } catch (e) {
        // ignore
      }
      window.location.href = '/';
    });
  }

  async function init() {
    wireCancelButton();
    wireLogout();

    let session;
    try {
      session = await api('/api/auth/session');
    } catch (e) {
      session = { authenticated: false };
    }

    qs('#accountLoading').style.display = 'none';

    if (!session.authenticated) {
      qs('#accountUnauthenticated').style.display = 'block';
      setTimeout(() => {
        window.location.href = '/?login=1';
      }, 1500);
      return;
    }

    qs('#accountContent').style.display = 'block';
    qs('#accountName').textContent = session.customer.name.split(' ')[0];
    qs('#accountEmail').textContent = session.customer.email;

    loadBookings();
    loadCarePlan();
  }

  init();
})();
