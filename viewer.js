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

  function createViewer(canvas, { interactive, color, tilt, front }) {
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
    // Everything turns together, so extras (the showcase screen) stay on the part.
    const group = new THREE.Group();
    scene.add(group);

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
      if (front) {
        // Look at the face (printed face down, so from below), display up.
        camera.up.set(0, 1, 0);
        camera.position.set(distance * 0.42, distance * 0.12, -distance * 0.9);
      } else {
        camera.up.set(0, 0, 1);
        camera.position.set(distance * 0.55, -distance * (tilt || 0.7), distance * 0.55);
      }
      camera.near = distance / 100;
      camera.far = distance * 20;
      camera.updateProjectionMatrix();
      controls.update();
    }
    function show(geometry) {
      if (mesh) group.remove(mesh);
      mesh = new THREE.Mesh(geometry, material);
      group.add(mesh);
      frame();
    }
    function add(object) { group.add(object); }
    if ('ResizeObserver' in window) new ResizeObserver(resize).observe(canvas);
    window.addEventListener('resize', resize);
    resize();
    // Only draw while on screen.
    new IntersectionObserver((e) => { visible = e[0].isIntersecting; }).observe(canvas);
    (function loop() {
      if (visible) {
        // The front view sways gently so the screen keeps facing you.
        if (front && !reduce) group.rotation.y = Math.sin(performance.now() / 2600) * 0.45;
        controls.update();
        renderer.render(scene, camera);
      }
      requestAnimationFrame(loop);
    })();
    canvas.addEventListener('pointerdown', () => { if (interactive) controls.autoRotate = false; });
    if (front) controls.autoRotate = false;
    return { show, frame, add };
  }

  // A Dash screen showing the next turn, drawn like the real firmware does.
  function screenTexture() {
    const c = document.createElement('canvas');
    c.width = c.height = 512;
    const g = c.getContext('2d');
    g.fillStyle = '#0b0d10';
    g.fillRect(0, 0, 512, 512);
    g.strokeStyle = '#ffffff';
    g.lineWidth = 34;
    g.lineCap = 'round';
    g.lineJoin = 'round';
    g.beginPath();
    g.moveTo(300, 250); g.lineTo(300, 160); g.lineTo(200, 160);
    g.stroke();
    g.fillStyle = '#ffffff';
    g.beginPath();
    g.moveTo(150, 160); g.lineTo(215, 105); g.lineTo(215, 215);
    g.closePath(); g.fill();
    g.textAlign = 'center';
    g.font = '800 92px Barlow, Arial, sans-serif';
    g.fillText('0.2', 236, 352);
    g.fillStyle = '#168bff';
    g.font = '700 46px Barlow, Arial, sans-serif';
    g.fillText('mi', 350, 352);
    g.fillStyle = '#ffffff';
    g.font = '700 40px Barlow, Arial, sans-serif';
    g.fillText('High Street', 256, 405);
    g.fillStyle = '#168bff';
    g.font = '600 30px Barlow, Arial, sans-serif';
    g.fillText('13 min  14:44', 256, 448);
    return new THREE.CanvasTexture(c);
  }

  // Showcases: the Dash case seen from the front, its screen lit up.
  document.querySelectorAll('canvas.showcase[data-file]').forEach((canvas) => {
    const v = createViewer(canvas, { interactive: false, color: 0x8f99a6, front: true });
    load(canvas.dataset.file).then((geometry) => {
      v.show(geometry);
      const box = new THREE.Box3().setFromBufferAttribute(geometry.attributes.position);
      const screen = new THREE.Mesh(
        new THREE.CircleGeometry(17.3, 96),
        new THREE.MeshBasicMaterial({ map: screenTexture() })
      );
      // The case is printed face down, so its front is the lowest z; the
      // display centre sits 1.9 mm above the case centre.
      screen.position.set(0, 1.9 - (box.max.y + box.min.y) / 2 + 0.0, box.min.z + 1.3);
      screen.rotation.y = Math.PI;
      v.add(screen);
    }).catch(() => {});
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
