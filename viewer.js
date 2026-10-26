// 3D viewer for the Dash parts: loads the printer's STL file for the chosen
// part and lets you spin, zoom and move it.
(function () {
  const canvas = document.getElementById('stage');
  const status = document.getElementById('viewer-status');
  const nameEl = document.getElementById('part-name');
  const sizeEl = document.getElementById('part-size');
  const download = document.getElementById('part-download');
  const buttons = Array.from(document.querySelectorAll('.part-picker button'));
  if (!canvas) return;
  if (!window.THREE || !THREE.STLLoader || !THREE.OrbitControls) {
    status.textContent = 'The 3D view could not load. You can still download the files below.';
    return;
  }

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 5000);
  const controls = new THREE.OrbitControls(camera, canvas);
  controls.enableDamping = true;
  scene.add(new THREE.HemisphereLight(0xffffff, 0x334455, 0.9));
  const key = new THREE.DirectionalLight(0xffffff, 0.8);
  key.position.set(1, 1.4, 1.2);
  scene.add(key);
  const rim = new THREE.DirectionalLight(0x9cc8ff, 0.35);
  rim.position.set(-1.2, -0.6, -1);
  scene.add(rim);

  const material = new THREE.MeshStandardMaterial({ color: 0x9aa4b0, roughness: 0.6, metalness: 0.1 });
  const loader = new THREE.STLLoader();
  const cache = {};
  let mesh = null;

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
    const distance = (radius / Math.sin((camera.fov * Math.PI) / 360)) * 1.05;
    controls.target.set(0, 0, 0);
    camera.up.set(0, 0, 1);
    camera.position.set(distance * 0.55, -distance * 0.7, distance * 0.55);
    camera.near = distance / 100;
    camera.far = distance * 20;
    camera.updateProjectionMatrix();
    controls.update();
  }

  function show(button) {
    buttons.forEach((b) => b.setAttribute('aria-selected', String(b === button)));
    const file = button.dataset.file;
    nameEl.textContent = button.textContent;
    sizeEl.textContent = button.dataset.size;
    download.href = file;
    status.textContent = 'Loading ' + button.textContent.toLowerCase() + '…';
    status.hidden = false;
    const use = (geometry) => {
      if (button.getAttribute('aria-selected') !== 'true') return;
      if (mesh) scene.remove(mesh);
      mesh = new THREE.Mesh(geometry, material);
      scene.add(mesh);
      status.hidden = true;
      frame();
    };
    if (cache[file]) return use(cache[file]);
    loader.load(file, (geometry) => {
      geometry.computeVertexNormals();
      geometry.center();
      cache[file] = geometry;
      use(geometry);
    }, undefined, () => {
      status.textContent = 'This part could not load. Try another, or reload the page.';
    });
  }

  buttons.forEach((b) => b.addEventListener('click', () => show(b)));
  document.getElementById('reset-view').addEventListener('click', frame);
  if ('ResizeObserver' in window) new ResizeObserver(resize).observe(canvas);
  window.addEventListener('resize', resize);
  resize();
  controls.autoRotate = !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  controls.autoRotateSpeed = 1.2;
  canvas.addEventListener('pointerdown', () => { controls.autoRotate = false; });
  (function loop() {
    controls.update();
    renderer.render(scene, camera);
    requestAnimationFrame(loop);
  })();
  show(buttons[0]);
})();
