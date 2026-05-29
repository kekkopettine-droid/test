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
  const SCROLL_SPEED = 0.00052;
  const TOUCH_SPEED  = 0.0016;
  const LERP         = 0.065;
  const EYE_H        = 1.72;
  const DOOR_W       = 3.8;
  const DOOR_H       = 3.1;
  const ROOM_W       = 16;
  const ROOM_H       = 10;
  const ENTRY_Z      = 12;

  /* ── STATO ── */
  let scrollProg = 0;
  let targetProg = 0;
  let introActive = true;
  let finishing   = false;
  let touchY      = null;
  let rafHandle   = null;

  /* Segnala ad app.js che l'intro è attiva → blocca bootProgress */
  window.introIsActive = true;

  /* ── DOM REFS ── */
  const seq     = document.getElementById('intro-sequence');
  const flashEl = document.getElementById('intro-flash');

  /* ── NASCONDI PROGETTO ESISTENTE ── */
  const projIds = ['threeCanvas', 'boot', 'hud-container', 'vignette', 'scanlines'];
  projIds.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.style.display = 'none';
  });

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
  /* Tone mapping realistico — evita il sovraesposizione */
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.setClearColor(0x111820, 1);

  /* ── SCENA E CAMERA ── */
  const scene = new THREE.Scene();
  /* Fog che lascia vedere la stanza ma nasconde le pareti lontane */
  scene.fog = new THREE.Fog(0x111820, 22, 65);

  const camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 200);
  camera.position.set(0, EYE_H, 15.5);
  camera.lookAt(0, EYE_H, ENTRY_Z);

  /* ── HELPER ── */
  function ease(t) { return t < 0.5 ? 2*t*t : 1 - Math.pow(-2*t+2, 2)/2; }
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function norm(p, s, e) { return clamp((p-s)/(e-s), 0, 1); }

  /* ════════════════════════════════════════════
     LUCI — indoor corporate: pannelli LED a soffitto, Animus accent
  ════════════════════════════════════════════ */

  /* Ambient medio-basso, freddo */
  scene.add(new THREE.AmbientLight(0x4a5a6a, 0.65));

  /* Hemisphere: soffitto freddo / pavimento scuro */
  const overheadFill = new THREE.HemisphereLight(0x708090, 0x1a2028, 0.7);
  scene.add(overheadFill);

  /* Pannelli LED a soffitto — luce principale della stanza */
  [4, -8, -20, -35].forEach(z => {
    const pl = new THREE.PointLight(0xb0c8d8, 3.2, 22);
    pl.position.set(0, 9.5, z);
    scene.add(pl);
  });

  /* Glow Animus — accento, non fonte primaria */
  const animusGlow = new THREE.PointLight(0x00aabb, 2.8, 14);
  animusGlow.position.set(0, 1.2, -10);
  scene.add(animusGlow);

  /* Fill posteriore Animus */
  const aniBack = new THREE.PointLight(0x006688, 1.2, 10);
  aniBack.position.set(0, 4.0, -14);
  scene.add(aniBack);

  /* SpotLight dall'alto — ombre reali sulla macchina e sul pavimento */
  const aniSpot = new THREE.SpotLight(0xc8d8e8, 2.8, 28, Math.PI * 0.18, 0.45, 1.2);
  aniSpot.position.set(0, 9.5, -10);
  aniSpot.target.position.set(0, 0, -10);
  aniSpot.castShadow = true;
  aniSpot.shadow.mapSize.set(1024, 1024);
  aniSpot.shadow.camera.near = 1;
  aniSpot.shadow.camera.far = 18;
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
        const v = 36 + Math.floor(Math.random() * 10);
        cx.fillStyle = `rgb(${v},${v+4},${v+8})`;
        cx.fillRect(x + 1, y + 1, ts - 2, ts - 2);
        /* specular spot */
        const g = cx.createRadialGradient(x+ts*0.28,y+ts*0.28,0, x+ts*0.5,y+ts*0.5, ts*0.65);
        g.addColorStop(0, 'rgba(255,255,255,0.06)');
        g.addColorStop(1, 'rgba(0,0,0,0)');
        cx.fillStyle = g;
        cx.fillRect(x, y, ts, ts);
      }
    }
    /* fughe tra le piastrelle */
    cx.fillStyle = '#080c10';
    for (let i = 1; i < 4; i++) {
      cx.fillRect(i*ts-1, 0, 2, sz);
      cx.fillRect(0, i*ts-1, sz, 2);
    }
    /* rumore fine */
    for (let i = 0; i < 12000; i++) {
      const px = Math.random()*sz, py = Math.random()*sz;
      const a = Math.random() * 0.05;
      cx.fillStyle = Math.random() > 0.5 ? `rgba(255,255,255,${a})` : `rgba(0,0,0,${a})`;
      cx.fillRect(px, py, 1, 1);
    }
    const t = new THREE.CanvasTexture(cv);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(ROOM_W / 4, 110 / 4);
    return t;
  }

  function makeConcreteWall() {
    const sz = 512;
    const cv = document.createElement('canvas');
    cv.width = cv.height = sz;
    const cx = cv.getContext('2d');

    cx.fillStyle = '#505a64';
    cx.fillRect(0, 0, sz, sz);
    /* pannelli orizzontali */
    cx.strokeStyle = 'rgba(0,0,0,0.22)';
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
    cx.fillStyle = '#252c34';
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
    concrete:    new THREE.MeshStandardMaterial({ color: 0x909aa4, roughness: 0.92, metalness: 0.0, map: wallTex }),
    concreteDk:  new THREE.MeshStandardMaterial({ color: 0x606870, roughness: 0.96, metalness: 0.0, map: ceilTex }),
    concreteWall:new THREE.MeshStandardMaterial({ color: 0x8a9aa6, roughness: 0.90, metalness: 0.0, map: wallTex }),
    floor:       new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.20, metalness: 0.10, map: floorTex }),
    metalDk:     new THREE.MeshStandardMaterial({ color: 0x707880, roughness: 0.28, metalness: 0.95, map: metalTex }),
    metal:       new THREE.MeshStandardMaterial({ color: 0x8090a0, roughness: 0.22, metalness: 0.88 }),
    handle:      new THREE.MeshStandardMaterial({ color: 0xb0b8c0, roughness: 0.06, metalness: 0.98 }),
    animus:      new THREE.MeshStandardMaterial({ color: 0x5a6a78, roughness: 0.35, metalness: 0.78 }),
    animusDk:    new THREE.MeshStandardMaterial({ color: 0x363e48, roughness: 0.42, metalness: 0.82 }),
    animusPlatf: new THREE.MeshStandardMaterial({ color: 0x404c58, roughness: 0.50, metalness: 0.65 }),
    glass:       new THREE.MeshStandardMaterial({
      color: 0x90c0d0, transparent: true, opacity: 0.15,
      roughness: 0.01, metalness: 0.0,
      side: THREE.DoubleSide, depthWrite: false,
    }),
    lightStrip:  new THREE.MeshBasicMaterial({ color: 0xe8f0f8, transparent: true, opacity: 0.95 }),
    glow:        (c, o) => new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: o, blending: THREE.AdditiveBlending, depthWrite: false }),
    glowDS:      (c, o) => new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: o, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }),
  };

  /* ════════════════════════════════════════════
     STANZA
  ════════════════════════════════════════════ */

  /* Pavimento */
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(ROOM_W, 110), M.floor);
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(0, 0, -28);
  floor.receiveShadow = true;
  scene.add(floor);

  /* Soffitto */
  const ceil = new THREE.Mesh(new THREE.PlaneGeometry(ROOM_W, 110), M.concreteDk);
  ceil.rotation.x = Math.PI / 2;
  ceil.position.set(0, ROOM_H, -28);
  ceil.receiveShadow = true;
  scene.add(ceil);

  /* Parete di fondo */
  const backWall = new THREE.Mesh(new THREE.PlaneGeometry(ROOM_W, ROOM_H), M.concreteWall);
  backWall.position.set(0, ROOM_H / 2, -72);
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
    const win = new THREE.Mesh(
      new THREE.PlaneGeometry(4.1, 5.5),
      new THREE.MeshStandardMaterial({
        color: 0x0a1018, transparent: true, opacity: 0.85,
        roughness: 0.05, metalness: 0.0, side: THREE.DoubleSide, depthWrite: false
      })
    );
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

  /* Montante centrale */
  const midPost = new THREE.Mesh(new THREE.BoxGeometry(0.05, DOOR_H, 0.05), M.metalDk);
  midPost.position.set(0, DOOR_H / 2, 0);
  doorGroup.add(midPost);

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

  /* ── Logo Abstergo sul vetro — incisione frost, bianco opaco ── */
  function buildLogoTex() {
    const c = document.createElement('canvas');
    c.width = 640; c.height = 320;
    const ctx = c.getContext('2d');
    ctx.clearRect(0, 0, 640, 320);

    const lx = 170, ly = 160, ts = 62;

    /* Simbolo: tre triangoli in stile etching su vetro */
    ctx.beginPath();
    ctx.moveTo(lx - ts * 0.84, ly + ts * 0.4);
    ctx.lineTo(lx - ts * 0.04, ly - ts);
    ctx.lineTo(lx + ts * 0.3,  ly - ts * 0.08);
    ctx.closePath();
    ctx.fillStyle = 'rgba(255, 255, 255, 0.55)';
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(lx + ts * 0.3,  ly - ts * 0.08);
    ctx.lineTo(lx + ts * 0.95, ly + ts * 0.4);
    ctx.lineTo(lx + ts * 0.02, ly + ts * 0.4);
    ctx.closePath();
    ctx.fillStyle = 'rgba(255, 255, 255, 0.75)';
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(lx - ts * 0.84, ly + ts * 0.4);
    ctx.lineTo(lx + ts * 0.95, ly + ts * 0.4);
    ctx.lineTo(lx + ts * 0.62, ly + ts * 0.9);
    ctx.lineTo(lx - ts * 0.62, ly + ts * 0.9);
    ctx.closePath();
    ctx.fillStyle = 'rgba(255, 255, 255, 0.40)';
    ctx.fill();

    /* Separatore verticale */
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(lx + ts * 1.22, ly - ts * 0.86);
    ctx.lineTo(lx + ts * 1.22, ly + ts * 1.05);
    ctx.stroke();

    /* Testo */
    ctx.fillStyle = 'rgba(255, 255, 255, 0.82)';
    ctx.font = 'bold 50px "Segoe UI", Arial, sans-serif';
    ctx.fillText('Abstergo', lx + ts * 1.42, ly + 12);

    ctx.fillStyle = 'rgba(255, 255, 255, 0.55)';
    ctx.font = '28px "Segoe UI", Arial, sans-serif';
    ctx.fillText('Industries', lx + ts * 1.55, ly + 50);

    return new THREE.CanvasTexture(c);
  }

  /* Logo diviso in due metà — una per porta, così si separa all'apertura */
  const logoTex = buildLogoTex();

  const fullLogoW = DOOR_W - 0.14;
  const fullLogoH = fullLogoW * 0.5;
  const halfLogoW = fullLogoW / 2;

  /* Metà sinistra: simbolo (0%–50% della texture) */
  const logoTexL = logoTex.clone();
  logoTexL.repeat.set(0.5, 1);
  logoTexL.offset.set(0, 0);
  logoTexL.needsUpdate = true;

  /* Metà destra: testo (50%–100% della texture) */
  const logoTexR = logoTex.clone();
  logoTexR.repeat.set(0.5, 1);
  logoTexR.offset.set(0.5, 0);
  logoTexR.needsUpdate = true;

  /* Posizione relativa al pannello di vetro (glassL/glassR centrati a y=DOOR_H/2) */
  const logoRelY  = DOOR_H * 0.58 - DOOR_H / 2; // = DOOR_H * 0.08
  const logoRelXL =  (DOOR_W / 4 - halfLogoW / 2); // piccolo offset per allineare
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

  /* ════════════════════════════════════════════
     MACCHINA ANIMUS
  ════════════════════════════════════════════ */
  const aniGroup = new THREE.Group();
  aniGroup.position.set(0, 0, -10);
  scene.add(aniGroup);

  /* Piattaforma rialzata */
  const platform = new THREE.Mesh(new THREE.BoxGeometry(5.6, 0.09, 5.2), M.animusPlatf);
  platform.position.set(0, 0.045, 0);
  platform.castShadow = true;
  platform.receiveShadow = true;
  aniGroup.add(platform);

  /* Bordi piattaforma — accento cyan contenuto */
  const eg = M.glow(0x009aaa, 0.45);
  [-2.8, 2.8].forEach(x => {
    const e = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.04, 5.2), eg);
    e.position.set(x, 0.085, 0);
    aniGroup.add(e);
  });
  [-2.6, 2.6].forEach(z => {
    const e = new THREE.Mesh(new THREE.BoxGeometry(5.6, 0.04, 0.04), eg);
    e.position.set(0, 0.085, z);
    aniGroup.add(e);
  });

  /* Chassis principale */
  const chassis = new THREE.Mesh(new THREE.BoxGeometry(2.05, 1.12, 4.1), M.animus);
  chassis.position.set(0, 0.65, -0.15);
  chassis.castShadow = true;
  chassis.receiveShadow = true;
  aniGroup.add(chassis);

  /* Superficie superiore (lettino) */
  const topSurf = new THREE.Mesh(new THREE.BoxGeometry(1.88, 0.13, 3.82), M.animusDk);
  topSurf.position.set(0, 1.275, -0.22);
  aniGroup.add(topSurf);

  /* Scanalatura corpo */
  const bodyGroove = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.055, 2.6), M.animusDk);
  bodyGroove.position.set(0, 1.265, -0.4);
  aniGroup.add(bodyGroove);

  /* Poggiatesta */
  const headRest = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.31, 0.62, 18), M.animus);
  headRest.rotation.x = Math.PI / 2;
  headRest.position.set(0, 1.34, 1.6);
  aniGroup.add(headRest);

  /* Bordi laterali lettino */
  [-0.84, 0.84].forEach(x => {
    const side = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.08, 3.8), M.animusDk);
    side.position.set(x, 1.3, -0.22);
    aniGroup.add(side);
  });

  /* ── Braccio meccanico (destra) ── */
  const armPost = new THREE.Mesh(new THREE.BoxGeometry(0.2, 1.42, 0.2), M.animusDk);
  armPost.position.set(1.06, 1.51, -1.0);
  aniGroup.add(armPost);

  const armH = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.16, 0.16), M.animusDk);
  armH.position.set(0.55, 2.25, -1.0);
  aniGroup.add(armH);

  /* Disco rotante */
  const disc = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.26, 0.1, 32), M.metal);
  disc.position.set(0.06, 2.25, -1.0);
  aniGroup.add(disc);

  /* Anello glow disc */
  const discRingMat = M.glowDS(0x00aacc, 0.55);
  const discRing = new THREE.Mesh(new THREE.RingGeometry(0.2, 0.28, 32), discRingMat);
  discRing.rotation.x = -Math.PI / 2;
  discRing.position.set(0.06, 2.32, -1.0);
  aniGroup.add(discRing);

  /* ── Pannello frontale con 3 cerchi luminosi ── */
  const frontPanel = new THREE.Mesh(new THREE.BoxGeometry(2.05, 0.62, 0.14), M.animusDk);
  frontPanel.position.set(0, 0.32, 2.06);
  aniGroup.add(frontPanel);

  const circleGeo = new THREE.CircleGeometry(0.2, 32);
  const glowCircles = [];
  [-0.62, 0, 0.62].forEach((x) => {
    const cMat = M.glow(0xddeeff, 0.7);
    cMat.side = THREE.DoubleSide;
    const circle = new THREE.Mesh(circleGeo, cMat);
    circle.position.set(x, 0.32, 2.14);
    aniGroup.add(circle);
    glowCircles.push(circle);

    /* Alone */
    const halo = new THREE.Mesh(new THREE.CircleGeometry(0.34, 32), M.glowDS(0x88bbcc, 0.15));
    halo.position.set(x, 0.32, 2.13);
    aniGroup.add(halo);

    /* Luce punto */
    const pl = new THREE.PointLight(0x88aacc, 1.2, 2.8);
    pl.position.set(x, 0.55, 2.22);
    aniGroup.add(pl);
  });

  /* ── Console schermo operatore (sinistra) ── */
  const consoleBase = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.86, 0.46), M.animusDk);
  consoleBase.position.set(-1.52, 0.88, -1.05);
  aniGroup.add(consoleBase);

  const scrBase = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.04, 0.38), M.animusDk);
  scrBase.position.set(-1.52, 1.35, -1.05);
  aniGroup.add(scrBase);

  const scrPanel = new THREE.Mesh(
    new THREE.BoxGeometry(0.38, 0.24, 0.022),
    new THREE.MeshStandardMaterial({ color: 0x040810, roughness: 0.5, metalness: 0.3 })
  );
  scrPanel.rotation.x = -0.35;
  scrPanel.position.set(-1.52, 1.49, -0.89);
  aniGroup.add(scrPanel);

  const scrGlow = new THREE.Mesh(
    new THREE.PlaneGeometry(0.28, 0.17),
    M.glow(0x0066aa, 0.85)
  );
  scrGlow.rotation.x = -0.35;
  scrGlow.position.set(-1.52, 1.49, -0.875);
  aniGroup.add(scrGlow);

  /* ── Tastiera su piantana (sinistra) ── */
  const kbPole = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 1.18, 8), M.metal);
  kbPole.position.set(-2.28, 0.59, -1.38);
  aniGroup.add(kbPole);

  const kbFoot = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.03, 0.28), M.metal);
  kbFoot.position.set(-2.28, 0.025, -1.38);
  aniGroup.add(kbFoot);

  const kbBoard = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.022, 0.2), M.animus);
  kbBoard.position.set(-2.28, 1.2, -1.38);
  aniGroup.add(kbBoard);

  /* ── Nebbia a pavimento ── */
  const mistMats = [
    M.glowDS(0x4060a0, 0.07),
    M.glowDS(0x304870, 0.05),
    M.glowDS(0x203050, 0.04),
  ];
  const mistMeshes = [
    { geo: new THREE.PlaneGeometry(8, 8),  pos: [0, 0.06, -10], ry: 0    },
    { geo: new THREE.PlaneGeometry(10, 6), pos: [0, 0.1,  -10], ry: 0.55 },
    { geo: new THREE.PlaneGeometry(6, 10), pos: [0, 0.08, -10], ry: -0.4 },
  ].map((d, i) => {
    const m = new THREE.Mesh(d.geo, mistMats[i]);
    m.rotation.set(-Math.PI / 2, 0, d.ry);
    m.position.set(...d.pos);
    scene.add(m);
    return m;
  });

  /* ════════════════════════════════════════════
     KEYFRAME CAMERA
  ════════════════════════════════════════════ */
  const KF = [
    { p: 0.00, pos: [0, EYE_H, 15.5],        tgt: [0, EYE_H * 0.97, ENTRY_Z]  },
    { p: 0.20, pos: [0, EYE_H, 15.5],        tgt: [0, EYE_H * 0.97, ENTRY_Z]  },
    { p: 0.52, pos: [0, EYE_H, 13.4],        tgt: [0, EYE_H * 0.87, -4]       },
    { p: 0.76, pos: [0, EYE_H, 0],           tgt: [0, 1.05, -10]               },
    { p: 0.88, pos: [0, EYE_H - 0.22, -5],   tgt: [0, 0.88, -10]              },
    { p: 1.00, pos: [0, 1.22, -8.0],         tgt: [0, 7.5,  -8.0]             },
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
    midPost.visible    = doorPhase < 0.12;

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

    scrollProg += (targetProg - scrollProg) * LERP;
    if (Math.abs(targetProg - scrollProg) < 0.00012) scrollProg = targetProg;

    updateScene(scrollProg);

    glowCircles.forEach((c, i) => {
      c.material.opacity = 0.55 + 0.15 * Math.sin(t * 1.5 + i * 1.1);
    });

    /* Disc rotation */
    discRing.rotation.z = t * 0.9;
    disc.rotation.y = t * 0.4;

    animusGlow.intensity = 2.6 + 0.5 * Math.sin(t * 1.2);
    aniBack.intensity    = 1.0 + 0.2 * Math.sin(t * 0.9 + 1.0);

    /* Nebbia */
    mistMeshes[0].position.x = Math.sin(t * 0.28) * 0.55;
    mistMeshes[1].rotation.z = t * 0.08;
    mistMeshes[2].position.z = -10 + Math.cos(t * 0.22) * 0.5;

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

  animate();

  /* ════════════════════════════════════════════
     SCROLL HANDLERS
  ════════════════════════════════════════════ */
  function onWheel(e) {
    if (!introActive) return;
    targetProg = clamp(targetProg + e.deltaY * SCROLL_SPEED, 0, 1);
  }
  function onTouchStart(e) { touchY = e.touches[0].clientY; }
  function onTouchMove(e) {
    if (!introActive || touchY === null) return;
    const dy = touchY - e.touches[0].clientY;
    touchY = e.touches[0].clientY;
    targetProg = clamp(targetProg + dy * TOUCH_SPEED, 0, 1);
    e.preventDefault();
  }

  window.addEventListener('wheel',      onWheel,      { passive: true });
  window.addEventListener('touchstart', onTouchStart, { passive: true });
  window.addEventListener('touchmove',  onTouchMove,  { passive: false });

  /* ════════════════════════════════════════════
     TRANSIZIONE FLUIDA → DISPLAY CURVO

     Sequenza:
     1. I display CSS dell'intro sono già visibili (opacity 1)
     2. Intro canvas fa un lento fade-out
     3. CONTEMPORANEAMENTE il Three.js canvas del progetto fa fade-in
     4. _resetBoot() ripristina l'animazione "rotazione da destra"
     5. I display CSS scompaiono → il display curvo Three.js appare
     Risultato: seamless
  ════════════════════════════════════════════ */
  function triggerTransition() {
    /* ── Step 1: prepara canvas Three.js principale ── */
    const threeCV = document.getElementById('threeCanvas');
    const bootEl  = document.getElementById('boot');
    const vignette = document.getElementById('vignette');
    const scanlines = document.getElementById('scanlines');
    const hudContainer = document.getElementById('hud-container');

    if (threeCV) {
      threeCV.style.display = 'block';
      threeCV.style.opacity = '0';
      threeCV.style.transition = 'none';
    }

    if (window._resetBoot) window._resetBoot();
    window.introIsActive = false;

    /* CSS3DRenderer */
    document.querySelectorAll('body > div').forEach(el => {
      if (el.style && el.style.zIndex === '5') {
        el.style.display = '';
        el.style.opacity = '0';
        el.style.transition = 'opacity 2.0s ease 0.8s';
        setTimeout(() => { el.style.opacity = '1'; }, 50);
      }
    });

    /* ── Step 3: flash bianco + crossfade ── */
    setTimeout(() => {
      /* Flash — simula l'ingresso nella simulazione */
      if (flashEl) {
        flashEl.style.transition = 'opacity 0.18s ease';
        flashEl.style.opacity = '0.85';
        setTimeout(() => {
          flashEl.style.transition = 'opacity 1.0s ease';
          flashEl.style.opacity = '0';
        }, 180);
      }

      /* Intro canvas esce lentamente */
      threeCanvas.style.transition = 'opacity 2.0s ease 0.1s';
      threeCanvas.style.opacity = '0';

      /* Canvas progetto entra in sync */
      if (threeCV) {
        threeCV.style.transition = 'opacity 2.0s ease 0.1s';
        threeCV.style.opacity = '1';
      }

      /* Boot screen */
      if (bootEl) {
        bootEl.style.display = 'flex';
        bootEl.style.opacity = '0';
        bootEl.style.transition = 'opacity 0.6s ease 0.2s';
        setTimeout(() => { if (bootEl) bootEl.style.opacity = '1'; }, 300);
      }

      /* Display CSS intro esce */
      if (displayWrap) {
        displayWrap.style.transition = 'opacity 1.0s ease';
        displayWrap.style.opacity = '0';
      }

      if (vignette)    { vignette.style.display = 'block'; }
      if (scanlines)   { scanlines.style.display = 'block'; }
      if (hudContainer){ hudContainer.style.display = ''; }

    }, 200);

    /* ── Step 4: cleanup ── */
    setTimeout(() => {
      seq.style.display = 'none';
      introActive = false;
      cancelAnimationFrame(rafHandle);
      renderer.dispose();
      domObs.disconnect();
      window.removeEventListener('wheel',      onWheel);
      window.removeEventListener('touchstart', onTouchStart);
      window.removeEventListener('touchmove',  onTouchMove);
    }, 2400);
  }

  /* ── RESIZE ── */
  window.addEventListener('resize', () => {
    renderer.setSize(window.innerWidth, window.innerHeight);
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
  });

})();
