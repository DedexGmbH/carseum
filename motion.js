// Scroll motion for the site: scenes animate in as they arrive, videos play
// only while on screen, the phone drifts a little (parallax), the top bar
// turns solid after the hero, and the dot rail shows where you are.
(function () {
  const root = document.documentElement;
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  root.classList.add('js');
  if (document.body.dataset.snap === 'mandatory') root.classList.add('snap');

  const scenes = Array.from(document.querySelectorAll('.scene, .flow'));
  const top = document.querySelector('.top');

  // Hero headline: each word slides in, one after another.
  document.querySelectorAll('.hero h1').forEach((h1) => {
    const words = h1.textContent.trim().split(/\s+/);
    h1.setAttribute('aria-label', h1.textContent.trim());
    h1.textContent = '';
    words.forEach((w, i) => {
      const span = document.createElement('span');
      span.className = 'word';
      span.style.setProperty('--i', i);
      span.setAttribute('aria-hidden', 'true');
      span.textContent = w;
      h1.appendChild(span);
      if (i < words.length - 1) h1.appendChild(document.createTextNode(' '));
    });
  });

  // Scenes come in once, and videos play only while their scene is showing.
  const videos = new Map();
  scenes.forEach((s) => videos.set(s, Array.from(s.querySelectorAll('video'))));
  const seen = new IntersectionObserver((entries) => {
    entries.forEach((e) => {
      if (e.isIntersecting) e.target.classList.add('in');
      videos.get(e.target).forEach((v) => {
        if (reduce) return;
        if (e.isIntersecting) v.play().catch(() => {});
        else v.pause();
      });
    });
  }, { threshold: 0.35 });
  scenes.forEach((s) => seen.observe(s));
  // The hero is already in view when the page opens.
  if (scenes[0]) scenes[0].classList.add('in');

  // Dot rail: one dot per scene, the current one lit.
  const rail = document.querySelector('.rail');
  const railScenes = scenes.filter((s) => s.dataset.title);
  const dots = railScenes.map((s) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.setAttribute('aria-label', s.dataset.title);
    b.title = s.dataset.title;
    b.addEventListener('click', () => s.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth' }));
    rail && rail.appendChild(b);
    return b;
  });

  // One scroll handler for the top bar, the rail and the parallax.
  const movers = Array.from(document.querySelectorAll('.parallax'));
  let ticking = false;
  function update() {
    ticking = false;
    const vh = window.innerHeight;
    if (top) top.classList.toggle('solid', window.scrollY > vh * 0.6);
    let current = 0;
    railScenes.forEach((s, i) => {
      const r = s.getBoundingClientRect();
      if (r.top <= vh * 0.5) current = i;
    });
    dots.forEach((d, i) => d.classList.toggle('on', i === current));
    if (reduce) return;
    movers.forEach((m) => {
      const r = m.closest('.scene').getBoundingClientRect();
      const p = Math.max(-1, Math.min(1, (r.top + r.height / 2 - vh / 2) / vh));
      m.style.setProperty('--p', p.toFixed(3));
    });
  }
  window.addEventListener('scroll', () => {
    if (!ticking) { ticking = true; requestAnimationFrame(update); }
  }, { passive: true });
  window.addEventListener('resize', update);
  update();
})();
