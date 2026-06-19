// Draggable left-side account panel with accordion sections.
// window.TrellisAccountPanel: { show, hide, openPanel, closePanel }
window.TrellisAccountPanel = (function () {
  const { qs, api, setStatus } = window.TrellisUtils;

  let panel, tab, backdrop;
  let isDragging = false;
  let dragStartX = 0;
  let dragStartY = 0;
  let panelStartTop = 0;
  let lastDeltaX = 0;
  let currentCustomer = null;

  const DISMISS_THRESHOLD = -80;

  function getInitials(name) {
    if (!name) return '?';
    const parts = name.trim().split(/\s+/);
    return parts.length === 1
      ? parts[0][0].toUpperCase()
      : (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }

  // ── Panel open / close ────────────────────────────────────────────────────

  function openPanel() {
    if (!panel) return;
    panel.classList.remove('is-hidden');
    if (tab) tab.style.display = 'none';
    if (backdrop) backdrop.classList.add('is-visible');
    document.body.classList.add('panel-open');
  }

  function closePanel() {
    if (!panel) return;
    panel.style.transform = '';
    panel.style.top = '';
    panel.classList.remove('is-dragged');
    panel.classList.add('is-hidden');
    if (tab) tab.style.display = 'block';
    if (backdrop) backdrop.classList.remove('is-visible');
    document.body.classList.remove('panel-open');
  }

  function show(customer) {
    if (!panel) return;
    currentCustomer = customer;
    qs('#accountPanelAvatar').textContent = getInitials(customer.name);
    qs('#accountPanelName').textContent  = customer.name  || '';
    qs('#accountPanelEmail').textContent = customer.email || '';
    populateProfile();
    if (tab) tab.style.display = 'block';
    openPanel();
  }

  function hide() {
    if (!panel) return;
    panel.classList.add('is-hidden');
    if (tab) tab.style.display = 'none';
    if (backdrop) backdrop.classList.remove('is-visible');
    document.body.classList.remove('panel-open');
  }

  // ── Accordion ─────────────────────────────────────────────────────────────

  let openSectionId = null;

  function toggleSection(sectionEl, sectionId) {
    const isAlreadyOpen = sectionEl.classList.contains('is-open');

    // Close all
    panel.querySelectorAll('.ap-section').forEach((s) => {
      s.classList.remove('is-open');
      const h = s.querySelector('.ap-section-header');
      if (h) h.setAttribute('aria-expanded', 'false');
    });
    openSectionId = null;

    if (!isAlreadyOpen) {
      sectionEl.classList.add('is-open');
      const h = sectionEl.querySelector('.ap-section-header');
      if (h) h.setAttribute('aria-expanded', 'true');
      openSectionId = sectionId;

      // Lazy-load data sections
      if (sectionId === 'billing')       loadBilling();
      if (sectionId === 'notifications') loadNotifications();
      if (sectionId === 'projects')      loadProjects();
    }
  }

  // ── Profile section ───────────────────────────────────────────────────────

  function populateProfile() {
    const nameInput    = qs('#profileNameInput');
    const emailInput   = qs('#profileEmailDisplay');
    const companyInput = qs('#profileCompanyInput');
    if (nameInput)    nameInput.value    = (currentCustomer && currentCustomer.name)    || '';
    if (emailInput)   emailInput.value   = (currentCustomer && currentCustomer.email)   || '';
    if (companyInput) companyInput.value = (currentCustomer && currentCustomer.company) || '';
    const statusEl = qs('#profileStatus');
    if (statusEl) { statusEl.textContent = ''; statusEl.className = 'form-status'; }
  }

  async function saveProfile() {
    const nameInput    = qs('#profileNameInput');
    const companyInput = qs('#profileCompanyInput');
    const statusEl     = qs('#profileStatus');
    const name = nameInput ? nameInput.value.trim() : '';
    if (!name) { setStatus(statusEl, 'Name cannot be empty.', 'error'); return; }
    setStatus(statusEl, 'Saving…', '');
    try {
      const body = { name };
      if (companyInput) body.company = companyInput.value.trim();
      const result = await api('/api/account/profile', { method: 'POST', body });
      currentCustomer = { ...currentCustomer, name: result.name || name };
      qs('#accountPanelName').textContent   = currentCustomer.name;
      qs('#accountPanelAvatar').textContent = getInitials(currentCustomer.name);
      setStatus(statusEl, 'Profile updated!', 'success');
    } catch (err) {
      setStatus(statusEl, err.message || 'Failed to save.', 'error');
    }
  }

  function wirePasswordToggle() {
    const toggleBtn  = qs('#changePasswordBtn');
    const form       = qs('#changePasswordForm');
    const submitBtn  = qs('#changePasswordSubmit');
    const statusEl   = qs('#passwordStatus');

    if (toggleBtn && form) {
      toggleBtn.addEventListener('click', () => {
        const hidden = form.hasAttribute('hidden');
        if (hidden) {
          form.removeAttribute('hidden');
          toggleBtn.textContent = 'Cancel';
        } else {
          form.setAttribute('hidden', '');
          toggleBtn.textContent = 'Change';
          const input = qs('#settingsNewPassword');
          if (input) input.value = '';
          if (statusEl) { statusEl.textContent = ''; statusEl.className = 'form-status'; }
        }
      });
    }

    if (submitBtn) {
      submitBtn.addEventListener('click', async () => {
        const input    = qs('#settingsNewPassword');
        const password = input ? input.value : '';
        if (password.length < 8) {
          setStatus(statusEl, 'Password must be at least 8 characters.', 'error');
          return;
        }
        setStatus(statusEl, 'Updating…', '');
        try {
          await window.TrellisAuth.updatePassword(password);
          if (input) input.value = '';
          const form = qs('#changePasswordForm');
          if (form) form.setAttribute('hidden', '');
          const btn = qs('#changePasswordBtn');
          if (btn) btn.textContent = 'Change';
          setStatus(statusEl, 'Password updated!', 'success');
        } catch (err) {
          setStatus(statusEl, err.message || 'Failed to update password.', 'error');
        }
      });
    }
  }

  // ── Billing section ───────────────────────────────────────────────────────

  async function loadBilling() {
    const container = qs('#apBillingContent');
    if (!container) return;
    container.innerHTML = '<p class="panel-loading" style="margin:0">Loading&hellip;</p>';
    try {
      const data = await api('/api/account/billing');
      if (!data || (!data.plan && (!data.invoices || !data.invoices.length))) {
        container.innerHTML = '<p class="panel-loading" style="margin:0">No billing records yet.</p>';
        return;
      }
      let html = '';
      if (data.plan) {
        html += `<div class="panel-info-row"><span>Plan</span><span>${data.plan}</span></div>`;
        if (data.monthly_price) html += `<div class="panel-info-row"><span>Monthly</span><span>${data.monthly_price}</span></div>`;
        if (data.renewal_date)  html += `<div class="panel-info-row"><span>Renewal</span><span>${data.renewal_date}</span></div>`;
        const status      = data.status || 'inactive';
        const badgeClass  = status === 'active' ? 'is-active' : status === 'cancellation_requested' ? 'is-pending' : 'is-inactive';
        const badgeLabel  = status === 'active' ? 'Active'    : status === 'cancellation_requested' ? 'Cancellation Requested' : status === 'cancelled' ? 'Cancelled' : 'Not Subscribed';
        html += `<div class="panel-info-row"><span>Status</span><span><span class="panel-status-badge ${badgeClass}">${badgeLabel}</span></span></div>`;
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
      if (!data.plan || data.status === 'inactive' || data.status === 'cancelled') {
        html += `<a href="#pricing" class="btn btn-primary btn-block" style="text-align:center;text-decoration:none;margin-top:var(--space-3)" onclick="window.TrellisAccountPanel.closePanel()">View Plans</a>`;
      }
      container.innerHTML = html;
    } catch {
      container.innerHTML = '<p class="panel-loading" style="margin:0">Could not load billing info.</p>';
    }
  }

  // ── Notifications section ─────────────────────────────────────────────────

  function loadNotifications() {
    const container = qs('#apNotificationsContent');
    if (!container) return;
    // Placeholder notifications — replace with real API data when available
    const items = [
      { icon: '🔔', text: 'Welcome to Trellis! Your account is all set.', time: 'Just now' },
    ];
    if (!items.length) {
      container.innerHTML = '<p class="panel-loading" style="margin:0">No notifications yet.</p>';
      return;
    }
    container.innerHTML = items.map((n) => `
      <div class="ap-notif-item">
        <span>${n.icon}</span>
        <span class="ap-notif-text">${n.text}</span>
        <span class="ap-notif-time">${n.time}</span>
      </div>
    `).join('');
  }

  // ── Projects section ──────────────────────────────────────────────────────

  function loadProjects() {
    const container = qs('#apProjectsContent');
    if (!container) return;
    // Placeholder — replace with real API data when projects table exists
    container.innerHTML = '<p class="panel-loading" style="margin:0">No active projects yet.</p>';
  }

  // ── Logout ────────────────────────────────────────────────────────────────

  function wireLogout() {
    const logoutBtn  = qs('#accountPanelLogout');
    const confirmBox = qs('#apLogoutConfirm');
    const yesBtn     = qs('#apLogoutYes');
    const noBtn      = qs('#apLogoutNo');

    if (!logoutBtn) return;

    logoutBtn.addEventListener('click', () => {
      if (confirmBox) {
        const isShown = !confirmBox.hasAttribute('hidden');
        if (isShown) {
          confirmBox.setAttribute('hidden', '');
        } else {
          confirmBox.removeAttribute('hidden');
        }
      }
    });

    if (yesBtn) {
      yesBtn.addEventListener('click', () => {
        if (window.TrellisAuth) window.TrellisAuth.logout();
        hide();
      });
    }

    if (noBtn) {
      noBtn.addEventListener('click', () => {
        if (confirmBox) confirmBox.setAttribute('hidden', '');
      });
    }
  }

  // ── Drag ─────────────────────────────────────────────────────────────────

  function onDrag(e) {
    if (!isDragging) return;
    const deltaX = e.clientX - dragStartX;
    const deltaY = e.clientY - dragStartY;
    lastDeltaX = deltaX;

    const newTop = panelStartTop + deltaY;
    const maxTop = window.innerHeight - panel.offsetHeight;
    panel.style.top = Math.max(0, Math.min(newTop, maxTop)) + 'px';

    if (deltaX < 0) {
      panel.style.transform = `translateX(${deltaX}px)`;
    } else {
      panel.style.transform = 'none';
    }
  }

  function onDragEnd() {
    isDragging = false;
    document.removeEventListener('mousemove', onDrag);
    document.removeEventListener('mouseup', onDragEnd);

    if (lastDeltaX <= DISMISS_THRESHOLD) {
      closePanel();
    } else {
      panel.style.transform = 'none';
    }
  }

  function initDrag(dragHandle) {
    dragHandle.addEventListener('mousedown', (e) => {
      isDragging = true;
      lastDeltaX = 0;
      dragStartX = e.clientX;
      dragStartY = e.clientY;
      panelStartTop = panel.getBoundingClientRect().top;
      panel.classList.add('is-dragged');
      panel.style.top = panelStartTop + 'px';
      document.addEventListener('mousemove', onDrag);
      document.addEventListener('mouseup', onDragEnd);
      e.preventDefault();
    });
  }

  // ── Build ─────────────────────────────────────────────────────────────────

  function build() {
    panel = qs('#accountPanel');
    tab   = qs('#accountPanelTab');
    if (!panel) return;

    backdrop = document.createElement('div');
    backdrop.className = 'panel-backdrop';
    backdrop.setAttribute('aria-hidden', 'true');
    document.body.appendChild(backdrop);
    backdrop.addEventListener('click', closePanel);

    const dragHandle = panel.querySelector('#accountPanelDrag');
    const closeBtn   = panel.querySelector('#accountPanelClose');

    if (dragHandle) initDrag(dragHandle);
    if (closeBtn)   closeBtn.addEventListener('click', closePanel);
    if (tab)        tab.addEventListener('click', openPanel);

    // Accordion section headers
    const sections = [
      { id: 'apSectionProfile',       key: 'profile' },
      { id: 'apSectionProjects',      key: 'projects' },
      { id: 'apSectionNotifications', key: 'notifications' },
      { id: 'apSectionBilling',       key: 'billing' },
    ];

    sections.forEach(({ id, key }) => {
      const sectionEl = qs('#' + id);
      if (!sectionEl) return;
      const header = sectionEl.querySelector('.ap-section-header');
      if (header) {
        header.addEventListener('click', () => toggleSection(sectionEl, key));
      }
    });

    // Profile save
    const saveBtn = qs('#saveProfileBtn');
    if (saveBtn) saveBtn.addEventListener('click', saveProfile);

    wirePasswordToggle();
    wireLogout();

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && !panel.classList.contains('is-hidden')) closePanel();
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', build);
  } else {
    build();
  }

  return { show, hide, openPanel, closePanel };
})();
