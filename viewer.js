// 3D viewer for the Dash parts, using the printer's STL files.
//  - The parts viewer (#stage): pick a part, spin, zoom, move, download.
//  - Showcase canvases (canvas.showcase[data-file]): one part turning slowly
//    behind a headline; the page still scrolls over them.
(function () {
  if (!window.THREE || !THREE.STLLoader || !THREE.OrbitControls) {
    const status = document.getElementById('viewer-status');
    if (status) status.textContent = 'The 3D view could not load. You can still download the files below.';
    return;
  }
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const loader = new THREE.STLLoader();
  const cache = {};

  function load(file) {
    if (!cache[file]) {
      cache[file] = new Promise((resolve, reject) => {
        loader.load(file, (g) => { g.computeVertexNormals(); g.center(); resolve(g); }, undefined, reject);
      });
    }
    return cache[file];
  }

  function createViewer(canvas, { interactive, color, tilt }) {
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 5000);
    const controls = new THREE.OrbitControls(camera, canvas);
    controls.enableDamping = true;
    controls.enabled = interactive;
    controls.autoRotate = !reduce;
    controls.autoRotateSpeed = interactive ? 1.2 : 0.8;
    scene.add(new THREE.HemisphereLight(0xffffff, 0x223344, 0.9));
    const key = new THREE.DirectionalLight(0xffffff, 0.85);
    key.position.set(1, 1.4, 1.2);
    scene.add(key);
    const rim = new THREE.DirectionalLight(0x5aa8ff, 0.7);
    rim.position.set(-1.2, -0.6, -1);
    scene.add(rim);
    const material = new THREE.MeshStandardMaterial({ color, roughness: 0.55, metalness: 0.15 });
    let mesh = null;
    let visible = true;

    function resize() {
      const w = canvas.clientWidth, h = canvas.clientHeight;
      if (!w || !h) return;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    }
    function frame() {
      if (!mesh) return;
      const size = new THREE.Box3().setFromObject(mesh).getSize(new THREE.Vector3());
      const radius = Math.max(size.x, size.y, size.z) * 0.62;
      const distance = (radius / Math.sin((camera.fov * Math.PI) / 360)) * (interactive ? 1.05 : 1.6);
      controls.target.set(0, 0, 0);
      camera.up.set(0, 0, 1);
      camera.position.set(distance * 0.55, -distance * (tilt || 0.7), distance * 0.55);
      camera.near = distance / 100;
      camera.far = distance * 20;
      camera.updateProjectionMatrix();
      controls.update();
    }
    function show(geometry) {
      if (mesh) scene.remove(mesh);
      mesh = new THREE.Mesh(geometry, material);
      scene.add(mesh);
      frame();
    }
    if ('ResizeObserver' in window) new ResizeObserver(resize).observe(canvas);
    window.addEventListener('resize', resize);
    resize();
    // Only draw while on screen.
    new IntersectionObserver((e) => { visible = e[0].isIntersecting; }).observe(canvas);
    (function loop() {
      if (visible) { controls.update(); renderer.render(scene, camera); }
      requestAnimationFrame(loop);
    })();
    canvas.addEventListener('pointerdown', () => { if (interactive) controls.autoRotate = false; });
    return { show, frame };
  }

  // Showcases
  document.querySelectorAll('canvas.showcase[data-file]').forEach((canvas) => {
    const v = createViewer(canvas, { interactive: false, color: 0x8f99a6, tilt: 0.35 });
    load(canvas.dataset.file).then(v.show).catch(() => {});
  });

  // Parts viewer
  const stage = document.getElementById('stage');
  if (!stage) return;
  const status = document.getElementById('viewer-status');
  const nameEl = document.getElementById('part-name');
  const sizeEl = document.getElementById('part-size');
  const download = document.getElementById('part-download');
  const buttons = Array.from(document.querySelectorAll('.part-picker button'));
  const viewer = createViewer(stage, { interactive: true, color: 0x9aa4b0 });

  function pick(button) {
    buttons.forEach((b) => b.setAttribute('aria-selected', String(b === button)));
    const file = button.dataset.file;
    nameEl.textContent = button.textContent;
    sizeEl.textContent = button.dataset.size;
    download.href = file;
    status.textContent = 'Loading ' + button.textContent.toLowerCase() + '…';
    status.hidden = false;
    load(file).then((g) => {
      if (button.getAttribute('aria-selected') !== 'true') return;
      viewer.show(g);
      status.hidden = true;
    }).catch(() => {
      status.textContent = 'This part could not load. Try another, or reload the page.';
    });
  }
  buttons.forEach((b) => b.addEventListener('click', () => pick(b)));
  document.getElementById('reset-view').addEventListener('click', viewer.frame);
  pick(buttons[0]);
})();
