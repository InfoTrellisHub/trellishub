/**
 * Trellishub Protection
 * Handles: ToS gate, cookie consent banner, right-click / devtools guard, watermark.
 *
 * Configure per-page BEFORE loading this script:
 *   window.TH_PROTECTION = { tos, cookies, rightClick, watermark, privacyUrl }
 * All flags default to true; set to false to disable.
 */
(function () {
  'use strict';

  var CFG       = window.TH_PROTECTION || {};
  var TOS       = CFG.tos        !== false;
  var COOKIES   = CFG.cookies    !== false;
  var RC        = CFG.rightClick !== false;
  var WATERMARK = CFG.watermark  !== false;
  var PRIVACY   = CFG.privacyUrl || '/privacy-policy.html';

  /* ── Inject CSS ──────────────────────────────────────────────────── */
  var CSS = [
    /* ToS overlay */
    '#th-tos-overlay{position:fixed;inset:0;background:rgba(0,0,0,.88);z-index:2147483647;display:flex;align-items:center;justify-content:center;padding:20px;font-family:system-ui,-apple-system,sans-serif;backdrop-filter:blur(5px);-webkit-backdrop-filter:blur(5px);cursor:auto;}',
    '#th-tos-modal{background:#fff;border-radius:16px;max-width:580px;width:100%;max-height:90vh;display:flex;flex-direction:column;box-shadow:0 24px 80px rgba(0,0,0,.5);overflow:hidden;}',
    '.th-tos-hd{padding:26px 30px 18px;border-bottom:1px solid #e8e8e8;flex-shrink:0;}',
    '.th-tos-brand{font-size:1rem;font-weight:800;letter-spacing:-.01em;color:#10241C;margin-bottom:6px;}',
    '.th-tos-brand span{color:#1B7A4D;}',
    '.th-tos-hd h2{font-size:1.2rem;font-weight:700;color:#10241C;margin:0;}',
    '.th-tos-bd{padding:22px 30px;overflow-y:auto;flex:1;font-size:.875rem;color:#4B5A55;line-height:1.65;}',
    '.th-tos-bd h3{font-size:.72rem;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:#10241C;margin:18px 0 6px;}',
    '.th-tos-bd h3:first-child{margin-top:0;}',
    '.th-tos-bd p{margin:0 0 10px;}',
    '.th-tos-bd a{color:#1B7A4D;}',
    '.th-tos-ft{padding:18px 30px 22px;border-top:1px solid #e8e8e8;flex-shrink:0;}',
    '.th-tos-chk{display:flex;align-items:flex-start;gap:12px;margin-bottom:14px;}',
    '.th-tos-chk input[type=checkbox]{margin-top:3px;width:17px;height:17px;accent-color:#1B7A4D;flex-shrink:0;cursor:pointer;}',
    '.th-tos-chk label{font-size:.85rem;color:#4B5A55;cursor:pointer;line-height:1.5;}',
    '.th-tos-btn{width:100%;padding:13px 20px;background:#1B7A4D;color:#fff;border:none;border-radius:10px;font-size:.875rem;font-weight:700;cursor:pointer;letter-spacing:.02em;transition:background .2s;}',
    '.th-tos-btn:disabled{opacity:.38;cursor:not-allowed;}',
    '.th-tos-btn:not(:disabled):hover{background:#145C3A;}',
    /* Cookie banner */
    '#th-cookie{position:fixed;bottom:0;left:0;right:0;background:#10241C;color:#fff;z-index:2147483646;padding:14px 24px;font-family:system-ui,-apple-system,sans-serif;font-size:.875rem;line-height:1.55;box-shadow:0 -4px 24px rgba(0,0,0,.25);display:flex;align-items:center;gap:20px;flex-wrap:wrap;transition:transform .3s ease;cursor:auto;}',
    '#th-cookie p{margin:0;flex:1;min-width:220px;color:rgba(255,255,255,.82);}',
    '#th-cookie a{color:#7ACBA3;text-decoration:underline;}',
    '.th-ck-btns{display:flex;gap:10px;flex-shrink:0;}',
    '.th-ck-btn{padding:9px 18px;border-radius:8px;font-size:.8rem;font-weight:700;cursor:pointer;transition:opacity .2s;}',
    '.th-ck-btn:hover{opacity:.82;}',
    '.th-ck-accept{background:#1B7A4D;color:#fff;border:none;}',
    '.th-ck-decline{background:transparent;color:rgba(255,255,255,.65);border:1px solid rgba(255,255,255,.25);}',
    /* Watermark */
    '#th-wm{position:fixed;bottom:20px;right:20px;background:rgba(16,36,28,.72);color:rgba(255,255,255,.85);font-family:system-ui,-apple-system,sans-serif;font-size:.68rem;font-weight:600;letter-spacing:.05em;padding:5px 12px;border-radius:999px;z-index:8999;pointer-events:none;-webkit-backdrop-filter:blur(6px);backdrop-filter:blur(6px);border:1px solid rgba(255,255,255,.1);transition:bottom .3s ease;}',
    'body.th-ck-on #th-wm{bottom:70px;}'
  ].join('');

  var styleEl = document.createElement('style');
  styleEl.textContent = CSS;
  (document.head || document.documentElement).appendChild(styleEl);

  /* ── Right-click & devtools guard ───────────────────────────────── */
  if (RC) {
    document.addEventListener('contextmenu', function (e) {
      e.preventDefault();
    });

    document.addEventListener('keydown', function (e) {
      var k = e.key;
      /* F12 */
      if (k === 'F12') { e.preventDefault(); return; }
      if (e.ctrlKey) {
        /* Ctrl+U (source), Ctrl+S (save) */
        if (/^[uUsS]$/.test(k)) { e.preventDefault(); return; }
        /* Ctrl+Shift+I / J / C (devtools) */
        if (e.shiftKey && /^[iIjJcC]$/.test(k)) { e.preventDefault(); return; }
      }
    });

    /* Block image drag */
    document.addEventListener('dragstart', function (e) {
      if (e.target && e.target.tagName === 'IMG') e.preventDefault();
    });
  }

  /* ── Watermark ──────────────────────────────────────────────────── */
  function addWatermark() {
    var wm = document.createElement('div');
    wm.id = 'th-wm';
    wm.setAttribute('aria-hidden', 'true');
    wm.textContent = 'Demo by Trellishub';
    document.body.appendChild(wm);
  }

  /* ── Cookie banner ──────────────────────────────────────────────── */
  function initCookies() {
    if (localStorage.getItem('th_cookies')) return;

    var el = document.createElement('div');
    el.id = 'th-cookie';
    el.setAttribute('role', 'dialog');
    el.setAttribute('aria-label', 'Cookie consent');
    el.innerHTML =
      '<p>We use cookies to improve your experience and for analytics. By continuing you agree to our ' +
      '<a href="' + PRIVACY + '" target="_blank" rel="noopener">Privacy Policy</a>. ' +
      'This site complies with GDPR &amp; POPIA.</p>' +
      '<div class="th-ck-btns">' +
        '<button class="th-ck-btn th-ck-decline" id="thCkDecline">Decline</button>' +
        '<button class="th-ck-btn th-ck-accept" id="thCkAccept">Accept All</button>' +
      '</div>';

    document.body.appendChild(el);
    document.body.classList.add('th-ck-on');

    function dismiss(val) {
      localStorage.setItem('th_cookies', val);
      el.style.transform = 'translateY(110%)';
      setTimeout(function () { if (el.parentNode) el.remove(); }, 320);
      document.body.classList.remove('th-ck-on');
    }

    document.getElementById('thCkAccept').addEventListener('click', function () { dismiss('accepted'); });
    document.getElementById('thCkDecline').addEventListener('click', function () { dismiss('declined'); });
  }

  /* ── ToS modal ──────────────────────────────────────────────────── */
  function initTos() {
    if (localStorage.getItem('th_tos_v1')) return;

    var overlay = document.createElement('div');
    overlay.id = 'th-tos-overlay';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-label', 'Terms of Service — Trellishub');

    overlay.innerHTML =
      '<div id="th-tos-modal">' +
        '<div class="th-tos-hd">' +
          '<div class="th-tos-brand">Trellis<span>hub</span></div>' +
          '<h2>Terms of Service</h2>' +
        '</div>' +
        '<div class="th-tos-bd">' +
          '<h3>1. Demo Disclaimer</h3>' +
          '<p>This is a demonstration website built by Trellishub (Pty) Ltd to showcase web design and development services. All brand names, businesses, products, people, and events depicted are fictional unless explicitly stated otherwise.</p>' +
          '<h3>2. Intellectual Property</h3>' +
          '<p>All content on this site — including but not limited to design, source code, graphics, layout, copy, and overall structure — is the exclusive intellectual property of Trellishub (Pty) Ltd. © 2025 Trellishub. All rights reserved.</p>' +
          '<h3>3. Prohibited Use</h3>' +
          '<p>You may not copy, reproduce, distribute, publish, modify, adapt, translate, reverse-engineer, decompile, or create derivative works from any part of this website or its content without prior written authorisation from Trellishub.</p>' +
          '<h3>4. Viewing Purposes Only</h3>' +
          '<p>Access is granted strictly for personal viewing and evaluation purposes. Screen-scraping, code extraction, automated access, or any commercial use of any kind is expressly prohibited.</p>' +
          '<h3>5. No Warranty</h3>' +
          '<p>This demo is provided "as is" without warranties of any kind, express or implied. Trellishub makes no representations regarding fitness for any particular purpose.</p>' +
          '<h3>6. Governing Law</h3>' +
          '<p>These terms are governed by the laws of the Republic of South Africa. Any disputes shall be subject to the exclusive jurisdiction of South African courts.</p>' +
          '<h3>7. Contact</h3>' +
          '<p>For licensing enquiries, permissions, or to get a website for your own business: <a href="mailto:info.trellishub@gmail.com">info.trellishub@gmail.com</a></p>' +
        '</div>' +
        '<div class="th-tos-ft">' +
          '<div class="th-tos-chk">' +
            '<input type="checkbox" id="thTosChk" />' +
            '<label for="thTosChk">I have read and agree to these Terms of Service. I understand this is a Trellishub demo and I will not copy, reuse, or redistribute any content or code.</label>' +
          '</div>' +
          '<button class="th-tos-btn" id="thTosBtn" disabled>Accept &amp; Continue →</button>' +
        '</div>' +
      '</div>';

    document.body.appendChild(overlay);
    document.body.style.overflow = 'hidden';

    var chk = document.getElementById('thTosChk');
    var btn = document.getElementById('thTosBtn');

    chk.addEventListener('change', function () {
      btn.disabled = !this.checked;
    });

    btn.addEventListener('click', function () {
      if (!chk.checked) return;
      localStorage.setItem('th_tos_v1', 'accepted');
      overlay.style.transition = 'opacity .35s ease';
      overlay.style.opacity = '0';
      setTimeout(function () {
        overlay.remove();
        document.body.style.overflow = '';
      }, 370);
    });

    /* Trap focus within modal */
    overlay.addEventListener('keydown', function (e) {
      if (e.key !== 'Tab') return;
      var focusable = overlay.querySelectorAll('input, button:not(:disabled), a[href]');
      var first = focusable[0];
      var last  = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault(); last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault(); first.focus();
      }
    });

    setTimeout(function () { chk.focus(); }, 80);
  }

  /* ── Boot ───────────────────────────────────────────────────────── */
  function boot() {
    if (WATERMARK) addWatermark();
    if (TOS)       initTos();
    if (COOKIES)   initCookies();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
