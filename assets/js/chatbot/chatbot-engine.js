// State machine: renders the current node, handles option clicks and capture-step
// text input, and persists every turn via /api/chat/*. Persistence failures never
// block the conversation — they're logged and swallowed.
window.TrellisChatEngine = (function () {
  const { api, isValidEmail } = window.TrellisUtils;
  const TREE = window.TRELLIS_CHATBOT_TREE;
  const COPY = window.TRELLIS_CHATBOT_COPY;

  let conversationId = null;
  let captured = {};
  let renderCallbacks = null; // supplied by chatbot-widget.js: { addBotMessage, addVisitorMessage, renderOptions, renderCaptureInput, clearPending }

  async function logSafely(fn) {
    try {
      await fn();
    } catch (e) {
      console.warn('[Trellis chatbot] persistence call failed (conversation continues):', e.message);
    }
  }

  async function start(ui) {
    renderCallbacks = ui;
    captured = {};
    try {
      const res = await api('/api/chat/start', { method: 'POST', body: { page_url: window.location.href } });
      conversationId = res.conversation_id;
    } catch (e) {
      conversationId = null; // chat still works fully offline-safe even if logging fails
    }
    renderNode('root');
  }

  function assertEndsInEscalate(node) {
    const last = node.options && node.options[node.options.length - 1];
    if (!last || (last.action !== 'ESCALATE' && !/none of the above/i.test(last.label))) {
      console.error(`[Trellis chatbot] node "${node.id}" does not end in a "None of the above" escalation option`);
    }
  }

  function renderNode(nodeId) {
    const node = TREE[nodeId];
    if (!node) {
      console.error(`[Trellis chatbot] unknown node "${nodeId}"`);
      return;
    }
    assertEndsInEscalate(node);
    renderCallbacks.clearPending();
    renderCallbacks.addBotMessage(node.message);

    if (node.inputType) {
      renderCallbacks.renderCaptureInput(node, (value) => handleCaptureSubmit(node, value));
    }
    renderCallbacks.renderOptions(node.options, (option, index) => handleOptionClick(node, option, index));
  }

  function handleOptionClick(node, option, index) {
    renderCallbacks.addVisitorMessage(option.label);
    logSafely(() =>
      api('/api/chat/message', {
        method: 'POST',
        body: { conversation_id: conversationId, sender: 'visitor', node_id: node.id, message_text: option.label, selected_option_index: index }
      })
    );

    if (option.meta && option.meta.bookingType) {
      captured.bookingType = option.meta.bookingType;
    }
    if (option.meta && option.meta.thenCapture) {
      captured._pendingCapture = option.meta.thenCapture;
    }

    if (option.action === 'ESCALATE') {
      escalate(node);
      return;
    }

    if (option.action === 'STANDBY') {
      renderCallbacks.addBotMessage(COPY.standby);
      if (option.next) renderNode(option.next);
      return;
    }

    if (option.action === 'DEEPLINK_BOOKING') {
      if (window.TrellisBooking) {
        window.TrellisBooking.startBooking(captured.bookingType || 'quote', { name: captured.name, email: captured.email, phone: captured.phone });
      } else if (window.TrellisNav) {
        window.TrellisNav.scrollToBooking(captured.bookingType || 'quote');
      }
      if (option.next) renderNode(option.next);
      return;
    }

    if (option.action === 'DEEPLINK_PRICING') {
      if (window.TrellisNav) window.TrellisNav.scrollToSection('#pricing');
      if (option.next) renderNode(option.next);
      return;
    }

    if (option.action === 'DEEPLINK_PORTFOLIO') {
      if (window.TrellisNav) window.TrellisNav.scrollToSection('#portfolio');
      if (option.next) renderNode(option.next);
      return;
    }

    if (option.next) renderNode(option.next);
  }

  function handleCaptureSubmit(node, rawValue) {
    const value = (rawValue || '').trim();
    if (!value) return false;
    if (node.validation === 'email' && !isValidEmail(value)) {
      return false; // widget shows inline validation message
    }

    renderCallbacks.addVisitorMessage(value);
    captured[node.captureField] = value;

    logSafely(() =>
      api('/api/chat/message', {
        method: 'POST',
        body: {
          conversation_id: conversationId,
          sender: 'visitor',
          node_id: node.id,
          message_text: value,
          captured: { [node.captureField]: value }
        }
      })
    );

    let nextId = node.next;
    if (captured._pendingCapture === 'phone' && node.captureField === 'email') {
      nextId = 'capture_phone_value';
      delete captured._pendingCapture;
    }

    renderNode(nextId);
    return true;
  }

  function escalate(node) {
    logSafely(() =>
      api('/api/chat/escalate', {
        method: 'POST',
        body: { conversation_id: conversationId, node_id: node.id, captured }
      })
    );
    renderCallbacks.clearPending();
    renderCallbacks.addBotMessage(COPY.escalate);
    renderCallbacks.renderOptions([{ label: COPY.startOver, next: 'root' }], (option) => renderNode(option.next));
  }

  return { start };
})();
