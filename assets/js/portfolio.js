// Fetches /assets/data/projects.json and renders portfolio cards into #portfolioGrid
(function () {
  const INDUSTRY_META = {
    medical: {
      accentClass: 'portfolio-card--medical',
      icon: '<svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="3"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/></svg>',
    },
    service: {
      accentClass: 'portfolio-card--service',
      icon: '<svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>',
    },
    sales: {
      accentClass: 'portfolio-card--sales',
      icon: '<svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>',
    },
    multi: {
      accentClass: 'portfolio-card--multi',
      icon: '<svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></svg>',
    },
  };

  let currentProjects = [];

  function featurePills(features) {
    return features.map((f) =>
      `<span class="portfolio-feature">${f}</span>`
    ).join('');
  }

  function renderCard(project, index) {
    const meta = INDUSTRY_META[project.id] || INDUSTRY_META.service;
    const tierBadge = project.tier
      ? `<span class="portfolio-tier-badge">${project.tier}</span>`
      : '';
    const hasMultipleDemos = Array.isArray(project.demos) && project.demos.length > 0;
    const viewBtn = hasMultipleDemos
      ? `<button type="button" class="btn btn-primary portfolio-view-btn" data-demo-picker="${index}">View Demo</button>`
      : `<a href="${project.link}" class="btn btn-primary portfolio-view-btn" target="_blank" rel="noopener">View Demo</a>`;
    return `
      <div class="card portfolio-card ${meta.accentClass}" data-reveal>
        <div class="portfolio-thumb-new">
          ${tierBadge}
          <div class="portfolio-thumb-icon">${meta.icon}</div>
        </div>
        <div class="portfolio-card-body">
          <span class="portfolio-industry-tag">${project.industry}</span>
          <h3 class="portfolio-card-title">${project.title}</h3>
          <p class="portfolio-card-desc">${project.description}</p>
          <div class="portfolio-features">${featurePills(project.features)}</div>
          ${viewBtn}
        </div>
      </div>`;
  }

  function demoOption(demo) {
    return `
      <a href="${demo.link}" class="portfolio-demo-option" target="_blank" rel="noopener">
        <span class="portfolio-demo-option-tag">${demo.industry}</span>
        <span class="portfolio-demo-option-title">${demo.title}</span>
        <span class="portfolio-demo-option-desc">${demo.description}</span>
        <span class="portfolio-demo-option-cta">View Demo &rarr;</span>
      </a>`;
  }

  function ensureDemoModal() {
    let overlay = document.getElementById('portfolioDemoOverlay');
    if (overlay) return overlay;

    overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.id = 'portfolioDemoOverlay';
    overlay.innerHTML = `
      <div class="modal-panel portfolio-demo-modal" role="dialog" aria-modal="true" aria-labelledby="portfolioDemoTitle">
        <button type="button" class="modal-close" id="portfolioDemoClose" aria-label="Close">&times;</button>
        <h2 id="portfolioDemoTitle"></h2>
        <p class="auth-subtext" id="portfolioDemoSubtext"></p>
        <div class="portfolio-demo-list" id="portfolioDemoList"></div>
      </div>`;
    document.body.appendChild(overlay);

    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) closeDemoPicker();
    });
    overlay.querySelector('#portfolioDemoClose').addEventListener('click', closeDemoPicker);
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && overlay.classList.contains('is-open')) closeDemoPicker();
    });

    return overlay;
  }

  function openDemoPicker(project) {
    const overlay = ensureDemoModal();
    overlay.querySelector('#portfolioDemoTitle').textContent = project.title;
    overlay.querySelector('#portfolioDemoSubtext').textContent = project.description;
    overlay.querySelector('#portfolioDemoList').innerHTML = project.demos.map(demoOption).join('');
    overlay.classList.add('is-open');
  }

  function closeDemoPicker() {
    const overlay = document.getElementById('portfolioDemoOverlay');
    if (overlay) overlay.classList.remove('is-open');
  }

  async function loadPortfolio() {
    const grid = document.getElementById('portfolioGrid');
    if (!grid) return;

    try {
      const res = await fetch('/assets/data/projects.json');
      if (!res.ok) throw new Error('Failed to load');
      const projects = await res.json();
      currentProjects = projects;
      grid.innerHTML = projects.map(renderCard).join('');

      grid.addEventListener('click', (e) => {
        const btn = e.target.closest('[data-demo-picker]');
        if (!btn) return;
        const project = currentProjects[Number(btn.dataset.demoPicker)];
        if (project) openDemoPicker(project);
      });

      // Re-trigger scroll-reveal on newly inserted cards
      if (window.TrellisReveal) window.TrellisReveal();
    } catch (e) {
      grid.innerHTML = '<p style="color:var(--color-muted);text-align:center;">Portfolio examples could not be loaded.</p>';
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', loadPortfolio);
  } else {
    loadPortfolio();
  }
})();
