/* ══════════════════════════════════════════════════════════════
   ABSTERGO INTRO SEQUENCE — js/intro.js
   Scena Three.js realistica: porte vetro → sala → Animus.
   Luci calibrate, transizione fluida con ripristino boot animation.

   FASI:
     0.00–0.18  Idle davanti alle porte (respiro camera)
     0.18–0.48  Porte scivolano lateralmente
     0.48–0.76  Walk through room → Animus in lontananza
     0.76–0.90  Avvicinamento ravvicinato
     0.90–1.00  Distensione sul lettino → transizione fluida al display
══════════════════════════════════════════════════════════════ */

(function () {
  'use strict';

  /* ── COSTANTI ── */
  const SCROLL_ACCEL = 0.000095;  /* accelerazione per ogni pixel di deltaY */
  const TOUCH_ACCEL  = 0.00018;
  const FRICTION     = 0.88;      /* attrito per frame — coasting naturale */
  const MAX_VEL      = 0.028;     /* velocità massima */
  const EYE_H        = 1.72;
  const DOOR_W       = 3.8;
  const DOOR_H       = 3.1;
  const ROOM_W       = 16;
  const ROOM_H       = 10;
  const ENTRY_Z      = 12;

  /* ── STATO ── */
  let scrollProg    = 0;
  let velocity      = 0;
  let introActive   = true;
  let finishing     = false;
  let touchY        = null;
  let rafHandle     = null;
  let bootResetDone = false;
  let mainCV        = null;

  /* Segnala ad app.js che l'intro è attiva → blocca bootProgress */
  window.introIsActive = true;

  /* ── DOM REFS ── */
  const seq     = document.getElementById('intro-sequence');
  const flashEl = document.getElementById('intro-flash');

  /* ── NASCONDI PROGETTO ESISTENTE ── */
  ['boot', 'hud-container', 'vignette', 'scanlines'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.style.display = 'none';
  });
  /* threeCanvas rimane display:block ma invisibile — rende in background per blend fluido */
  mainCV = document.getElementById('threeCanvas');
  if (mainCV) {
    mainCV.style.display    = 'block';
    mainCV.style.opacity    = '0';
    mainCV.style.transition = 'none';
    mainCV.style.pointerEvents = 'none';
  }

  /* Intercetta CSS3DRenderer aggiunto da app.js */
  const domObs = new MutationObserver(mutations => {
    mutations.forEach(m => m.addedNodes.forEach(node => {
      if (node.nodeType === 1 && node.style && node.style.zIndex === '5' && introActive) {
        node.style.display = 'none';
        node.style.opacity = '0';
      }
    }));
  });
  domObs.observe(document.body, { childList: true });

  /* ── CANVAS THREE.JS INTRO ── */
  const threeCanvas = document.createElement('canvas');
  threeCanvas.style.cssText = 'position:absolute;top:0;left:0;width:100%;height:100%;z-index:1;display:block;';
  seq.appendChild(threeCanvas);

  /* ── RENDERER ── */
  const renderer = new THREE.WebGLRenderer({ canvas: threeCanvas, antialias: true, alpha: false });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.62;
  renderer.physicallyCorrectLights = true;
  renderer.setClearColor(0x1a1a1a, 1);  /* identico main app — nessuno stacco in alto */

  /* ── SCENA E CAMERA ── */
  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x1a1a1a, 0.018);

  const camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 200);
  camera.position.set(0, EYE_H, 15.5);
  camera.lookAt(0, EYE_H, ENTRY_Z);

  /* ── HELPER ── */
  function ease(t) { return t < 0.5 ? 2*t*t : 1 - Math.pow(-2*t+2, 2)/2; }
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function norm(p, s, e) { return clamp((p-s)/(e-s), 0, 1); }

  /* ════════════════════════════════════════════
     ENVIRONMENT MAP — IBL (Image Based Lighting)
     Trasforma metalli da "plastica dipinta" a superfici realistiche
  ════════════════════════════════════════════ */
  function buildEnvMap() {
    const w = 512, h = 256;
    const cv = document.createElement('canvas');
    cv.width = w; cv.height = h;
    const ctx = cv.getContext('2d');

    /* Cielo diurno — sfondo principale luminoso */
    const skyGrad = ctx.createLinearGradient(0, 0, 0, h);
    skyGrad.addColorStop(0,   '#a8c4de');
    skyGrad.addColorStop(0.5, '#c8dff0');
    skyGrad.addColorStop(1,   '#e4eff8');
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, w, h);

    /* Pannello soffitto — luce bianca brillante */
    const ceilLight = ctx.createRadialGradient(w*0.5, 0, 0, w*0.5, h*0.08, h*0.55);
    ceilLight.addColorStop(0,   'rgba(255,252,248,0.98)');
    ceilLight.addColorStop(0.35,'rgba(235,245,255,0.65)');
    ceilLight.addColorStop(1,   'rgba(0,0,0,0)');
    ctx.fillStyle = ceilLight;
    ctx.fillRect(0, 0, w, h * 0.65);

    /* Sole da destra — caldo e intenso */
    const sunFill = ctx.createRadialGradient(w, h*0.3, 0, w*0.72, h*0.35, h*0.6);
    sunFill.addColorStop(0,   'rgba(255,248,220,0.88)');
    sunFill.addColorStop(0.4, 'rgba(235,242,255,0.45)');
    sunFill.addColorStop(1,   'rgba(0,0,0,0)');
    ctx.fillStyle = sunFill;
    ctx.fillRect(w * 0.45, 0, w * 0.55, h);

    /* Riflessione pavimento chiaro (basso) */
    const floorRef = ctx.createLinearGradient(0, h*0.78, 0, h);
    floorRef.addColorStop(0, 'rgba(0,0,0,0)');
    floorRef.addColorStop(1, 'rgba(210,225,235,0.60)');
    ctx.fillStyle = floorRef;
    ctx.fillRect(0, h*0.72, w, h*0.28);

    const tex = new THREE.CanvasTexture(cv);
    tex.mapping = THREE.EquirectangularReflectionMapping;

    const pmrem = new THREE.PMREMGenerator(renderer);
    pmrem.compileEquirectangularShader();
    const env = pmrem.fromEquirectangular(tex).texture;
    pmrem.dispose();
    tex.dispose();
    return env;
  }

  const envMap = buildEnvMap();
  scene.environment = envMap;

  /* ════════════════════════════════════════════
     LUCI — sala industriale luminosa con luce solare da finestre laterali
  ════════════════════════════════════════════ */

  /* Ambient bassa — sala con contrasto, non sovraesposta */
  scene.add(new THREE.AmbientLight(0x90a8bc, 0.55));

  /* Sole da destra */
  const sunLight = new THREE.DirectionalLight(0xffe8c0, 1.6);
  sunLight.position.set(14, 8, 2);
  sunLight.target.position.set(0, 0, -4);
  sunLight.castShadow = true;
  sunLight.shadow.mapSize.set(1024, 1024);
  sunLight.shadow.camera.near = 1;
  sunLight.shadow.camera.far = 45;
  sunLight.shadow.camera.left = -12;
  sunLight.shadow.camera.right = 12;
  sunLight.shadow.camera.top = 10;
  sunLight.shadow.camera.bottom = -10;
  sunLight.shadow.bias = -0.002;
  scene.add(sunLight);
  scene.add(sunLight.target);

  /* Fill freddo da sinistra */
  const skyFill = new THREE.DirectionalLight(0xa0c0d8, 0.45);
  skyFill.position.set(-10, 7, 1);
  skyFill.target.position.set(0, 0, -4);
  scene.add(skyFill);
  scene.add(skyFill.target);

  /* Spotlight porta */
  const doorSpot = new THREE.SpotLight(0xffe8c8, 1.8, 28, Math.PI * 0.18, 0.50, 1.2);
  doorSpot.position.set(4, 8.5, 18);
  doorSpot.target.position.set(0, 1.4, 12);
  doorSpot.castShadow = true;
  doorSpot.shadow.mapSize.set(512, 512);
  doorSpot.shadow.bias = -0.002;
  scene.add(doorSpot);
  scene.add(doorSpot.target);

  /* Pannelli LED corridoio */
  [-10, -24, -38].forEach(z => {
    const pl = new THREE.PointLight(0xc8dff8, 0.7, 16);
    pl.position.set(0, 9.4, z);
    scene.add(pl);
  });

  /* Glow Animus — luce cyan intensa dal pozzo (NOME FISSO: usato in animate loop) */
  const animusGlow = new THREE.PointLight(0x00e8ff, 6.5, 14);
  animusGlow.position.set(0, -0.5, -6);
  scene.add(animusGlow);

  /* Fill posteriore Animus (NOME FISSO: usato in animate loop) */
  const aniBack = new THREE.PointLight(0x00c8e8, 3.0, 10);
  aniBack.position.set(0, 1.2, -11);
  scene.add(aniBack);

  /* Pareti laterali pozzo — uplight cyan */
  [-3.0, 3.0].forEach(x => {
    const pw = new THREE.PointLight(0x00d8ff, 2.2, 6);
    pw.position.set(x, -0.4, -6);
    scene.add(pw);
  });

  /* SpotLight dall'alto nel pozzo */
  const aniSpot = new THREE.SpotLight(0xf0f8ff, 4.5, 30, Math.PI * 0.22, 0.40, 0.9);
  aniSpot.position.set(0, 9.5, -6);
  aniSpot.target.position.set(0, -0.8, -6);
  aniSpot.castShadow = true;
  aniSpot.shadow.mapSize.set(1024, 1024);
  aniSpot.shadow.camera.near = 1;
  aniSpot.shadow.camera.far = 20;
  aniSpot.shadow.bias = -0.001;
  scene.add(aniSpot);
  scene.add(aniSpot.target);

  /* ════════════════════════════════════════════
     TEXTURE PROCEDURALI — generate via canvas
  ════════════════════════════════════════════ */

  function makeTileFloor() {
    const sz = 512, ts = 128; // 4×4 tiles
    const cv = document.createElement('canvas');
    cv.width = cv.height = sz;
    const cx = cv.getContext('2d');

    for (let row = 0; row < 4; row++) {
      for (let col = 0; col < 4; col++) {
        const x = col * ts, y = row * ts;
        const v = 158 + Math.floor(Math.random() * 18);
        cx.fillStyle = `rgb(${v},${v-2},${v-4})`;
        cx.fillRect(x + 1, y + 1, ts - 2, ts - 2);
        /* vena marmo */
        const g = cx.createRadialGradient(x+ts*0.3,y+ts*0.25,0, x+ts*0.5,y+ts*0.5, ts*0.7);
        g.addColorStop(0, 'rgba(255,255,255,0.18)');
        g.addColorStop(0.5,'rgba(200,198,195,0.08)');
        g.addColorStop(1, 'rgba(0,0,0,0)');
        cx.fillStyle = g;
        cx.fillRect(x, y, ts, ts);
      }
    }
    /* fughe chiare */
    cx.fillStyle = '#c4c8c4';
    for (let i = 1; i < 4; i++) {
      cx.fillRect(i*ts-1, 0, 2, sz);
      cx.fillRect(0, i*ts-1, sz, 2);
    }
    /* venature marmo */
    for (let i = 0; i < 6000; i++) {
      const px = Math.random()*sz, py = Math.random()*sz;
      const a = Math.random() * 0.06;
      cx.fillStyle = Math.random() > 0.4 ? `rgba(255,255,255,${a})` : `rgba(160,155,150,${a*2})`;
      cx.fillRect(px, py, 1 + Math.random()*2.5, 1);
    }
    const t = new THREE.CanvasTexture(cv);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    return t;
  }

  function makeConcreteWall() {
    const sz = 512;
    const cv = document.createElement('canvas');
    cv.width = cv.height = sz;
    const cx = cv.getContext('2d');

    cx.fillStyle = '#9aa4ac';
    cx.fillRect(0, 0, sz, sz);
    /* pannelli orizzontali */
    cx.strokeStyle = 'rgba(0,0,0,0.12)';
    cx.lineWidth = 2;
    [0, 128, 256, 384, 512].forEach(y => {
      cx.beginPath(); cx.moveTo(0, y); cx.lineTo(sz, y); cx.stroke();
    });
    /* variazione verticale per ogni pannello */
    for (let py = 0; py < 4; py++) {
      const brightness = 0.94 + Math.random() * 0.12;
      cx.fillStyle = `rgba(${brightness>1?255:Math.floor(80*brightness)},${Math.floor(90*brightness)},${Math.floor(100*brightness)},0.25)`;
      cx.fillRect(0, py*128, sz, 126);
    }
    /* rumore cemento */
    for (let i = 0; i < 55000; i++) {
      const px = Math.random()*sz, py = Math.random()*sz;
      const a = Math.random() * 0.07;
      cx.fillStyle = Math.random() > 0.5 ? `rgba(255,255,255,${a})` : `rgba(0,0,0,${a})`;
      cx.fillRect(px, py, 1 + Math.random()*0.5, 1 + Math.random()*0.5);
    }
    const t = new THREE.CanvasTexture(cv);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(4, 1.2);
    return t;
  }

  function makeCeilTex() {
    const sz = 256;
    const cv = document.createElement('canvas');
    cv.width = cv.height = sz;
    const cx = cv.getContext('2d');
    cx.fillStyle = '#2a2e34';
    cx.fillRect(0, 0, sz, sz);
    for (let i = 0; i < 20000; i++) {
      const px = Math.random()*sz, py = Math.random()*sz;
      cx.fillStyle = `rgba(0,0,0,${Math.random()*0.08})`;
      cx.fillRect(px, py, 1, 1);
    }
    const t = new THREE.CanvasTexture(cv);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(8, 28);
    return t;
  }

  function makeMetalDkTex() {
    const sz = 256;
    const cv = document.createElement('canvas');
    cv.width = cv.height = sz;
    const cx = cv.getContext('2d');
    cx.fillStyle = '#18202a';
    cx.fillRect(0, 0, sz, sz);
    /* brushed lines */
    for (let y = 0; y < sz; y += 2) {
      const a = 0.02 + Math.random() * 0.04;
      cx.fillStyle = `rgba(255,255,255,${a})`;
      cx.fillRect(0, y, sz, 1);
    }
    const t = new THREE.CanvasTexture(cv);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(2, 2);
    return t;
  }

  const floorTex  = makeTileFloor();
  const wallTex   = makeConcreteWall();
  const ceilTex   = makeCeilTex();
  const metalTex  = makeMetalDkTex();

  /* ════════════════════════════════════════════
     MATERIALI — texture-based
  ════════════════════════════════════════════ */
  const M = {
    concrete:    new THREE.MeshStandardMaterial({ color: 0x6a7278, roughness: 0.94, metalness: 0.0, map: wallTex }),
    concreteDk:  new THREE.MeshStandardMaterial({ color: 0x3e4248, roughness: 0.97, metalness: 0.0, map: ceilTex }),
    concreteWall:new THREE.MeshStandardMaterial({ color: 0x626a70, roughness: 0.92, metalness: 0.0, map: wallTex }),
    /* Pavimento marmo chiaro — lucido e riflettente */
    floor:       new THREE.MeshStandardMaterial({ color: 0xc0bab2, roughness: 0.12, metalness: 0.04, map: floorTex, envMapIntensity: 1.2 }),
    /* Metallo scuro — brushed con env map forte */
    metalDk:     new THREE.MeshStandardMaterial({ color: 0x808898, roughness: 0.22, metalness: 0.96, map: metalTex, envMapIntensity: 1.8 }),
    metal:       new THREE.MeshStandardMaterial({ color: 0x909aaa, roughness: 0.18, metalness: 0.92, envMapIntensity: 1.6 }),
    /* Maniglie: acciaio lucido */
    handle:      new THREE.MeshStandardMaterial({ color: 0xc8d0d8, roughness: 0.03, metalness: 1.0, envMapIntensity: 2.2 }),
    /* Animus: MeshPhysicalMaterial con clearcoat — aspetto verniciato industriale */
    animus:      new THREE.MeshPhysicalMaterial({
      color: 0x5a6a78, roughness: 0.28, metalness: 0.82,
      clearcoat: 0.55, clearcoatRoughness: 0.12, envMapIntensity: 1.4
    }),
    animusDk:    new THREE.MeshPhysicalMaterial({
      color: 0x2e3840, roughness: 0.38, metalness: 0.86,
      clearcoat: 0.35, clearcoatRoughness: 0.18, envMapIntensity: 1.2
    }),
    animusPlatf: new THREE.MeshPhysicalMaterial({
      color: 0x3c4850, roughness: 0.45, metalness: 0.70,
      clearcoat: 0.25, clearcoatRoughness: 0.22, envMapIntensity: 1.0
    }),
    /* Vetro: MeshPhysicalMaterial — riflette l'ambiente */
    glass:       new THREE.MeshPhysicalMaterial({
      color: 0xaaccdd, roughness: 0.0, metalness: 0.0,
      transparent: true, opacity: 0.18,
      clearcoat: 1.0, clearcoatRoughness: 0.0,
      envMapIntensity: 1.5,
      side: THREE.DoubleSide, depthWrite: false,
    }),
    lightStrip:  new THREE.MeshBasicMaterial({ color: 0xeef4fc, transparent: true, opacity: 0.95 }),
    glow:        (c, o) => new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: o, blending: THREE.AdditiveBlending, depthWrite: false }),
    glowDS:      (c, o) => new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: o, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }),
  };

  /* ════════════════════════════════════════════
     STANZA
  ════════════════════════════════════════════ */

  /* ── Pozzo Animus — dimensioni e geometria ── */
  const PIT_HW = 3.4;   /* half-width in x */
  const PIT_FZ = -2.0;  /* z front edge */
  const PIT_BZ = -10.2; /* z back edge */
  const PIT_DEP = 0.80; /* profondità */

  /* Helper: sezione pavimento marmo con repeat proporzionale */
  function addFloorSection(w, d, cx2, cz) {
    const mat = M.floor.clone();
    mat.map = floorTex.clone();
    mat.map.wrapS = mat.map.wrapT = THREE.RepeatWrapping;
    mat.map.repeat.set(w / 4, d / 4);
    mat.map.needsUpdate = true;
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), mat);
    m.rotation.x = -Math.PI / 2;
    m.position.set(cx2, 0, cz);
    m.receiveShadow = true;
    scene.add(m);
    return m;
  }

  /* Sezione anteriore: dalla porta fino al bordo del pozzo */
  addFloorSection(ROOM_W, 17, 0, 6.5);
  /* Striscia sinistra ai lati del pozzo */
  const pitSideW = ROOM_W / 2 - PIT_HW;
  addFloorSection(pitSideW, Math.abs(PIT_BZ - PIT_FZ), -(ROOM_W/2 - pitSideW/2), (PIT_FZ + PIT_BZ) / 2);
  /* Striscia destra */
  addFloorSection(pitSideW, Math.abs(PIT_BZ - PIT_FZ), (ROOM_W/2 - pitSideW/2), (PIT_FZ + PIT_BZ) / 2);
  /* Sezione posteriore: dal retro del pozzo fino in fondo */
  addFloorSection(ROOM_W, 34, 0, -27.1);

  /* ── Pavimento pozzo — emissivo cyan ── */
  const pitFloorMat = new THREE.MeshStandardMaterial({
    color: 0x000c14,
    emissive: 0x001c2e,
    emissiveIntensity: 1.2,
    roughness: 0.85, metalness: 0.08
  });
  const pitFloor = new THREE.Mesh(
    new THREE.PlaneGeometry(PIT_HW * 2, Math.abs(PIT_BZ - PIT_FZ)), pitFloorMat);
  pitFloor.rotation.x = -Math.PI / 2;
  pitFloor.position.set(0, -PIT_DEP, (PIT_FZ + PIT_BZ) / 2);
  pitFloor.receiveShadow = true;
  scene.add(pitFloor);

  /* Griglie luminose sul fondo */
  [[-2.5, 0], [0, 0], [2.5, 0], [0, -2.5], [0, 2.5]].forEach(([gx, gz]) => {
    const glow = new THREE.Mesh(
      new THREE.PlaneGeometry(1.8, 1.8),
      M.glow(0x00ffff, 0.18));
    glow.rotation.x = -Math.PI / 2;
    glow.position.set(gx, -PIT_DEP + 0.004, (PIT_FZ + PIT_BZ) / 2 + gz);
    scene.add(glow);
  });

  /* ── Pareti pozzo — cemento scuro con riflesso cyan ── */
  const pitWallMat = new THREE.MeshStandardMaterial({
    color: 0x1a2028, roughness: 0.85, metalness: 0.06, side: THREE.DoubleSide
  });
  const pitWallGlowMat = new THREE.MeshStandardMaterial({
    color: 0x002030,
    emissive: 0x00384c,
    emissiveIntensity: 0.8,
    roughness: 0.6, metalness: 0.1, side: THREE.DoubleSide
  });
  const pitPD = Math.abs(PIT_BZ - PIT_FZ);

  /* Fronte */
  const pwF = new THREE.Mesh(new THREE.PlaneGeometry(PIT_HW * 2, PIT_DEP), pitWallMat);
  pwF.position.set(0, -PIT_DEP / 2, PIT_FZ); scene.add(pwF);
  /* Fondo */
  const pwB = new THREE.Mesh(new THREE.PlaneGeometry(PIT_HW * 2, PIT_DEP), pitWallGlowMat);
  pwB.rotation.y = Math.PI;
  pwB.position.set(0, -PIT_DEP / 2, PIT_BZ); scene.add(pwB);
  /* Sinistra */
  const pwL = new THREE.Mesh(new THREE.PlaneGeometry(pitPD, PIT_DEP), pitWallGlowMat);
  pwL.rotation.y = Math.PI / 2;
  pwL.position.set(-PIT_HW, -PIT_DEP / 2, (PIT_FZ + PIT_BZ) / 2); scene.add(pwL);
  /* Destra */
  const pwR = new THREE.Mesh(new THREE.PlaneGeometry(pitPD, PIT_DEP), pitWallGlowMat);
  pwR.rotation.y = -Math.PI / 2;
  pwR.position.set(PIT_HW, -PIT_DEP / 2, (PIT_FZ + PIT_BZ) / 2); scene.add(pwR);

  /* ── Bordo/bordo metallico pozzo ── */
  const rimMat = new THREE.MeshPhysicalMaterial({
    color: 0x5c6e7a, roughness: 0.25, metalness: 0.78,
    clearcoat: 0.5, clearcoatRoughness: 0.15
  });
  /* Bordi perimetrali */
  const rimBF = new THREE.Mesh(new THREE.BoxGeometry(PIT_HW * 2 + 0.36, 0.08, 0.22), rimMat);
  rimBF.position.set(0, 0.04, PIT_FZ - 0.11); scene.add(rimBF);
  const rimBB = new THREE.Mesh(new THREE.BoxGeometry(PIT_HW * 2 + 0.36, 0.08, 0.22), rimMat);
  rimBB.position.set(0, 0.04, PIT_BZ + 0.11); scene.add(rimBB);
  const rimBL = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.08, pitPD + 0.22), rimMat);
  rimBL.position.set(-PIT_HW - 0.11, 0.04, (PIT_FZ + PIT_BZ) / 2); scene.add(rimBL);
  const rimBR = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.08, pitPD + 0.22), rimMat);
  rimBR.position.set(PIT_HW + 0.11, 0.04, (PIT_FZ + PIT_BZ) / 2); scene.add(rimBR);

  /* Striscia cyan al bordo interno */
  [
    [PIT_HW * 2, 0.035, PIT_FZ + 0.018],
    [PIT_HW * 2, 0.035, PIT_BZ - 0.018],
  ].forEach(([w2, , z2]) => {
    const s = new THREE.Mesh(new THREE.PlaneGeometry(w2, 0.035), M.glow(0x00ffff, 0.65));
    s.rotation.x = -Math.PI / 2; s.position.set(0, 0.002, z2); scene.add(s);
  });
  [PIT_HW - 0.018, -PIT_HW + 0.018].forEach(x2 => {
    const s = new THREE.Mesh(new THREE.PlaneGeometry(0.035, pitPD), M.glow(0x00ffff, 0.65));
    s.rotation.x = -Math.PI / 2; s.position.set(x2, 0.002, (PIT_FZ + PIT_BZ) / 2); scene.add(s);
  });

  /* ════════════════════════════════════════════
     SOFFITTO — copia ESATTA del bgGroup di app.js
     Tutti MeshBasicMaterial: nessuna interferenza luci intro.
     Colori = colori renderizzati da app.js (metalMat+AmbientLight2.8).
     Scala: distanza soffitto (8.8u) / distanza bg app (53u) = 0.166×
  ════════════════════════════════════════════ */
  const cy = ROOM_H;
  const S  = 0.166; /* fattore scala */

  /* Colori calcolati: metalMat(0x0f0f0f)+AmbientLight(white,2.8)+PointLight(cyan,6) di app.js
     metalMat → ~0x38 per canale con tinta cyan; darkMetalMat → ~0x15 */
  const CB_dk   = new THREE.MeshBasicMaterial({ color: 0x141618 }); /* darkMetalMat rendered */
  const CB_mt   = new THREE.MeshBasicMaterial({ color: 0x383d3f }); /* metalMat rendered     */
  const CB_pipe = new THREE.MeshBasicMaterial({ color: 0x1e2224 }); /* pipeMat rendered      */
  const CB_box  = new THREE.MeshBasicMaterial({ color: 0x181a1a }); /* boxMat rendered       */
  const CB_led  = new THREE.MeshBasicMaterial({ color: 0x00ffff, transparent: true, opacity: 0.7 });
  const CB_warn = new THREE.MeshBasicMaterial({ color: 0xff3300, transparent: true, opacity: 0.8 });

  /* ── Parete di fondo (PlaneGeometry 400×200 in app.js → proiettata sul soffitto) ── */
  const ceil = new THREE.Mesh(new THREE.PlaneGeometry(400*S, 200*S), CB_dk);
  ceil.rotation.x = Math.PI / 2;
  ceil.position.set(0, cy, -16);
  scene.add(ceil);

  /* ── Travi orizzontali (400×6, 400×4, 400×8) lungo X ── */
  /* topBeam y=15 → z: 15*S=2.49 davanti alla camera (visibile) */
  const topBeam2  = new THREE.Mesh(new THREE.BoxGeometry(400*S, 6*S, 2*S), CB_mt);
  topBeam2.position.set(0, cy - 2*S, 15*S - 16);
  scene.add(topBeam2);
  const midBeam2  = new THREE.Mesh(new THREE.BoxGeometry(400*S, 4*S, 2*S), CB_mt);
  midBeam2.position.set(0, cy - 2*S, 0*S - 16);
  scene.add(midBeam2);
  const botBeam2  = new THREE.Mesh(new THREE.BoxGeometry(400*S, 8*S, 2*S), CB_mt);
  botBeam2.position.set(0, cy - 2*S, -15*S - 16);
  scene.add(botBeam2);

  /* ── Tubature orizzontali (y=6,8,−6,−8 in app.js) ── */
  [6, 8, -6, -8].forEach(yOff => {
    const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.25*S, 0.25*S, 400*S, 10), CB_pipe);
    pipe.rotation.z = Math.PI / 2;
    pipe.position.set(0, cy - 0.5*S, yOff*S - 16);
    scene.add(pipe);
  });

  /* ── Pilastri (x=−160..160 step 15 in app.js) → costole lungo Z ── */
  for (let xi = -160; xi <= 160; xi += 15) {
    const px = xi * S;
    if (Math.abs(px) > ROOM_W / 2 + 1) continue; /* fuori dalla stanza */

    /* Pilastro: BoxGeometry(2,200,4) in app.js → qui gira lungo Z */
    const pillar = new THREE.Mesh(new THREE.BoxGeometry(2*S, 200*S, 4*S), CB_mt);
    pillar.rotation.x = Math.PI / 2; /* fa correre il pilastro lungo Z */
    pillar.position.set(px, cy - 2*S, -16);
    scene.add(pillar);

    /* Groove */
    const groove = new THREE.Mesh(new THREE.BoxGeometry(0.5*S, 200*S, 4.5*S), CB_dk);
    groove.rotation.x = Math.PI / 2;
    groove.position.set(px, cy - 2*S, -16);
    scene.add(groove);

    /* LED blinker — esattamente come in app.js */
    if (Math.random() > 0.2) {
      const led = new THREE.Mesh(new THREE.BoxGeometry(0.8*S, 0.15*S, 4.6*S), CB_led);
      led.rotation.x = Math.PI / 2;
      led.position.set(px, cy - 0.08*S, ((Math.random()-0.5)*15 + 15)*S - 16);
      scene.add(led);
    }

    /* Tubatura verticale spessa (vPipe in app.js) */
    if (Math.random() > 0.4) {
      const vp = new THREE.Mesh(new THREE.CylinderGeometry(0.5*S, 0.5*S, 200*S, 10), CB_pipe);
      vp.rotation.x = Math.PI / 2;
      vp.position.set(px + 3*S, cy - 2*S, -16);
      scene.add(vp);
    }

    /* Scatole server con LED di stato */
    if (Math.random() > 0.5) {
      const bz = ((Math.random()-0.5)*15 + 18)*S - 16;
      const box2 = new THREE.Mesh(new THREE.BoxGeometry(5*S, 8*S, 2*S), CB_box);
      box2.position.set(px + 7.5*S, cy - 1*S, bz);
      scene.add(box2);
      const isWarn = Math.random() > 0.85;
      const statusL = new THREE.Mesh(new THREE.BoxGeometry(0.8*S, 0.8*S, 2.2*S), isWarn ? CB_warn : CB_led);
      statusL.position.set(px + 7.5*S, cy - 0.4*S, bz + 2*S);
      scene.add(statusL);
    }

    /* Cross-bracing */
    if (Math.random() > 0.6 && xi < 150) {
      const cGeo = new THREE.CylinderGeometry(0.2*S, 0.2*S, 22*S, 6);
      const cr1 = new THREE.Mesh(cGeo, CB_mt);
      cr1.rotation.x = Math.PI / 2;
      cr1.rotation.z = Math.PI / 4;
      cr1.position.set(px + 7.5*S, cy - 2*S, 16*S - 16);
      scene.add(cr1);
      const cr2 = new THREE.Mesh(cGeo, CB_mt);
      cr2.rotation.x = Math.PI / 2;
      cr2.rotation.z = -Math.PI / 4;
      cr2.position.set(px + 7.5*S, cy - 2*S, 16*S - 16);
      scene.add(cr2);
    }
  }

  /* ── Strip LED cyan (identici a app.js — bottomGlow/topGlow convertiti a strip piane) ── */
  function addCeilStrip(z) {
    const strip = new THREE.Mesh(
      new THREE.PlaneGeometry(ROOM_W * 0.85, 0.025),
      new THREE.MeshBasicMaterial({ color: 0x00ffff, transparent: true, opacity: 0.70,
        blending: THREE.AdditiveBlending, depthWrite: false })
    );
    strip.rotation.x = Math.PI / 2;
    strip.position.set(0, cy - 0.002, z);
    scene.add(strip);
    const halo = new THREE.Mesh(
      new THREE.PlaneGeometry(ROOM_W, 0.55),
      new THREE.MeshBasicMaterial({ color: 0x00ffff, transparent: true, opacity: 0.055,
        blending: THREE.AdditiveBlending, depthWrite: false })
    );
    halo.rotation.x = Math.PI / 2;
    halo.position.set(0, cy - 0.005, z);
    scene.add(halo);
    const pl = new THREE.PointLight(0x00ffff, 0.5, 10);
    pl.position.set(0, cy - 0.3, z);
    scene.add(pl);
  }
  [2, -8, -18, -28, -38].forEach(addCeilStrip);

  /* ── GRIGLIA CYAN sul soffitto — identica alla gridGroup di app.js ──
     app.js: linee orizzontali ogni 1.5u su arco raggio 25, 40 linee vert.
     Qui proiettate piatte sul soffitto con stessa densità visiva (scala S) */
  const gridMatH = new THREE.LineBasicMaterial({ color: 0x00ffff, transparent: true, opacity: 0.15, blending: THREE.AdditiveBlending });
  const gridMatV = new THREE.LineBasicMaterial({ color: 0x00ffff, transparent: true, opacity: 0.08, blending: THREE.AdditiveBlending });
  const GHALF_X = 400 * S / 2;
  const GHALF_Z = 200 * S / 2;

  /* Linee orizzontali (equivalenti alle linee y di app.js) */
  for (let zi = -10.5; zi <= 10.5; zi += 1.5) {
    const gz = zi * S - 16;
    const pts = [
      new THREE.Vector3(-GHALF_X, cy - 0.001, gz),
      new THREE.Vector3( GHALF_X, cy - 0.001, gz)
    ];
    scene.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), gridMatH));
  }

  /* Linee verticali (40 linee lungo X in app.js) */
  for (let i = 0; i <= 40; i++) {
    const gx = -GHALF_X + (i / 40) * GHALF_X * 2;
    const pts = [
      new THREE.Vector3(gx, cy - 0.001, -GHALF_Z - 16),
      new THREE.Vector3(gx, cy - 0.001,  GHALF_Z - 16)
    ];
    scene.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), gridMatV));
  }

  /* ── Texture sfumata vetro (gradient blu di app.js) proiettata sul soffitto ── */
  (function() {
    const gc = document.createElement('canvas'); gc.width = 2; gc.height = 256;
    const gx2 = gc.getContext('2d');
    const gr = gx2.createLinearGradient(0, 0, 0, 256);
    gr.addColorStop(0,    'rgba(0,50,90,0.8)');
    gr.addColorStop(0.25, 'rgba(0,40,70,0.3)');
    gr.addColorStop(0.5,  'rgba(0,30,50,0.05)');
    gr.addColorStop(0.75, 'rgba(0,40,70,0.3)');
    gr.addColorStop(1,    'rgba(0,80,130,0.9)');
    gx2.fillStyle = gr; gx2.fillRect(0, 0, 2, 256);
    const glassTex2 = new THREE.CanvasTexture(gc);
    const glassOverlay = new THREE.Mesh(
      new THREE.PlaneGeometry(GHALF_X * 2, GHALF_Z * 2),
      new THREE.MeshBasicMaterial({ map: glassTex2, transparent: true, opacity: 1,
        depthWrite: false, blending: THREE.NormalBlending })
    );
    glassOverlay.rotation.x = Math.PI / 2;
    glassOverlay.position.set(0, cy - 0.003, -16);
    scene.add(glassOverlay);
  })();

  /* ── Bezel (cornici metalliche spesse ai bordi vetro) ── */
  /* In app.js: CylinderGeometry(radius+0.2, ..., 1.5 height) al top/bottom del vetro.
     Qui: barre lungo X ai bordi Z del soffitto */
  const bezelMatC = new THREE.MeshBasicMaterial({ color: 0x1a2025 });
  const bezelTop = new THREE.Mesh(new THREE.BoxGeometry(GHALF_X * 2, 1.5*S, 2*S), bezelMatC);
  bezelTop.position.set(0, cy - 0.75*S, -GHALF_Z - 16 + 1.5*S);
  scene.add(bezelTop);
  const bezelBot = new THREE.Mesh(new THREE.BoxGeometry(GHALF_X * 2, 1.5*S, 2*S), bezelMatC);
  bezelBot.position.set(0, cy - 0.75*S, GHALF_Z - 16 - 1.5*S);
  scene.add(bezelBot);

  /* Striscia luminosa cyan bordo bezel (bottomGlow di app.js) */
  [[GHALF_Z - 16 - 1.5*S, 0.8], [-GHALF_Z - 16 + 1.5*S, 0.8]].forEach(([bz, op]) => {
    const bg = new THREE.Mesh(new THREE.PlaneGeometry(GHALF_X * 2, 0.08*S),
      new THREE.MeshBasicMaterial({ color: 0x00ffff, transparent: true, opacity: op,
        blending: THREE.AdditiveBlending, depthWrite: false }));
    bg.rotation.x = Math.PI / 2;
    bg.position.set(0, cy - 0.002, bz);
    scene.add(bg);
  });

  /* Parete di fondo */
  const backWall = new THREE.Mesh(new THREE.PlaneGeometry(ROOM_W, ROOM_H), M.concreteWall);
  backWall.position.set(0, ROOM_H / 2, -44);
  backWall.receiveShadow = true;
  scene.add(backWall);

  /* Pareti laterali */
  const lw = new THREE.Mesh(new THREE.PlaneGeometry(110, ROOM_H), M.concreteWall);
  lw.rotation.y = Math.PI / 2;
  lw.position.set(-ROOM_W / 2, ROOM_H / 2, -28);
  lw.receiveShadow = true;
  scene.add(lw);

  const rw = new THREE.Mesh(new THREE.PlaneGeometry(110, ROOM_H), M.concreteWall);
  rw.rotation.y = -Math.PI / 2;
  rw.position.set(ROOM_W / 2, ROOM_H / 2, -28);
  rw.receiveShadow = true;
  scene.add(rw);

  /* ── Finestre laterali — dark glass, solo architettura, nessuna luce diurna ── */
  function addWindow(side, z) {
    const x = (ROOM_W / 2) * side;
    const rotY = side > 0 ? -Math.PI / 2 : Math.PI / 2;
    const fr = new THREE.Mesh(new THREE.PlaneGeometry(4.6, 6.0), M.metalDk);
    fr.rotation.y = rotY;
    fr.position.set(x * 0.999, 5.5, z);
    scene.add(fr);
    /* Finestra luminosa — cielo esterno */
    const winMat = new THREE.MeshStandardMaterial({
      color: 0xd8eeff,
      emissive: side > 0 ? 0xc87820 : 0x5888a8,
      emissiveIntensity: side > 0 ? 0.7 : 0.3,
      roughness: 0.0, metalness: 0.0,
      transparent: true, opacity: 0.92,
      side: THREE.DoubleSide, depthWrite: false
    });
    const win = new THREE.Mesh(new THREE.PlaneGeometry(4.1, 5.5), winMat);
    win.rotation.y = rotY;
    win.position.set(x * 0.998, 5.5, z);
    scene.add(win);
  }
  [-1, 1].forEach(side => [-5, -19, -34].forEach(z => addWindow(side, z)));

  /* ── Colonne industriali ── */
  function addColumn(x, z) {
    const colMat = new THREE.MeshStandardMaterial({ color: 0x8090a0, roughness: 0.90, metalness: 0.0, map: wallTex });
    const col = new THREE.Mesh(new THREE.BoxGeometry(1.3, ROOM_H, 1.3), colMat);
    col.position.set(x, ROOM_H / 2, z);
    col.castShadow = true;
    col.receiveShadow = true;
    scene.add(col);
    /* Base */
    const base = new THREE.Mesh(new THREE.BoxGeometry(1.72, 0.38, 1.72), M.concreteDk);
    base.position.set(x, 0.19, z);
    scene.add(base);
    /* Capitello */
    const cap = new THREE.Mesh(new THREE.BoxGeometry(1.72, 0.28, 1.72), M.concreteDk);
    cap.position.set(x, ROOM_H - 0.14, z);
    scene.add(cap);
  }
  [-5.8, 5.8].forEach(x => [-8, -22, -38].forEach(z => addColumn(x, z)));

  /* ── Travi metalliche a soffitto ── */
  [-1, -15, -29].forEach(z => {
    const beam = new THREE.Mesh(new THREE.BoxGeometry(ROOM_W, 0.26, 0.32), M.metalDk);
    beam.position.set(0, ROOM_H - 0.13, z);
    scene.add(beam);
  });

  /* ── Faretti a soffitto ── */
  function addFixture(z) {
    const h = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.07, 1.0), M.metalDk);
    h.position.set(0, ROOM_H - 0.035, z);
    scene.add(h);
    const s = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.055, 0.85), M.lightStrip);
    s.position.set(0, ROOM_H - 0.075, z);
    scene.add(s);
  }
  [4, -8, -20, -35].forEach(addFixture);

  /* ── Pavimento riflettente (linea sottile lungo il centro) ── */
  const floorLineGeo = new THREE.PlaneGeometry(0.02, 80);
  const floorLineMat = M.glow(0x0088aa, 0.12);
  const floorLine = new THREE.Mesh(floorLineGeo, floorLineMat);
  floorLine.rotation.x = -Math.PI / 2;
  floorLine.position.set(0, 0.005, -25);
  scene.add(floorLine);

  /* ════════════════════════════════════════════
     INGRESSO — PARETE E PORTA
  ════════════════════════════════════════════ */
  const doorGroup = new THREE.Group();
  doorGroup.position.set(0, 0, ENTRY_Z);
  scene.add(doorGroup);

  /* Pareti intorno alla porta */
  const sideW = (ROOM_W - DOOR_W) / 2;

  const wallSL = new THREE.Mesh(new THREE.BoxGeometry(sideW, ROOM_H, 0.26), M.concreteWall);
  wallSL.position.set(-(DOOR_W / 2 + sideW / 2), ROOM_H / 2, 0);
  wallSL.castShadow = true; wallSL.receiveShadow = true;
  doorGroup.add(wallSL);

  const wallSR = new THREE.Mesh(new THREE.BoxGeometry(sideW, ROOM_H, 0.26), M.concreteWall);
  wallSR.position.set((DOOR_W / 2 + sideW / 2), ROOM_H / 2, 0);
  wallSR.castShadow = true; wallSR.receiveShadow = true;
  doorGroup.add(wallSR);

  const wallTop = new THREE.Mesh(new THREE.BoxGeometry(DOOR_W, ROOM_H - DOOR_H, 0.26), M.concreteWall);
  wallTop.position.set(0, DOOR_H + (ROOM_H - DOOR_H) / 2, 0);
  wallTop.castShadow = true; wallTop.receiveShadow = true;
  doorGroup.add(wallTop);

  /* ── Cornice porta (metallo anodizzato scuro) ── */
  const fL = new THREE.Mesh(new THREE.BoxGeometry(0.09, DOOR_H + 0.06, 0.09), M.metalDk);
  fL.position.set(-DOOR_W / 2 - 0.045, DOOR_H / 2, 0);
  doorGroup.add(fL);

  const fR = new THREE.Mesh(new THREE.BoxGeometry(0.09, DOOR_H + 0.06, 0.09), M.metalDk);
  fR.position.set(DOOR_W / 2 + 0.045, DOOR_H / 2, 0);
  doorGroup.add(fR);

  const fTop = new THREE.Mesh(new THREE.BoxGeometry(DOOR_W + 0.24, 0.1, 0.1), M.metalDk);
  fTop.position.set(0, DOOR_H + 0.05, 0);
  doorGroup.add(fTop);

  /* Meccanismo scorrevole sopra */
  const mechCover = new THREE.Mesh(new THREE.BoxGeometry(DOOR_W + 0.1, 0.16, 0.28), M.metalDk);
  mechCover.position.set(0, DOOR_H + 0.23, 0);
  doorGroup.add(mechCover);

  /* Guida pavimento */
  const rail = new THREE.Mesh(new THREE.BoxGeometry(DOOR_W, 0.03, 0.14), M.metalDk);
  rail.position.set(0, 0.015, 0);
  doorGroup.add(rail);

  /* ── Pannelli vetro ── */
  const panelW = DOOR_W / 2 - 0.03;
  const panelH = DOOR_H - 0.05;

  const glassL = new THREE.Mesh(new THREE.BoxGeometry(panelW, panelH, 0.01), M.glass.clone());
  glassL.position.set(-DOOR_W / 4, DOOR_H / 2, 0);
  doorGroup.add(glassL);

  const glassR = new THREE.Mesh(new THREE.BoxGeometry(panelW, panelH, 0.01), M.glass.clone());
  glassR.position.set(DOOR_W / 4, DOOR_H / 2, 0);
  doorGroup.add(glassR);


  /* Maniglie */
  const handleGeo = new THREE.CylinderGeometry(0.016, 0.016, 0.46, 10);
  const hL = new THREE.Mesh(handleGeo, M.handle);
  hL.rotation.z = Math.PI / 2;
  hL.position.set(-DOOR_W / 4 + 0.2, DOOR_H * 0.5, 0.013);
  doorGroup.add(hL);

  const hR = new THREE.Mesh(handleGeo, M.handle);
  hR.rotation.z = Math.PI / 2;
  hR.position.set(DOOR_W / 4 - 0.2, DOOR_H * 0.5, 0.013);
  doorGroup.add(hR);

  /* ── Logo Abstergo sul vetro — path SVG esatti da index.html ── */
  function buildLogoTex() {
    /* Canvas in proporzione 1:1 con il viewBox SVG (340×90) a 2× */
    const cw = 680, ch = 180;
    const c = document.createElement('canvas');
    c.width = cw; c.height = ch;
    const ctx = c.getContext('2d');
    ctx.clearRect(0, 0, cw, ch);

    /* Scala per mappare il viewBox SVG 340×90 → canvas 680×180 */
    ctx.scale(cw / 340, ch / 90);

    /* ── Simbolo: transform="translate(14,9) scale(0.20)" ── */
    ctx.save();
    ctx.translate(14, 9);
    ctx.scale(0.20, 0.20);

    /* Top-Left Piece */
    ctx.fillStyle = 'rgba(255,255,255,1.0)';
    ctx.fill(new Path2D('M214.902 47.301 C 198.522 73.203,184.322 95.656,183.347 97.197 C 182.372 98.739,180.634 101.490,179.484 103.312 C 178.334 105.134,176.483 108.057,175.370 109.809 C 174.258 111.561,164.284 127.325,153.206 144.841 C 142.129 162.357,126.214 187.521,117.839 200.761 C 109.465 214.001,102.557 224.979,102.489 225.157 C 102.390 225.416,112.043 225.466,151.966 225.415 L 201.566 225.350 215.386 203.822 C 222.986 191.981,238.989 167.045,250.946 148.408 C 262.904 129.771,273.057 113.949,273.510 113.248 C 273.962 112.548,275.725 109.813,277.429 107.171 L 280.525 102.367 262.832 51.884 C 253.100 24.119,245.036 1.133,244.911 0.805 C 244.713 0.282,241.005 6.027,214.902 47.301'));

    /* Right Piece */
    ctx.fillStyle = 'rgba(255,255,255,1.0)';
    ctx.fill(new Path2D('M247.575 176.557 L 222.687 218.317 241.172 248.075 C 251.338 264.443,270.849 295.863,284.530 317.898 L 309.402 357.962 354.707 357.962 L 400.012 357.962 399.647 357.389 C 399.446 357.073,370.769 306.885,335.919 245.860 C 301.070 184.834,272.536 134.880,272.510 134.851 C 272.484 134.822,261.263 153.589,247.575 176.557'));

    /* Bottom Piece */
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.fill(new Path2D('M34.749 257.006 C 28.069 268.181,17.575 285.714,11.429 295.968 C 5.283 306.221,0.255 314.677,0.255 314.758 C 0.255 314.838,60.503 314.904,134.140 314.904 C 207.777 314.904,268.025 314.840,268.025 314.761 C 268.025 314.681,261.213 303.417,252.886 289.729 C 244.559 276.040,233.915 258.535,229.232 250.828 L 220.718 236.815 133.807 236.751 L 46.896 236.687 34.749 257.006'));

    ctx.restore();

    /* ── Linea separatrice verticale ── */
    ctx.strokeStyle = 'rgba(255,255,255,0.9)';
    ctx.lineWidth = 0.75;
    ctx.beginPath();
    ctx.moveTo(102, 15);
    ctx.lineTo(102, 80);
    ctx.stroke();

    /* ── Testo "Abstergo" ── */
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 32px "Segoe UI", Arial, sans-serif';
    ctx.fillText('Abstergo', 116, 52);

    /* ── Testo "Industries" ── */
    ctx.fillStyle = 'rgba(255,255,255,0.95)';
    ctx.font = '400 18px "Segoe UI", Arial, sans-serif';
    ctx.fillText('Industries', 117, 74);

    return new THREE.CanvasTexture(c);
  }

  const logoTex = buildLogoTex();

  /* Aspect ratio SVG: 340/90 = 3.778 */
  const fullLogoW = DOOR_W * 0.90;
  const fullLogoH = fullLogoW * (90 / 340);
  const halfLogoW = fullLogoW / 2;

  /* Split texture: sinistra 0–50%, destra 50–100% */
  const logoTexL = logoTex.clone();
  logoTexL.repeat.set(0.5, 1); logoTexL.offset.set(0, 0); logoTexL.needsUpdate = true;
  const logoTexR = logoTex.clone();
  logoTexR.repeat.set(0.5, 1); logoTexR.offset.set(0.5, 0); logoTexR.needsUpdate = true;

  /* Centro del logo a x=0 (centro porta):
     metà sinistra: worldX da -halfLogoW a 0 → centro a -halfLogoW/2
     In glassL local (centrato a -DOOR_W/4): logoRelXL = (-halfLogoW/2) - (-DOOR_W/4) */
  const logoRelY  = 0.12;  /* leggermente sopra il centro del pannello */
  const logoRelXL = DOOR_W / 4 - halfLogoW / 2;
  const logoRelXR = -(DOOR_W / 4 - halfLogoW / 2);

  const logoMeshL = new THREE.Mesh(
    new THREE.PlaneGeometry(halfLogoW, fullLogoH),
    new THREE.MeshBasicMaterial({ map: logoTexL, transparent: true, depthWrite: false, side: THREE.DoubleSide })
  );
  logoMeshL.position.set(logoRelXL, logoRelY, 0.013);
  glassL.add(logoMeshL);

  const logoMeshR = new THREE.Mesh(
    new THREE.PlaneGeometry(halfLogoW, fullLogoH),
    new THREE.MeshBasicMaterial({ map: logoTexR, transparent: true, depthWrite: false, side: THREE.DoubleSide })
  );
  logoMeshR.position.set(logoRelXR, logoRelY, 0.013);
  glassR.add(logoMeshR);

  /* Pannello smerigliato scuro dietro il logo — fa risaltare il bianco */
  const logoBacking = new THREE.Mesh(
    new THREE.PlaneGeometry(fullLogoW * 1.20, fullLogoH * 2.6),
    new THREE.MeshBasicMaterial({ color: 0x000814, transparent: true, opacity: 0.60, depthWrite: false })
  );
  logoBacking.position.set(0, DOOR_H / 2, -0.006);
  doorGroup.add(logoBacking);

  /* Alone bianco additive sopra */
  const logoGlowMesh = new THREE.Mesh(
    new THREE.PlaneGeometry(fullLogoW * 1.30, fullLogoH * 2.8),
    new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.07,
      blending: THREE.AdditiveBlending, depthWrite: false })
  );
  logoGlowMesh.position.set(0, DOOR_H / 2, 0.02);
  doorGroup.add(logoGlowMesh);

  /* ════════════════════════════════════════════
     MACCHINA ANIMUS
  ════════════════════════════════════════════ */
  const aniGroup = new THREE.Group();
  aniGroup.position.set(0, -0.80, -6);
  aniGroup.rotation.y = Math.PI * 0.22;
  scene.add(aniGroup);

  /* ── Materiali Animus ── */
  const MA = {
    body:   new THREE.MeshPhysicalMaterial({ color: 0xa8b4be, roughness: 0.16, metalness: 0.78, clearcoat: 0.80, clearcoatRoughness: 0.08, envMapIntensity: 1.8 }),
    light:  new THREE.MeshPhysicalMaterial({ color: 0xc4cdd4, roughness: 0.12, metalness: 0.74, clearcoat: 0.88, clearcoatRoughness: 0.05, envMapIntensity: 2.0 }),
    dark:   new THREE.MeshPhysicalMaterial({ color: 0x3e464e, roughness: 0.24, metalness: 0.92, clearcoat: 0.50, clearcoatRoughness: 0.14, envMapIntensity: 1.6 }),
    platf:  new THREE.MeshPhysicalMaterial({ color: 0x606e78, roughness: 0.32, metalness: 0.80, clearcoat: 0.35, envMapIntensity: 1.3 }),
    screen: new THREE.MeshStandardMaterial({ color: 0x010810, roughness: 0.4, metalness: 0.2 }),
  };

  function ag(m) { aniGroup.add(m); return m; }

  /* Rounded-box: box centrale + 4 cilindri agli spigoli verticali */
  function rcBox(w, h, d, r, mat, x, y, z) {
    const b1 = new THREE.Mesh(new THREE.BoxGeometry(w, h, d - r * 2), mat);
    b1.position.set(x, y, z); b1.castShadow = true; ag(b1);
    const b2 = new THREE.Mesh(new THREE.BoxGeometry(w - r * 2, h, d), mat);
    b2.position.set(x, y, z); b2.castShadow = true; ag(b2);
    const hw = w / 2 - r, hd = d / 2 - r;
    [-hw, hw].forEach(cx => [-hd, hd].forEach(cz => {
      const c = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, 14), mat);
      c.position.set(x + cx, y, z + cz); c.castShadow = true; ag(c);
    }));
  }

  /* Blob: SphereGeometry schiacciata — forma organica */
  function blob(rx, ry, rz, mat, x, y, z) {
    const m = new THREE.Mesh(new THREE.SphereGeometry(1.0, 28, 14), mat);
    m.scale.set(rx, ry, rz); m.position.set(x, y, z); m.castShadow = true;
    return ag(m);
  }

  /* ══ PIATTAFORMA — ottagonale, con step ══ */
  const platGeo = new THREE.CylinderGeometry(1.0, 1.02, 0.13, 8);
  const platMesh = new THREE.Mesh(platGeo, MA.platf);
  platMesh.scale.set(3.0, 1.0, 2.8); platMesh.position.set(0, 0.065, 0);
  platMesh.receiveShadow = true; ag(platMesh);
  /* Step rialzato sotto macchina */
  const stepGeo = new THREE.CylinderGeometry(1.0, 1.0, 0.08, 8);
  const stepMesh = new THREE.Mesh(stepGeo, MA.platf);
  stepMesh.scale.set(1.3, 1.0, 1.35); stepMesh.position.set(0, 0.17, 0); ag(stepMesh);
  /* Bordi cyan piattaforma */
  const edgeCyan = M.glow(0x00ffff, 0.55);
  const edgeTube = new THREE.TubeGeometry(
    new THREE.CatmullRomCurve3([
      new THREE.Vector3(-2.90, 0.115,  2.65),
      new THREE.Vector3( 2.90, 0.115,  2.65),
      new THREE.Vector3( 2.90, 0.115, -2.65),
      new THREE.Vector3(-2.90, 0.115, -2.65),
      new THREE.Vector3(-2.90, 0.115,  2.65),
    ], false), 80, 0.018, 6, false);
  ag(new THREE.Mesh(edgeTube, edgeCyan));

  /* ══ CORPO PRINCIPALE — rcBox con angoli arrotondati r=0.13 ══ */
  rcBox(1.95, 1.38, 4.15, 0.13, MA.body, 0, 0.82, 0);

  /* Fascia laterale scura */
  [-0.98, 0.98].forEach(x => {
    const facia = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 4.10, 10), MA.dark);
    facia.rotation.z = Math.PI / 2; facia.scale.set(1, 1, 68);
    facia.position.set(x, 0.85, 0); ag(facia);
  });

  /* Scanalatura orizzontale medio-bassa */
  const grooveTube = new THREE.TubeGeometry(
    new THREE.CatmullRomCurve3([
      new THREE.Vector3(-0.90, 0.60, 2.09),
      new THREE.Vector3( 0.90, 0.60, 2.09),
    ]), 4, 0.025, 8, false);
  ag(new THREE.Mesh(grooveTube, MA.dark));

  /* ── PANNELLO FRONTALE (foot end, z+) ── */
  const circleGeo = new THREE.CircleGeometry(0.24, 32);
  const glowCircles = [];
  [-0.66, 0, 0.66].forEach(x => {
    /* housing cilindrico incassato */
    const hous = new THREE.Mesh(new THREE.CylinderGeometry(0.30, 0.30, 0.10, 28), MA.dark);
    hous.rotation.x = Math.PI / 2; hous.position.set(x, 0.76, 2.09); ag(hous);
    /* cerchio luminoso */
    const cMat = M.glow(0xddeeff, 0.88); cMat.side = THREE.DoubleSide;
    const circle = new THREE.Mesh(circleGeo, cMat);
    circle.position.set(x, 0.76, 2.12); ag(circle); glowCircles.push(circle);
    const halo = new THREE.Mesh(new THREE.CircleGeometry(0.44, 32), M.glowDS(0x88ccee, 0.16));
    halo.position.set(x, 0.76, 2.11); ag(halo);
    const pl = new THREE.PointLight(0x88bbdd, 1.6, 3.2);
    pl.position.set(x, 0.96, 2.35); aniGroup.add(pl);
  });
  /* Pannello circuiti trasparente (parte bassa) */
  const cpMat = new THREE.MeshStandardMaterial({ color: 0x001218, transparent: true, opacity: 0.82, roughness: 0.06, side: THREE.DoubleSide, depthWrite: false });
  ag(new THREE.Mesh(new THREE.PlaneGeometry(1.90, 0.52), cpMat)).position.set(0, 0.25, 2.10);
  for (let i = 0; i < 9; i++) {
    const h = 0.28 + Math.random() * 0.18;
    const ln = new THREE.Mesh(new THREE.PlaneGeometry(0.007, h), M.glow(0x00ffff, 0.22 + Math.random() * 0.28));
    ln.position.set(-0.84 + i * 0.21, 0.25, 2.105); ag(ln);
  }
  for (let i = 0; i < 5; i++) {
    const ln = new THREE.Mesh(new THREE.PlaneGeometry(1.75, 0.005), M.glow(0x00ffff, 0.16));
    ln.position.set(0, 0.05 + i * 0.11, 2.104); ag(ln);
  }

  /* ══ LETTINO — blob organici sovrapposti ══ */
  /* Corpo principale */
  blob(1.02, 0.090, 1.92, MA.light, 0, 1.672, -0.15);
  /* Spalle (più larghe e leggermente rialzate) */
  blob(1.06, 0.095, 0.52, MA.light, 0, 1.685, 1.38);
  /* Paraurti spalle laterali */
  [-1.0, 1.0].forEach(sx => blob(0.22, 0.17, 0.52, MA.body, sx * 1.04, 1.660, 0.86));
  /* Zona vita (rientranza: blob scuro schiacciato ai lati) */
  [-0.82, 0.82].forEach(sx => blob(0.14, 0.09, 0.72, MA.dark, sx, 1.692, -0.22));
  /* Gambe */
  blob(0.92, 0.085, 0.50, MA.light, 0, 1.658, -1.82);
  /* Scanalatura centrale: toro molto schiacciato */
  const spineGeo = new THREE.TorusGeometry(0.001, 0.001, 4, 4); // placeholder invisible
  // invece uso blob strettissimo:
  blob(0.14, 0.025, 1.78, MA.dark, 0, 1.745, -0.08);
  /* Corrimani: TubeGeometry lungo i fianchi */
  [-0.90, 0.90].forEach(sx => {
    const railCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(sx, 1.735, -2.05),
      new THREE.Vector3(sx * 1.06, 1.738,  0.00),
      new THREE.Vector3(sx * 1.04, 1.736,  1.30),
      new THREE.Vector3(sx,        1.732,  2.05),
    ]);
    const railMesh = new THREE.Mesh(new THREE.TubeGeometry(railCurve, 24, 0.038, 8, false), MA.dark);
    railMesh.castShadow = true; ag(railMesh);
    /* strip cyan */
    const cRail = new THREE.Mesh(new THREE.TubeGeometry(railCurve, 24, 0.020, 6, false), M.glow(0x00ffff, 0.42));
    ag(cRail);
  });

  /* ── POGGIATESTA — LatheGeometry bowl ergonomico ── */
  const hPts = [
    new THREE.Vector2(0.00, 0.00),
    new THREE.Vector2(0.16, 0.02),
    new THREE.Vector2(0.32, 0.09),
    new THREE.Vector2(0.46, 0.21),
    new THREE.Vector2(0.54, 0.36),
    new THREE.Vector2(0.52, 0.50),
    new THREE.Vector2(0.42, 0.58),
    new THREE.Vector2(0.26, 0.60),
    new THREE.Vector2(0.10, 0.54),
    new THREE.Vector2(0.00, 0.44),
  ];
  const headLathe = new THREE.Mesh(new THREE.LatheGeometry(hPts, 22), MA.body);
  headLathe.scale.set(1.48, 1.0, 1.0);
  headLathe.position.set(0, 1.720, 2.14);
  headLathe.castShadow = true; ag(headLathe);

  /* ══ BRACCIO MECCANICO — TubeGeometry su curva CatmullRom ══ */
  const armCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3( 1.08, 1.58, -0.42),
    new THREE.Vector3( 1.32, 2.18, -0.50),
    new THREE.Vector3( 1.28, 2.88, -0.56),
    new THREE.Vector3( 0.72, 3.34, -0.60),
    new THREE.Vector3( 0.05, 3.44, -0.60),
    new THREE.Vector3(-0.24, 3.22, -0.62),
    new THREE.Vector3(-0.30, 2.68, -0.64),
    new THREE.Vector3(-0.56, 2.44, -0.66),
    new THREE.Vector3(-0.76, 2.42, -0.68),
  ]);
  /* Tubo principale braccio */
  const armMesh = new THREE.Mesh(
    new THREE.TubeGeometry(armCurve, 60, 0.052, 10, false), MA.dark);
  armMesh.castShadow = true; ag(armMesh);
  /* Tubo esterno (più spesso, semi-trasparente — guaina) */
  const armSheath = new THREE.Mesh(
    new THREE.TubeGeometry(armCurve, 60, 0.072, 10, false),
    new THREE.MeshPhysicalMaterial({ color: 0x3a4450, roughness: 0.30, metalness: 0.85, transparent: true, opacity: 0.35, clearcoat: 0.5, depthWrite: false }));
  ag(armSheath);

  /* Sfere giuntura lungo la curva */
  [0.0, 0.22, 0.48, 0.68, 0.88].forEach(t => {
    const pt = armCurve.getPoint(t);
    const r = t === 0 ? 0.11 : (t === 0.48 ? 0.10 : 0.08);
    const jt = new THREE.Mesh(new THREE.SphereGeometry(r, 14, 10), MA.light);
    jt.position.copy(pt); jt.castShadow = true; ag(jt);
  });

  /* Disco sensore terminale */
  const discTip = armCurve.getPoint(1.0);
  const disc = new THREE.Mesh(new THREE.CylinderGeometry(0.30, 0.30, 0.09, 32), MA.light);
  disc.rotation.z = Math.PI / 2;
  disc.position.copy(discTip); ag(disc);
  const discRingMat = M.glowDS(0x00ffff, 0.72);
  const discRing = new THREE.Mesh(new THREE.TorusGeometry(0.26, 0.028, 10, 32), discRingMat);
  discRing.rotation.z = Math.PI / 2;
  discRing.position.copy(discTip); ag(discRing);
  const discInner = new THREE.Mesh(new THREE.CircleGeometry(0.18, 32), M.glowDS(0x00ccff, 0.52));
  discInner.rotation.z = Math.PI / 2;
  discInner.position.copy(discTip); ag(discInner);
  const discPl = new THREE.PointLight(0x00ccff, 2.0, 2.8);
  discPl.position.copy(discTip); discPl.position.x -= 0.15; aniGroup.add(discPl);

  /* ══ LAPTOP SU PIANTANA ══ */
  /* Piantana con profilo conico sottile */
  const lapPole = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.036, 1.60, 12), M.metal);
  lapPole.position.set(-1.72, 0.81, 0.62); ag(lapPole);
  /* Basetta a 4 gambe curvilinee */
  [0, Math.PI*0.5, Math.PI, Math.PI*1.5].forEach(a => {
    const legCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-1.72, 0.04, 0.62),
      new THREE.Vector3(-1.72 + Math.cos(a)*0.18, 0.02, 0.62 + Math.sin(a)*0.18),
      new THREE.Vector3(-1.72 + Math.cos(a)*0.38, 0.01, 0.62 + Math.sin(a)*0.38),
    ]);
    ag(new THREE.Mesh(new THREE.TubeGeometry(legCurve, 6, 0.022, 6, false), M.metal));
  });
  /* Braccio orizzontale supporto */
  const lapArm = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.62, 8), M.metal);
  lapArm.rotation.x = Math.PI / 2; lapArm.position.set(-1.72, 1.62, 0.31); ag(lapArm);
  /* Base laptop */
  rcBox(0.76, 0.026, 0.50, 0.04, MA.body, -1.72, 1.625, 0.62);
  /* Cerniera */
  const hinge = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.70, 8), MA.dark);
  hinge.rotation.z = Math.PI / 2; hinge.position.set(-1.72, 1.64, 0.38); ag(hinge);
  /* Schermo */
  rcBox(0.72, 0.46, 0.022, 0.04, MA.body, -1.72, 1.88, 0.75);
  /* Display */
  const lapDisp = new THREE.Mesh(new THREE.PlaneGeometry(0.62, 0.38), MA.screen);
  lapDisp.rotation.x = -0.55; lapDisp.position.set(-1.72, 1.88, 0.755); ag(lapDisp);
  const lapGlow = new THREE.Mesh(new THREE.PlaneGeometry(0.48, 0.28), M.glow(0x0044aa, 0.72));
  lapGlow.rotation.x = -0.55; lapGlow.position.set(-1.72, 1.89, 0.760); ag(lapGlow);
  const lapLogo = new THREE.Mesh(new THREE.PlaneGeometry(0.15, 0.09), M.glowDS(0x55aaff, 0.88));
  lapLogo.rotation.x = -0.55; lapLogo.position.set(-1.72, 1.90, 0.763); ag(lapLogo);

  /* ══ TASTIERA SU PIANTANA ══ */
  const kbPole = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.034, 1.36, 12), M.metal);
  kbPole.position.set(-2.44, 0.69, 0.12); ag(kbPole);
  /* Basetta stella curvilinea */
  [0, 1.26, 2.51, 3.77, 5.03].forEach(a => {
    const legC = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-2.44, 0.04, 0.12),
      new THREE.Vector3(-2.44 + Math.cos(a)*0.22, 0.02, 0.12 + Math.sin(a)*0.22),
      new THREE.Vector3(-2.44 + Math.cos(a)*0.44, 0.01, 0.12 + Math.sin(a)*0.44),
    ]);
    ag(new THREE.Mesh(new THREE.TubeGeometry(legC, 5, 0.020, 6, false), M.metal));
  });
  /* Tray con forma organica (rcBox) */
  rcBox(0.70, 0.030, 0.28, 0.04, MA.body, -2.44, 1.365, 0.12);
  /* Corpo tastiera */
  rcBox(0.64, 0.024, 0.24, 0.03, MA.dark, -2.44, 1.377, 0.12);
  /* Righe tasti */
  for (let row = 0; row < 5; row++) {
    const keyRow = new THREE.Mesh(
      new THREE.BoxGeometry(0.56, 0.018, 0.036),
      new THREE.MeshStandardMaterial({ color: 0x1a1e26, roughness: 0.95, metalness: 0.05 }));
    keyRow.position.set(-2.44, 1.388, -0.04 + row * 0.053); ag(keyRow);
  }

  /* ── Nebbia a pavimento ── */
  const mistMats = [
    M.glowDS(0x00c8e8, 0.10),
    M.glowDS(0x00a8cc, 0.07),
    M.glowDS(0x008aaa, 0.05),
  ];
  const mistMeshes = [
    { geo: new THREE.PlaneGeometry(6, 7),  pos: [0, -0.74, -6], ry: 0    },
    { geo: new THREE.PlaneGeometry(8, 5),  pos: [0, -0.70, -6], ry: 0.55 },
    { geo: new THREE.PlaneGeometry(5, 8),  pos: [0, -0.72, -6], ry: -0.4 },
  ].map((d, i) => {
    const m = new THREE.Mesh(d.geo, mistMats[i]);
    m.rotation.set(-Math.PI / 2, 0, d.ry);
    m.position.set(...d.pos);
    scene.add(m);
    return m;
  });

  /* ════════════════════════════════════════════
     POLTRONE — due sedie moderne ai lati del pozzo
  ════════════════════════════════════════════ */
  function addArmchair(wx, wz, rotY) {
    const matShell = new THREE.MeshPhysicalMaterial({
      color: 0xb0aca6, roughness: 0.50, metalness: 0.0,
      clearcoat: 0.35, clearcoatRoughness: 0.30
    });
    const matLeg = new THREE.MeshStandardMaterial({ color: 0xc4c8cc, roughness: 0.18, metalness: 0.88 });

    const g = new THREE.Group();
    g.position.set(wx, 0, wz);
    g.rotation.y = rotY;

    /* Seduta — LatheGeometry bowl */
    const seatPts = [
      new THREE.Vector2(0.00, 0.00), new THREE.Vector2(0.20, 0.02),
      new THREE.Vector2(0.36, 0.10), new THREE.Vector2(0.44, 0.22),
      new THREE.Vector2(0.45, 0.34), new THREE.Vector2(0.40, 0.42),
      new THREE.Vector2(0.28, 0.46), new THREE.Vector2(0.10, 0.42),
    ];
    const seatShell = new THREE.Mesh(new THREE.LatheGeometry(seatPts, 22), matShell);
    seatShell.scale.set(1.0, 1.0, 0.92);
    seatShell.position.set(0, 0.32, 0); g.add(seatShell);

    /* Cuscino seduta — blob */
    const cushion = new THREE.Mesh(new THREE.SphereGeometry(1, 22, 12), matShell);
    cushion.scale.set(0.38, 0.09, 0.35);
    cushion.position.set(0, 0.56, 0.02); g.add(cushion);

    /* Schienale curvo */
    const backCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-0.36, 0.55, -0.28),
      new THREE.Vector3(-0.32, 0.82, -0.32),
      new THREE.Vector3(0, 0.95, -0.34),
      new THREE.Vector3(0.32, 0.82, -0.32),
      new THREE.Vector3(0.36, 0.55, -0.28),
    ]);
    const backMesh = new THREE.Mesh(
      new THREE.TubeGeometry(backCurve, 30, 0.130, 10, false), matShell);
    g.add(backMesh);

    /* Poggiatesta */
    const headBlob = new THREE.Mesh(new THREE.SphereGeometry(1, 18, 10), matShell);
    headBlob.scale.set(0.24, 0.16, 0.12);
    headBlob.position.set(0, 1.06, -0.34); g.add(headBlob);

    /* Braccioli */
    [-0.40, 0.40].forEach(ax => {
      const armBlob = new THREE.Mesh(new THREE.SphereGeometry(1, 18, 10), matShell);
      armBlob.scale.set(0.07, 0.07, 0.36);
      armBlob.position.set(ax, 0.62, -0.02); g.add(armBlob);
      /* supporto bracciolo */
      const armPole = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.028, 0.26, 8), matLeg);
      armPole.position.set(ax, 0.46, -0.02); g.add(armPole);
    });

    /* Gambe metalliche — 4 coniche inclinate verso l'esterno */
    [[-0.30, -0.28], [0.30, -0.28], [-0.30, 0.28], [0.30, 0.28]].forEach(([lx, lz]) => {
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.020, 0.38, 8), matLeg);
      const ang = 0.12;
      leg.rotation.x = lz < 0 ? ang : -ang;
      leg.rotation.z = lx < 0 ? ang : -ang;
      leg.position.set(lx * 1.10, 0.19, lz * 1.10); g.add(leg);
      /* piedino */
      const foot = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.032, 0.022, 8), matLeg);
      foot.position.set(lx * 1.18, 0.011, lz * 1.18); g.add(foot);
    });

    scene.add(g);
    return g;
  }

  addArmchair(-5.2, -4.8,  Math.PI * 0.18);
  addArmchair( 5.2, -4.8, -Math.PI * 0.18);

  /* ════════════════════════════════════════════
     ARREDI E ATTREZZATURE — popola la sala
  ════════════════════════════════════════════ */

  const matDesk   = new THREE.MeshStandardMaterial({ color: 0x2a2e34, roughness: 0.55, metalness: 0.55 });
  const matScreen = new THREE.MeshStandardMaterial({ color: 0x080e14, roughness: 0.25, metalness: 0.3 });
  const matRack   = new THREE.MeshStandardMaterial({ color: 0x1a1e22, roughness: 0.60, metalness: 0.65 });
  const matLight2 = new THREE.MeshStandardMaterial({ color: 0x8aaaba, roughness: 0.18, metalness: 0.85 });

  /* ── Workstation: scrivania + monitor + tastiera ── */
  function addWorkstation(wx, wz, rotY) {
    const g = new THREE.Group();
    g.position.set(wx, 0, wz);
    g.rotation.y = rotY;

    /* Piano scrivania */
    const desk = new THREE.Mesh(new THREE.BoxGeometry(1.60, 0.06, 0.72), matDesk);
    desk.position.set(0, 0.78, 0);
    desk.castShadow = true; desk.receiveShadow = true; g.add(desk);

    /* Gambe */
    [[-0.72, -0.30], [0.72, -0.30], [-0.72, 0.30], [0.72, 0.30]].forEach(([lx, lz]) => {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.78, 0.06), matDesk);
      leg.position.set(lx, 0.39, lz); g.add(leg);
    });

    /* Monitor principale */
    const monBase = new THREE.Mesh(new THREE.CylinderGeometry(0.10, 0.14, 0.04, 10), matLight2);
    monBase.position.set(0, 0.84, -0.18); g.add(monBase);
    const monPole = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.28, 0.04), matDesk);
    monPole.position.set(0, 0.98, -0.18); g.add(monPole);
    const monFrame = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.44, 0.04), matDesk);
    monFrame.position.set(0, 1.18, -0.18); g.add(monFrame);
    const monDisp = new THREE.Mesh(new THREE.PlaneGeometry(0.64, 0.38), matScreen);
    monDisp.position.set(0, 1.18, -0.158);
    /* schermo emissivo cyan */
    const dispMat = monDisp.material.clone();
    dispMat.emissive = new THREE.Color(0x003040);
    dispMat.emissiveIntensity = 1.0;
    monDisp.material = dispMat;
    g.add(monDisp);

    /* Monitor secondario — inclinato lateralmente */
    const mon2 = new THREE.Group();
    mon2.position.set(0.56, 1.16, -0.17);
    mon2.rotation.y = -0.32;
    const mf2 = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.34, 0.04), matDesk);
    mon2.add(mf2);
    const md2 = new THREE.Mesh(new THREE.PlaneGeometry(0.46, 0.28), matScreen.clone());
    md2.material.emissive = new THREE.Color(0x001828);
    md2.material.emissiveIntensity = 0.8;
    md2.position.z = 0.022; mon2.add(md2);
    g.add(mon2);

    /* Tastiera */
    const kb = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.022, 0.18), matDesk);
    kb.position.set(-0.08, 0.822, 0.12); g.add(kb);

    /* Sedia operativa */
    const seatMat = new THREE.MeshStandardMaterial({ color: 0x1a1e24, roughness: 0.65, metalness: 0.1 });
    const seat = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.08, 0.46), seatMat);
    seat.position.set(0, 0.50, 0.52); g.add(seat);
    const back2 = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.52, 0.06), seatMat);
    back2.position.set(0, 0.82, 0.30); g.add(back2);
    const pole2 = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.50, 8), matLight2);
    pole2.position.set(0, 0.25, 0.52); g.add(pole2);

    /* Luce schermo — debole, colorata cyan */
    const screenGlow = new THREE.PointLight(0x00aacc, 0.4, 2.5);
    screenGlow.position.set(0, 1.20, 0.20); g.add(screenGlow);

    scene.add(g);
  }

  /* ── Rack server ── */
  function addServerRack(wx, wz, rotY) {
    const g = new THREE.Group();
    g.position.set(wx, 0, wz);
    g.rotation.y = rotY;

    const body = new THREE.Mesh(new THREE.BoxGeometry(0.62, 2.10, 0.68), matRack);
    body.position.y = 1.05;
    body.castShadow = true; g.add(body);

    /* Pannelli frontali */
    for (let i = 0; i < 10; i++) {
      const panel = new THREE.Mesh(new THREE.BoxGeometry(0.54, 0.14, 0.01), matDesk);
      panel.position.set(0, 0.22 + i * 0.18, 0.345); g.add(panel);
      /* LED status */
      const led = new THREE.Mesh(new THREE.PlaneGeometry(0.06, 0.028),
        new THREE.MeshBasicMaterial({ color: i % 3 === 0 ? 0x00ff88 : 0x00aaff,
          transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending }));
      led.position.set(0.22, 0.22 + i * 0.18, 0.352); g.add(led);
    }

    /* Bordo superiore */
    const top = new THREE.Mesh(new THREE.BoxGeometry(0.66, 0.04, 0.72), matLight2);
    top.position.y = 2.12; g.add(top);

    scene.add(g);
  }

  /* ── Colonnina controllo ── */
  function addControlPedestal(wx, wz) {
    const g = new THREE.Group();
    g.position.set(wx, 0, wz);
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.26, 0.90, 10), matRack);
    base.position.y = 0.45; g.add(base);
    const top2 = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.22, 0.06, 10), matLight2);
    top2.position.y = 0.93; g.add(top2);
    const screen2 = new THREE.Mesh(new THREE.PlaneGeometry(0.38, 0.24), matScreen.clone());
    screen2.material.emissive = new THREE.Color(0x002238);
    screen2.material.emissiveIntensity = 1.2;
    screen2.rotation.x = -0.55;
    screen2.position.set(0, 1.02, 0.12); g.add(screen2);
    scene.add(g);
  }

  /* ── Piazzamento workstation — pareti laterali ── */
  /* Sinistra */
  addWorkstation(-6.2, -15, Math.PI / 2);
  addWorkstation(-6.2, -20, Math.PI / 2);
  addWorkstation(-6.2, -27, Math.PI / 2);
  addWorkstation(-6.2, -33, Math.PI / 2);
  /* Destra */
  addWorkstation( 6.2, -15, -Math.PI / 2);
  addWorkstation( 6.2, -20, -Math.PI / 2);
  addWorkstation( 6.2, -27, -Math.PI / 2);
  addWorkstation( 6.2, -33, -Math.PI / 2);

  /* ── Rack server — fondo sala e angoli ── */
  addServerRack(-6.8, -34, Math.PI / 2);
  addServerRack(-6.8, -38, Math.PI / 2);
  addServerRack( 6.8, -34, -Math.PI / 2);
  addServerRack( 6.8, -38, -Math.PI / 2);

  /* ── Colonnine controllo vicino al pozzo ── */
  addControlPedestal(-4.8, -2.5);
  addControlPedestal( 4.8, -2.5);
  addControlPedestal(-4.8, -9.5);
  addControlPedestal( 4.8, -9.5);

  /* ── Schermi a parete laterale ── */
  function addWallScreen(side, wz) {
    const x = (ROOM_W / 2 - 0.06) * side;
    const rotY = side > 0 ? -Math.PI / 2 : Math.PI / 2;
    const frame = new THREE.Mesh(new THREE.BoxGeometry(2.4, 1.5, 0.08), matDesk);
    frame.rotation.y = rotY;
    frame.position.set(x, 5.5, wz);
    scene.add(frame);
    const disp = new THREE.Mesh(new THREE.PlaneGeometry(2.24, 1.36),
      new THREE.MeshStandardMaterial({ color: 0x020c12, emissive: 0x002030, emissiveIntensity: 0.8, roughness: 0.2 }));
    disp.rotation.y = rotY;
    disp.position.set(x * 0.996, 5.5, wz);
    scene.add(disp);
    const gl = new THREE.PointLight(0x0088cc, 0.5, 4);
    gl.position.set(x * 0.85, 5.5, wz);
    scene.add(gl);
  }
  [-1, 1].forEach(s => [-13, -22, -31].forEach(z => addWallScreen(s, z)));

  /* ════════════════════════════════════════════
     COMMAND CENTER — parete di fondo
  ════════════════════════════════════════════ */

  /* Piattaforma rialzata */
  const ccPlatform = new THREE.Mesh(new THREE.BoxGeometry(ROOM_W - 1, 0.14, 4.0), matDesk);
  ccPlatform.position.set(0, 0.07, -42.0);
  ccPlatform.receiveShadow = true;
  scene.add(ccPlatform);
  const ccStep = new THREE.Mesh(new THREE.BoxGeometry(ROOM_W - 1, 0.08, 0.40), matLight2);
  ccStep.position.set(0, 0.04, -39.80);
  scene.add(ccStep);
  /* Strisce LED bordo piattaforma */
  const ccEdge = new THREE.Mesh(new THREE.PlaneGeometry(ROOM_W - 1.2, 0.025), M.glow(0x00ffff, 0.50));
  ccEdge.rotation.x = -Math.PI / 2;
  ccEdge.position.set(0, 0.145, -39.85);
  scene.add(ccEdge);

  /* Desk semicircolare in 3 segmenti */
  [[-3.6, -41.2, -0.25], [0, -41.6, 0], [3.6, -41.2, 0.25]].forEach(([dx, dz, ry]) => {
    const seg = new THREE.Mesh(new THREE.BoxGeometry(2.8, 0.06, 0.80), matDesk);
    seg.position.set(dx, 0.92, dz);
    seg.rotation.y = ry;
    seg.castShadow = true;
    scene.add(seg);
    /* Gamba */
    [-1.1, 1.1].forEach(lx => {
      const leg2 = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.92, 8), matLight2);
      leg2.position.set(dx + Math.cos(ry) * lx, 0.46, dz + Math.sin(ry) * lx);
      scene.add(leg2);
    });
  });

  /* Banca monitor sul fondo — 7 schermi in arco */
  for (let i = 0; i < 7; i++) {
    const t2 = (i - 3) / 3;
    const mx = t2 * 6.2;
    const mz = -43.3 + Math.abs(t2) * 0.6;
    const ry2 = -t2 * 0.22;

    const mFrame = new THREE.Mesh(new THREE.BoxGeometry(0.90, 0.56, 0.05), matDesk);
    mFrame.position.set(mx, 2.20, mz);
    mFrame.rotation.y = ry2;
    scene.add(mFrame);

    const mDisp2 = new THREE.Mesh(new THREE.PlaneGeometry(0.82, 0.50),
      new THREE.MeshStandardMaterial({ color: 0x020a10, emissive: 0x001c2c, emissiveIntensity: 1.0, roughness: 0.2 }));
    mDisp2.position.set(mx + Math.sin(ry2) * 0.027, 2.20, mz + Math.cos(ry2) * 0.027);
    mDisp2.rotation.y = ry2;
    scene.add(mDisp2);

    const gl2 = new THREE.PointLight(0x0077aa, 0.3, 2.2);
    gl2.position.set(mx, 2.20, mz + 0.5);
    scene.add(gl2);
  }

  /* Supporto banca monitor */
  const monRail = new THREE.Mesh(new THREE.BoxGeometry(14, 0.06, 0.08), matLight2);
  monRail.position.set(0, 1.60, -43.2);
  scene.add(monRail);
  const monRail2 = new THREE.Mesh(new THREE.BoxGeometry(14, 0.06, 0.08), matLight2);
  monRail2.position.set(0, 2.68, -43.2);
  scene.add(monRail2);

  /* ════════════════════════════════════════════
     LOGO ABSTERGO — parete fondo + zone multiple
  ════════════════════════════════════════════ */

  /* Logo enorme parete di fondo — illuminato */
  function addLogoPanel(wx, wy, wz, scale, rotY, bgOpacity) {
    const lw = 3.8 * scale, lh = 3.8 * scale * (90 / 340);
    const bg = new THREE.Mesh(
      new THREE.PlaneGeometry(lw * 1.15, lh * 2.6),
      new THREE.MeshBasicMaterial({ color: 0x000810, transparent: true, opacity: bgOpacity, depthWrite: false })
    );
    bg.rotation.y = rotY;
    bg.position.set(wx, wy, wz + (rotY !== 0 ? 0 : 0.005));
    scene.add(bg);

    const tex2 = buildLogoTex();
    const lTexL = tex2.clone(); lTexL.repeat.set(0.5, 1); lTexL.offset.set(0, 0); lTexL.needsUpdate = true;
    const lTexR = tex2.clone(); lTexR.repeat.set(0.5, 1); lTexR.offset.set(0.5, 0); lTexR.needsUpdate = true;

    const ml = new THREE.Mesh(new THREE.PlaneGeometry(lw / 2, lh),
      new THREE.MeshBasicMaterial({ map: lTexL, transparent: true, depthWrite: false, side: THREE.DoubleSide }));
    ml.rotation.y = rotY;
    ml.position.set(wx - Math.cos(rotY) * lw / 4, wy, wz + 0.01);
    scene.add(ml);

    const mr = new THREE.Mesh(new THREE.PlaneGeometry(lw / 2, lh),
      new THREE.MeshBasicMaterial({ map: lTexR, transparent: true, depthWrite: false, side: THREE.DoubleSide }));
    mr.rotation.y = rotY;
    mr.position.set(wx + Math.cos(rotY) * lw / 4, wy, wz + 0.01);
    scene.add(mr);

    /* Spotlight puntata sul logo */
    const ll = new THREE.SpotLight(0xffffff, 2.0, 8, Math.PI * 0.18, 0.5, 1.4);
    ll.position.set(wx, wy + 3.5, wz + 2.5);
    ll.target.position.set(wx, wy, wz);
    scene.add(ll); scene.add(ll.target);
  }

  /* 1. Parete di fondo — grande, centrato */
  addLogoPanel(0, 6.5, -43.85, 2.0, 0, 0.65);

  /* 2. Parete sinistra, metà corridoio */
  function addSideLogoPanel(side, wz) {
    const x = (ROOM_W / 2 - 0.08) * side;
    const rotY = side > 0 ? -Math.PI / 2 : Math.PI / 2;
    const lw2 = 2.4, lh2 = 2.4 * (90 / 340);
    const bg2 = new THREE.Mesh(
      new THREE.PlaneGeometry(lw2 * 1.2, lh2 * 2.8),
      new THREE.MeshBasicMaterial({ color: 0x000810, transparent: true, opacity: 0.55, depthWrite: false })
    );
    bg2.rotation.y = rotY; bg2.position.set(x, 3.2, wz); scene.add(bg2);

    const tex3 = buildLogoTex();
    const lL3 = tex3.clone(); lL3.repeat.set(0.5,1); lL3.offset.set(0,0); lL3.needsUpdate=true;
    const lR3 = tex3.clone(); lR3.repeat.set(0.5,1); lR3.offset.set(0.5,0); lR3.needsUpdate=true;
    const ml3 = new THREE.Mesh(new THREE.PlaneGeometry(lw2/2, lh2),
      new THREE.MeshBasicMaterial({ map:lL3, transparent:true, depthWrite:false, side:THREE.DoubleSide }));
    ml3.rotation.y = rotY; ml3.position.set(x + (side>0?-1:1)*lw2/4, 3.2, wz); scene.add(ml3);
    const mr3 = new THREE.Mesh(new THREE.PlaneGeometry(lw2/2, lh2),
      new THREE.MeshBasicMaterial({ map:lR3, transparent:true, depthWrite:false, side:THREE.DoubleSide }));
    mr3.rotation.y = rotY; mr3.position.set(x + (side>0?1:-1)*lw2/4, 3.2, wz); scene.add(mr3);
  }
  addSideLogoPanel(-1, -18);
  addSideLogoPanel( 1, -26);

  /* ════════════════════════════════════════════
     KEYFRAME CAMERA
  ════════════════════════════════════════════ */
  const KF = [
    { p: 0.00, pos: [0, EYE_H, 15.5],        tgt: [0, EYE_H * 0.97, ENTRY_Z]  },
    { p: 0.20, pos: [0, EYE_H, 15.5],        tgt: [0, EYE_H * 0.97, ENTRY_Z]  },
    { p: 0.52, pos: [0, EYE_H, 13.4],        tgt: [0, EYE_H * 0.87, -4]       },
    { p: 0.76, pos: [0, EYE_H, 0],           tgt: [0, 1.05, -6]                },
    { p: 0.88, pos: [0, EYE_H - 0.22, -3],  tgt: [0, 0.88, -6]               },
    { p: 1.00, pos: [0, 1.22, -5.0],        tgt: [0, 7.5,  -5.0]             },
  ];

  function getCamState(p) {
    let k0 = KF[0], k1 = KF[KF.length - 1];
    for (let i = 0; i < KF.length - 1; i++) {
      if (p >= KF[i].p && p <= KF[i + 1].p) { k0 = KF[i]; k1 = KF[i + 1]; break; }
    }
    const t  = k1.p === k0.p ? 1 : norm(p, k0.p, k1.p);
    const te = ease(t);
    return {
      pos: new THREE.Vector3(...k0.pos).lerp(new THREE.Vector3(...k1.pos), te),
      tgt: new THREE.Vector3(...k0.tgt).lerp(new THREE.Vector3(...k1.tgt), te),
    };
  }

  /* ════════════════════════════════════════════
     UPDATE SCENA
  ════════════════════════════════════════════ */
  function updateScene(p) {
    /* ── Porte ── */
    const doorPhase = ease(norm(p, 0.18, 0.48));
    const slide = doorPhase * (DOOR_W / 2 + 0.08);
    glassL.position.x  = -DOOR_W / 4 - slide;
    hL.position.x      = -DOOR_W / 4 + 0.2 - slide;
    glassR.position.x  =  DOOR_W / 4 + slide;
    hR.position.x      =  DOOR_W / 4 - 0.2 + slide;

    /* ── Camera ── */
    const state = getCamState(p);
    camera.position.copy(state.pos);
    camera.lookAt(state.tgt);

  }

  /* ════════════════════════════════════════════
     ANIMATION LOOP
  ════════════════════════════════════════════ */
  const clock = new THREE.Clock();

  function animate() {
    rafHandle = requestAnimationFrame(animate);
    const t = clock.getElapsedTime();

    velocity *= FRICTION;
    if (Math.abs(velocity) < 0.00004) velocity = 0;
    scrollProg = clamp(scrollProg + velocity, 0, 1);
    /* rimbalzo ai bordi */
    if (scrollProg <= 0 && velocity < 0) velocity = 0;
    if (scrollProg >= 1 && velocity > 0) velocity = 0;

    updateScene(scrollProg);

    glowCircles.forEach((c, i) => {
      c.material.opacity = 0.55 + 0.15 * Math.sin(t * 1.5 + i * 1.1);
    });

    /* Disc rotation */
    discRing.rotation.z = t * 0.9;
    disc.rotation.y = t * 0.4;

    animusGlow.intensity = 3.5 + 0.6 * Math.sin(t * 1.2);
    aniBack.intensity    = 1.4 + 0.3 * Math.sin(t * 0.9 + 1.0);

    /* Nebbia */
    mistMeshes[0].position.x = Math.sin(t * 0.28) * 0.55;
    mistMeshes[1].rotation.z = t * 0.08;
    mistMeshes[2].position.z = -6 + Math.cos(t * 0.22) * 0.5;

    /* Respiro camera idle */
    if (scrollProg < 0.12) {
      const breathAmt = (1 - scrollProg / 0.12) * Math.sin(t * 1.3) * 0.014;
      camera.position.y += breathAmt;
    }

    renderer.render(scene, camera);

    if (scrollProg >= 0.998 && !finishing) {
      finishing = true;
      triggerTransition();
    }
  }

  /* TEMPORANEO: salta l'intro, aspetta che app.js sia pronto poi taglia */
  function waitAndCut() {
    if (typeof window._resetBoot === 'function') {
      triggerTransition();
    } else {
      requestAnimationFrame(waitAndCut);
    }
  }
  requestAnimationFrame(waitAndCut);
  // animate();

  /* ════════════════════════════════════════════
     SCROLL HANDLERS
  ════════════════════════════════════════════ */
  function onWheel(e) {
    if (!introActive) return;
    const d = Math.sign(e.deltaY) * Math.min(Math.abs(e.deltaY), 80);
    velocity += d * SCROLL_ACCEL;
    velocity = Math.sign(velocity) * Math.min(Math.abs(velocity), MAX_VEL);
  }
  function onTouchStart(e) { touchY = e.touches[0].clientY; }
  function onTouchMove(e) {
    if (!introActive || touchY === null) return;
    const dy = touchY - e.touches[0].clientY;
    touchY = e.touches[0].clientY;
    velocity += dy * TOUCH_ACCEL;
    velocity = Math.sign(velocity) * Math.min(Math.abs(velocity), MAX_VEL);
    e.preventDefault();
  }

  window.addEventListener('wheel',      onWheel,      { passive: true });
  window.addEventListener('touchstart', onTouchStart, { passive: true });
  window.addEventListener('touchmove',  onTouchMove,  { passive: false });

  /* ════════════════════════════════════════════
     COLLEGAMENTO DIRETTO → DISPLAY CURVO
     Nessuna transizione: taglio istantaneo al display principale.
  ════════════════════════════════════════════ */
  function triggerTransition() {
    /* Taglio diretto: intro sparisce, display appare istantaneamente */
    if (window._resetBoot) window._resetBoot();
    window.introIsActive = false;

    /* Mostra subito il canvas principale */
    if (mainCV) {
      mainCV.style.transition  = 'none';
      mainCV.style.opacity     = '1';
      mainCV.style.pointerEvents = '';
    }

    /* Nascondi intro-sequence immediatamente */
    seq.style.display = 'none';

    /* CSS3DRenderer */
    document.querySelectorAll('body > div').forEach(el => {
      if (el.style && el.style.zIndex === '5') {
        el.style.display = '';
        el.style.opacity = '1';
        el.style.transition = 'none';
      }
    });

    /* vignette, scanlines, hud — visibili subito (no boot/loading screen) */
    const vignette     = document.getElementById('vignette');
    const scanlines    = document.getElementById('scanlines');
    const hudContainer = document.getElementById('hud-container');

    if (vignette)     { vignette.style.display  = 'block'; }
    if (scanlines)    { scanlines.style.display  = 'block'; }
    if (hudContainer) { hudContainer.style.display = ''; }

    /* Cleanup */
    introActive = false;
    cancelAnimationFrame(rafHandle);
    renderer.dispose();
    domObs.disconnect();
    window.removeEventListener('wheel',      onWheel);
    window.removeEventListener('touchstart', onTouchStart);
    window.removeEventListener('touchmove',  onTouchMove);
  }

  /* ── RESIZE ── */
  window.addEventListener('resize', () => {
    renderer.setSize(window.innerWidth, window.innerHeight);
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
  });

})();
