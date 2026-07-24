with open("js/intro.js", "w") as f:
    f.write("""(function () {
  'use strict';

  /* ── STATO E SETUP ── */
  let introActive = true;
  let rafHandle = null;
  let startTime = null;
  let finishing = false;
  const DURATION = 11000; // 11 secondi

  window.introIsActive = true;

  const seq = document.getElementById('intro-sequence');

  /* Nascondi gli elementi esistenti */
  ['boot', 'hud-container', 'vignette', 'scanlines'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.style.display = 'none';
  });

  const mainCV = document.getElementById('threeCanvas');
  if (mainCV) {
    mainCV.style.display = 'block';
    mainCV.style.opacity = '0';
    mainCV.style.transition = 'none';
    mainCV.style.pointerEvents = 'none';
  }

  const domObs = new MutationObserver(mutations => {
    mutations.forEach(m => m.addedNodes.forEach(node => {
      if (node.nodeType === 1 && node.style && node.style.zIndex === '5' && introActive) {
        node.style.display = 'none';
        node.style.opacity = '0';
      }
    }));
  });
  domObs.observe(document.body, { childList: true });

  const threeCanvas = document.createElement('canvas');
  threeCanvas.style.cssText = 'position:absolute;top:0;left:0;width:100%;height:100%;z-index:1;display:block;';
  seq.appendChild(threeCanvas);

  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({
      canvas: threeCanvas,
      antialias: true,
      alpha: false,
      powerPreference: 'high-performance'
    });
  } catch (e) {
    console.warn('[Intro] WebGL non disponibile, salto intro:', e.message);
    introActive = false;
    window.introIsActive = false;
    seq.style.display = 'none';
    ['boot', 'hud-container', 'vignette', 'scanlines'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.style.display = '';
    });
    if (mainCV) { mainCV.style.opacity = '1'; mainCV.style.pointerEvents = ''; }
    domObs.disconnect();
    return;
  }
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.physicallyCorrectLights = true;

  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x1a2228, 0.015);
  scene.background = new THREE.Color(0x1a2228);

  const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 200);

  /* ── ENVIRONMENT MAP ── */
  function buildEnvMap() {
    const w = 512, h = 256;
    const cv = document.createElement('canvas');
    cv.width = w; cv.height = h;
    const ctx = cv.getContext('2d');
    const skyGrad = ctx.createLinearGradient(0, 0, 0, h);
    skyGrad.addColorStop(0, '#88aacc');
    skyGrad.addColorStop(1, '#ddeecc');
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, w, h);
    const tex = new THREE.CanvasTexture(cv);
    tex.mapping = THREE.EquirectangularReflectionMapping;
    const pmrem = new THREE.PMREMGenerator(renderer);
    pmrem.compileEquirectangularShader();
    const env = pmrem.fromEquirectangular(tex).texture;
    pmrem.dispose();
    tex.dispose();
    return env;
  }
  scene.environment = buildEnvMap();

  /* ── ILLUMINAZIONE ── */
  scene.add(new THREE.AmbientLight(0x708090, 0.8));
  
  const dirLight = new THREE.DirectionalLight(0xaaccff, 2.5);
  dirLight.position.set(-15, 12, 5);
  dirLight.target.position.set(0, 0, 0);
  dirLight.castShadow = true;
  dirLight.shadow.mapSize.set(2048, 2048);
  dirLight.shadow.camera.near = 1;
  dirLight.shadow.camera.far = 40;
  dirLight.shadow.camera.left = -15;
  dirLight.shadow.camera.right = 15;
  dirLight.shadow.camera.top = 15;
  dirLight.shadow.camera.bottom = -15;
  dirLight.shadow.bias = -0.001;
  scene.add(dirLight);
  scene.add(dirLight.target);

  const poolLight = new THREE.PointLight(0x00ffff, 4.0, 15);
  poolLight.position.set(0, -1.0, 0);
  scene.add(poolLight);

  /* ── MATERIALI ── */
  const matTile = new THREE.MeshStandardMaterial({ color: 0x555555, roughness: 0.8 });
  const matMarble = new THREE.MeshPhysicalMaterial({ color: 0xdddddd, roughness: 0.1, metalness: 0.1, clearcoat: 1.0, clearcoatRoughness: 0.1 });
  const matColumn = new THREE.MeshStandardMaterial({ color: 0x667777, roughness: 0.7 });
  const matWater = new THREE.MeshPhysicalMaterial({ color: 0x00aaff, transmission: 0.9, opacity: 0.8, transparent: true, roughness: 0.1 });
  const matAnimus = new THREE.MeshPhysicalMaterial({ color: 0xf5f5dc, roughness: 0.3, clearcoat: 0.5 });
  const matDarkMetal = new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.5, metalness: 0.8 });
  const matEmissive = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 2.0 });
  const matWin = new THREE.MeshBasicMaterial({ color: 0xaaccff, transparent: true, opacity: 0.9, side: THREE.DoubleSide });

  /* ── GEOMETRIE DELLA STANZA ── */
  const roomW = 40, roomD = 40;
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(roomW, roomD), matTile);
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);

  // Vasca e piattaforme in marmo
  const poolW = 8, poolD = 10;
  const platH = 0.4;
  
  const p1 = new THREE.Mesh(new THREE.BoxGeometry(roomW, platH, (roomD-poolD)/2), matMarble);
  p1.position.set(0, platH/2, -(poolD/2 + (roomD-poolD)/4)); p1.receiveShadow = true; scene.add(p1);
  
  const p2 = new THREE.Mesh(new THREE.BoxGeometry(roomW, platH, (roomD-poolD)/2), matMarble);
  p2.position.set(0, platH/2, (poolD/2 + (roomD-poolD)/4)); p2.receiveShadow = true; scene.add(p2);
  
  const p3 = new THREE.Mesh(new THREE.BoxGeometry((roomW-poolW)/2, platH, poolD), matMarble);
  p3.position.set(-(poolW/2 + (roomW-poolW)/4), platH/2, 0); p3.receiveShadow = true; scene.add(p3);
  
  const p4 = new THREE.Mesh(new THREE.BoxGeometry((roomW-poolW)/2, platH, poolD), matMarble);
  p4.position.set((poolW/2 + (roomW-poolW)/4), platH/2, 0); p4.receiveShadow = true; scene.add(p4);

  // Acqua e fondo
  const water = new THREE.Mesh(new THREE.PlaneGeometry(poolW, poolD), matWater);
  water.rotation.x = -Math.PI / 2;
  water.position.set(0, 0.1, 0);
  scene.add(water);

  const poolBottom = new THREE.Mesh(new THREE.PlaneGeometry(poolW, poolD), new THREE.MeshStandardMaterial({color: 0x113333}));
  poolBottom.rotation.x = -Math.PI / 2;
  poolBottom.position.set(0, -0.5, 0);
  scene.add(poolBottom);

  // Tubi vasca
  for(let i=0; i<3; i++) {
    const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, poolW), matDarkMetal);
    pipe.rotation.z = Math.PI / 2;
    pipe.position.set(0, -0.4, -2 + i*2);
    scene.add(pipe);
  }

  // Piattaforma Scrivania
  const backPlat = new THREE.Mesh(new THREE.BoxGeometry(10, 0.8, 6), matMarble);
  backPlat.position.set(0, 0.4, -15);
  backPlat.receiveShadow = true;
  scene.add(backPlat);

  // Colonne
  for(let x of [-12, 12]) {
    for(let z of [-15, -5, 5, 15]) {
      const col = new THREE.Mesh(new THREE.BoxGeometry(1.5, 10, 1.5), matColumn);
      col.position.set(x, 5, z);
      col.castShadow = true;
      col.receiveShadow = true;
      scene.add(col);
      
      const base = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.5, 1.8), matDarkMetal);
      base.position.set(x, 0.25, z);
      scene.add(base);
    }
  }

  // Vetrate
  const winGeo = new THREE.PlaneGeometry(16, 6);
  const wL = new THREE.Mesh(winGeo, matWin);
  wL.position.set(-19.9, 5, 0); wL.rotation.y = Math.PI / 2; scene.add(wL);
  
  // Scrivania
  const desk = new THREE.Mesh(new THREE.BoxGeometry(3, 0.1, 1), matDarkMetal);
  desk.position.set(0, 1.5, -15);
  desk.castShadow = true;
  scene.add(desk);
  const leg1 = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.7, 0.8), matDarkMetal);
  leg1.position.set(-1.4, 1.15, -15); scene.add(leg1);
  const leg2 = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.7, 0.8), matDarkMetal);
  leg2.position.set(1.4, 1.15, -15); scene.add(leg2);

  /* ── ANIMUS E POLTRONE ── */
  const animusGrp = new THREE.Group();
  animusGrp.position.set(0, 0.5, 0);
  scene.add(animusGrp);

  const bedBase = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.6, 5), matAnimus);
  bedBase.position.set(0, 0.3, 0);
  bedBase.castShadow = true;
  animusGrp.add(bedBase);

  // Luci inferiori Animus
  for(let x of [-0.6, 0.6]) {
    for(let z of [-1.5, -0.5, 0.5, 1.5]) {
      const light = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.1), matEmissive);
      light.position.set(x, 0, z);
      animusGrp.add(light);
      const spot = new THREE.PointLight(0xffffff, 1.5, 5);
      spot.position.set(x, -0.2, z);
      animusGrp.add(spot);
    }
  }

  const bedTop = new THREE.Mesh(new THREE.CapsuleGeometry(0.8, 3, 4, 8), matAnimus);
  bedTop.rotation.x = Math.PI / 2;
  bedTop.position.set(0, 0.8, 0);
  bedTop.castShadow = true;
  animusGrp.add(bedTop);

  const headRest = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 1), matAnimus);
  headRest.rotation.z = Math.PI / 2;
  headRest.position.set(0, 1.0, -1.8);
  headRest.castShadow = true;
  animusGrp.add(headRest);

  const animusPanel = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.05), matDarkMetal);
  animusPanel.position.set(0.9, 0.8, 1);
  animusGrp.add(animusPanel);

  function addChair(x, z) {
    const chair = new THREE.Group();
    const seat = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.4, 1.2), matAnimus);
    seat.position.set(0, 0.4, 0);
    seat.castShadow = true;
    chair.add(seat);
    const back = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.8, 0.3), matAnimus);
    back.position.set(0, 0.8, -0.45);
    back.castShadow = true;
    chair.add(back);
    const armL = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.6, 1.2), matDarkMetal);
    armL.position.set(-0.5, 0.7, 0);
    chair.add(armL);
    const armR = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.6, 1.2), matDarkMetal);
    armR.position.set(0.5, 0.7, 0);
    chair.add(armR);
    chair.position.set(x, 0.4, z);
    scene.add(chair);
  }
  addChair(-3.5, 0);
  addChair(3.5, 0);

  /* ── AUDIO INIT ── */
  function initAudio() {
    if (window.audioEngine) window.audioEngine.init();
  }
  window.addEventListener('click', initAudio, { once: true });
  window.addEventListener('keydown', initAudio, { once: true });

  /* ── SEQUENZA E TRANSIZIONE ── */
  const clock = new THREE.Clock();

  function triggerTransition() {
    if (window.audioEngine) window.audioEngine.playTransition();
    if (window._resetBoot) window._resetBoot();
    window.introIsActive = false;

    if (mainCV) {
      mainCV.style.transition  = 'none';
      mainCV.style.opacity     = '1';
      mainCV.style.pointerEvents = '';
    }
    seq.style.display = 'none';

    document.querySelectorAll('body > div').forEach(el => {
      if (el.style && el.style.zIndex === '5') {
        el.style.display = '';
        el.style.opacity = '1';
        el.style.transition = 'none';
      }
    });

    const vignette = document.getElementById('vignette');
    const scanlines = document.getElementById('scanlines');
    const hudContainer = document.getElementById('hud-container');
    if (vignette) vignette.style.display = 'block';
    if (scanlines) scanlines.style.display = 'block';
    if (hudContainer) hudContainer.style.display = '';

    introActive = false;
    cancelAnimationFrame(rafHandle);
    
    try {
      const gl = renderer.getContext();
      const ext = gl.getExtension('WEBGL_lose_context');
      if (ext) ext.loseContext();
    } catch (_) {}
    
    renderer.dispose();
    renderer = null;
    window.dispatchEvent(new Event('introContextReleased'));
    domObs.disconnect();
    window.removeEventListener('click', skipIntro);
    window.removeEventListener('keydown', skipIntro);
  }

  function skipIntro() {
    if (!introActive || finishing) return;
    finishing = true;
    triggerTransition();
  }

  window.addEventListener('click', skipIntro);
  window.addEventListener('keydown', skipIntro);

  function easeInOut(t) {
    return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
  }

  function animate() {
    rafHandle = requestAnimationFrame(animate);
    if (!introActive) return;

    if (!startTime) startTime = performance.now();
    const elapsed = performance.now() - startTime;
    const progress = Math.min(elapsed / DURATION, 1.0);

    const t = clock.getElapsedTime();
    matWater.opacity = 0.8 + Math.sin(t * 2) * 0.05;

    /* 
      Fasi Camera:
      0.0 - 0.2: Establishing
      0.2 - 0.7: Avvicinamento
      0.7 - 0.95: Stendersi
      0.95 - 1.0: Hold e Transizione
    */
    if (progress < 0.2) {
      const p = progress / 0.2;
      const e = easeInOut(p);
      camera.position.set(-8 + 2 * e, 3.5, 12 - 2 * e);
      camera.lookAt(0, 1.2, 0);
    } else if (progress < 0.7) {
      const p = (progress - 0.2) / 0.5;
      const e = easeInOut(p);
      camera.position.set(-6 * (1 - e) + 0, 3.5 - 1.5 * e, 10 * (1 - e) + 1.5);
      camera.lookAt(0, 1.2 + 0.3 * e, -1 * e);
    } else if (progress < 0.95) {
      const p = (progress - 0.7) / 0.25;
      const e = easeInOut(p);
      camera.position.set(0, 2 * (1 - e) + 1.6, 1.5 * (1 - e) + 0);
      
      const targetY = 1.5 * (1 - e) + 10 * e;
      const targetZ = -1 * (1 - e) + 0;
      camera.lookAt(0, targetY, targetZ);
    } else {
      if (!finishing) {
        finishing = true;
        triggerTransition();
      }
    }

    renderer.render(scene, camera);
  }

  animate();

  window.addEventListener('resize', () => {
    if (!renderer) return;
    renderer.setSize(window.innerWidth, window.innerHeight);
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
  });

})();
"""
