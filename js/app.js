(function () {
  'use strict';

  var memoryBlocks = [];

  /* ══════════════════════════════════════════════
     RENDERER & SCENE
  ══════════════════════════════════════════════ */
  const canvas   = document.getElementById('threeCanvas');
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  // Sfondo grigio neutro per contrasto
  renderer.setClearColor(0x1a1a1a, 1);

  const cssRenderer = new THREE.CSS3DRenderer();
  cssRenderer.setSize(window.innerWidth, window.innerHeight);
  cssRenderer.domElement.style.position = 'fixed';
  cssRenderer.domElement.style.top = '0';
  cssRenderer.domElement.style.left = '0';
  cssRenderer.domElement.style.zIndex = '5';
  cssRenderer.domElement.style.pointerEvents = 'none';
  document.body.appendChild(cssRenderer.domElement);

  /* Quando i pannelli gene sono aperti, qualsiasi click sul cssRenderer chiude —
     il CSS3D hit-testing è inaffidabile per elementi inclinati in prospettiva */
  cssRenderer.domElement.addEventListener('click', (e) => {
    /* Chiude i pannelli gene se aperti (tranne PRENOTA) */
    if (typeof selectedDnaGene !== 'undefined' && selectedDnaGene !== -1) {
      const id = e.target && e.target.id;
      if (id === 'scConfirmBtn') return;
      if (id === 'charConfirmBtn' || id === 'charBackBtn') return; /* non interferire con char view */
      hideGeneInfo();
    }
  });

  // Nasconde il renderer CSS3D durante l'intro sequence
  if (document.getElementById('intro-sequence')) {
    cssRenderer.domElement.style.display = 'none';
  }
  const scene  = new THREE.Scene();
  scene.fog    = new THREE.FogExp2(0x1a1a1a, 0.025);
  const camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 300);
  camera.position.set(0, 0, 18);

  /* ══════════════════════════════════════════════
     MOUSE EASING
  ══════════════════════════════════════════════ */
  const rawMouse = new THREE.Vector2(0, 0);
  const eMouse   = new THREE.Vector2(0, 0);
  const EASE     = 0.03;

  window.addEventListener('mousemove', e => {
    rawMouse.x =  (e.clientX / window.innerWidth  - 0.5) * 2;
    rawMouse.y = -(e.clientY / window.innerHeight - 0.5) * 2;
  });

  /* ══════════════════════════════════════════════
     LIGHTS
  ══════════════════════════════════════════════ */
  scene.add(new THREE.AmbientLight(0xffffff, 2.8));

  const keyL = new THREE.PointLight(0xccffff, 6.0, 80);
  keyL.position.set(0, 25, 10); // Spostata in alto per non fare riflesso al centro
  scene.add(keyL);

  const fillL = new THREE.PointLight(0x0088ff, 5.0, 50);
  fillL.position.set(25, -5, 5); // Spostata più di lato
  scene.add(fillL);

  /* ══════════════════════════════════════════════
     BACKGROUND (Struttura metallica industriale)
  ══════════════════════════════════════════════ */
  const bgGroup = new THREE.Group();
  scene.add(bgGroup);

  // Materiali (roughness alta per eliminare i riflessi circolari/ovali della luce sul muro)
  const metalMat = new THREE.MeshStandardMaterial({ color: 0x0f0f0f, metalness: 0.2, roughness: 1.0 });
  const darkMetalMat = new THREE.MeshStandardMaterial({ color: 0x050505, metalness: 0.1, roughness: 1.0 });
  const pipeMat = new THREE.MeshStandardMaterial({ color: 0x111111, metalness: 0.9, roughness: 0.2 });
  const ledMat = new THREE.MeshBasicMaterial({ color: 0x00ffff, transparent: true, opacity: 0.7 }); // Led ciano
  const warningLedMat = new THREE.MeshBasicMaterial({ color: 0xff3300, transparent: true, opacity: 0.8 }); // Led rossi/arancio
  const boxMat = new THREE.MeshStandardMaterial({ color: 0x0a0a0a, metalness: 0.4, roughness: 0.9 }); // Scatole server

  const wall = new THREE.Mesh(new THREE.PlaneGeometry(400, 200), darkMetalMat);
  wall.position.set(0, 0, -35);
  bgGroup.add(wall);

  // Travi orizzontali principali
  const topBeam = new THREE.Mesh(new THREE.BoxGeometry(400, 6, 2), metalMat);
  topBeam.position.set(0, 15, -30);
  bgGroup.add(topBeam);

  const midBeam = new THREE.Mesh(new THREE.BoxGeometry(400, 4, 2), metalMat);
  midBeam.position.set(0, 0, -32);
  bgGroup.add(midBeam);

  const bottomBeam = new THREE.Mesh(new THREE.BoxGeometry(400, 8, 2), metalMat);
  bottomBeam.position.set(0, -15, -30);
  bgGroup.add(bottomBeam);

  // Tubature/Cavi orizzontali (dettaglio industriale)
  for(let y of [6, 8, -6, -8]) {
    const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.25, 400, 16), pipeMat);
    pipe.rotation.z = Math.PI / 2;
    pipe.position.set(0, y, -33.5);
    bgGroup.add(pipe);
  }

  // Pilastri verticali con dettagli e luci server
  for (let x = -160; x <= 160; x += 15) {
    const pillarGeo = new THREE.BoxGeometry(2, 200, 4);
    const pillar = new THREE.Mesh(pillarGeo, metalMat);
    pillar.position.set(x, 0, -28);
    bgGroup.add(pillar);

    // Fessura centrale (groove)
    const grooveGeo = new THREE.BoxGeometry(0.5, 200, 4.5);
    const groove = new THREE.Mesh(grooveGeo, darkMetalMat);
    groove.position.set(x, 0, -28);
    bgGroup.add(groove);

    // Indicatori LED (server blinkers) posizionati sui pilastri
    if (Math.random() > 0.2) {
      const ledGeo = new THREE.BoxGeometry(0.8, 0.15, 4.6);
      const led = new THREE.Mesh(ledGeo, ledMat);
      led.position.set(x, (Math.random() - 0.5) * 15 + 15, -28); // Spostato in alto
      bgGroup.add(led);
    }

    // NUOVI DETTAGLI: Tubature verticali spesse
    if (Math.random() > 0.4) {
      const vPipe = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 200, 16), pipeMat);
      vPipe.position.set(x + 3, 0, -32);
      bgGroup.add(vPipe);
    }

    // NUOVI DETTAGLI: Scatole di derivazione/Server centrali attaccate al muro
    if (Math.random() > 0.5) {
      const box = new THREE.Mesh(new THREE.BoxGeometry(5, 8, 2), boxMat);
      const boxY = (Math.random() - 0.5) * 15 + 18; // Spostate in alto
      box.position.set(x + 7.5, boxY, -33.5);
      bgGroup.add(box);
      
      // Led di stato sulla scatola (spesso ciano, a volte rosso di allerta)
      const isWarning = Math.random() > 0.85;
      const statusLed = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.8, 2.2), isWarning ? warningLedMat : ledMat);
      statusLed.position.set(x + 7.5, boxY + 2, -33.5);
      bgGroup.add(statusLed);
    }

    // NUOVI DETTAGLI: Strutture ad X (Cross-bracing) per rinforzo industriale
    if (Math.random() > 0.6 && x < 150) {
      const crossGeo = new THREE.CylinderGeometry(0.2, 0.2, 22, 8); // Lunghezza diagonale
      
      const crossY = 16; // Posizionate in alto
      const cross1 = new THREE.Mesh(crossGeo, metalMat);
      cross1.position.set(x + 7.5, crossY, -29.5);
      cross1.rotation.z = Math.PI / 4; // 45 gradi
      bgGroup.add(cross1);

      const cross2 = new THREE.Mesh(crossGeo, metalMat);
      cross2.position.set(x + 7.5, crossY, -29.5);
      cross2.rotation.z = -Math.PI / 4;
      bgGroup.add(cross2);
    }
  }

  const topLight = new THREE.DirectionalLight(0x88ccff, 3); // Intensità ridotta
  topLight.position.set(0, 30, -10);
  topLight.target.position.set(0, 15, -30); // Punta verso l'alto, lontano dal centro
  scene.add(topLight);
  scene.add(topLight.target);

  /* ══════════════════════════════════════════════
     CURVED HUD GLASS (Il vetro curvo principale)
  ══════════════════════════════════════════════ */
  const gridRadius = 25;
  const gridGroup = new THREE.Group();
  gridGroup.position.set(0, 0, 5); // Spostato un po' più vicino
  gridGroup.rotation.y = Math.PI; // Parte da sinistra completamente fuori campo
  scene.add(gridGroup);

  // IL VETRO (Arco molto ampio per coprire i lati vuoti)
  const glassHeight = 22; 
  const arcLength = Math.PI * 1.5; // 270 gradi per coprire tutto il campo visivo
  const cylThetaStart = -Math.PI - (arcLength / 2); // Centrato esattamente dietro (su -Z)
  const screenGlassGeo = new THREE.CylinderGeometry(gridRadius, gridRadius, glassHeight, 64, 1, true, cylThetaStart, arcLength);
  
  // Creazione dinamica di una texture sfumata (Gradient) per il vetro
  const canvasGrad = document.createElement('canvas');
  canvasGrad.width = 2;
  canvasGrad.height = 256;
  const ctxGrad = canvasGrad.getContext('2d');
  const gradient = ctxGrad.createLinearGradient(0, 0, 0, 256);
  // Sfumatura: i bordi sono più opachi e luminosi, il centro è molto trasparente
  gradient.addColorStop(0, "rgba(0, 50, 90, 0.8)");    // Bordo alto (Opaco)
  gradient.addColorStop(0.25, "rgba(0, 40, 70, 0.3)");
  gradient.addColorStop(0.5, "rgba(0, 30, 50, 0.05)"); // Centro (Quasi invisibile)
  gradient.addColorStop(0.75, "rgba(0, 40, 70, 0.3)");
  gradient.addColorStop(1, "rgba(0, 80, 130, 0.9)");   // Bordo basso (Molto opaco e luminoso)
  
  ctxGrad.fillStyle = gradient;
  ctxGrad.fillRect(0, 0, 2, 256);
  
  const glassTex = new THREE.CanvasTexture(canvasGrad);

  const screenGlassMat = new THREE.MeshBasicMaterial({ 
    map: glassTex,
    transparent: true,
    opacity: 1,
    side: THREE.BackSide,
    depthWrite: false
  });
  gridGroup.add(new THREE.Mesh(screenGlassGeo, screenGlassMat));

  // Overlay luminoso ciano: parte spento, si attiva dopo il boot per simulare l'accensione
  const glassActivatedMat = new THREE.MeshBasicMaterial({
    color: 0x004466,
    transparent: true,
    opacity: 0,
    side: THREE.BackSide,
    depthWrite: false,
    blending: THREE.AdditiveBlending
  });
  gridGroup.add(new THREE.Mesh(screenGlassGeo, glassActivatedMat));

  // CORNICI METALLICHE SPESSE (Sopra e Sotto il vetro)
  const bezelGeo = new THREE.CylinderGeometry(gridRadius + 0.2, gridRadius + 0.2, 1.5, 64, 1, true, cylThetaStart, arcLength);
  const bezelMat = new THREE.MeshStandardMaterial({ 
    color: 0x11161a, 
    metalness: 0.9, 
    roughness: 0.4, 
    side: THREE.BackSide,
    transparent: true,
    opacity: 1
  });
  
  const topBezel = new THREE.Mesh(bezelGeo, bezelMat);
  topBezel.position.y = glassHeight / 2 + 0.75;
  gridGroup.add(topBezel);

  const bottomBezel = new THREE.Mesh(bezelGeo, bezelMat);
  bottomBezel.position.y = -(glassHeight / 2) - 0.75;
  gridGroup.add(bottomBezel);

  // STRISCE LUMINOSE CIANO (Alla base e in cima al vetro)
  const bottomGlowMat = new THREE.MeshBasicMaterial({ 
    color: 0x00ffff, 
    transparent: true, 
    opacity: 0,
    side: THREE.DoubleSide,
    depthTest: false,
    blending: THREE.AdditiveBlending
  });
  const topGlowMat = new THREE.MeshBasicMaterial({ 
    color: 0x00ffff, 
    transparent: true, 
    opacity: 0,
    side: THREE.DoubleSide,
    depthTest: false,
    blending: THREE.AdditiveBlending
  });

  const bottomGlow = new THREE.Mesh(new THREE.CylinderGeometry(gridRadius + 0.05, gridRadius + 0.05, 0.3, 64, 1, true, cylThetaStart, arcLength), bottomGlowMat);
  bottomGlow.position.y = -(glassHeight / 2) + 0.15;
  gridGroup.add(bottomGlow);

  const bottomGlowLine = new THREE.Mesh(new THREE.CylinderGeometry(gridRadius + 0.08, gridRadius + 0.08, 0.08, 64, 1, true, cylThetaStart, arcLength), bottomGlowMat);
  bottomGlowLine.position.y = -(glassHeight / 2) + 0.8;
  gridGroup.add(bottomGlowLine);

  const topGlow = new THREE.Mesh(new THREE.CylinderGeometry(gridRadius + 0.05, gridRadius + 0.05, 0.3, 64, 1, true, cylThetaStart, arcLength), topGlowMat);
  topGlow.position.y = (glassHeight / 2) - 0.15;
  gridGroup.add(topGlow);

  const topGlowLine = new THREE.Mesh(new THREE.CylinderGeometry(gridRadius + 0.08, gridRadius + 0.08, 0.08, 64, 1, true, cylThetaStart, arcLength), topGlowMat);
  topGlowLine.position.y = (glassHeight / 2) - 0.8;
  gridGroup.add(topGlowLine);

  // GRIGLIA SOTTILE SUL VETRO (Tracciata solo sull'arco)
  const gridMatHoriz = new THREE.LineBasicMaterial({ color: 0x00ffff, transparent: true, opacity: 0.15, blending: THREE.AdditiveBlending });
  const gridMatVert = new THREE.LineBasicMaterial({ color: 0x00ffff, transparent: true, opacity: 0.08, blending: THREE.AdditiveBlending });

  const thetaCenter = Math.PI * 1.5;
  const panelArcStart = thetaCenter - (arcLength / 2);

  // Linee orizzontali
  for (let y = -10.5; y <= 10.5; y += 1.5) {
    const points = [];
    const segments = 64;
    for(let i=0; i<=segments; i++){
      const a = panelArcStart + (i/segments)*arcLength;
      points.push(new THREE.Vector3(Math.cos(a)*gridRadius, y, Math.sin(a)*gridRadius));
    }
    const geo = new THREE.BufferGeometry().setFromPoints(points);
    const line = new THREE.Line(geo, gridMatHoriz);
    gridGroup.add(line);
  }

  // Linee verticali
  const numVertLines = 40;
  for (let i = 0; i <= numVertLines; i++) {
    const a = panelArcStart + (i / numVertLines) * arcLength;
    const points = [
      new THREE.Vector3(Math.cos(a) * gridRadius, -11, Math.sin(a) * gridRadius),
      new THREE.Vector3(Math.cos(a) * gridRadius,  11, Math.sin(a) * gridRadius)
    ];
    gridGroup.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(points), gridMatVert));
  }

  /* ── DETTAGLI STRUTTURALI: LED INDICATORI AI BORDI DELL'ARCO ── */
  const postLedMats = [];

  for (const angle of [cylThetaStart, cylThetaStart + arcLength]) {
    const px = Math.cos(angle) * (gridRadius + 0.15);
    const pz = Math.sin(angle) * (gridRadius + 0.15);

    // Piccolo LED ciano all'endpoint dell'arco
    const pLedMat = new THREE.MeshBasicMaterial({ color: 0x00ffff, transparent: true, opacity: 0, depthTest: false, blending: THREE.AdditiveBlending });
    const pLed = new THREE.Mesh(new THREE.SphereGeometry(0.2, 8, 8), pLedMat);
    pLed.position.set(px, glassHeight / 2 + 0.5, pz);
    gridGroup.add(pLed);
    postLedMats.push(pLedMat);
  }

  /* ── LUCI LAMPEGGIANTI SUI BEZELS ── */
  const blinkLeds = [];
  const blinkPositions = [0.1, 0.3, 0.5, 0.7, 0.9]; // Posizioni lungo l'arco
  for (let bi = 0; bi < blinkPositions.length; bi++) {
    const a = panelArcStart + blinkPositions[bi] * arcLength;
    const isWarning = bi === 2; // Al centro metti uno rosso/arancio
    const bMat = new THREE.MeshBasicMaterial({
      color: isWarning ? 0xff6600 : 0x00ffff,
      transparent: true, opacity: 0, depthTest: false
    });
    for (const fy of [glassHeight / 2 + 0.75, -(glassHeight / 2) - 0.75]) {
      const bLed = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 8), bMat.clone());
      bLed.position.set(Math.cos(a) * (gridRadius + 0.25), fy, Math.sin(a) * (gridRadius + 0.25));
      bLed.userData.blinkOffset = Math.random() * Math.PI * 2;
      bLed.userData.blinkSpeed  = 0.6 + Math.random() * 2.5;
      gridGroup.add(bLed);
      blinkLeds.push(bLed);
    }
  }

  /* ── FRAMMENTI DI MEMORIA ANIMUS (PARTICELLE FLUTTUANTI) ── */
  const animusParticleCount = 80;
  const animusParticlesGeo = new THREE.BufferGeometry();
  const animusPositions = new Float32Array(animusParticleCount * 3);
  const animusSpeeds = [];

  for (let i = 0; i < animusParticleCount; i++) {
    const angle = panelArcStart + Math.random() * arcLength;
    // Leggermente staccati dal vetro (tra gridRadius - 2 e gridRadius + 1)
    const radius = gridRadius - 2.0 + Math.random() * 3.0;
    animusPositions[i * 3] = Math.cos(angle) * radius;
    animusPositions[i * 3 + 1] = (Math.random() - 0.5) * glassHeight;
    animusPositions[i * 3 + 2] = Math.sin(angle) * radius;

    animusSpeeds.push({
      y: 0.015 + Math.random() * 0.035,
      angleSpeed: (Math.random() - 0.5) * 0.001,
      angle: angle,
      radius: radius
    });
  }

  animusParticlesGeo.setAttribute('position', new THREE.BufferAttribute(animusPositions, 3));
  
  animusParticlesMat = new THREE.PointsMaterial({
    color: 0x00ffff,
    size: 0.12,
    transparent: true,
    opacity: 0.05, // Partono quasi invisibili, fanno fade-in post-boot
    blending: THREE.AdditiveBlending,
    depthWrite: false
  });
  
  animusParticles = new THREE.Points(animusParticlesGeo, animusParticlesMat);
  gridGroup.add(animusParticles);

  /* ── ONDA DI SCANSIONE OLOGRAFICA ── */
  const scanMat = new THREE.MeshBasicMaterial({
    color: 0x00ffff, transparent: true, opacity: 0,
    side: THREE.DoubleSide, depthTest: false,
    blending: THREE.AdditiveBlending
  });
  const scanRing = new THREE.Mesh(
    new THREE.CylinderGeometry(gridRadius + 0.01, gridRadius + 0.01, 0.08, 64, 1, true, cylThetaStart, arcLength),
    scanMat
  );
  gridGroup.add(scanRing);

  /* ══════════════════════════════════════════════
     CSS3D PANELS (Anchored to the Grid)
  ══════════════════════════════════════════════ */
  const spread = 0.42;
  const panelRadiusCSS = 24.8; // Appena dentro il vetro

  // 1) LOGO - centrato sopra le due schede
  const logoEl = document.getElementById('abstergoLogo');
  const cssLogo = new THREE.CSS3DObject(logoEl);
  // Usa thetaCenter per stare esattamente al centro del display
  const thetaLogo = thetaCenter - 0.7;
  cssLogo.position.set(Math.cos(thetaLogo) * panelRadiusCSS, 8.0, Math.sin(thetaLogo) * panelRadiusCSS);
  cssLogo.scale.set(0.013, 0.013, 0.013);
  cssLogo.lookAt(0, 8.0, 0);
  gridGroup.add(cssLogo);

  // SCHERMATA DI BENVENUTO (Centro)
  const welcomeEl = document.getElementById('welcomeScreen');
  welcomeEl.style.opacity = 0;
  const cssWelcome = new THREE.CSS3DObject(welcomeEl);
  // Posizionato esattamente al centro verticale e ingrandito
  cssWelcome.position.set(Math.cos(thetaCenter) * panelRadiusCSS, 0.0, Math.sin(thetaCenter) * panelRadiusCSS);
  cssWelcome.scale.set(0.025, 0.025, 0.025);
  cssWelcome.lookAt(0, 0.0, 0);
  gridGroup.add(cssWelcome);

  // 1b) TECH HALO DIETRO IL LOGO (Cerchi concentrici rotanti in stile Animus)
  const haloGroup = new THREE.Group();
  const haloRadius = panelRadiusCSS + 0.05;
  haloGroup.position.set(Math.cos(thetaLogo) * haloRadius, 8.0, Math.sin(thetaLogo) * haloRadius);
  haloGroup.lookAt(0, 8.0, 0);
  gridGroup.add(haloGroup);

  const ringMat = new THREE.LineBasicMaterial({
    color: 0x00ffff,
    transparent: true,
    opacity: 0.35,
    blending: THREE.AdditiveBlending,
    depthWrite: false
  });

  const outerRingPoints = [];
  const outerSegs = 64;
  for (let i = 0; i <= outerSegs; i++) {
    const a = (i / outerSegs) * Math.PI * 2;
    outerRingPoints.push(new THREE.Vector3(Math.cos(a) * 1.5, Math.sin(a) * 1.5, 0));
  }
  const outerRingGeo = new THREE.BufferGeometry().setFromPoints(outerRingPoints);
  outerRing = new THREE.LineLoop(outerRingGeo, ringMat);
  haloGroup.add(outerRing);

  const innerRingGeo = new THREE.BufferGeometry();
  const innerPoints = [];
  const innerSegs = 36;
  const radiusInner = 1.15;
  for (let i = 0; i < innerSegs; i++) {
    if (i % 2 === 0) {
      const a1 = (i / innerSegs) * Math.PI * 2;
      const a2 = ((i + 0.8) / innerSegs) * Math.PI * 2;
      innerPoints.push(new THREE.Vector3(Math.cos(a1) * radiusInner, Math.sin(a1) * radiusInner, 0));
      innerPoints.push(new THREE.Vector3(Math.cos(a2) * radiusInner, Math.sin(a2) * radiusInner, 0));
    }
  }
  innerRingGeo.setFromPoints(innerPoints);
  innerRing = new THREE.LineSegments(innerRingGeo, ringMat);
  haloGroup.add(innerRing);

  const crossMat = new THREE.LineBasicMaterial({ color: 0x00ffff, transparent: true, opacity: 0.25 });
  const crossGeo = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(-0.2, 0, 0), new THREE.Vector3(0.2, 0, 0),
    new THREE.Vector3(0, -0.2, 0), new THREE.Vector3(0, 0.2, 0)
  ]);
  const cross1 = new THREE.LineSegments(crossGeo, crossMat);
  cross1.position.set(-1.5, 0, 0);
  haloGroup.add(cross1);
  const cross2 = new THREE.LineSegments(crossGeo, crossMat);
  cross2.position.set(1.5, 0, 0);
  haloGroup.add(cross2);

  /* ── LINEE BIANCHE ORIZZONTALI SCORREVOLI (ANIMUS DATA SWEEPS) ── */
  sweepMat = new THREE.LineBasicMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 0.35,
    blending: THREE.AdditiveBlending,
    depthWrite: false
  });

  const sweepLength = Math.PI * (25 / 180); // Lunghezza 25 gradi
  const sweepPoints = [];
  const sweepSegs = 16;
  for (let i = 0; i <= sweepSegs; i++) {
    const a = (i / sweepSegs) * sweepLength;
    // Disposti leggermente davanti al vetro (+0.08) per contrasto
    sweepPoints.push(new THREE.Vector3(Math.cos(a) * (gridRadius + 0.08), 0, Math.sin(a) * (gridRadius + 0.08)));
  }

  const topSweep1Geo = new THREE.BufferGeometry().setFromPoints(sweepPoints);
  const topSweep2Geo = new THREE.BufferGeometry().setFromPoints(sweepPoints);
  const bottomSweep1Geo = new THREE.BufferGeometry().setFromPoints(sweepPoints);
  const bottomSweep2Geo = new THREE.BufferGeometry().setFromPoints(sweepPoints);

  topSweep1 = new THREE.Line(topSweep1Geo, sweepMat);
  topSweep1.position.y = glassHeight / 2 - 0.5;
  gridGroup.add(topSweep1);

  topSweep2 = new THREE.Line(topSweep2Geo, sweepMat);
  topSweep2.position.y = glassHeight / 2 - 0.7;
  gridGroup.add(topSweep2);

  bottomSweep1 = new THREE.Line(bottomSweep1Geo, sweepMat);
  bottomSweep1.position.y = -glassHeight / 2 + 0.5;
  gridGroup.add(bottomSweep1);

  bottomSweep2 = new THREE.Line(bottomSweep2Geo, sweepMat);
  bottomSweep2.position.y = -glassHeight / 2 + 0.7;
  gridGroup.add(bottomSweep2);

  // 2) PANNELLO SINISTRO
  const panelL = document.getElementById('panelL');
  const cssObjL = new THREE.CSS3DObject(panelL);
  const thetaL = thetaCenter - spread; 
  cssObjL.position.set(Math.cos(thetaL) * panelRadiusCSS, -1, Math.sin(thetaL) * panelRadiusCSS);
  cssObjL.scale.set(0.035, 0.035, 0.035);
  cssObjL.lookAt(0, -1, 0);
  gridGroup.add(cssObjL);

  // 3) PANNELLO DESTRO
  const panelR = document.getElementById('panelR');
  const cssObjR = new THREE.CSS3DObject(panelR);
  const thetaR = thetaCenter + spread;
  cssObjR.position.set(Math.cos(thetaR) * panelRadiusCSS, -1, Math.sin(thetaR) * panelRadiusCSS);
  cssObjR.scale.set(0.035, 0.035, 0.035);
  cssObjR.lookAt(0, -1, 0);
  gridGroup.add(cssObjR);

  /* ── Piani WebGL invisibili per hit-testing affidabile ──
     Nella scene principale (NON gridGroup) con posizioni world dopo boot.
     gridGroup.position = (0,0,5), rotation.y = 0 dopo boot.
     World pos pannello = local pos + (0,0,5) */
  const panelHitMat = new THREE.MeshBasicMaterial({ visible: false, side: THREE.DoubleSide });
  const panelHitGeo = new THREE.PlaneGeometry(480 * 0.035, 380 * 0.035); /* 16.8 × 13.3 */

  const hitPlaneL = new THREE.Mesh(panelHitGeo, panelHitMat);
  hitPlaneL.position.set(
    Math.cos(thetaL) * panelRadiusCSS,
    -1,
    Math.sin(thetaL) * panelRadiusCSS + 5
  );
  hitPlaneL.lookAt(0, -1, 18); /* guarda verso la camera */
  scene.add(hitPlaneL);

  const hitPlaneR = new THREE.Mesh(panelHitGeo, panelHitMat);
  hitPlaneR.position.set(
    Math.cos(thetaR) * panelRadiusCSS,
    -1,
    Math.sin(thetaR) * panelRadiusCSS + 5
  );
  hitPlaneR.lookAt(0, -1, 18);
  scene.add(hitPlaneR);

  /* Raycaster dedicato ai pannelli — creato una volta sola */
  const panelRaycaster = new THREE.Raycaster();

  /* panelDetail rimosso in quanto non più usato ed era fonte di interferenze al centro dello schermo */

  /* ── PARTICOLARI GEOMETRICI DELL'HUD IN STILE ANIMUS (TOP, BOTTOM, LATI) ── */
  
  // A) RULER TICKS (Piccoli trattini di scala in cima e in fondo al display curvo)
  const rulerTicks = new THREE.Group();
  gridGroup.add(rulerTicks);

  const tickMat = new THREE.LineBasicMaterial({
    color: 0x00ffff,
    transparent: true,
    opacity: 0.22,
    blending: THREE.AdditiveBlending,
    depthWrite: false
  });

  const numTicks = 60;
  const tickYSize = 0.3;
  for (let i = 0; i <= numTicks; i++) {
    const angle = panelArcStart + (i / numTicks) * arcLength;
    const cx = Math.cos(angle) * (gridRadius + 0.05);
    const cz = Math.sin(angle) * (gridRadius + 0.05);

    // Tick in cima (top edge ruler)
    const topTick = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(cx, glassHeight / 2 - 0.2, cz),
        new THREE.Vector3(cx, glassHeight / 2 - 0.2 - tickYSize, cz)
      ]),
      tickMat
    );
    rulerTicks.add(topTick);

    // Tick in fondo (bottom edge ruler)
    const bottomTick = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(cx, -glassHeight / 2 + 0.2, cz),
        new THREE.Vector3(cx, -glassHeight / 2 + 0.2 + tickYSize, cz)
      ]),
      tickMat
    );
    rulerTicks.add(bottomTick);
  }

  // B) STAFFE DI DELIMITAZIONE CORNER (Ai lati estremi del display)
  const bracketMat = new THREE.LineBasicMaterial({
    color: 0x00ffff,
    transparent: true,
    opacity: 0.35,
    blending: THREE.AdditiveBlending,
    depthWrite: false
  });

  for (const angle of [cylThetaStart, cylThetaStart + arcLength]) {
    const isLeft = angle === cylThetaStart;
    const cx = Math.cos(angle) * (gridRadius + 0.05);
    const cz = Math.sin(angle) * (gridRadius + 0.05);

    // Linea verticale laterale di delimitazione
    const vertBracket = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(cx, -glassHeight / 2 + 1.2, cz),
        new THREE.Vector3(cx, glassHeight / 2 - 1.2, cz)
      ]),
      bracketMat
    );
    gridGroup.add(vertBracket);

    // Angoli/Trattini orizzontali che puntano verso l'interno dell'arco
    const dir = isLeft ? 1 : -1;
    const insideAngle = angle + dir * 0.035; // 0.035 radianti all'interno
    const icx = Math.cos(insideAngle) * (gridRadius + 0.05);
    const icz = Math.sin(insideAngle) * (gridRadius + 0.05);

    const topCap = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(cx, glassHeight / 2 - 1.2, cz),
        new THREE.Vector3(icx, glassHeight / 2 - 1.2, icz)
      ]),
      bracketMat
    );
    gridGroup.add(topCap);

    const bottomCap = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(cx, -glassHeight / 2 + 1.2, cz),
        new THREE.Vector3(icx, -glassHeight / 2 + 1.2, icz)
      ]),
      bracketMat
    );
    gridGroup.add(bottomCap);
  }

  // C) BLOCCHI DI MEMORIA IMPILATI (Memory block indicators che pulsano)
  const blockMat = new THREE.MeshBasicMaterial({
    color: 0x00ffff,
    transparent: true,
    opacity: 0.15,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    depthWrite: false
  });

  const blockCount = 6;
  const blockHeight = 0.5;
  const blockWidth = 0.15;
  const blockSpacing = 0.2;

  for (const angle of [cylThetaStart + 0.12, cylThetaStart + arcLength - 0.12]) {
    const cx = Math.cos(angle) * (gridRadius + 0.05);
    const cz = Math.sin(angle) * (gridRadius + 0.05);

    for (let j = 0; j < blockCount; j++) {
      const blockGeo = new THREE.PlaneGeometry(blockWidth, blockHeight);
      const block = new THREE.Mesh(blockGeo, blockMat.clone());
      block.position.set(cx, -glassHeight / 4 + j * (blockHeight + blockSpacing), cz);
      block.lookAt(0, block.position.y, 0);
      block.userData.pulseOffset = Math.random() * Math.PI * 2;
      block.userData.pulseSpeed = 1.2 + Math.random() * 2.0;
      gridGroup.add(block);
      memoryBlocks.push(block);
    }
  }

  /* ══════════════════════════════════════════════
     CURVED HOLOGRAPHIC TIMELINE (scheda destra)
  ══════════════════════════════════════════════ */
  const TL_R = 16;
  const TL_Y = 0;
  // L'arco totale del display va da 135° a 405°(=45°).
  // La camera (FOV 50°) vede solo da ~205° a ~335°: i nodi vengono posizionati
  // in questo intervallo così risultano tutti visibili.
  const TL_ARC_START = Math.PI * (205 / 180);
  const TL_ARC_LEN   = Math.PI * (130 / 180);

  // Tubo spesso (linea olografica) — usa TubeGeometry per avere spessore reale
  (function() {
    const pts = [];
    for (let i = 0; i <= 100; i++) {
      const phi = panelArcStart + (i / 100) * arcLength;
      pts.push(new THREE.Vector3(Math.cos(phi) * TL_R, TL_Y, Math.sin(phi) * TL_R));
    }
    const curve = new THREE.CatmullRomCurve3(pts);
    const tubeGeo = new THREE.TubeGeometry(curve, 200, 0.07, 8, false);
    const tubeMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false });
    tlArcLine = new THREE.Mesh(tubeGeo, tubeMat);
    tlArcLine.visible = false;
    gridGroup.add(tlArcLine);
    const glowGeo = new THREE.TubeGeometry(curve, 200, 0.18, 8, false);
    const glowMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.12, blending: THREE.AdditiveBlending, depthWrite: false });
    const glowMesh = new THREE.Mesh(glowGeo, glowMat);
    glowMesh.visible = false;
    gridGroup.add(glowMesh);
    tlArcLine.userData.glow = glowMesh;
  })();

  // Dati storici per ciascun nodo (5 personaggi AC)
  const tlNodeData = [
    { year: '1500', info: '<b style="color:#00ffff">EPOCA:</b> Rinascimento<br><b style="color:#00ffff">SOGGETTO:</b> Ezio Auditore<br><b style="color:#00ffff">STATO:</b> Sincronizzazione stabile.' },
    { year: '1600', info: '<b style="color:#00ffff">EPOCA:</b> Età d\'Oro della Pirateria<br><b style="color:#00ffff">SOGGETTO:</b> Edward Kenway<br><b style="color:#00ffff">STATO:</b> Condizioni navali attive.' },
    { year: '1700', info: '<b style="color:#00ffff">EPOCA:</b> Rivoluzione Americana<br><b style="color:#00ffff">SOGGETTO:</b> Connor Kenway<br><b style="color:#00ffff">STATO:</b> Frammenti di memoria instabili.' },
    { year: '1800', info: '<b style="color:#00ffff">EPOCA:</b> Rivoluzione Francese<br><b style="color:#00ffff">SOGGETTO:</b> Arno Dorian<br><b style="color:#00ffff">STATO:</b> Anomalie temporali (Helix).' },
    { year: '1900', info: '<b style="color:#00ffff">EPOCA:</b> Rivoluzione Industriale<br><b style="color:#00ffff">SOGGETTO:</b> Jacob Frye<br><b style="color:#00ffff">STATO:</b> Interferenza Templare elevata.' },
  ];

  // Nodi alternati: dispari sopra la linea, pari sotto — per non ammassare le date
  const tlNodeOffsets = [1.6, -1.6, 1.6, -1.6, 1.6];

  // Tick verticali ai 5 nodi (WebGL) — si estendono dalla linea verso il nodo
  tlTickObjs = [];
  for (let s = 0; s < 5; s++) {
    const phi   = TL_ARC_START + (s / 4) * TL_ARC_LEN;
    const cx    = Math.cos(phi) * TL_R, cz = Math.sin(phi) * TL_R;
    const yNode = TL_Y + tlNodeOffsets[s];
    const tk    = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(cx, TL_Y, cz),
        new THREE.Vector3(cx, yNode, cz)
      ]),
      new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending })
    );
    tk.visible = false;
    gridGroup.add(tk);
    tlTickObjs.push(tk);
  }

  // 5 nodi CSS3D alternati sopra/sotto la linea
  tlNodeEls  = [];
  tlNodeCsss = [];
  for (let s = 0; s < 5; s++) {
    const phi   = TL_ARC_START + (s / 4) * TL_ARC_LEN;
    const cx    = Math.cos(phi) * TL_R, cz = Math.sin(phi) * TL_R;
    const yNode = TL_Y + tlNodeOffsets[s];
    const el    = document.createElement('div');
    el.className = 'tl-node-item';
    el.dataset.idx = s;
    el.innerHTML = `<div class="tl-node-dot"></div><div class="tl-node-year">${tlNodeData[s].year}</div>`;
    el.style.opacity = '0';
    el.style.pointerEvents = 'none';
    el.style.zIndex = '1000';
    document.getElementById('hud-container').appendChild(el);
    tlNodeEls.push(el);
    const cssN = new THREE.CSS3DObject(el);
    cssN.position.set(cx, yNode, cz);
    cssN.scale.set(0.018, 0.018, 0.018);
    cssN.lookAt(0, yNode, 0);
    // FIX SAFARI BUG: microscopica rotazione per evitare che il piano sia perfettamente ortogonale
    cssN.rotation.y += 0.001;
    cssN.rotation.x += 0.001;
    gridGroup.add(cssN);
    tlNodeCsss.push(cssN);
  }

  // Testo guida curvo — un CSS3DObject per carattere, disposti ad arco lungo il vetro
  const guideText  = "Seleziona un'epoca per sincronizzarti con un personaggio storico.";
  const GUIDE_R    = 22, GUIDE_Y = 7.5;
  const CHAR_SCALE = 0.018, CHAR_STEP = 0.015;
  // Centro spostato a destra (+0.15) per non sovrapporsi al logo Abstergo a sinistra
  const guideStartPhi = thetaCenter - (guideText.length * CHAR_STEP) / 2;
  tlGuideEl = [];
  guideText.split('').forEach((ch, i) => {
    const el = document.createElement('div');
    el.style.cssText = 'pointer-events:none; color:rgba(255,255,255,0.92); font-size:26px; font-weight:400; letter-spacing:0; text-transform:uppercase; text-shadow:0 0 12px rgba(255,255,255,0.5); white-space:pre; display:inline-block; font-family:Consolas,\'Lucida Console\',monospace;';
    el.style.opacity = '0';
    el.textContent = ch;
    document.getElementById('hud-container').appendChild(el);
    tlGuideEl.push(el);
    const phi = guideStartPhi + i * CHAR_STEP;
    const css = new THREE.CSS3DObject(el);
    css.position.set(Math.cos(phi) * GUIDE_R, GUIDE_Y, Math.sin(phi) * GUIDE_R);
    css.scale.set(CHAR_SCALE, CHAR_SCALE, CHAR_SCALE);
    css.lookAt(0, GUIDE_Y, 0);
    gridGroup.add(css);
  });



  // Mini DNA WebGL sopra/sotto ogni pallino della timeline
  tlDnaGroups = [];
  tlDnaHovers = new Array(5).fill(false);
  for (let s = 0; s < 5; s++) {
    const phi   = TL_ARC_START + (s / 4) * TL_ARC_LEN;
    const cx    = Math.cos(phi) * TL_R, cz = Math.sin(phi) * TL_R;
    const yNode = TL_Y + tlNodeOffsets[s];
    const yDna  = yNode + (tlNodeOffsets[s] > 0 ? 1.2 : -1.2);

    const mg = new THREE.Group();
    mg.position.set(cx, yDna, cz);
    mg.scale.setScalar(1.4);
    // Ruota il DNA in modo che il suo asse segua la tangente del cilindro a quest'angolo
    mg.rotation.y = Math.atan2(-Math.cos(phi), -Math.sin(phi));
    mg.visible = false;

    // Due onde sinusoidali piatte che scorrono (stile schermata analisi Animus)
    const MN = 2, MSEGS = 80, MAMP = 0.18, MH = 2.0, MDEPTH = 0.04;
    const mArr1 = new Float32Array((MSEGS + 1) * 3);
    const mArr2 = new Float32Array((MSEGS + 1) * 3);
    const MRUNGS = MN * 6;
    const mArrR = new Float32Array((MRUNGS + 1) * 6);

    const mGeo1 = new THREE.BufferGeometry(); mGeo1.setAttribute('position', new THREE.BufferAttribute(mArr1, 3));
    const mGeo2 = new THREE.BufferGeometry(); mGeo2.setAttribute('position', new THREE.BufferAttribute(mArr2, 3));
    const mGeoR = new THREE.BufferGeometry(); mGeoR.setAttribute('position', new THREE.BufferAttribute(mArrR, 3));

    mg.add(new THREE.Line(mGeo1, new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false })));
    mg.add(new THREE.Line(mGeo2, new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending, depthWrite: false })));
    mg.add(new THREE.LineSegments(mGeoR, new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false })));

    mg.userData.mArr1 = mArr1; mg.userData.mArr2 = mArr2; mg.userData.mArrR = mArrR;
    mg.userData.mGeo1 = mGeo1; mg.userData.mGeo2 = mGeo2; mg.userData.mGeoR = mGeoR;
    mg.userData.MN = MN; mg.userData.MSEGS = MSEGS; mg.userData.MAMP = MAMP;
    mg.userData.MH = MH; mg.userData.MDEPTH = MDEPTH; mg.userData.MRUNGS = MRUNGS;
    mg.userData.phase = s * 0.8; // Fase iniziale diversa per ogni nodo

    gridGroup.add(mg);
    tlDnaGroups.push(mg);
  }

  /* ══ PERSONAGGI STORICI per epoca ══ */
  const historicalChars = [
    [ /* 1500 - Rinascimento */
      { name: 'Leonardo da Vinci',   dates: '1452–1519', role: 'Artista, scienziato e inventore. Mente universale del Rinascimento.' },
      { name: 'Lorenzo de\' Medici', dates: '1449–1492', role: 'Signore di Firenze, mecenate delle arti, centro del potere politico.' },
      { name: 'Niccolò Machiavelli', dates: '1469–1527', role: 'Filosofo e stratega. Teorico del potere senza compromessi.' },
      { name: 'Michelangelo',         dates: '1475–1564', role: 'Scultore e pittore. Creatore della Cappella Sistina e del David.' },
    ],
    [ /* 1600 - Pirateria */
      { name: 'Barbanera',       dates: '1680–1718', role: 'Il pirata più temuto dei Caraibi. Simbolo del terrore dei mari.' },
      { name: 'Anne Bonny',      dates: '1697–1782', role: 'Piratessa leggendaria. Sfidò le convenzioni di un\'epoca intera.' },
      { name: 'Henry Morgan',    dates: '1635–1688', role: 'Corsaro gallese, poi Governatore della Giamaica. Doppio gioco supremo.' },
      { name: 'Calico Jack',     dates: '1682–1720', role: 'Capitano pirata noto per la sua bandiera e il suo equipaggio.' },
    ],
    [ /* 1700 - Rivoluzione Americana */
      { name: 'George Washington',  dates: '1732–1799', role: 'Generale e primo Presidente degli Stati Uniti d\'America.' },
      { name: 'Benjamin Franklin',  dates: '1706–1790', role: 'Scienziato, diplomatico e Padre Fondatore.' },
      { name: 'Thomas Jefferson',   dates: '1743–1826', role: 'Autore della Dichiarazione di Indipendenza americana.' },
      { name: 'Alexander Hamilton', dates: '1755–1804', role: 'Stratega finanziario, architetto del governo federale.' },
    ],
    [ /* 1800 - Rivoluzione Francese */
      { name: 'Napoleone Bonaparte', dates: '1769–1821', role: 'Generale e Imperatore. Rivoluzionò l\'Europa con armi e leggi.' },
      { name: 'Marie Antoinette',    dates: '1755–1793', role: 'Regina di Francia. Simbolo del potere e della sua caduta.' },
      { name: 'Maximilien Robespierre', dates: '1758–1794', role: 'Architetto del Terrore rivoluzionario. Il volto oscuro degli ideali.' },
      { name: 'Jean-Paul Marat',     dates: '1743–1793', role: 'Giornalista radicale e voce del popolo insorto.' },
    ],
    [ /* 1900 - Rivoluzione Industriale */
      { name: 'Nikola Tesla',   dates: '1856–1943', role: 'Inventore visionario. Padre dell\'elettricità alternata.' },
      { name: 'Karl Marx',      dates: '1818–1883', role: 'Filosofo e teorico. Le sue idee cambiarono il corso della storia.' },
      { name: 'Charles Darwin', dates: '1809–1882', role: 'Naturalista. La teoria dell\'evoluzione scosse le basi del sapere.' },
      { name: 'Queen Victoria', dates: '1819–1901', role: 'Regina dell\'Impero Britannico nel suo massimo splendore.' },
    ],
  ];

  /* ══ VISTA PERSONAGGI — lista a sinistra, descrizione a destra, entrambi sempre visibili ══ */
  let charViewEpoch = -1;
  const charEpochLabels = ['Rinascimento','Età d\'Oro Pirateria','Rivoluzione Americana','Rivoluzione Francese','Rivoluzione Industriale'];

  /* Pannello SINISTRA — nomi personaggi */
  const charListEl = document.createElement('div');
  charListEl.style.cssText = 'opacity:0;transition:opacity .4s ease;pointer-events:none;';
  document.getElementById('hud-container').appendChild(charListEl);
  const charListCss = new THREE.CSS3DObject(charListEl);
  charListCss.scale.setScalar(0.028);
  charListCss.position.set(0, 1000, 0); // Sposta fuori schermo per evitare che il wrapper blocchi il centro
  scene.add(charListCss);

  /* Pannello DESTRA — descrizione personaggio + bottoni */
  const charDetailEl = document.createElement('div');
  charDetailEl.innerHTML = `<div class="sc-panel" style="width:360px;">
    <div class="sc-panel-tag">PROFILO STORICO</div>
    <div class="sc-epoch" id="charName" style="margin-bottom:4px;">Seleziona un personaggio</div>
    <div style="font-size:10px;letter-spacing:.18em;color:rgba(0,255,255,.55);margin-bottom:8px;" id="charDates"></div>
    <div class="sc-divider"></div>
    <div id="charRole" style="color:rgba(200,240,255,.82);font-size:15px;line-height:1.65;margin:8px 0 12px;font-family:Rajdhani,sans-serif;">—</div>
    <div class="sc-actions" id="charActions" style="display:none;">
      <button class="sc-btn-confirm" id="charConfirmBtn">INIZIA ESPERIENZA</button>
    </div>
    <div class="sc-confirm-msg" id="charConfirmMsg" style="display:none">⬡ SINCRONIZZAZIONE AVVIATA</div>
  </div>`;
  charDetailEl.style.cssText = 'opacity:0;transition:opacity .4s ease;pointer-events:none;';
  document.getElementById('hud-container').appendChild(charDetailEl);
  const charDetailCss = new THREE.CSS3DObject(charDetailEl);
  charDetailCss.scale.setScalar(0.028);
  charDetailCss.position.set(0, 1000, 0); // Sposta fuori schermo
  scene.add(charDetailCss);

  document.getElementById('charConfirmBtn').addEventListener('click', () => {
    document.getElementById('charConfirmBtn').disabled = true;
    document.getElementById('charConfirmMsg').style.display = 'block';
    setTimeout(() => hideCharacterView(), 3000);
  });

  function buildCharList(epochIdx) {
    const chars  = historicalChars[epochIdx];
    const label  = charEpochLabels[epochIdx];
    const year   = tlNodeData[epochIdx].year;
    const rows   = chars.map((ch, i) =>
      `<div class="char-row" data-i="${i}" style="
        padding:10px 8px;border-bottom:1px solid rgba(0,255,255,.10);
        cursor:pointer;transition:background .15s,color .15s;border-radius:2px;">
        <div style="font-size:16px;font-weight:700;color:#fff;letter-spacing:.04em;">${ch.name}</div>
        <div style="font-size:9px;letter-spacing:.18em;color:rgba(0,255,255,.5);margin-top:2px;">${ch.dates}</div>
      </div>`
    ).join('');
    charListEl.innerHTML = `<div class="sc-panel" style="width:300px;">
      <div class="sc-panel-tag">PERSONAGGI — ${year}</div>
      <div class="sc-epoch" style="margin-bottom:8px;">${label}</div>
      <div class="sc-divider"></div>
      ${rows}
    </div>`;
    charListEl.querySelectorAll('.char-row').forEach(row => {
      const i = parseInt(row.dataset.i);
      row.addEventListener('mouseenter', () => {
        row.style.background = 'rgba(0,255,255,.06)';
        updateCharDetail(epochIdx, i, false);
      });
      row.addEventListener('mouseleave', () => { row.style.background = ''; });
      row.addEventListener('click', () => updateCharDetail(epochIdx, i, true));
    });
  }

  function updateCharDetail(epochIdx, charIdx, confirm) {
    const ch = historicalChars[epochIdx][charIdx];
    document.getElementById('charName').textContent  = ch.name;
    document.getElementById('charDates').textContent = ch.dates;
    document.getElementById('charRole').textContent  = ch.role;
    document.getElementById('charActions').style.display = confirm ? 'flex' : 'none';
    if (confirm) {
      document.getElementById('charConfirmBtn').disabled = false;
      document.getElementById('charConfirmMsg').style.display = 'none';
    }
  }

  function showCharacterView(epochIdx) {
    charViewEpoch = epochIdx;
    buildCharList(epochIdx);

    const r   = gridRadius - 2.5;
    const margin = 0.32;
    /* phi < thetaCenter → x negativo → sinistra; phi > thetaCenter → x positivo → destra */
    const phiNames = thetaCenter - margin; /* sinistra */
    const phiDesc  = thetaCenter + margin; /* destra  */
    charListCss.position.set(Math.cos(phiNames)*r, 0, Math.sin(phiNames)*r + 5);
    charListCss.lookAt(0, 0, 18);
    charDetailCss.position.set(Math.cos(phiDesc)*r, 0, Math.sin(phiDesc)*r + 5);
    charDetailCss.lookAt(0, 0, 18);

    /* Reset dettaglio */
    document.getElementById('charName').textContent = 'Seleziona un personaggio';
    document.getElementById('charDates').textContent = '';
    document.getElementById('charRole').textContent  = '—';
    document.getElementById('charActions').style.display = 'none';
    document.getElementById('charConfirmMsg').style.display = 'none';

    charListEl.style.opacity   = '1'; charListEl.style.pointerEvents   = 'auto';
    charDetailEl.style.opacity = '1'; charDetailEl.style.pointerEvents = 'auto';
    cssRenderer.domElement.style.pointerEvents = 'auto';
    dnaBackArrow.style.display = 'block';
  }

  function hideCharacterView() {
    charListEl.style.opacity   = '0'; charListEl.style.pointerEvents   = 'none';
    charDetailEl.style.opacity = '0'; charDetailEl.style.pointerEvents = 'none';
    charListCss.position.set(0, 1000, 0);
    charDetailCss.position.set(0, 1000, 0);
    charViewEpoch = -1;
    cssRenderer.domElement.style.pointerEvents = 'none';
    dnaBackArrow.style.display = 'none';
    panelL.classList.remove('hidden-panel');
    panelR.classList.remove('hidden-panel');
  }

  // Click + hover sui nodi
  tlNodeEls.forEach((el, s) => {
    el.addEventListener('mouseenter', () => { tlDnaHovers[s] = true; });
    el.addEventListener('mouseleave', () => { tlDnaHovers[s] = false; });
    el.addEventListener('pointerdown', () => {
      hideTimelineElements(); /* nasconde solo la timeline, NON ripristina i pannelli */
      showCharacterView(s);
    });
  });

  function showTimelineView() {
    panelL.classList.add('hidden-panel');
    panelR.classList.add('hidden-panel');
    tlArcLine.visible = true;
    if (tlArcLine.userData.glow) tlArcLine.userData.glow.visible = true;
    tlTickObjs.forEach(t => { t.visible = true; });
    tlNodeEls.forEach(el => { 
      el.style.opacity = '1'; 
      el.style.pointerEvents = 'auto'; 
      el.style.zIndex = '1000'; 
      if (el.parentElement) el.parentElement.style.zIndex = '1000';
    });
    dnaBackArrow.style.display = 'block';
    tlGuideTimeouts.forEach(t => clearTimeout(t));
    tlGuideTimeouts = [];
    tlGuideEl.forEach((el, i) => {
      el.style.opacity = '0';
      if (el.parentElement) el.parentElement.style.pointerEvents = 'none';
      tlGuideTimeouts.push(setTimeout(() => { el.style.opacity = '1'; }, i * 38));
    });
    tlDnaGroups.forEach(g => { g.visible = true; });
  }

  function hideTimelineElements() {
    tlArcLine.visible = false;
    if (tlArcLine.userData.glow) tlArcLine.userData.glow.visible = false;
    tlTickObjs.forEach(t => { t.visible = false; });
    tlNodeEls.forEach(el => { el.style.opacity = '0'; el.style.pointerEvents = 'none'; el.classList.remove('active'); });
    dnaBackArrow.style.display = 'none';
    tlGuideTimeouts.forEach(t => clearTimeout(t));
    tlGuideTimeouts = [];
    tlGuideEl.forEach(el => { el.style.opacity = '0'; });
    tlDnaGroups.forEach((g, s) => { g.visible = false; tlDnaHovers[s] = false; });
  }
  function hideTimelineView() {
    hideTimelineElements();
    panelL.classList.remove('hidden-panel');
    panelR.classList.remove('hidden-panel');
  }



  // Dichiarazioni anticipate (usate sopra negli IIFE)
  var tlArcLine, tlTickObjs, tlNodeEls, tlNodeCsss, tlDnaGroups, tlDnaHovers, tlGuideEl, tlGuideTimeouts;
  tlGuideTimeouts = [];
  var outerRing, innerRing, animusParticles, animusParticlesMat;
  var topSweep1, topSweep2, bottomSweep1, bottomSweep2, sweepMat;
  var memoryBlocks;

  // HOVER STATES PER INGRANDIMENTO FLUIDO IN 3D
  let hoverL = false;
  let hoverR = false;

  /* hover gestito via raycasting nel loop animate — nessun listener CSS necessario */


  /* ══════════════════════════════════════════════
     DNA 3D MODEL
  ══════════════════════════════════════════════ */
  const DNA_TURNS = 6;
  const DNA_RAD   = 1.1;
  const r_dna     = 18;

  const dnaGroup = new THREE.Group();
  dnaGroup.visible = false;
  gridGroup.add(dnaGroup);

  // Materiali DNA — eliche: glow a 3 strati (core bianco + glow + tinta cyan)
  const matSA  = new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 1.0,  blending: THREE.AdditiveBlending, depthWrite: false });
  const matSB  = new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.45, blending: THREE.AdditiveBlending, depthWrite: false });
  const matSC  = new THREE.LineBasicMaterial({ color: 0x55bbff, transparent: true, opacity: 0.22, blending: THREE.AdditiveBlending, depthWrite: false });
  const matRung = new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.5,  blending: THREE.AdditiveBlending, depthWrite: false });

  // Nodi: sfere compatte bianche luminose
  const matSph1 = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 1.0, blending: THREE.AdditiveBlending, depthWrite: false });
  const matSph2 = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 1.0, blending: THREE.AdditiveBlending, depthWrite: false });

  // Geometrie aggiornabili ogni frame
  const STRAND_SEGS = 200;
  const NUM_RUNGS   = DNA_TURNS * 9;
  const arr1     = new Float32Array((STRAND_SEGS + 1) * 3);
  const arr2     = new Float32Array((STRAND_SEGS + 1) * 3);
  const arrRungs = new Float32Array((NUM_RUNGS  + 1) * 6);

  const geo1 = new THREE.BufferGeometry(); geo1.setAttribute('position', new THREE.BufferAttribute(arr1, 3));
  const geo2 = new THREE.BufferGeometry(); geo2.setAttribute('position', new THREE.BufferAttribute(arr2, 3));
  // 3 layer di glow per elica: core + glow + tinta
  dnaGroup.add(new THREE.Line(geo1, matSA));
  dnaGroup.add(new THREE.Line(geo1, matSB));
  dnaGroup.add(new THREE.Line(geo1, matSC));
  dnaGroup.add(new THREE.Line(geo2, matSA));
  dnaGroup.add(new THREE.Line(geo2, matSB));
  dnaGroup.add(new THREE.Line(geo2, matSC));

  const geoRungs = new THREE.BufferGeometry(); geoRungs.setAttribute('position', new THREE.BufferAttribute(arrRungs, 3));

  // Rungs: cilindro bianco esterno + core cyan sottile = effetto "cavo energetico"
  const rungCylGeo = new THREE.CylinderGeometry(0.028, 0.028, 1, 7, 1);
  const rungCylMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.80, blending: THREE.AdditiveBlending, depthWrite: false });
  const rungCorGeo = new THREE.CylinderGeometry(0.011, 0.011, 1, 6, 1);
  const rungCorMat = new THREE.MeshBasicMaterial({ color: 0x00ffff, transparent: true, opacity: 1.0,  blending: THREE.AdditiveBlending, depthWrite: false });
  const rungCyls = [], rungCors = [];
  for (let i = 0; i <= NUM_RUNGS; i++) {
    const cyl = new THREE.Mesh(rungCylGeo, rungCylMat); dnaGroup.add(cyl); rungCyls.push(cyl);
    const cor = new THREE.Mesh(rungCorGeo, rungCorMat); dnaGroup.add(cor); rungCors.push(cor);
  }

  // Nodi piccoli e nitidi
  const gSph = new THREE.SphereGeometry(0.05, 8, 6);
  const sphArr1 = [], sphArr2 = [];
  for (let i = 0; i <= NUM_RUNGS; i++) {
    const s1 = new THREE.Mesh(gSph, matSph1); dnaGroup.add(s1); sphArr1.push(s1);
    const s2 = new THREE.Mesh(gSph, matSph2); dnaGroup.add(s2); sphArr2.push(s2);
  }

  // 5 geni specifici interattivi (1 per ogni antenato)
  const NUM_SECTIONS = 5;
  const specialGeneIndices = [15, 21, 27, 33, 39];
  const specialGenes = specialGeneIndices.map(i => [sphArr1[i], sphArr2[i]]);

  // Diamo un colore azzurro olografico emettitore ai 5 geni selezionabili per spiccare
  const matSphSpecial = new THREE.MeshBasicMaterial({ color: 0x00ffff, wireframe: false, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false });
  
  // Hitbox invisibili per facilitare la selezione col mouse (calibrata)
  const hitBoxes = [];
  const hitBoxGeo = new THREE.SphereGeometry(0.85, 8, 8);
  const hitBoxMat = new THREE.MeshBasicMaterial({ visible: false });

  const gSphSpecial = new THREE.SphereGeometry(0.065, 16, 12);
  specialGenes.forEach(pair => {
    pair[0].geometry = gSphSpecial;
    pair[1].geometry = gSphSpecial;
    pair[0].material = matSphSpecial;
    pair[1].material = matSphSpecial;

    const hb1 = new THREE.Mesh(hitBoxGeo, hitBoxMat);
    pair[0].add(hb1);
    hitBoxes.push(hb1);

    const hb2 = new THREE.Mesh(hitBoxGeo, hitBoxMat);
    pair[1].add(hb2);
    hitBoxes.push(hb2);
  });

  // Aggiungiamo i 5 reticoli HUD rotanti a forma di diamante per evidenziare i geni
  const reticleArr1 = [], reticleArr2 = [];
  const reticleGeo = new THREE.RingGeometry(0.14, 0.17, 48, 1);
  for (let s = 0; s < NUM_SECTIONS; s++) {
    const rMat1 = new THREE.MeshBasicMaterial({ color: 0x00ffff, side: THREE.DoubleSide, transparent: true, opacity: 0.7, blending: THREE.AdditiveBlending, depthWrite: false });
    const r1 = new THREE.Mesh(reticleGeo, rMat1);
    dnaGroup.add(r1);
    reticleArr1.push(r1);

    const rMat2 = new THREE.MeshBasicMaterial({ color: 0x00ffff, side: THREE.DoubleSide, transparent: true, opacity: 0.7, blending: THREE.AdditiveBlending, depthWrite: false });
    const r2 = new THREE.Mesh(reticleGeo, rMat2);
    dnaGroup.add(r2);
    reticleArr2.push(r2);
  }

  // Flusso particellare olografico sulle eliche (stream di pixel dati)
  const partCount = 80;
  const partGeo1 = new THREE.BufferGeometry();
  const partGeo2 = new THREE.BufferGeometry();
  const arrParts1 = new Float32Array(partCount * 3);
  const arrParts2 = new Float32Array(partCount * 3);
  partGeo1.setAttribute('position', new THREE.BufferAttribute(arrParts1, 3));
  partGeo2.setAttribute('position', new THREE.BufferAttribute(arrParts2, 3));
  
  const partMat = new THREE.PointsMaterial({
    color: 0x00ffff,
    size: 0.16,
    transparent: true,
    opacity: 0.9,
    blending: THREE.AdditiveBlending,
    depthWrite: false
  });
  const partSys1 = new THREE.Points(partGeo1, partMat); dnaGroup.add(partSys1);
  const partSys2 = new THREE.Points(partGeo2, partMat); dnaGroup.add(partSys2);

  // Gabbia di contenimento cilindrica olografica curva
  const cagePts = [];
  const numVerticals = 8;
  const steps = 40;
  for (let i = 0; i < steps; i++) {
    const t1 = i / steps;
    const t2 = (i + 1) / steps;
    const phi1 = panelArcStart + t1 * arcLength;
    const phi2 = panelArcStart + t2 * arcLength;
    
    // Anello superiore
    cagePts.push(new THREE.Vector3(Math.cos(phi1) * r_dna, 1.5, Math.sin(phi1) * r_dna));
    cagePts.push(new THREE.Vector3(Math.cos(phi2) * r_dna, 1.5, Math.sin(phi2) * r_dna));
    
    // Anello inferiore
    cagePts.push(new THREE.Vector3(Math.cos(phi1) * r_dna, -1.5, Math.sin(phi1) * r_dna));
    cagePts.push(new THREE.Vector3(Math.cos(phi2) * r_dna, -1.5, Math.sin(phi2) * r_dna));
  }
  for (let i = 0; i <= numVerticals; i++) {
    const t = i / numVerticals;
    const phi = panelArcStart + t * arcLength;
    const cx = Math.cos(phi) * r_dna, cz = Math.sin(phi) * r_dna;
    // Linee verticali della gabbia
    cagePts.push(new THREE.Vector3(cx, 1.5, cz));
    cagePts.push(new THREE.Vector3(cx, -1.5, cz));
  }
  const cageGeo = new THREE.BufferGeometry().setFromPoints(cagePts);
  const cageMat = new THREE.LineBasicMaterial({ color: 0x00ffff, transparent: true, opacity: 0.12, blending: THREE.AdditiveBlending, depthWrite: false });
  const cageLine = new THREE.LineSegments(cageGeo, cageMat);
  dnaGroup.add(cageLine);

  // Linea di scansione laser olografica (curva che sale e scende)
  const sweepPts = [];
  const dnaSweepSegs = 60;
  for (let i = 0; i <= dnaSweepSegs; i++) {
    const t = i / dnaSweepSegs;
    const phi = panelArcStart + t * arcLength;
    sweepPts.push(new THREE.Vector3(Math.cos(phi) * r_dna, 0, Math.sin(phi) * r_dna));
  }
  const sweepLineGeo = new THREE.BufferGeometry().setFromPoints(sweepPts);
  const matSweepLine = new THREE.LineBasicMaterial({ color: 0x00ffff, transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending, depthWrite: false, linewidth: 3 });
  const sweepLine = new THREE.Line(sweepLineGeo, matSweepLine);
  dnaGroup.add(sweepLine);


  const sectionData = [
    { year: '1500', name: 'Ezio Auditore' },
    { year: '1600', name: 'Edward Kenway' },
    { year: '1700', name: 'Connor Kenway' },
    { year: '1800', name: 'Arno Dorian'   },
    { year: '1900', name: 'Jacob Frye'    },
  ];

  const dnaLabelEls = [];
  for (let s = 0; s < NUM_SECTIONS; s++) {
    // Calcoliamo l'angolo phi esattamente in base all'indice del gene speciale
    const t = specialGeneIndices[s] / NUM_RUNGS;
    const phi = panelArcStart + t * arcLength;
    const el  = document.createElement('div');
    el.className = 'dna-label';
    el.innerHTML = `
      <div class="dna-label-card">
        <div class="dna-label-header">
          <span class="dna-label-dot"></span>
          <span class="dna-label-tag">GENE_0${s+1}</span>
        </div>
        <div class="dna-label-year">${sectionData[s].year}</div>
        <div class="dna-label-status">[ DECODED LINK ]</div>
      </div>
    `;
    el.style.opacity = '0';
    el.style.pointerEvents = 'none';
    document.getElementById('hud-container').appendChild(el);
    dnaLabelEls.push(el);
    const cssLbl = new THREE.CSS3DObject(el);
    // Alterniamo le posizioni: gli indici dispari (s=1 -> 1600, s=3 -> 1800) in basso, gli altri in alto
    const yOffset = (s % 2 === 0) ? (DNA_RAD + 2.0) : -(DNA_RAD + 2.0);
    cssLbl.position.set(Math.cos(phi) * r_dna, yOffset, Math.sin(phi) * r_dna);
    cssLbl.scale.set(0.022, 0.022, 0.022);
    cssLbl.lookAt(0, yOffset, 0);
    gridGroup.add(cssLbl);
  }

  // Raycasting hover sui geni
  const dnaRaycaster   = new THREE.Raycaster();
  const dnaMouse       = new THREE.Vector2();
  const allDnaSpheres  = [...sphArr1, ...sphArr2];
  window.addEventListener('mousemove', e => {
    dnaMouse.x =  (e.clientX / window.innerWidth)  * 2 - 1;
    dnaMouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
  });

  // Aggiorna posizioni con la fase corrente (effetto "spiedo")
  function updateDNA(phase) {
    for (let i = 0; i <= STRAND_SEGS; i++) {
      const t  = i / STRAND_SEGS;
      const phi = panelArcStart + t * arcLength;
      const ha  = t * Math.PI * 2 * DNA_TURNS + phase;
      const cx = Math.cos(phi) * r_dna, cz = Math.sin(phi) * r_dna;
      const vO = Math.sin(ha) * DNA_RAD;
      arr1[i*3]=cx; arr1[i*3+1]=vO;  arr1[i*3+2]=cz;
      arr2[i*3]=cx; arr2[i*3+1]=-vO; arr2[i*3+2]=cz;
    }
    geo1.attributes.position.needsUpdate = true;
    geo2.attributes.position.needsUpdate = true;

    for (let i = 0; i <= NUM_RUNGS; i++) {
      const t  = i / NUM_RUNGS;
      const phi = panelArcStart + t * arcLength;
      const ha  = t * Math.PI * 2 * DNA_TURNS + phase;
      const cx = Math.cos(phi) * r_dna, cz = Math.sin(phi) * r_dna;
      const vO = Math.sin(ha) * DNA_RAD;
      const ri = i * 6;
      arrRungs[ri]=cx; arrRungs[ri+1]=vO;  arrRungs[ri+2]=cz;
      arrRungs[ri+3]=cx; arrRungs[ri+4]=-vO; arrRungs[ri+5]=cz;
      sphArr1[i].position.set(cx, vO,  cz);
      sphArr2[i].position.set(cx, -vO, cz);
      const rungH = Math.max(Math.abs(vO) * 2, 0.01);
      rungCyls[i].position.set(cx, 0, cz);
      rungCyls[i].scale.set(1, rungH, 1);
      rungCors[i].position.set(cx, 0, cz);
      rungCors[i].scale.set(1, rungH, 1);
    }
    geoRungs.attributes.position.needsUpdate = true;

    // Riposiziona i 5 reticoli HUD rotanti esattamente sui 5 geni speciali
    for (let s = 0; s < NUM_SECTIONS; s++) {
      const idx = specialGeneIndices[s];
      reticleArr1[s].position.copy(sphArr1[idx].position);
      reticleArr2[s].position.copy(sphArr2[idx].position);
    }

    // Particelle di dati olografici fluenti lungo i due filamenti dell'elica
    const flowTime = Date.now() * 0.0012;
    for (let i = 0; i < partCount; i++) {
      const t = ((i / partCount) + flowTime) % 1.0;
      const phi = panelArcStart + t * arcLength;
      const ha  = t * Math.PI * 2 * DNA_TURNS + phase;
      const cx = Math.cos(phi) * r_dna, cz = Math.sin(phi) * r_dna;
      const vO = Math.sin(ha) * DNA_RAD;
      
      arrParts1[i * 3] = cx; arrParts1[i * 3 + 1] = vO; arrParts1[i * 3 + 2] = cz;
      arrParts2[i * 3] = cx; arrParts2[i * 3 + 1] = -vO; arrParts2[i * 3 + 2] = cz;
    }
    partGeo1.attributes.position.needsUpdate = true;
    partGeo2.attributes.position.needsUpdate = true;
  }

  let dnaPhase = 0;
  let selectedDnaGene = -1;
  let lastHoveredGene  = -1;
  let blockCanvasClick = false;
  updateDNA(0);

  const dnaBackArrow = document.getElementById('dnaBackArrow');

  // Testo guida curvo per la vista DNA — un CSS3DObject per carattere
  const dnaGuideText = "Seleziona un frammento del tuo DNA per sincronizzarti con l'antenato che ha vissuto in quell'epoca.";
  const DNA_GUIDE_R  = 22, DNA_GUIDE_Y = 7.5;
  const DNA_CHAR_SCALE = 0.018, DNA_CHAR_STEP = 0.015;
  const dnaGuideStartPhi = thetaCenter + 0.2 - (dnaGuideText.length * DNA_CHAR_STEP) / 2;
  const dnaGuideEls = [];
  dnaGuideText.split('').forEach((ch, i) => {
    const el = document.createElement('div');
    el.style.cssText = 'pointer-events:none; color:rgba(255,255,255,0.92); font-size:26px; font-weight:400; letter-spacing:0; text-transform:uppercase; text-shadow:0 0 12px rgba(255,255,255,0.5); white-space:pre; display:inline-block; font-family:Consolas,\'Lucida Console\',monospace;';
    el.style.opacity = '0';
    el.textContent = ch;
    document.getElementById('hud-container').appendChild(el);
    dnaGuideEls.push(el);
    const phi = dnaGuideStartPhi + i * DNA_CHAR_STEP;
    const css = new THREE.CSS3DObject(el);
    css.position.set(Math.cos(phi) * DNA_GUIDE_R, DNA_GUIDE_Y, Math.sin(phi) * DNA_GUIDE_R);
    css.scale.set(DNA_CHAR_SCALE, DNA_CHAR_SCALE, DNA_CHAR_SCALE);
    css.lookAt(0, DNA_GUIDE_Y, 0);
    gridGroup.add(css);
  });
  let dnaGuideTimeouts = [];

  function showDNAView() {
    panelL.classList.add('hidden-panel');
    panelR.classList.add('hidden-panel');
    dnaGroup.visible           = true;
    dnaBackArrow.style.display = 'block';
    dnaLabelEls.forEach(el => { el.style.opacity = '0'; });
    // Materializzazione carattere per carattere
    dnaGuideTimeouts.forEach(t => clearTimeout(t));
    dnaGuideTimeouts = [];
    dnaGuideEls.forEach((el, i) => {
      el.style.opacity = '0';
      dnaGuideTimeouts.push(setTimeout(() => { el.style.opacity = '1'; }, i * 38));
    });
  }

  function hideDNAView() {
    dnaGroup.visible           = false;
    dnaBackArrow.style.display = 'none';
    dnaGuideTimeouts.forEach(t => clearTimeout(t));
    dnaGuideTimeouts = [];
    dnaGuideEls.forEach(el => { el.style.opacity = '0'; });
    dnaLabelEls.forEach(el => { el.style.opacity = '0'; });
    allDnaSpheres.forEach(sp => sp.scale.setScalar(1));
    selectedDnaGene = -1;
    panelL.classList.remove('hidden-panel');
    panelR.classList.remove('hidden-panel');
  }

  // ── SHOWCASE BOOKING CINEMATICO ──
  const geneData = [
    { year: '1500', epoch: 'Rinascimento',
      price: '€ 480', duration: '2 ORE',
      tagline: 'Arte, potere e cospirazioni.',
      desc: 'Un\'epoca di straordinario fervore intellettuale e artistico, in cui le grandi famiglie si contendono il controllo degli stati attraverso alleanze, tradimenti e veleni. Sotto la superficie del rinnovamento culturale, antiche fratellanze segrete muovono le loro pedine per dominare il destino dell\'umanità.' },
    { year: '1600', epoch: "Età d'Oro della Pirateria",
      price: '€ 390', duration: '2 ORE',
      tagline: 'Libertà, rischio e mare aperto.',
      desc: 'Le grandi potenze coloniali si contendono le rotte commerciali mentre uomini e donne fuggono dalle leggi del vecchio mondo per costruirsi un destino sui mari. Un\'epoca di esplorazione senza confini, dove la libertà assoluta ha sempre un prezzo altissimo.' },
    { year: '1700', epoch: 'Rivoluzione Americana',
      price: '€ 430', duration: '2 ORE',
      tagline: 'Indipendenza contro il vecchio ordine.',
      desc: 'Per la prima volta nella storia moderna, un popolo insorge contro un impero e si dà le proprie leggi. Tra ideali illuministi e battaglie sanguinose, si gettano le basi di un nuovo sistema politico mentre forze nell\'ombra cercano di piegare la rivoluzione ai propri scopi.' },
    { year: '1800', epoch: 'Rivoluzione Francese',
      price: '€ 450', duration: '2 ORE',
      tagline: 'Il vecchio mondo crolla sotto i piedi.',
      desc: 'La monarchia cede al furore popolare, le istituzioni millenarie vengono spazzate via nel giro di mesi. È un\'era di trasformazione violenta e radicale, in cui gli ideali di libertà e uguaglianza si scontrano con la brutalità del potere e con chi vuole usare il caos per imporsi sulle macerie.' },
    { year: '1900', epoch: 'Rivoluzione Industriale',
      price: '€ 360', duration: '2 ORE',
      tagline: 'Il progresso trasforma ogni cosa.',
      desc: 'Macchine a vapore, fabbriche fumanti e milioni di persone che abbandonano le campagne per le città. Il mondo si trasforma a una velocità mai vista prima. Mentre la tecnologia promette benessere, le disparità sociali si acuiscono e movimenti operai sfidano chi detiene il controllo sui mezzi di produzione.' },
  ];
  const today = new Date().toISOString().split('T')[0];

  let bookingPhase      = 'idle'; // 'idle'|'extracting'|'showcasing'|'retracting'
  let bookingAnimT      = 0;
  let bookingTargetGene = -1;
  const bookingStartPos  = new THREE.Vector3();
  const bookingCenterPos = new THREE.Vector3(0, 0, 7);
  function easeInOutCubic(t) { return t<0.5?4*t*t*t:1-Math.pow(-2*t+2,3)/2; }

  // Materiali DNA da dissolvere durante l'animazione
  const dnaFadeMats = [
    { mat: matSA,        base: 1.0  }, { mat: matSB,        base: 0.45 },
    { mat: matSC,        base: 0.22 }, { mat: rungCylMat,   base: 0.80 },
    { mat: rungCorMat,   base: 1.0  }, { mat: matSph1,      base: 1.0  },
    { mat: matSph2,      base: 1.0  }, { mat: matSphSpecial, base: 0.9 },
  ];

  // (showcase group rimosso — il gene si evidenzia in place)

  // ── Pannello sinistro: data/orario ──
  const scLeftEl = document.createElement('div');
  scLeftEl.innerHTML = `<div class="sc-panel">
    <div class="sc-panel-tag">ACCESSO GENETICO</div>
    <div class="sc-epoch" id="scEpoch">—</div>
    <div id="scTagline" style="color:rgba(0,220,255,0.75);font-size:18px;font-family:'Rajdhani',sans-serif;letter-spacing:0.06em;margin:4px 0 8px;">—</div>
    <div class="sc-divider"></div>
    <div style="display:flex;gap:24px;">
      <div class="sc-spec-row" style="flex:1;flex-direction:column;align-items:flex-start;gap:2px;">
        <span class="sc-spec-label">Durata</span><span class="sc-spec-value" id="scDuration">—</span>
      </div>
      <div class="sc-spec-row" style="flex:1;flex-direction:column;align-items:flex-start;gap:2px;">
        <span class="sc-spec-label">Costo</span><span class="sc-spec-value sc-price" id="scPrice">—</span>
      </div>
    </div>
    <div class="sc-divider"></div>
    <div style="display:flex;gap:10px;">
      <div class="sc-field" style="flex:1;margin-bottom:0;">
        <label class="sc-label">Data</label>
        <input type="date" id="scDate" class="sc-input" value="${today}" min="${today}">
      </div>
      <div class="sc-field" style="flex:1;margin-bottom:0;">
        <label class="sc-label">Orario</label>
        <select id="scTime" class="sc-input">
          <option>09:00</option><option>10:00</option><option>11:00</option>
          <option>13:00</option><option>14:00</option><option>15:00</option><option>16:00</option>
        </select>
      </div>
    </div>
    <div class="sc-actions" style="margin-top:10px;">
      <button class="sc-btn-confirm" id="scConfirmBtn">PRENOTA</button>
      <button class="sc-btn-cancel"  id="scCancelBtn">CHIUDI</button>
    </div>
    <div class="sc-confirm-msg" id="scConfirmMsg" style="display:none">⬡ PRENOTAZIONE CONFERMATA</div>
  </div>`;
  scLeftEl.style.cssText = 'opacity:0;transition:opacity 0.6s ease;pointer-events:none;';
  document.getElementById('hud-container').appendChild(scLeftEl);
  const scLeftCss = new THREE.CSS3DObject(scLeftEl);
  scLeftCss.position.set(-12, 0, -8);
  scLeftCss.lookAt(0, 0, 18);
  scLeftCss.scale.setScalar(0.028);
  scene.add(scLeftCss);

  // ── Pannello destro: descrizione ambientazione epoca ──
  const scRightEl = document.createElement('div');
  scRightEl.innerHTML = `<div class="sc-panel">
    <div class="sc-panel-tag">AMBIENTAZIONE</div>
    <div class="sc-epoch" id="scEpochRight" style="margin-bottom:14px;">—</div>
    <div class="sc-divider"></div>
    <div id="scDescRight" style="color:rgba(200,240,255,0.88);font-size:24px;line-height:1.75;font-family:'Rajdhani',sans-serif;font-weight:400;letter-spacing:0.02em;">—</div>
  </div>`;
  scRightEl.style.cssText = 'opacity:0;transition:opacity 0.6s ease;pointer-events:none;';
  document.getElementById('hud-container').appendChild(scRightEl);
  const scRightCss = new THREE.CSS3DObject(scRightEl);
  scRightCss.position.set(12, 0, -8);
  scRightCss.lookAt(0, 0, 18);
  scRightCss.scale.setScalar(0.028);
  scene.add(scRightCss);

  function showGeneInfo(s) {
    selectedDnaGene = s;
    canvas.style.pointerEvents = 'none';
    dnaBackArrow.style.pointerEvents = 'none';
    dnaBackArrow.style.opacity = '0.2';
    cssRenderer.domElement.style.pointerEvents = 'auto';
    const g = geneData[s];
    document.getElementById('scEpoch').textContent    = `${g.epoch.toUpperCase()} · ${g.year}`;
    document.getElementById('scTagline').textContent  = g.tagline;
    document.getElementById('scPrice').textContent      = g.price;
    document.getElementById('scDuration').textContent   = g.duration;
    document.getElementById('scEpochRight').textContent = g.epoch.toUpperCase();
    document.getElementById('scDescRight').textContent  = g.desc;
    document.getElementById('scConfirmBtn').disabled    = false;
    document.getElementById('scConfirmMsg').style.display = 'none';
    document.getElementById('scDate').value = today;

    /* Pannelli sulla superficie interna del display curvo.
       Posizionati simmetricamente rispetto al gene, con offset verso il centro
       dell'arco per garantire sempre visibilità ottimale. */
    const t_gene   = specialGeneIndices[s] / NUM_RUNGS;
    const phi_gene = panelArcStart + t_gene * arcLength;
    const r        = gridRadius - 2.5;
    /* ~280px * 0.028 = 7.8u → semi 3.9 → clamp ±(11-3.9-1.1) = ±6 */
    const gY       = Math.max(-6, Math.min(6, sphArr1[specialGeneIndices[s]].position.y));

    /* Calcola quanto il gene è distante dal centro dell'arco (0=centro, 1=bordo) */
    const distFromCenter = (phi_gene - thetaCenter) / (arcLength / 2); /* -1..+1 */
    /* Offset base: pannello sx a phi+, pannello dx a phi- */
    const baseDelta = 0.32;
    /* Per geni al bordo, sposta entrambi i pannelli verso il centro */
    const centerPull = distFromCenter * 0.28;
    const phiLRaw = phi_gene + baseDelta - centerPull;
    const phiRRaw = phi_gene - baseDelta - centerPull;
    /* margin tiene conto della semi-larghezza fisica del pannello a scala 0.028:
       ~380px * 0.028 = 10.6 unità → semiangolo = 10.6/(2*r) ≈ 0.24 rad + safety 0.15 */
    const margin  = 0.55;
    const phiL = Math.min(Math.max(phiLRaw, panelArcStart + margin), panelArcStart + arcLength - margin);
    const phiR = Math.min(Math.max(phiRRaw, panelArcStart + margin), panelArcStart + arcLength - margin);

    scLeftCss.position.set(Math.cos(phiL) * r, gY, Math.sin(phiL) * r + 5);
    scLeftCss.lookAt(0, gY, 18);
    scRightCss.position.set(Math.cos(phiR) * r, gY, Math.sin(phiR) * r + 5);
    scRightCss.lookAt(0, gY, 18);

    scLeftEl.style.opacity  = '1'; scLeftEl.style.pointerEvents  = 'auto';
    scRightEl.style.opacity = '1'; scRightEl.style.pointerEvents = 'auto';
    /* Nascondi solo la scritta guida — il DNA rimane visibile e reattivo all'hover */
    dnaGuideEls.forEach(el => { el.style.opacity = '0'; });
    dnaLabelEls.forEach(el => { el.style.opacity = '0'; el.classList.remove('hovered'); });
  }
  function hideGeneInfo() {
    selectedDnaGene = -1;
    dnaBackArrow.style.pointerEvents = '';
    dnaBackArrow.style.opacity = '';
    cssRenderer.domElement.style.pointerEvents = 'none';
    setTimeout(() => { canvas.style.pointerEvents = ''; }, 120);
    scLeftEl.style.opacity  = '0'; scLeftEl.style.pointerEvents  = 'none';
    scRightEl.style.opacity = '0'; scRightEl.style.pointerEvents = 'none';
    allDnaSpheres.forEach(sp => sp.scale.setScalar(1));
    dnaGuideEls.forEach(el => { el.style.opacity = '1'; });
  }

  document.getElementById('scCancelBtn').addEventListener('click', () => hideGeneInfo());
  document.getElementById('scConfirmBtn').addEventListener('click', () => {
    document.getElementById('scConfirmBtn').disabled = true;
    document.getElementById('scConfirmMsg').style.display = 'block';
    setTimeout(() => hideGeneInfo(), 3500);
  });

  /* ── Click globale su WINDOW — funziona ovunque, anche su CSS3D ── */
  window.addEventListener('click', e => {
    if (blockCanvasClick) return;
    if (selectedDnaGene !== -1) return;

    /* Pannelli principali: raycasting su hitPlane invisibili */
    if (hasBooted && !panelL.classList.contains('hidden-panel')) {
      panelRaycaster.setFromCamera(rawMouse, camera);
      if (panelRaycaster.intersectObject(hitPlaneL).length > 0) { showDNAView(); return; }
      if (panelRaycaster.intersectObject(hitPlaneR).length > 0) { showTimelineView(); return; }
    }

    /* Geni DNA */
    if (dnaGroup.visible && lastHoveredGene !== -1) {
      showGeneInfo(lastHoveredGene);
    }
  });

  // Freccia indietro: gestisce showcase, DNA e timeline
  dnaBackArrow.addEventListener('click', () => {
    if (selectedDnaGene !== -1) {
      hideGeneInfo();
    } else if (charViewEpoch !== -1) {
      /* Se il dettaglio è visibile → torna alla lista; altrimenti chiudi tutto */
      const detailVisible = charDetailEl && charDetailEl.style.opacity === '1'
                            && document.getElementById('charActions').style.display !== 'none';
      if (detailVisible) {
        document.getElementById('charBackBtn').click();
      } else {
        hideCharacterView();
      }
    } else if (tlArcLine && tlArcLine.visible) {
      hideTimelineView();
    } else {
      hideDNAView();
    }
  });

  /* ══════════════════════════════════════════
     RESIZE
  ══════════════════════════════════════════ */
  window.addEventListener('resize', ()=>{
    renderer.setSize(window.innerWidth, window.innerHeight);
    cssRenderer.setSize(window.innerWidth, window.innerHeight);
    camera.aspect = window.innerWidth/window.innerHeight;
    camera.updateProjectionMatrix();
  });

  /* ══════════════════════════════════════════
     ANIMATION LOOP E BOOT SEQUENCE
  ══════════════════════════════════════════ */
  let bootProgress = 0;
  let hasBooted = false;
  let isWelcoming = false;
  let welcomeStartTime = 0;

  // Espone una funzione globale per resettare il boot al termine dell'intro
  // intro.js chiama window._resetBoot() prima di rivelare il progetto
  window._resetBoot = function () {
    bootProgress = 0;
    hasBooted   = false;
    isWelcoming = false;
    welcomeStartTime = 0;
    welcomeEl.style.opacity = '0';
    ledProgress = 0;
    panelProgress = 0;
    logoEl.style.opacity = '0';
    panelL.style.opacity = '0';
    panelR.style.opacity = '0';
    panelL.style.pointerEvents = 'none';
    panelR.style.pointerEvents = 'none';
    gridGroup.rotation.y = Math.PI; // riparte da sinistra completamente fuori campo
  };

  // Impostiamo l'opacità HTML a zero per iniziare e disabilitiamo i click
  logoEl.style.opacity = "0";
  panelL.style.opacity = "0";
  panelR.style.opacity = "0";
  welcomeEl.style.opacity = "0";
  panelL.style.pointerEvents = "none";
  panelR.style.pointerEvents = "none";

  let ledProgress = 0;
  let panelProgress = 0;

  function animate(){
    requestAnimationFrame(animate);

    // --- ANIMUS BOOT ANIMATION E SCHERMATA BENVENUTO ---
    if (bootProgress < 1 || isWelcoming) {
      if (bootProgress < 1) {
        // Non avanza durante l'intro sequence
        if (!window.introIsActive) {
          bootProgress += 0.004;
          if (bootProgress >= 1) {
            bootProgress = 1;
            // Imposta opacità finali dei materiali 3D alla fine della rotazione
            screenGlassMat.opacity = 1;
            bezelMat.opacity = 1;
            gridMatHoriz.opacity = 0.15;
            gridMatVert.opacity = 0.08;
            if (!hasBooted && !isWelcoming) {
              isWelcoming = true;
              welcomeStartTime = Date.now();
              welcomeEl.style.opacity = '1'; // Fade in
            }
          }
        }
      }
      
      if (isWelcoming) {
        const elapsed = Date.now() - welcomeStartTime;
        if (elapsed > 2800) {
          welcomeEl.style.opacity = '0'; // Fade out
        }
        if (elapsed > 3500) {
          isWelcoming = false;
          hasBooted = true;
          eMouse.set(0, 0);
        }
      }
      
      const ease = 1 - Math.pow(1 - bootProgress, 4);
      
      // Rotazione: il display parte da sinistra (fuori campo) verso il centro
      gridGroup.rotation.y = Math.PI * (1 - ease);

      // I materiali 3D sono visibili per tutta la rotazione
      screenGlassMat.opacity = 1;
      bezelMat.opacity = 1;
      gridMatHoriz.opacity = 0.15;
      gridMatVert.opacity = 0.08;
      // Logo e schede restano invisibili durante la rotazione
      logoEl.style.opacity = 0;
      panelL.style.opacity = 0;
      panelR.style.opacity = 0;
    } else if (ledProgress < 1) {
      ledProgress += 0.1; // LED si accendono molto più velocemente
      if (ledProgress >= 1) {
        ledProgress = 1;
        bottomGlowMat.opacity = 0.9;
        topGlowMat.opacity = 0.9;
      } else {
        bottomGlowMat.opacity = 0.9 * ledProgress;
        topGlowMat.opacity = 0.9 * ledProgress;
      }
    }

    // Aggiornamento eMouse solo dopo il boot, così non accumula durante l'animazione
    if (hasBooted) {
      eMouse.x += (rawMouse.x - eMouse.x) * EASE;
      eMouse.y += (rawMouse.y - eMouse.y) * EASE;
    }

    camera.position.set(0, 0, 18);
    if (hasBooted) {
      // Movimento della camera attivo solo dopo il completamento dell'animazione
      camera.lookAt(eMouse.x * 10, eMouse.y * 5, 0);
    } else {
      // Durante il boot la visuale rimane fissa al centro
      camera.lookAt(0, 0, 0);
    }

    /* Raycasting pannelli — usa rawMouse (posizione reale, non smorzata) */
    if (hasBooted && !panelL.classList.contains('hidden-panel')) {
      panelRaycaster.setFromCamera(rawMouse, camera);
      hoverL = panelRaycaster.intersectObject(hitPlaneL).length > 0;
      hoverR = panelRaycaster.intersectObject(hitPlaneR).length > 0;
    } else {
      hoverL = false; hoverR = false;
    }

    const targetScaleL = hoverL ? 0.042 : 0.035;
    cssObjL.scale.lerp(new THREE.Vector3(targetScaleL, targetScaleL, targetScaleL), 0.12);
    panelL.style.borderColor = hoverL ? 'rgba(0,255,255,0.9)' : '';
    panelL.style.boxShadow   = hoverL ? 'inset 0 0 60px rgba(0,255,255,0.25)' : '';

    const targetScaleR = hoverR ? 0.042 : 0.035;
    cssObjR.scale.lerp(new THREE.Vector3(targetScaleR, targetScaleR, targetScaleR), 0.12);
    panelR.style.borderColor = hoverR ? 'rgba(0,255,255,0.9)' : '';
    panelR.style.boxShadow   = hoverR ? 'inset 0 0 60px rgba(0,255,255,0.25)' : '';

    renderer.render(scene, camera);
    cssRenderer.render(scene, camera);

    // ── ANIMAZIONI POST-BOOT ──
    if (hasBooted) {
      const now = Date.now() * 0.001;

      // LED agli endpoint: fade-in rapido, poi fissi
      postLedMats.forEach(m => { m.opacity = Math.min(0.9, m.opacity + 0.02); });

      // Lampeggio LED sul bezel
      blinkLeds.forEach(led => {
        const v = Math.pow(Math.max(0, Math.sin(now * led.userData.blinkSpeed + led.userData.blinkOffset)), 4);
        led.material.opacity = v * 0.95;
      });

      // Dissolvenza particelle Animus post-boot (effetto comparsa)
      if (animusParticlesMat && animusParticlesMat.opacity < 0.65) {
        animusParticlesMat.opacity += 0.005;
      }

      // Animazione delle particelle Animus (salita lenta con oscillazione sinusoidale)
      if (animusParticles) {
        const animPos = animusParticles.geometry.attributes.position.array;
        for (let i = 0; i < animusParticleCount; i++) {
          // Fai salire la particella
          animPos[i * 3 + 1] += animusSpeeds[i].y;
          
          // Oscilla leggermente sull'arco
          animusSpeeds[i].angle += animusSpeeds[i].angleSpeed;
          animPos[i * 3] = Math.cos(animusSpeeds[i].angle) * animusSpeeds[i].radius;
          animPos[i * 3 + 2] = Math.sin(animusSpeeds[i].angle) * animusSpeeds[i].radius;

          // Se esce dal display (sopra), resetta in basso con nuovi valori random
          if (animPos[i * 3 + 1] > glassHeight / 2) {
            animPos[i * 3 + 1] = -glassHeight / 2;
            animusSpeeds[i].angle = panelArcStart + Math.random() * arcLength;
            animusSpeeds[i].radius = gridRadius - 2.0 + Math.random() * 3.0;
          }
        }
        animusParticles.geometry.attributes.position.needsUpdate = true;
      }

      // Rotazione tech rings dietro il logo
      if (outerRing && innerRing) {
        outerRing.rotation.z += 0.003;
        innerRing.rotation.z -= 0.005;
      }

      // Animazione delle linee orizzontali bianche (sweeps)
      if (topSweep1 && topSweep2 && bottomSweep1 && bottomSweep2) {
        // Sopra girano verso destra
        topSweep1.rotation.y += 0.005;
        topSweep2.rotation.y += 0.003;
        
        // Sotto girano verso sinistra
        bottomSweep1.rotation.y -= 0.004;
        bottomSweep2.rotation.y -= 0.0025;

        // Facciamo pulsare impercettibilmente la loro opacità
        if (sweepMat) {
          sweepMat.opacity = 0.3 + 0.15 * Math.sin(now * 3.5);
        }
      }

      // Animazione dei blocchi di memoria Animus
      if (memoryBlocks) {
        memoryBlocks.forEach(block => {
          const pulse = 0.08 + 0.17 * Math.pow(Math.max(0, Math.sin(now * block.userData.pulseSpeed + block.userData.pulseOffset)), 3);
          block.material.opacity = pulse;
        });
      }

      // Onda di scansione verticale sul vetro (ciclo lento)
      scanRing.position.y = Math.sin(now * 0.35) * (glassHeight / 2 - 0.5);
      scanMat.opacity = 0.18 + 0.1 * Math.cos(now * 0.7);

      // Schede e logo: compaiono dopo che i LED sono completamente accesi
      if (ledProgress >= 1 && panelProgress < 1) {
        panelProgress = Math.min(1, panelProgress + 0.06); // Più veloce
        const pe = 1 - Math.pow(1 - panelProgress, 3);
        logoEl.style.opacity = pe;
        panelL.style.opacity = pe;
        panelR.style.opacity = pe;
        // Abilita i click solo quando le schede sono completamente visibili
        if (panelProgress >= 1) {
          panelL.style.pointerEvents = "auto";
          panelR.style.pointerEvents = "auto";
        }
      }

      // Glass activation: il vetro si illumina progressivamente dopo che le schede sono apparse
      if (panelProgress >= 1) {
        glassActivatedMat.opacity = Math.min(0.45, glassActivatedMat.opacity + 0.006);
      }

      // Rotazione DNA "spiedo" + hover sui 5 geni
      if (dnaGroup.visible) {
        /* Se un pannello è aperto, nessun hover sui geni */
        const panelOpen = selectedDnaGene !== -1;
        dnaRaycaster.setFromCamera(dnaMouse, camera);
        const hits = panelOpen ? [] : dnaRaycaster.intersectObjects(hitBoxes);

        let isHoveringDNA = hits.length > 0;
        let hoveredGene = -1;
        lastHoveredGene = -1;
        
        if (isHoveringDNA) {
          const hit = hits[0].object;
          const parentNode = hit.parent; // hitBox è figlio del gene
          for (let s = 0; s < NUM_SECTIONS; s++) {
            if (specialGenes[s].includes(parentNode)) {
              hoveredGene = s;
              lastHoveredGene = s;
              break;
            }
          }
        }
        
        // Aggiorna le etichette: evidenzia gene hovered o gene selezionato dalla timeline
        for (let s = 0; s < NUM_SECTIONS; s++) {
          if (s === hoveredGene || s === selectedDnaGene) {
            dnaLabelEls[s].classList.add('hovered');
            dnaLabelEls[s].style.opacity = '1';
          } else {
            dnaLabelEls[s].classList.remove('hovered');
            dnaLabelEls[s].style.opacity = '0';
          }
        }

        // Il DNA si ferma se c'è un gene selezionato, hovered o in booking
        if (hoveredGene === -1 && selectedDnaGene === -1) {
          dnaPhase += 0.025;
        }
        updateDNA(dnaPhase);

        // Animazione dei nodi nucleotidici (ottaedri wireframe)
        const tempScale = new THREE.Vector3();
        for (let i = 0; i <= NUM_RUNGS; i++) {
          const s = specialGeneIndices.indexOf(i);
          let targetScale = 0.8; // Geni normali più piccoli
          
          if (s !== -1) {
            // È un gene speciale selezionabile: respira a idle
            targetScale = 1.0 + 0.15 * Math.abs(Math.sin(now * 1.8 + s * 0.9));

            if (selectedDnaGene === s) {
              targetScale = 4.5;
            } else if (hoveredGene === s) {
              targetScale = 1.8;
            }
          }
          
          tempScale.set(targetScale, targetScale, targetScale);
          sphArr1[i].scale.lerp(tempScale, 0.15);
          sphArr2[i].scale.lerp(tempScale, 0.15);
        }

        // Pulsazione opacità sfere selezionabili
        matSphSpecial.opacity = 0.7 + 0.25 * Math.abs(Math.sin(now * 1.8));

        // Animazione dei 5 reticoli HUD a diamante (rotazione, scala e pulsazione)
        const tempRScale = new THREE.Vector3();
        for (let s = 0; s < NUM_SECTIONS; s++) {
          const isTarget = (hoveredGene === s || selectedDnaGene === s);

          // Scala reticolo — proporzionale alla sfera, non va oltre 1.8
          const idleRScale = 1.0 + 0.2 * Math.abs(Math.sin(now * 1.8 + s * 0.9));
          const targetRScaleVal = isTarget ? 1.9 : idleRScale;
          tempRScale.set(targetRScaleVal, targetRScaleVal, targetRScaleVal);
          reticleArr1[s].scale.lerp(tempRScale, 0.15);
          reticleArr2[s].scale.lerp(tempRScale, 0.15);

          // Pulsazione opacità
          const idleOpacity = 0.55 + 0.3 * Math.abs(Math.sin(now * 1.8 + s * 0.9));
          const targetOpacity = isTarget ? (0.7 + 0.3 * Math.sin(now * 12.0)) : idleOpacity;
          reticleArr1[s].material.opacity = targetOpacity;
          reticleArr2[s].material.opacity = targetOpacity;

          // Rotazione local Z + billboarding
          const spinSpeed = isTarget ? 4.0 : 1.4;
          const spinAngle = now * spinSpeed;
          reticleArr1[s].quaternion.copy(camera.quaternion).multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), spinAngle));
          reticleArr2[s].quaternion.copy(camera.quaternion).multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), -spinAngle)); // rotazione inversa
        }

        // Animazione scorrimento sweep laser (curva di scansione Y)
        if (sweepLine && matSweepLine) {
          sweepLine.position.y = Math.sin(now * 2.5) * 1.5;
          matSweepLine.opacity = 0.5 + 0.3 * Math.cos(now * 5.0);
        }

        // Effetto glitch/jitter di desincronizzazione Animus su dnaGroup
        if (Math.random() < 0.015) {
          dnaGroup.position.set(
            (Math.random() - 0.5) * 0.25,
            (Math.random() - 0.5) * 0.08,
            (Math.random() - 0.5) * 0.25
          );
        } else {
          dnaGroup.position.lerp(new THREE.Vector3(0, 0, 0), 0.25);
        }
      }

      // (animazione booking rimossa — gene si evidenzia in place)

      // Mini DNA sulla timeline: onde sinusoidali scorrevoli + scala su hover
      if (tlDnaGroups && tlArcLine && tlArcLine.visible) {
        const tV = new THREE.Vector3();
        tlDnaGroups.forEach((g, s) => {
          g.userData.phase = (g.userData.phase || s * 0.8) + 0.04;
          const ph = g.userData.phase;
          const { mArr1, mArr2, mArrR, mGeo1, mGeo2, mGeoR,
                  MN, MSEGS, MAMP, MH, MDEPTH, MRUNGS } = g.userData;

          if (mGeo1) {
            for (let i = 0; i <= MSEGS; i++) {
              const t = i / MSEGS, a = t * Math.PI * 2 * MN + ph;
              const x = (t - 0.5) * MH;
              mArr1[i*3]   = x; mArr1[i*3+1] =  Math.sin(a) * MAMP; mArr1[i*3+2] = Math.cos(a) * MDEPTH;
              mArr2[i*3]   = x; mArr2[i*3+1] = -Math.sin(a) * MAMP; mArr2[i*3+2] = Math.cos(a) * MDEPTH;
            }
            mGeo1.attributes.position.needsUpdate = true;
            mGeo2.attributes.position.needsUpdate = true;

            for (let i = 0; i <= MRUNGS; i++) {
              const t = i / MRUNGS, a = t * Math.PI * 2 * MN + ph;
              const x = (t - 0.5) * MH;
              const ri = i * 6;
              mArrR[ri]   = x; mArrR[ri+1] =  Math.sin(a) * MAMP; mArrR[ri+2] = Math.cos(a) * MDEPTH;
              mArrR[ri+3] = x; mArrR[ri+4] = -Math.sin(a) * MAMP; mArrR[ri+5] = Math.cos(a) * MDEPTH;
            }
            mGeoR.attributes.position.needsUpdate = true;
          }

          const ts = tlDnaHovers[s] ? 2.2 : 1.4;
          tV.set(ts, ts, ts);
          g.scale.lerp(tV, 0.1);
        });
      }

    }   // fine if (hasBooted)
  }     // fine function animate()

  /* Logo ora gestito come SVG inline nell'HTML, processLogo() non più necessario */


  /* ══════════════════════════════════════════
     LOGICA SPA: CAMBIO SCHERMATA
  ══════════════════════════════════════════ */

  function showCardsView() {
    panelL.classList.remove('hidden-panel');
    panelR.classList.remove('hidden-panel');
  }

  /* Click gestito tramite window + raycasting — nessun handler diretto necessario */



  document.getElementById('btn-back').addEventListener('click', () => {
    showCardsView();
  });

  animate();
})();
