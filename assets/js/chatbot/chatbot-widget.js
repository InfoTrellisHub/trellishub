// DOM construction for the chat widget: launcher bubble + panel. Self-contained —
// only depends on utils.js + chatbot-data.js + chatbot-engine.js + chatbot.css.
(function () {
  function el(tag, className, html) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (html !== undefined) node.innerHTML = html;
    return node;
  }

  function buildWidget() {
    const launcher = el('button', 'trellis-chat-launcher is-idle');
    launcher.setAttribute('aria-label', 'Open Trellis chat assistant');
    launcher.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>';

    const panel = el('div', 'trellis-chat-panel');
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-label', 'Trellis chat assistant');

    const header = el('div', 'trellis-chat-header');
    header.innerHTML = '<strong>Trellis Assistant</strong>';
    const closeBtn = el('button', 'trellis-chat-close', '&times;');
    closeBtn.setAttribute('aria-label', 'Close chat');
    header.appendChild(closeBtn);

    const body = el('div', 'trellis-chat-body');
    body.setAttribute('aria-live', 'polite');

    panel.appendChild(header);
    panel.appendChild(body);

    document.body.appendChild(launcher);
    document.body.appendChild(panel);

    let started = false;

    function open() {
      panel.classList.add('is-open');
      launcher.classList.remove('is-idle');
      if (!started) {
        started = true;
        window.TrellisChatEngine.start(ui);
      }
    }

    function close() {
      panel.classList.remove('is-open');
    }

    launcher.addEventListener('click', open);
    closeBtn.addEventListener('click', close);

    function scrollToBottom() {
      body.scrollTop = body.scrollHeight;
    }

    function addBotMessage(text) {
      const msg = el('div', 'trellis-chat-msg bot', '');
      msg.textContent = text;
      body.appendChild(msg);
      scrollToBottom();
    }

    function addVisitorMessage(text) {
      const msg = el('div', 'trellis-chat-msg visitor', '');
      msg.textContent = text;
      body.appendChild(msg);
      scrollToBottom();
    }

    function clearInteractiveElements() {
      Array.from(body.querySelectorAll('.trellis-chat-options, .trellis-chat-capture')).forEach((node) => node.remove());
    }

    function renderOptions(options, onSelect) {
      const wrap = el('div', 'trellis-chat-options');
      options.forEach((option, index) => {
        const btn = el('button', 'trellis-chat-option' + (option.action === 'ESCALATE' || /none of the above/i.test(option.label) ? ' is-escalate' : ''));
        btn.textContent = `${index + 1}. ${option.label}`;
        btn.addEventListener('click', () => {
          Array.from(wrap.querySelectorAll('button')).forEach((b) => (b.disabled = true));
          onSelect(option, index + 1);
        });
        wrap.appendChild(btn);
      });
      body.appendChild(wrap);
      scrollToBottom();
    }

    function renderCaptureInput(node, onSubmit) {
      const wrap = el('div', 'trellis-chat-capture');
      const input = document.createElement('input');
      input.type = node.validation === 'email' ? 'email' : 'text';
      input.placeholder = node.captureField === 'email' ? 'you@example.com' : node.captureField === 'phone' ? '072 000 0000' : 'Type your answer…';
      const submitBtn = el('button', '', 'Send');

      function submit() {
        const ok = onSubmit(input.value);
        if (ok === false) {
          input.style.borderColor = 'var(--color-error)';
          return;
        }
        input.disabled = true;
        submitBtn.disabled = true;
      }

      submitBtn.addEventListener('click', submit);
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') submit();
      });

      wrap.appendChild(input);
      wrap.appendChild(submitBtn);
      body.insertBefore(wrap, body.lastElementChild && body.lastElementChild.classList.contains('trellis-chat-options') ? body.lastElementChild : null);
      body.appendChild(wrap);
      scrollToBottom();
      input.focus();
    }

    const ui = { addBotMessage, addVisitorMessage, renderOptions, renderCaptureInput, clearPending: clearInteractiveElements };

    // Exposed so the chatbot's booking deep-link can open the widget if it was closed.
    window.TrellisChatWidget = { open, close };
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', buildWidget);
  } else {
    buildWidget();
  }
})();
