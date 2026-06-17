// Customer auth: modal UI, session check, nav state, Google Identity Services.
window.TrellisAuth = (function () {
  const { qs, qsa, api, setStatus, isValidEmail } = window.TrellisUtils;

  let cachedSession = null; // { authenticated, customer } | null until first check
  let onSuccessCallback = null;
  let googleClientId = null;

  const overlay = () => qs('#authModalOverlay');

  function setActiveTab(tabName) {
    qsa('.auth-tab').forEach((tab) => tab.classList.toggle('is-active', tab.dataset.authTab === tabName));
    qsa('.auth-panel').forEach((panel) => panel.classList.toggle('is-active', panel.dataset.authPanel === tabName));
  }

  function openModal(options) {
    const opts = options || {};
    onSuccessCallback = opts.onSuccess || null;
    setActiveTab(opts.defaultTab || 'login');

    if (opts.prefill) {
      if (opts.prefill.name) {
        const nameField = qs('#signupName');
        if (nameField) nameField.value = opts.prefill.name;
      }
      if (opts.prefill.email) {
        const loginEmail = qs('#loginEmail');
        const signupEmail = qs('#signupEmail');
        if (loginEmail) loginEmail.value = opts.prefill.email;
        if (signupEmail) signupEmail.value = opts.prefill.email;
      }
    }

    const ov = overlay();
    if (ov) ov.classList.add('is-open');
  }

  function closeModal() {
    const ov = overlay();
    if (ov) ov.classList.remove('is-open');
  }

  function isAuthenticated() {
    return Boolean(cachedSession && cachedSession.authenticated);
  }

  function getCustomer() {
    return cachedSession && cachedSession.authenticated ? cachedSession.customer : null;
  }

  function updateNavUI() {
    const slot = qs('#navAuthSlot');
    if (!slot) return;
    if (isAuthenticated()) {
      const customer = getCustomer();
      slot.innerHTML = `<a href="/my-account" class="btn-ghost">${customer.name.split(' ')[0]}</a> <button class="btn-ghost" id="navLogoutBtn" style="background:none;border:none;cursor:pointer;">Log Out</button>`;
      const logoutBtn = qs('#navLogoutBtn');
      if (logoutBtn) logoutBtn.addEventListener('click', logout);
    } else {
      slot.innerHTML = `<a href="#" class="btn-ghost" id="navLoginLink">Log In</a>`;
      const loginLink = qs('#navLoginLink');
      if (loginLink) {
        loginLink.addEventListener('click', (e) => {
          e.preventDefault();
          openModal({ defaultTab: 'login' });
        });
      }
    }
  }

  async function checkSession() {
    try {
      const result = await api('/api/auth/session');
      cachedSession = result;
    } catch (e) {
      cachedSession = { authenticated: false };
    }
    updateNavUI();
    return cachedSession;
  }

  async function logout() {
    try {
      await api('/api/auth/logout', { method: 'POST' });
    } catch (e) {
      // ignore — clearing local state regardless
    }
    cachedSession = { authenticated: false };
    updateNavUI();
    if (window.location.pathname.startsWith('/my-account')) {
      window.location.href = '/';
    }
  }

  function handleAuthSuccess(customer) {
    cachedSession = { authenticated: true, customer };
    updateNavUI();
    closeModal();
    if (onSuccessCallback) {
      const cb = onSuccessCallback;
      onSuccessCallback = null;
      cb(customer);
    }
  }

  function wireTabs() {
    qsa('.auth-tab').forEach((tab) => {
      tab.addEventListener('click', () => setActiveTab(tab.dataset.authTab));
    });
    const forgotLink = qs('#forgotPasswordLink');
    if (forgotLink) {
      forgotLink.addEventListener('click', (e) => {
        e.preventDefault();
        setActiveTab('forgot');
      });
    }
    const closeBtn = qs('#authModalClose');
    if (closeBtn) closeBtn.addEventListener('click', closeModal);
    const ov = overlay();
    if (ov) {
      ov.addEventListener('click', (e) => {
        if (e.target === ov) closeModal();
      });
    }
  }

  function wireLoginForm() {
    const form = qs('#loginForm');
    if (!form) return;
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const statusEl = qs('#loginStatus');
      const email = qs('#loginEmail').value.trim();
      const password = qs('#loginPassword').value;
      if (!isValidEmail(email) || !password) {
        setStatus(statusEl, 'Please enter a valid email and password.', 'error');
        return;
      }
      try {
        const result = await api('/api/auth/login', { method: 'POST', body: { email, password } });
        setStatus(statusEl, 'Logged in!', 'success');
        handleAuthSuccess(result.customer);
        form.reset();
      } catch (err) {
        setStatus(statusEl, err.message, 'error');
      }
    });
  }

  function wireSignupForm() {
    const form = qs('#signupForm');
    if (!form) return;
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const statusEl = qs('#signupStatus');
      const name = qs('#signupName').value.trim();
      const email = qs('#signupEmail').value.trim();
      const password = qs('#signupPassword').value;
      if (!name || !isValidEmail(email) || password.length < 8) {
        setStatus(statusEl, 'Please fill in all fields (password must be at least 8 characters).', 'error');
        return;
      }
      try {
        const result = await api('/api/auth/signup', { method: 'POST', body: { name, email, password } });
        setStatus(statusEl, 'Account created!', 'success');
        handleAuthSuccess(result.customer);
        form.reset();
      } catch (err) {
        setStatus(statusEl, err.message, 'error');
      }
    });
  }

  function wireForgotForm() {
    const form = qs('#forgotForm');
    if (!form) return;
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const statusEl = qs('#forgotStatus');
      const email = qs('#forgotEmail').value.trim();
      if (!isValidEmail(email)) {
        setStatus(statusEl, 'Please enter a valid email.', 'error');
        return;
      }
      try {
        const result = await api('/api/auth/forgot-password', { method: 'POST', body: { email } });
        setStatus(statusEl, result.message, 'success');
      } catch (err) {
        setStatus(statusEl, err.message, 'error');
      }
    });
  }

  function wireResetForm() {
    const form = qs('#resetForm');
    if (!form) return;
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const statusEl = qs('#resetStatus');
      const password = qs('#resetPassword').value;
      const token = form.dataset.resetToken;
      if (password.length < 8) {
        setStatus(statusEl, 'Password must be at least 8 characters.', 'error');
        return;
      }
      try {
        const result = await api('/api/auth/reset-password', { method: 'POST', body: { token, newPassword: password } });
        setStatus(statusEl, 'Password updated! You are now logged in.', 'success');
        await checkSession();
        setTimeout(closeModal, 1200);
      } catch (err) {
        setStatus(statusEl, err.message, 'error');
      }
    });
  }

  function checkForResetTokenInUrl() {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('reset_token');
    const wantsLogin = params.get('login');

    if (token) {
      const form = qs('#resetForm');
      if (form) form.dataset.resetToken = token;
      openModal({ defaultTab: 'reset' });
      params.delete('reset_token');
    } else if (wantsLogin) {
      openModal({ defaultTab: 'login' });
      params.delete('login');
    } else {
      return;
    }

    const newUrl = window.location.pathname + (params.toString() ? `?${params}` : '');
    window.history.replaceState({}, '', newUrl);
  }

  async function initGoogleSignIn() {
    try {
      const config = await api('/api/auth/config');
      googleClientId = config.googleClientId;
    } catch (e) {
      googleClientId = null;
    }
    if (!googleClientId || !window.google || !window.google.accounts) return;

    window.google.accounts.id.initialize({
      client_id: googleClientId,
      callback: async (response) => {
        try {
          const result = await api('/api/auth/google', { method: 'POST', body: { idToken: response.credential } });
          handleAuthSuccess(result.customer);
        } catch (err) {
          const statusEl = qs('#loginStatus') || qs('#signupStatus');
          setStatus(statusEl, 'Could not sign in with Google. Please try again.', 'error');
        }
      }
    });

    ['googleBtnLogin', 'googleBtnSignup'].forEach((id) => {
      const el = qs(`#${id}`);
      if (el) window.google.accounts.id.renderButton(el, { theme: 'outline', size: 'large', width: 260 });
    });
  }

  function init() {
    wireTabs();
    wireLoginForm();
    wireSignupForm();
    wireForgotForm();
    wireResetForm();
    checkSession();
    checkForResetTokenInUrl();
    // Google's script loads async — try shortly after DOM ready, it's safe to call repeatedly.
    setTimeout(initGoogleSignIn, 300);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  return { openModal, closeModal, isAuthenticated, getCustomer, checkSession, logout };
})();
