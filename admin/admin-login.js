(function () {
  const { qs, api, setStatus } = window.TrellisUtils;

  // If already logged in, skip straight to the dashboard.
  api('/api/admin/session')
    .then((session) => {
      if (session.authenticated) window.location.href = '/admin/dashboard';
    })
    .catch(() => {});

  const form = qs('#adminLoginForm');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const statusEl = qs('#adminLoginStatus');
    const password = qs('#adminPassword').value;
    try {
      await api('/api/admin/login', { method: 'POST', body: { password } });
      setStatus(statusEl, 'Logged in — redirecting…', 'success');
      window.location.href = '/admin/dashboard';
    } catch (err) {
      setStatus(statusEl, err.message, 'error');
    }
  });
})();
