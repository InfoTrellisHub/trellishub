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

    container.innerHTML = `
      <div class="ap-proj-subs">

        <div class="ap-proj-sub" id="apProjSubFiles">
          <button class="ap-proj-sub-header" aria-expanded="false">
            <span class="ap-proj-sub-icon">
              <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
            </span>
            <span class="ap-proj-sub-label">Website Files</span>
            <svg class="ap-chevron" viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" aria-hidden="true"><polyline points="6 9 12 15 18 9"/></svg>
          </button>
          <div class="ap-proj-sub-body">
            <div class="ap-proj-sub-content">
              <p class="ap-proj-empty">Your delivered website source code, assets, and project files will be available here once your project is complete.</p>
              <a class="ap-proj-link" href="/handover/template" target="_blank" rel="noopener">
                <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                View Handover Document
              </a>
            </div>
          </div>
        </div>

        <div class="ap-proj-sub" id="apProjSubTutorials">
          <button class="ap-proj-sub-header" aria-expanded="false">
            <span class="ap-proj-sub-icon">
              <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><polygon points="10 8 16 12 10 16 10 8"/></svg>
            </span>
            <span class="ap-proj-sub-label">Tutorials</span>
            <svg class="ap-chevron" viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" aria-hidden="true"><polyline points="6 9 12 15 18 9"/></svg>
          </button>
          <div class="ap-proj-sub-body">
            <div class="ap-proj-sub-content">
              <p class="ap-proj-empty">Step-by-step video tutorials covering hosting, email setup, managing credentials, and maintaining your site.</p>
              <a class="ap-proj-link" href="/handover/tutorial" target="_blank" rel="noopener">
                <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polygon points="10 8 16 12 10 16 10 8"/></svg>
                View Tutorial Guide
              </a>
            </div>
          </div>
        </div>

        <div class="ap-proj-sub" id="apProjSubCreds">
          <button class="ap-proj-sub-header" aria-expanded="false">
            <span class="ap-proj-sub-icon">
              <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
            </span>
            <span class="ap-proj-sub-label">Credentials</span>
            <svg class="ap-chevron" viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" aria-hidden="true"><polyline points="6 9 12 15 18 9"/></svg>
          </button>
          <div class="ap-proj-sub-body">
            <div class="ap-proj-sub-content">
              <p class="ap-proj-empty">Domain details, hosting credentials, email accounts, API keys, and passwords are delivered securely in your handover document.</p>
              <div class="ap-proj-cred-note">
                <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                <p>Your credentials are shared privately. Never store passwords in unsecured locations.</p>
              </div>
              <a class="ap-proj-link" href="/handover/template" target="_blank" rel="noopener">
                <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                Open Handover Document
              </a>
            </div>
          </div>
        </div>

      </div>
    `;

    container.querySelectorAll('.ap-proj-sub-header').forEach((header) => {
      header.addEventListener('click', () => {
        const sub = header.closest('.ap-proj-sub');
        const isOpen = sub.classList.contains('is-open');
        sub.classList.toggle('is-open', !isOpen);
        header.setAttribute('aria-expanded', String(!isOpen));
      });
    });
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
