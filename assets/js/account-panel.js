// Draggable left-side account panel. Shown when a customer is logged in.
// window.TrellisAccountPanel: { show, hide, openPanel, closePanel }
window.TrellisAccountPanel = (function () {
  const { qs } = window.TrellisUtils;

  let panel, tab;
  let isDragging = false;
  let dragStartY = 0;
  let panelStartTop = 0;
  let hasDragged = false;

  function getInitials(name) {
    if (!name) return '?';
    const parts = name.trim().split(/\s+/);
    return parts.length === 1
      ? parts[0][0].toUpperCase()
      : (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }

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

  function onDrag(e) {
    if (!isDragging) return;
    hasDragged = true;
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
      hasDragged = false;
      dragStartY = e.clientY;
      panelStartTop = panel.getBoundingClientRect().top;
      panel.classList.add('is-dragged');
      panel.style.top = panelStartTop + 'px';
      document.addEventListener('mousemove', onDrag);
      document.addEventListener('mouseup', onDragEnd);
      e.preventDefault();
    });
  }

  function build() {
    panel = qs('#accountPanel');
    tab = qs('#accountPanelTab');
    if (!panel) return;

    const dragHandle = panel.querySelector('#accountPanelDrag');
    const closeBtn = panel.querySelector('#accountPanelClose');
    const logoutBtn = panel.querySelector('#accountPanelLogout');

    if (dragHandle) initDrag(dragHandle);
    if (closeBtn) closeBtn.addEventListener('click', closePanel);
    if (tab) tab.addEventListener('click', openPanel);

    if (logoutBtn) {
      logoutBtn.addEventListener('click', () => {
        if (window.TrellisAuth) window.TrellisAuth.logout();
        hide();
      });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', build);
  } else {
    build();
  }

  return { show, hide, openPanel, closePanel };
})();
