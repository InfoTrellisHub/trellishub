// Draggable left-side account panel. Shown when a customer is logged in.
// window.TrellisAccountPanel: { show, hide, openPanel, closePanel }
window.TrellisAccountPanel = (function () {
  const { qs, api, setStatus } = window.TrellisUtils;

  let panel, tab;
  let isDragging = false;
  let dragStartY = 0;
  let panelStartTop = 0;
  let currentCustomer = null;

  function getInitials(name) {
    if (!name) return '?';
    const parts = name.trim().split(/\s+/);
    return parts.length === 1
      ? parts[0][0].toUpperCase()
      : (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }

  // ── Panel open/close ──────────────────────────────────────────────────────

  function openPanel() {
    if (!panel) return;
    panel.classList.remove('is-hidden');
    if (tab) tab.style.display = 'none';
  }

  function closePanel() {
    if (!panel) return;
    panel.classList.add('is-hidden');
    if (tab) tab.style.display = 'block';
  }

  function show(customer) {
    if (!panel) return;
    currentCustomer = customer;
    qs('#accountPanelAvatar').textContent = getInitials(customer.name);
    qs('#accountPanelName').textContent = customer.name || '';
    qs('#accountPanelEmail').textContent = customer.email || '';
    if (tab) tab.style.display = 'block';
    openPanel();
  }

  function hide() {
    if (!panel) return;
    panel.classList.add('is-hidden');
    if (tab) tab.style.display = 'none';
  }

  // ── Sub-view navigation ───────────────────────────────────────────────────

  function showView(viewId) {
    const main = qs('#accountPanelMain');
    const views = panel.querySelectorAll('.account-panel-subview');
    if (main) main.hidden = viewId !== 'main';
    views.forEach((v) => { v.hidden = v.id !== viewId; });
  }

  function backToMain() {
    showView('main');
  }

  // ── Profile sub-view ──────────────────────────────────────────────────────

  function loadProfile() {
    if (!currentCustomer) return;
    const nameInput = qs('#profileNameInput');
    const emailInput = qs('#profileEmailDisplay');
    const avatarEl = qs('#profileAvatarDisplay');
    if (nameInput) nameInput.value = currentCustomer.name || '';
    if (emailInput) emailInput.value = currentCustomer.email || '';
    if (avatarEl) avatarEl.textContent = getInitials(currentCustomer.name);
    const statusEl = qs('#profileStatus');
    if (statusEl) { statusEl.textContent = ''; statusEl.className = 'form-status'; }
  }

  async function saveProfile() {
    const nameInput = qs('#profileNameInput');
    const statusEl = qs('#profileStatus');
    const name = nameInput ? nameInput.value.trim() : '';
    if (!name) { setStatus(statusEl, 'Name cannot be empty.', 'error'); return; }
    setStatus(statusEl, 'Saving…', '');
    try {
      const result = await api('/api/account/profile', { method: 'POST', body: { name } });
      currentCustomer = { ...currentCustomer, name: result.name || name };
      qs('#accountPanelName').textContent = currentCustomer.name;
      qs('#accountPanelAvatar').textContent = getInitials(currentCustomer.name);
      setStatus(statusEl, 'Profile updated!', 'success');
    } catch (err) {
      setStatus(statusEl, err.message || 'Failed to save.', 'error');
    }
  }

  // ── Billing sub-view ──────────────────────────────────────────────────────

  async function loadBilling() {
    const container = qs('#billingContent');
    if (!container) return;
    container.innerHTML = '<p class="panel-loading">Loading&hellip;</p>';
    try {
      const data = await api('/api/account/billing');
      if (!data || (!data.plan && (!data.invoices || !data.invoices.length))) {
        container.innerHTML = '<p class="panel-loading">No billing records yet.</p>';
        return;
      }
      let html = '';
      if (data.plan) {
        html += `<div class="panel-info-row"><span>Plan</span><span>${data.plan}</span></div>`;
        if (data.monthly_price) html += `<div class="panel-info-row"><span>Monthly</span><span>${data.monthly_price}</span></div>`;
        if (data.renewal_date) html += `<div class="panel-info-row"><span>Renewal</span><span>${data.renewal_date}</span></div>`;
        html += '<div class="account-panel-divider"></div>';
      }
      if (data.invoices && data.invoices.length) {
        html += '<p class="panel-section-label">Payment History</p>';
        data.invoices.forEach((inv) => {
          html += `<div class="panel-info-row"><span>${inv.date}</span><span>${inv.amount}</span></div>`;
        });
      } else {
        html += '<p class="panel-loading" style="margin-top:0">No payment history yet.</p>';
      }
      container.innerHTML = html;
    } catch {
      container.innerHTML = '<p class="panel-loading">Could not load billing info.</p>';
    }
  }

  // ── Care Plan sub-view ────────────────────────────────────────────────────

  async function loadCarePlan() {
    const container = qs('#carePlanPanelContent');
    if (!container) return;
    container.innerHTML = '<p class="panel-loading">Loading&hellip;</p>';
    try {
      const data = await api('/api/account/care-plan');
      const status = (data && data.status) || 'inactive';
      const badgeClass = status === 'active' ? 'is-active'
        : status === 'cancellation_requested' ? 'is-pending' : 'is-inactive';
      const badgeLabel = status === 'active' ? 'Active'
        : status === 'cancellation_requested' ? 'Cancellation Requested'
        : status === 'cancelled' ? 'Cancelled' : 'Not Subscribed';
      let html = `<div class="panel-info-row"><span>Status</span><span><span class="panel-status-badge ${badgeClass}">${badgeLabel}</span></span></div>`;
      if (data && data.renewal_date) {
        html += `<div class="panel-info-row"><span>Renewal</span><span>${data.renewal_date}</span></div>`;
      }
      if (data && data.start_date) {
        html += `<div class="panel-info-row"><span>Started</span><span>${data.start_date}</span></div>`;
      }
      if (data && data.monthly_price && data.currency) {
        html += `<div class="panel-info-row"><span>Monthly</span><span>${data.currency} ${data.monthly_price}</span></div>`;
      }
      if (status === 'inactive' || status === 'cancelled') {
        html += `<div class="account-panel-divider"></div><a href="#pricing" class="btn btn-primary btn-block" style="text-align:center;text-decoration:none;" onclick="window.TrellisAccountPanel.closePanel()">View Plans</a>`;
      }
      container.innerHTML = html;
    } catch {
      container.innerHTML = '<p class="panel-loading">Could not load care plan info.</p>';
    }
  }

  // ── Settings sub-view ─────────────────────────────────────────────────────

  function wireSettings() {
    const changePasswordBtn = qs('#changePasswordBtn');
    const changeEmailBtn = qs('#changeEmailBtn');

    if (changePasswordBtn) {
      changePasswordBtn.addEventListener('click', async () => {
        const input = qs('#settingsNewPassword');
        const statusEl = qs('#passwordStatus');
        const password = input ? input.value : '';
        if (password.length < 8) {
          setStatus(statusEl, 'Password must be at least 8 characters.', 'error');
          return;
        }
        setStatus(statusEl, 'Updating…', '');
        try {
          await window.TrellisAuth.updatePassword(password);
          if (input) input.value = '';
          setStatus(statusEl, 'Password updated!', 'success');
        } catch (err) {
          setStatus(statusEl, err.message || 'Failed to update password.', 'error');
        }
      });
    }

    if (changeEmailBtn) {
      changeEmailBtn.addEventListener('click', async () => {
        const input = qs('#settingsNewEmail');
        const statusEl = qs('#emailStatus');
        const email = input ? input.value.trim() : '';
        if (!email || !email.includes('@')) {
          setStatus(statusEl, 'Please enter a valid email address.', 'error');
          return;
        }
        setStatus(statusEl, 'Sending confirmation…', '');
        try {
          await window.TrellisAuth.updateEmail(email);
          if (input) input.value = '';
          setStatus(statusEl, 'Confirmation sent — check your inbox.', 'success');
        } catch (err) {
          setStatus(statusEl, err.message || 'Failed to update email.', 'error');
        }
      });
    }
  }

  // ── Drag ──────────────────────────────────────────────────────────────────

  function onDrag(e) {
    if (!isDragging) return;
    const deltaY = e.clientY - dragStartY;
    const newTop = panelStartTop + deltaY;
    const maxTop = window.innerHeight - panel.offsetHeight;
    panel.style.top = Math.max(0, Math.min(newTop, maxTop)) + 'px';
  }

  function onDragEnd() {
    isDragging = false;
    document.removeEventListener('mousemove', onDrag);
    document.removeEventListener('mouseup', onDragEnd);
  }

  function initDrag(dragHandle) {
    dragHandle.addEventListener('mousedown', (e) => {
      isDragging = true;
      dragStartY = e.clientY;
      panelStartTop = panel.getBoundingClientRect().top;
      panel.classList.add('is-dragged');
      panel.style.top = panelStartTop + 'px';
      document.addEventListener('mousemove', onDrag);
      document.addEventListener('mouseup', onDragEnd);
      e.preventDefault();
    });
  }

  // ── Wiring ────────────────────────────────────────────────────────────────

  function build() {
    panel = qs('#accountPanel');
    tab = qs('#accountPanelTab');
    if (!panel) return;

    const dragHandle = panel.querySelector('#accountPanelDrag');
    const closeBtn = panel.querySelector('#accountPanelClose');
    const logoutBtn = panel.querySelector('#accountPanelLogout');
    const saveProfileBtn = qs('#saveProfileBtn');

    if (dragHandle) initDrag(dragHandle);
    if (closeBtn) closeBtn.addEventListener('click', closePanel);
    if (tab) tab.addEventListener('click', openPanel);

    if (logoutBtn) {
      logoutBtn.addEventListener('click', () => {
        if (window.TrellisAuth) window.TrellisAuth.logout();
        hide();
      });
    }

    if (saveProfileBtn) saveProfileBtn.addEventListener('click', saveProfile);

    // Nav buttons
    panel.querySelectorAll('[data-panel-view]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const view = btn.dataset.panelView;
        showView('panelView' + view.charAt(0).toUpperCase() + view.slice(1));
        if (view === 'profile') loadProfile();
        if (view === 'billing') loadBilling();
        if (view === 'careplan') loadCarePlan();
      });
    });

    // Back buttons
    panel.querySelectorAll('.panel-back-btn').forEach((btn) => {
      btn.addEventListener('click', backToMain);
    });

    wireSettings();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', build);
  } else {
    build();
  }

  return { show, hide, openPanel, closePanel };
})();
