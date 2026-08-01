/* ═══════════════════════════════════════════════════════
   AX-01 — UI ORCHESTRATION
   Boot sequence · GSAP reveals · nav state · telemetry ·
   hover → region excitation bridged to the 3D world.
   ═══════════════════════════════════════════════════════ */

(function () {
  'use strict';

  /* ── boot loader ─────────────────────────────────── */
  const loaderEl = document.getElementById('loader');
  const fillEl = document.getElementById('loader-fill');
  const pctEl = document.getElementById('loader-pct');
  const textEl = document.getElementById('loader-text');

  const bootLines = [
    'INITIALIZING SUBSTRATE',
    'ROUTING POWER PHASES',
    'CALIBRATING VRM ARRAY',
    'TRAINING LINK EQUALIZATION',
    'MOUNTING MEMORY CHANNELS',
    'NPU HANDSHAKE OK',
  ];

  let progress = 0;
  let worldReady = false;
  let finished = false;

  const bootTimer = setInterval(() => {
    // approach 90% while the world compiles; jump to 100 when ready
    const cap = worldReady ? 100 : 90;
    progress = Math.min(cap, progress + 3 + Math.random() * 9);
    fillEl.style.width = progress + '%';
    pctEl.textContent = String(Math.floor(progress)).padStart(2, '0');
    textEl.textContent = bootLines[Math.min(bootLines.length - 1, Math.floor(progress / 18))];
    if (progress >= 100) finishBoot();
  }, 130);

  function finishBoot() {
    if (finished) return;
    finished = true;
    clearInterval(bootTimer);
    fillEl.style.width = '100%';
    pctEl.textContent = '100';
    setTimeout(() => {
      loaderEl.classList.add('done');
      revealHero();
      setTimeout(() => loaderEl.remove(), 1400);
    }, 350);
  }

  window.addEventListener('ax:booted', () => { worldReady = true; });
  // hard fallback: never trap the visitor behind the loader
  setTimeout(() => { worldReady = true; }, 6000);

  /* ── GSAP section reveals ────────────────────────── */
  const hasGsap = typeof gsap !== 'undefined' && typeof ScrollTrigger !== 'undefined';
  if (hasGsap) {
    gsap.registerPlugin(ScrollTrigger);
  } else {
    // CDN failed — never trap content behind reveal states
    document.querySelectorAll('.reveal').forEach((el) => {
      el.style.opacity = '1';
      el.style.transform = 'none';
    });
  }
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function revealHero() {
    const hero = document.querySelector('#hero .panel');
    if (!hasGsap) return; // already forced visible above
    if (reduced) { gsap.set(hero, { opacity: 1, y: 0 }); return; }
    gsap.to(hero, { opacity: 1, y: 0, duration: 1.5, ease: 'power3.out', delay: 0.15 });
    gsap.from('#hud-top, #hud-rail, #hud-telemetry, #scroll-hint', {
      opacity: 0, duration: 1.6, ease: 'power2.out', delay: 0.5, clearProps: 'opacity',
    });
  }

  /* ── section-level scroll-triggered reveals with pinning ── */
  if (hasGsap) {
    document.querySelectorAll('.panel-section:not(#hero)').forEach((section) => {
      const panel = section.querySelector('.panel');
      if (!panel) return;

      if (reduced) {
        gsap.set(panel, { opacity: 1, y: 0 });
        return;
      }

      /* pin the section for a portion of its height for cinematic feel */
      ScrollTrigger.create({
        trigger: section,
        start: 'top top',
        end: 'bottom bottom',
        pin: false, /* don't physically pin — use the tall min-heights instead */
      });

      /* reveal panel when it enters viewport */
      gsap.to(panel, {
        opacity: 1, y: 0, duration: 1.25, ease: 'power3.out',
        scrollTrigger: { trigger: panel, start: 'top 78%', once: true },
      });
    });
  }

  /* staggered children inside cards/lists */
  if (hasGsap && !reduced) {
    [['.skill-grid', '.skill-card']].forEach(([wrap, item]) => {
      const wrapEl = document.querySelector(wrap);
      if (!wrapEl) return;
      gsap.from(wrapEl.querySelectorAll(item), {
        opacity: 0, y: 22, duration: 0.9, ease: 'power3.out', stagger: 0.12,
        scrollTrigger: { trigger: wrapEl, start: 'top 82%', once: true },
      });
    });

    /* individual project chapters get their own staggered tag/cta reveal */
    document.querySelectorAll('.project-chapter').forEach((chapter) => {
      const tags = chapter.querySelector('.tag-row');
      const ctas = chapter.querySelector('.project-ctas');
      const items = [];
      if (tags) items.push(...tags.querySelectorAll('li'));
      if (ctas) items.push(...ctas.querySelectorAll('.btn'));
      if (items.length) {
        gsap.from(items, {
          opacity: 0, y: 16, duration: 0.8, ease: 'power3.out', stagger: 0.08,
          scrollTrigger: { trigger: chapter, start: 'top 70%', once: true },
        });
      }
    });
  }

  /* ── nav + rail active state ─────────────────────── */
  const navLinks = Array.from(document.querySelectorAll('#nav a'));
  const railLabels = Array.from(document.querySelectorAll('.rail-labels span'));
  const sections = Array.from(document.querySelectorAll('.panel-section'));
  const railProgress = document.getElementById('rail-progress');
  const scrollHint = document.getElementById('scroll-hint');

  const io = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      const idx = entry.target.dataset.index;
      navLinks.forEach((a) => a.classList.toggle('active', a.dataset.section === idx));
      railLabels.forEach((s) => s.classList.toggle('active', s.dataset.section === idx));
    });
  }, { rootMargin: '-42% 0px -42% 0px' });
  sections.forEach((s) => io.observe(s));

  /* ── scroll-linked chrome: progress rail, hint, telemetry ── */
  const tlCam = document.getElementById('tl-cam');
  const tlPwr = document.getElementById('tl-pwr');
  const tlThm = document.getElementById('tl-thm');
  const sectorNames = ['NPU CORE', 'MEM ARRAY', 'SIG ROUTE', 'STOCKPILOT', 'EXAM OS', 'GYM SALAAR', 'OVERVIEW'];

  let ticking = false;
  function onScroll() {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => {
      const max = document.documentElement.scrollHeight - window.innerHeight;
      const p = max > 0 ? window.scrollY / max : 0;
      railProgress.style.height = (p * 100).toFixed(1) + '%';
      scrollHint.classList.toggle('hidden', window.scrollY > 60);
      const sector = Math.min(6, Math.round(p * 6));
      tlCam.textContent = sectorNames[sector] + ' ' + (p * 6).toFixed(2);
      ticking = false;
    });
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  /* quietly living telemetry */
  setInterval(() => {
    tlPwr.textContent = (0.82 + Math.random() * 0.05).toFixed(2) + ' V';
    tlThm.textContent = (40.5 + Math.random() * 2.2).toFixed(1) + '°C';
  }, 2400);

  /* ── WhatsApp click-to-chat setup ────────────────── */
  const waBtn = document.getElementById('whatsapp-link');
  if (waBtn) {
    const message = "Hi Abhinav! I came across your portfolio and really liked your work. I'd like to connect with you regarding an opportunity/project.";
    const whatsappUrl = `https://wa.me/919392380501?text=${encodeURIComponent(message)}`;
    waBtn.setAttribute('href', whatsappUrl);
  }

  /* ── hover → excite matching board region ────────── */
  function bindRegion(selector, region) {
    document.querySelectorAll(selector).forEach((el) => {
      el.addEventListener('mouseenter', () =>
        window.dispatchEvent(new CustomEvent('ax:region', { detail: { region, active: true } })));
      el.addEventListener('mouseleave', () =>
        window.dispatchEvent(new CustomEvent('ax:region', { detail: { region, active: false } })));
    });
  }
  bindRegion('.project-chapter', 'pcie');    // project chapters power the expansion region
  bindRegion('.skill-card', 'routing');       // skills excite the signal fabric
  bindRegion('.contact-pill, .whatsapp-btn', 'cpu'); // contact pills & whatsapp warm the core
})();
