(function () {
  const { qs, qsa, api, setStatus } = window.TrellisUtils;

  function escapeHtml(value) {
    const div = document.createElement('div');
    div.textContent = value == null ? '' : String(value);
    return div.innerHTML;
  }

  function formatDate(iso) {
    if (!iso) return '—';
    return new Date(iso).toLocaleString();
  }

  async function requireSession() {
    try {
      const session = await api('/api/admin/session');
      if (!session.authenticated) {
        window.location.href = '/admin';
        return null;
      }
      qs('#adminWelcome').textContent = `Logged in as ${session.name}`;
      return session;
    } catch (e) {
      window.location.href = '/admin';
      return null;
    }
  }

  function wireLogout() {
    qs('#adminLogoutBtn').addEventListener('click', async () => {
      try {
        await api('/api/admin/logout', { method: 'POST' });
      } catch (e) {
        // ignore
      }
      window.location.href = '/admin';
    });
  }

  function wireTabs() {
    qsa('.admin-tab').forEach((tab) => {
      tab.addEventListener('click', () => {
        qsa('.admin-tab').forEach((t) => t.classList.toggle('is-active', t === tab));
        qsa('.admin-panel').forEach((p) => p.classList.toggle('is-active', p.dataset.adminPanel === tab.dataset.adminTab));
        loadPanel(tab.dataset.adminTab);
      });
    });
  }

  async function loadLeads() {
    const body = qs('#leadsTableBody');
    body.innerHTML = '<tr><td colspan="7">Loading…</td></tr>';
    try {
      const { leads } = await api('/api/admin/leads');
      if (!leads.length) {
        body.innerHTML = '<tr><td colspan="7">No leads yet.</td></tr>';
        return;
      }
      body.innerHTML = leads
        .map(
          (l) => `<tr>
            <td>${formatDate(l.created_at)}</td>
            <td>${escapeHtml(l.name)}</td>
            <td><a href="mailto:${escapeHtml(l.email)}">${escapeHtml(l.email)}</a></td>
            <td>${escapeHtml(l.phone) || '—'}</td>
            <td>${escapeHtml(l.company) || '—'}</td>
            <td style="max-width:280px;">${escapeHtml(l.message)}</td>
            <td>${escapeHtml(l.status)}</td>
          </tr>`
        )
        .join('');
    } catch (e) {
      body.innerHTML = `<tr><td colspan="7">Could not load leads: ${escapeHtml(e.message)}</td></tr>`;
    }
  }

  async function loadBookings() {
    const body = qs('#bookingsTableBody');
    body.innerHTML = '<tr><td colspan="8">Loading…</td></tr>';
    try {
      const { bookings } = await api('/api/admin/bookings');
      if (!bookings.length) {
        body.innerHTML = '<tr><td colspan="8">No bookings yet.</td></tr>';
        return;
      }
      body.innerHTML = bookings
        .map(
          (b) => `<tr>
            <td>${formatDate(b.created_at)}</td>
            <td>${b.booking_type === 'care_plan' ? 'Care Plan' : 'Quote'}</td>
            <td>${escapeHtml(b.name)}</td>
            <td><a href="mailto:${escapeHtml(b.email)}">${escapeHtml(b.email)}</a></td>
            <td>${escapeHtml(b.phone) || '—'}</td>
            <td>${escapeHtml(b.preferred_date) || '—'} ${escapeHtml(b.preferred_time) || ''}</td>
            <td style="max-width:240px;">${escapeHtml(b.notes) || '—'}</td>
            <td>${escapeHtml(b.status)}</td>
          </tr>`
        )
        .join('');
    } catch (e) {
      body.innerHTML = `<tr><td colspan="8">Could not load bookings: ${escapeHtml(e.message)}</td></tr>`;
    }
  }

  async function loadConversations() {
    const body = qs('#conversationsTableBody');
    body.innerHTML = '<tr><td colspan="7">Loading…</td></tr>';
    try {
      const { conversations } = await api('/api/admin/conversations');
      if (!conversations.length) {
        body.innerHTML = '<tr><td colspan="7">No conversations yet.</td></tr>';
        return;
      }
      body.innerHTML = conversations
        .map(
          (c) => `<tr class="${c.escalated ? 'is-escalated' : ''}">
            <td>${formatDate(c.started_at)}</td>
            <td>${escapeHtml(c.captured_name) || '—'}</td>
            <td>${escapeHtml(c.captured_email) || '—'}</td>
            <td>${escapeHtml(c.captured_phone) || '—'}</td>
            <td>${c.escalation_count || 0}</td>
            <td>${escapeHtml(c.last_node_id) || '—'}</td>
            <td><button class="admin-row-action" data-conversation-id="${c.id}">View transcript</button></td>
          </tr>`
        )
        .join('');

      qsa('[data-conversation-id]', body).forEach((btn) => {
        btn.addEventListener('click', () => viewTranscript(btn.dataset.conversationId));
      });
    } catch (e) {
      body.innerHTML = `<tr><td colspan="7">Could not load conversations: ${escapeHtml(e.message)}</td></tr>`;
    }
  }

  async function viewTranscript(conversationId) {
    const view = qs('#transcriptView');
    view.style.display = 'block';
    view.innerHTML = 'Loading transcript…';
    try {
      const { messages } = await api(`/api/admin/conversations?conversation_id=${encodeURIComponent(conversationId)}`);
      view.innerHTML = messages
        .map(
          (m) =>
            `<p class="transcript-line ${m.sender}"><strong>${m.sender === 'bot' ? 'Bot' : 'Visitor'}:</strong> ${escapeHtml(m.message_text)}${m.is_escalation ? ' <em>(escalation)</em>' : ''}</p>`
        )
        .join('');
    } catch (e) {
      view.innerHTML = `Could not load transcript: ${escapeHtml(e.message)}`;
    }
  }

  async function saveCarePlan(customerId, row) {
    const statusSelect = qs('select', row);
    const renewalInput = qs('input[type="date"]', row);
    const saveBtn = qs('button', row);
    saveBtn.disabled = true;
    try {
      await api('/api/admin/care-plan', {
        method: 'POST',
        body: { customer_id: customerId, status: statusSelect.value, renewal_date: renewalInput.value || null }
      });
      saveBtn.textContent = 'Saved!';
      setTimeout(() => loadCustomers(), 800);
    } catch (e) {
      saveBtn.textContent = 'Error';
      console.error(e);
    } finally {
      saveBtn.disabled = false;
    }
  }

  function wireNewCustomerForm() {
    const toggleBtn = qs('#newCustomerBtn');
    const panel = qs('#newCustomerForm');
    const cancelBtn = qs('#cancelNewCustomerBtn');
    const form = qs('#createCustomerForm');
    if (!toggleBtn || !form) return;

    toggleBtn.addEventListener('click', () => {
      panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
    });
    cancelBtn.addEventListener('click', () => {
      form.reset();
      panel.style.display = 'none';
    });

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const statusEl = qs('#createCustomerStatus');
      const name = qs('#newCustomerName').value.trim();
      const email = qs('#newCustomerEmail').value.trim();
      const password = qs('#newCustomerPassword').value;
      setStatus(statusEl, 'Creating account…', '');
      try {
        const result = await api('/api/admin/create-customer', { method: 'POST', body: { name, email, password: password || undefined } });
        const pwNote = result.password ? ` Password: ${result.password}` : '';
        setStatus(statusEl, `Account created for ${escapeHtml(email)}.${pwNote} Share these with them to log in.`, 'success');
        form.reset();
        loaded.customers = false;
        loadCustomers();
      } catch (err) {
        setStatus(statusEl, err.message || 'Could not create the account.', 'error');
      }
    });
  }

  async function loadCustomers() {
    const body = qs('#customersTableBody');
    body.innerHTML = '<tr><td colspan="6">Loading…</td></tr>';
    try {
      const { customers } = await api('/api/admin/customers');
      if (!customers.length) {
        body.innerHTML = '<tr><td colspan="6">No registered customers yet.</td></tr>';
        return;
      }
      body.innerHTML = customers
        .map((c) => {
          const plan = c.carePlan || {};
          const status = plan.status || 'inactive';
          const renewal = plan.renewal_date || '';
          return `<tr>
            <td>${formatDate(c.created_at)}</td>
            <td>${escapeHtml(c.name)}</td>
            <td><a href="mailto:${escapeHtml(c.email)}">${escapeHtml(c.email)}</a></td>
            <td>${escapeHtml(status)}</td>
            <td>${escapeHtml(renewal) || '—'}</td>
            <td>
              <div class="care-plan-edit-row" data-customer-id="${c.id}">
                <select>
                  <option value="inactive" ${status === 'inactive' ? 'selected' : ''}>Inactive</option>
                  <option value="active" ${status === 'active' ? 'selected' : ''}>Active</option>
                  <option value="cancellation_requested" ${status === 'cancellation_requested' ? 'selected' : ''}>Cancellation Requested</option>
                  <option value="cancelled" ${status === 'cancelled' ? 'selected' : ''}>Cancelled</option>
                </select>
                <input type="date" value="${escapeHtml(renewal)}" />
                <button class="admin-row-action">Save</button>
              </div>
            </td>
          </tr>`;
        })
        .join('');

      qsa('.care-plan-edit-row', body).forEach((row) => {
        qs('button', row).addEventListener('click', () => saveCarePlan(row.dataset.customerId, row));
      });
    } catch (e) {
      body.innerHTML = `<tr><td colspan="6">Could not load customers: ${escapeHtml(e.message)}</td></tr>`;
    }
  }

  const loaders = { leads: loadLeads, bookings: loadBookings, conversations: loadConversations, customers: loadCustomers };
  const loaded = {};

  function loadPanel(name) {
    if (loaded[name]) return;
    loaded[name] = true;
    loaders[name]();
  }

  async function init() {
    const session = await requireSession();
    if (!session) return;
    wireLogout();
    wireTabs();
    wireNewCustomerForm();
    loadPanel('leads');
  }

  init();
})();
