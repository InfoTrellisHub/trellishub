// Right-side account panel with tabbed sections.
// window.TrellisAccountPanel: { show, hide, openPanel, closePanel }
window.TrellisAccountPanel = (function () {
  const { qs, qsa, api, setStatus } = window.TrellisUtils;

  let panel, backdrop;
  let currentCustomer = null;
  let activeTab = 'profile';

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
    if (backdrop) backdrop.classList.add('is-visible');
    document.body.classList.add('panel-open');
  }

  function closePanel() {
    if (!panel) return;
    panel.classList.add('is-hidden');
    if (backdrop) backdrop.classList.remove('is-visible');
    document.body.classList.remove('panel-open');
    const confirmBox = qs('#apLogoutConfirm');
    if (confirmBox) confirmBox.setAttribute('hidden', '');
  }

  function show(customer) {
    if (!panel) return;
    currentCustomer = customer;
    qs('#accountPanelAvatar').textContent = getInitials(customer.name);
    qs('#accountPanelName').textContent  = customer.name  || '';
    qs('#accountPanelEmail').textContent = customer.email || '';
    populateProfile();
    switchTab('profile', { force: true });
    openPanel();
  }

  function hide() {
    if (!panel) return;
    panel.classList.add('is-hidden');
    if (backdrop) backdrop.classList.remove('is-visible');
    document.body.classList.remove('panel-open');
  }

  // ── Tabs ─────────────────────────────────────────────────────────────────

  function switchTab(key, opts) {
    const force = opts && opts.force;
    if (key === activeTab && !force) return;
    activeTab = key;

    qsa('.ap-tab', panel).forEach((btn) => {
      const isActive = btn.dataset.apTab === key;
      btn.classList.toggle('is-active', isActive);
      btn.setAttribute('aria-selected', String(isActive));
    });
    qsa('.ap-tab-panel', panel).forEach((p) => {
      p.classList.toggle('is-active', p.dataset.apPanel === key);
    });

    if (key === 'billing')       loadBilling();
    if (key === 'notifications') loadNotifications();
    if (key === 'projects')      loadProjects();
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

  function resetPasswordForm() {
    const currentInput = qs('#settingsCurrentPassword');
    const newInput     = qs('#settingsNewPassword');
    if (currentInput) currentInput.value = '';
    if (newInput)     newInput.value = '';
    const statusEl = qs('#passwordStatus');
    if (statusEl) { statusEl.textContent = ''; statusEl.className = 'form-status'; }
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
          resetPasswordForm();
        }
      });
    }

    if (submitBtn) {
      submitBtn.addEventListener('click', async () => {
        const currentInput = qs('#settingsCurrentPassword');
        const newInput     = qs('#settingsNewPassword');
        const current = currentInput ? currentInput.value : '';
        const next    = newInput ? newInput.value : '';
        if (!current) {
          setStatus(statusEl, 'Enter your current password.', 'error');
          return;
        }
        if (next.length < 8) {
          setStatus(statusEl, 'New password must be at least 8 characters.', 'error');
          return;
        }
        setStatus(statusEl, 'Updating…', '');
        try {
          await window.TrellisAuth.updatePassword(current, next);
          resetPasswordForm();
          form.setAttribute('hidden', '');
          if (toggleBtn) toggleBtn.textContent = 'Change';
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

    let data;
    try {
      data = await api('/api/account/billing');
    } catch (err) {
      container.innerHTML = `<p class="panel-loading" style="margin:0">Could not load billing info: ${err.message}</p>`;
      return;
    }

    const { care_plan, invoices = [], payments = [] } = data;

    if (!care_plan && !invoices.length && !payments.length) {
      container.innerHTML = `
        <p class="ap-proj-empty">No billing history yet.</p>
        <a class="ap-card-link" href="/#pricing" onclick="window.TrellisAccountPanel.closePanel(); return true;">
          <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/></svg>
          View Care Plans
        </a>`;
      return;
    }

    const carePlanHtml = care_plan ? `
      <div class="ap-card">
        <div class="panel-info-row"><span>Plan</span><span>${care_plan.name}</span></div>
        ${care_plan.monthly_price ? `<div class="panel-info-row"><span>Monthly</span><span>${care_plan.monthly_price}</span></div>` : ''}
        ${care_plan.renewal_date  ? `<div class="panel-info-row"><span>Renewal</span><span>${care_plan.renewal_date}</span></div>`  : ''}
        <div class="panel-info-row"><span>Status</span><span><span class="panel-status-badge is-active">Active</span></span></div>
        ${!care_plan.recurring_active ? '<button type="button" class="ap-btn-secondary btn-sm" id="apSetupRecurringBtn">Set up recurring billing</button>' : '<p class="ap-proj-empty" style="margin:0">Recurring billing is active.</p>'}
      </div>
    ` : '';

    const invoicesHtml = invoices.length
      ? invoices.map((inv) => `
          <div class="ap-billing-invoice" data-invoice-id="${inv.id}">
            <div class="ap-billing-invoice-meta">
              <span class="ap-billing-invoice-num">Invoice #${inv.invoice_no || '—'}</span>
              <span class="ap-billing-invoice-date">${inv.date || '—'}</span>
              <span class="ap-billing-invoice-amount">${inv.amount || '—'}</span>
            </div>
            ${inv.description ? `<p class="ap-billing-invoice-desc">${inv.description}</p>` : ''}
            ${inv.status === 'unpaid' && inv.id ? `<button type="button" class="ap-btn-secondary btn-sm ap-pay-invoice-btn" data-pay-invoice="${inv.id}">Pay Now</button>` : ''}
          </div>
        `).join('')
      : '<p class="ap-proj-empty">No invoices yet.</p>';

    const paymentsHtml = payments.length
      ? payments.map((p) => `
          <div class="panel-info-row">
            <span>${p.date || '—'}</span>
            <span>${p.method ? p.method + ' · ' : ''}${p.amount || '—'}</span>
          </div>
        `).join('')
      : '<p class="ap-proj-empty">No payments recorded.</p>';

    container.innerHTML = `
      ${care_plan ? `<p class="ap-block-title">Care Plan</p>${carePlanHtml}` : ''}
      <p class="ap-block-title">Invoices</p>
      ${invoicesHtml}
      <p class="ap-block-title">Payment History</p>
      ${paymentsHtml}
    `;

    container.querySelectorAll('[data-pay-invoice]').forEach((btn) => {
      btn.addEventListener('click', () => {
        startPayfastCheckout({ type: 'invoice', invoice_id: btn.dataset.payInvoice }, btn);
      });
    });

    const recurringBtn = qs('#apSetupRecurringBtn', container);
    if (recurringBtn) {
      recurringBtn.addEventListener('click', () => {
        startPayfastCheckout({ type: 'subscription' }, recurringBtn);
      });
    }
  }

  // Requests a signed PayFast checkout from the server, then builds and submits a
  // hidden form to PayFast — a real browser POST is required, so a server-side
  // redirect can't be used to send the customer to PayFast's checkout page.
  async function startPayfastCheckout(payload, btn) {
    const originalText = btn.textContent;
    btn.disabled = true;
    btn.textContent = 'Redirecting…';
    try {
      const data = await api('/api/payments/checkout', { method: 'POST', body: payload });
      const form = document.createElement('form');
      form.method = 'POST';
      form.action = data.action;
      Object.entries(data.fields).forEach(([name, value]) => {
        const input = document.createElement('input');
        input.type = 'hidden';
        input.name = name;
        input.value = value;
        form.appendChild(input);
      });
      document.body.appendChild(form);
      form.submit();
    } catch (err) {
      btn.disabled = false;
      btn.textContent = originalText;
      alert(err.message || 'Could not start checkout. Please try again.');
    }
  }

  // ── Notifications section ─────────────────────────────────────────────────

  function loadNotifications() {
    const container = qs('#apNotificationsContent');
    if (!container) return;
    container.innerHTML = '<p class="panel-loading" style="margin:0">No notifications yet.</p>';
  }

  // ── Projects section ──────────────────────────────────────────────────────

  async function loadProjects() {
    const container = qs('#apProjectsContent');
    if (!container) return;

    let credentialsUrl = null;
    try {
      const data = await api('/api/account/handover');
      credentialsUrl = data.credentials_url || null;
    } catch {
      // non-fatal — credentials card will show the placeholder link
    }

    const credentialsLink = credentialsUrl
      ? `<a class="ap-card-link" href="${credentialsUrl}" target="_blank" rel="noopener" download>
           <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
           Download Credentials Document
         </a>`
      : `<a class="ap-card-link" href="/handover/credentials.html" target="_blank" rel="noopener">
           <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
           Open Handover Document
         </a>`;

    container.innerHTML = `
      <div class="ap-card">
        <div class="ap-card-header">
          <span class="ap-card-icon">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
          </span>
          <span class="ap-card-title">Website Files</span>
        </div>
        <p>Your delivered website source code, assets, and project files will be available here once your project is complete.</p>
        <a class="ap-card-link" href="/handover/website-files.html" target="_blank" rel="noopener">
          <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
          View Handover Document
        </a>
      </div>

      <div class="ap-card">
        <div class="ap-card-header">
          <span class="ap-card-icon">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><polygon points="10 8 16 12 10 16 10 8"/></svg>
          </span>
          <span class="ap-card-title">Tutorials</span>
        </div>
        <p>Step-by-step video tutorials covering hosting, email setup, managing credentials, and maintaining your site.</p>
        <a class="ap-card-link" href="/handover/tutorial.html" target="_blank" rel="noopener">
          <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polygon points="10 8 16 12 10 16 10 8"/></svg>
          View Tutorial Guide
        </a>
      </div>

      <div class="ap-card">
        <div class="ap-card-header">
          <span class="ap-card-icon">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
          </span>
          <span class="ap-card-title">Credentials</span>
        </div>
        <p>Domain details, hosting credentials, email accounts, API keys, and passwords are delivered securely in your handover document.</p>
        <div class="ap-card-note">
          <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
          <p>Your credentials are shared privately. Never store passwords in unsecured locations.</p>
        </div>
        ${credentialsLink}
      </div>
    `;
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

  // ── Build ─────────────────────────────────────────────────────────────────

  function build() {
    panel = qs('#accountPanel');
    if (!panel) return;

    backdrop = document.createElement('div');
    backdrop.className = 'panel-backdrop';
    backdrop.setAttribute('aria-hidden', 'true');
    document.body.appendChild(backdrop);
    backdrop.addEventListener('click', closePanel);

    const closeBtn = qs('#accountPanelClose');
    if (closeBtn) closeBtn.addEventListener('click', closePanel);

    qsa('.ap-tab', panel).forEach((btn) => {
      btn.addEventListener('click', () => switchTab(btn.dataset.apTab));
    });

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
