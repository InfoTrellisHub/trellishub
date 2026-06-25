// Customer auth: Supabase Auth for sign-up/login/password-reset, session cookie
// issued via /api/auth/exchange, modal UI unchanged.
window.TrellisAuth = (function () {
  const { qs, qsa, api, setStatus, isValidEmail } = window.TrellisUtils;

  let cachedSession = null;
  let onSuccessCallback = null;
  let supabase = null;

  // Captured before Supabase cleans the URL on init
  const _urlHadAuthTokens = (() => {
    const h = window.location.hash;
    const p = new URLSearchParams(window.location.search);
    return h.includes('access_token') || p.has('token_hash') || p.has('code');
  })();

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
        const f = qs('#signupName');
        if (f) f.value = opts.prefill.name;
      }
      if (opts.prefill.email) {
        const le = qs('#loginEmail');
        const se = qs('#signupEmail');
        if (le) le.value = opts.prefill.email;
        if (se) se.value = opts.prefill.email;
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
      const firstName = (customer.name || customer.email).split(' ')[0];
      slot.innerHTML = `<button class="btn-ghost" id="navAccountBtn">${firstName}</button>`;
      const btn = qs('#navAccountBtn');
      if (btn) btn.addEventListener('click', () => {
        if (window.TrellisAccountPanel) window.TrellisAccountPanel.openPanel();
      });
    } else {
      slot.innerHTML = `<a href="#" class="btn-ghost" id="navLoginLink">Account</a>`;
      const link = qs('#navLoginLink');
      if (link) link.addEventListener('click', (e) => {
        e.preventDefault();
        openModal({ defaultTab: 'login' });
      });
    }
  }

  async function exchangeToken(accessToken, supabaseUser) {
    try {
      return await api('/api/auth/exchange', { method: 'POST', body: { access_token: accessToken } });
    } catch (e) {
      const name = (supabaseUser.user_metadata && (supabaseUser.user_metadata.full_name || supabaseUser.user_metadata.name)) || supabaseUser.email.split('@')[0];
      return { authenticated: true, customer: { name, email: supabaseUser.email } };
    }
  }

  function handleAuthSuccess(customer) {
    cachedSession = { authenticated: true, customer };
    updateNavUI();
    closeModal();
    if (window.TrellisAccountPanel) window.TrellisAccountPanel.show(customer);
    if (window.TrellisForms) window.TrellisForms.prefillFromCustomer(customer);
    if (onSuccessCallback) {
      const cb = onSuccessCallback;
      onSuccessCallback = null;
      cb(customer);
    }
  }

  async function logout() {
    if (supabase) {
      try { await supabase.auth.signOut(); } catch (e) { /* ignore */ }
    }
    try { await api('/api/auth/logout', { method: 'POST' }); } catch (e) { /* ignore */ }
    cachedSession = { authenticated: false };
    updateNavUI();
    if (window.TrellisAccountPanel) window.TrellisAccountPanel.hide();
    if (window.location.pathname.startsWith('/my-account')) window.location.href = '/';
  }

  async function checkSession() {
    try {
      const result = await api('/api/auth/session');
      cachedSession = result;
    } catch (e) {
      cachedSession = { authenticated: false };
    }
    updateNavUI();
    if (isAuthenticated()) {
      const customer = getCustomer();
      if (window.TrellisAccountPanel) {
        window.TrellisAccountPanel.show(customer);
        window.TrellisAccountPanel.closePanel();
      }
      if (window.TrellisForms) window.TrellisForms.prefillFromCustomer(customer);
    }
    return cachedSession;
  }

  function wireTabs() {
    qsa('.auth-tab').forEach((tab) => {
      tab.addEventListener('click', () => setActiveTab(tab.dataset.authTab));
    });
    const forgotLink = qs('#forgotPasswordLink');
    if (forgotLink) forgotLink.addEventListener('click', (e) => { e.preventDefault(); setActiveTab('forgot'); });
    const closeBtn = qs('#authModalClose');
    if (closeBtn) closeBtn.addEventListener('click', closeModal);
    const ov = overlay();
    if (ov) ov.addEventListener('click', (e) => { if (e.target === ov) closeModal(); });
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
      setStatus(statusEl, 'Signing in…', '');
      try {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw new Error(error.message || error.error_description || JSON.stringify(error) || 'Sign-in failed — please try again.');
        const result = await exchangeToken(data.session.access_token, data.user);
        setStatus(statusEl, 'Logged in!', 'success');
        handleAuthSuccess(result.customer);
        form.reset();
      } catch (err) {
        setStatus(statusEl, err.message || 'Sign-in failed — please try again.', 'error');
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
      setStatus(statusEl, 'Creating account…', '');
      try {
        const { data, error } = await supabase.auth.signUp({
          email, password,
          options: { data: { full_name: name }, emailRedirectTo: window.location.origin + '/' },
        });
        if (error) {
          const msg = error.message || error.error_description || (error.status ? `Server error ${error.status}` : null) || 'Sign-up failed — please check your details and try again.';
          console.error('[TrellisAuth] signUp error object:', error);
          throw new Error(msg);
        }
        if (data.session) {
          const result = await exchangeToken(data.session.access_token, data.user);
          setStatus(statusEl, 'Account created!', 'success');
          handleAuthSuccess(result.customer);
          form.reset();
        } else {
          setStatus(statusEl, 'Account created! Check your email to confirm your address, then log in.', 'success');
          form.reset();
        }
      } catch (err) {
        setStatus(statusEl, err.message || 'Sign-up failed — please try again.', 'error');
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
      setStatus(statusEl, 'Sending…', '');
      try {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: window.location.origin + '/'
        });
        if (error) throw new Error(error.message);
        setStatus(statusEl, 'Reset link sent — check your inbox.', 'success');
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
      if (password.length < 8) {
        setStatus(statusEl, 'Password must be at least 8 characters.', 'error');
        return;
      }
      setStatus(statusEl, 'Updating password…', '');
      try {
        const { data, error } = await supabase.auth.updateUser({ password });
        if (error) throw new Error(error.message);
        const result = await exchangeToken(data.session.access_token, data.user);
        setStatus(statusEl, 'Password updated! You are now logged in.', 'success');
        handleAuthSuccess(result.customer);
        setTimeout(closeModal, 1200);
      } catch (err) {
        setStatus(statusEl, err.message, 'error');
      }
    });
  }

  async function initSupabase() {
    try {
      const config = await api('/api/auth/config');
      if (!config.supabaseUrl || !config.supabaseAnonKey) return;
      supabase = window.supabase.createClient(config.supabaseUrl, config.supabaseAnonKey);
      supabase.auth.onAuthStateChange((event) => {
        if (event === 'PASSWORD_RECOVERY') {
          setActiveTab('reset');
          const ov = overlay();
          if (ov) ov.classList.add('is-open');
        }
      });
    } catch (e) {
      console.warn('[TrellisAuth] Supabase init failed:', e.message);
    }
  }

  async function checkForEmailConfirmation() {
    if (!supabase || !_urlHadAuthTokens) return false;
    const params = new URLSearchParams(window.location.search);
    const type = params.get('type');

    // Don't touch password-recovery redirects — onAuthStateChange handles those
    if (type === 'recovery') return false;

    // PKCE code flow (?code=...)
    const code = params.get('code');
    if (code) {
      try {
        const { data, error } = await supabase.auth.exchangeCodeForSession(code);
        if (!error && data.session) {
          const result = await exchangeToken(data.session.access_token, data.user);
          handleAuthSuccess(result.customer);
          params.delete('code');
          params.delete('type');
          window.history.replaceState({}, '', window.location.pathname + (params.toString() ? '?' + params : ''));
          return true;
        }
      } catch (e) { /* ignore */ }
    }

    // OTP token_hash flow (?token_hash=...&type=signup|email)
    const tokenHash = params.get('token_hash');
    if (tokenHash && (type === 'signup' || type === 'email')) {
      try {
        const { data, error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });
        if (!error && data.session) {
          const result = await exchangeToken(data.session.access_token, data.user);
          handleAuthSuccess(result.customer);
          params.delete('token_hash');
          params.delete('type');
          window.history.replaceState({}, '', window.location.pathname + (params.toString() ? '?' + params : ''));
          return true;
        }
      } catch (e) { /* ignore */ }
    }

    // Implicit hash flow (#access_token=... — auto-processed by Supabase on createClient)
    if (window.location.hash.includes('access_token')) {
      const hashType = new URLSearchParams(window.location.hash.slice(1)).get('type');
      if (hashType !== 'recovery') {
        try {
          const { data: { session } } = await supabase.auth.getSession();
          if (session) {
            const result = await exchangeToken(session.access_token, session.user);
            handleAuthSuccess(result.customer);
            window.history.replaceState({}, '', window.location.pathname + window.location.search);
            return true;
          }
        } catch (e) { /* ignore */ }
      }
    }

    return false;
  }

  function checkForLoginParam() {
    const params = new URLSearchParams(window.location.search);
    if (params.get('login')) {
      openModal({ defaultTab: 'login' });
      params.delete('login');
      window.history.replaceState({}, '', window.location.pathname + (params.toString() ? `?${params}` : ''));
    }
  }

  async function init() {
    wireTabs();
    await initSupabase();
    wireLoginForm();
    wireSignupForm();
    wireForgotForm();
    wireResetForm();
    const autoLoggedIn = await checkForEmailConfirmation();
    if (!autoLoggedIn) await checkSession();
    checkForLoginParam();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  async function updatePassword(newPassword) {
    if (!supabase) throw new Error('Auth not initialised.');
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) throw new Error(error.message);
  }

  async function updateEmail(newEmail) {
    if (!supabase) throw new Error('Auth not initialised.');
    const { error } = await supabase.auth.updateUser({ email: newEmail });
    if (error) throw new Error(error.message);
  }

  return { openModal, closeModal, isAuthenticated, getCustomer, checkSession, logout, updatePassword, updateEmail };
})();
