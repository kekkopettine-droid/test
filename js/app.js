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
  gridGroup.rotation.y = -Math.PI * 1.5; // Parte da destra, fuori campo
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

  // 4) PANNELLO DETTAGLIO
  const panelDetail = document.getElementById('panelDetail');
  const cssObjDetail = new THREE.CSS3DObject(panelDetail);
  // Spostato alla sua posizione originale
  cssObjDetail.position.set(Math.cos(thetaCenter) * panelRadiusCSS, -1, Math.sin(thetaCenter) * panelRadiusCSS);
  cssObjDetail.scale.set(0.035, 0.035, 0.035);
  cssObjDetail.lookAt(0, -1, 0);
  gridGroup.add(cssObjDetail);

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
  const tlNodeOffsets = [2.8, -2.8, 2.8, -2.8, 2.8];

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
    document.getElementById('hud-container').appendChild(el);
    tlNodeEls.push(el);
    const cssN = new THREE.CSS3DObject(el);
    cssN.position.set(cx, yNode, cz);
    cssN.scale.set(0.018, 0.018, 0.018);
    cssN.lookAt(0, yNode, 0);
    gridGroup.add(cssN);
    tlNodeCsss.push(cssN);
  }

  // Info box CSS3D (centro display)
  tlInfoEl = document.createElement('div');
  tlInfoEl.style.cssText = 'text-align:center;min-width:650px;pointer-events:none;';
  tlInfoEl.style.opacity = '0';
  document.getElementById('hud-container').appendChild(tlInfoEl);
  const tlInfoCss = new THREE.CSS3DObject(tlInfoEl);
  tlInfoCss.position.set(Math.cos(thetaCenter) * TL_R, TL_Y - 3.5, Math.sin(thetaCenter) * TL_R);
  tlInfoCss.scale.set(0.012, 0.012, 0.012);
  tlInfoCss.lookAt(0, TL_Y - 3.5, 0);
  gridGroup.add(tlInfoCss);

  // Bottone indietro CSS3D
  tlBackEl = document.createElement('div');
  tlBackEl.className = 'btn-back';
  tlBackEl.textContent = 'INDIETRO';
  tlBackEl.style.opacity = '0';
  tlBackEl.style.pointerEvents = 'none';
  document.getElementById('hud-container').appendChild(tlBackEl);
  const tlBackCss = new THREE.CSS3DObject(tlBackEl);
  tlBackCss.position.set(Math.cos(thetaCenter) * TL_R, TL_Y - 6.0, Math.sin(thetaCenter) * TL_R);
  tlBackCss.scale.set(0.016, 0.016, 0.016);
  tlBackCss.lookAt(0, TL_Y - 6.0, 0);
  gridGroup.add(tlBackCss);

  // Mini DNA WebGL sopra/sotto ogni pallino della timeline
  tlDnaGroups = [];
  tlDnaHovers = new Array(5).fill(false);
  for (let s = 0; s < 5; s++) {
    const phi   = TL_ARC_START + (s / 4) * TL_ARC_LEN;
    const cx    = Math.cos(phi) * TL_R, cz = Math.sin(phi) * TL_R;
    const yNode = TL_Y + tlNodeOffsets[s];
    const yDna  = yNode + (tlNodeOffsets[s] > 0 ? 1.8 : -1.8);

    const mg = new THREE.Group();
    mg.position.set(cx, yDna, cz);
    mg.scale.setScalar(2.0);
    mg.visible = false;

    // Elica orizzontale ispirata al modello Animus: curve ciano/bianco ad alto contrasto
    const MTURNS = 3, MSEGS = 120, MRAD = 0.4, MH = 2.2;
    const mPts1 = [], mPts2 = [], mRungPts = [];
    for (let i = 0; i <= MSEGS; i++) {
      const t = i / MSEGS, a = t * Math.PI * 2 * MTURNS;
      const x = (t - 0.5) * MH;
      mPts1.push(new THREE.Vector3(x,  Math.cos(a) * MRAD, Math.sin(a) * MRAD * 0.3));
      mPts2.push(new THREE.Vector3(x, -Math.cos(a) * MRAD, Math.sin(a) * MRAD * 0.3));
    }
    const MRINGS = MTURNS * 7;
    for (let i = 0; i <= MRINGS; i++) {
      const t = i / MRINGS, a = t * Math.PI * 2 * MTURNS;
      const x = (t - 0.5) * MH;
      mRungPts.push(new THREE.Vector3(x,  Math.cos(a) * MRAD, Math.sin(a) * MRAD * 0.3));
      mRungPts.push(new THREE.Vector3(x, -Math.cos(a) * MRAD, Math.sin(a) * MRAD * 0.3));
    }

    // Materiali olografici
    const mMat1 = new THREE.LineBasicMaterial({ color: 0x00ffff, transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false });
    const mMat2 = new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false });
    const mRMat = new THREE.LineBasicMaterial({ color: 0x00ffff, transparent: true, opacity: 0.50, blending: THREE.AdditiveBlending, depthWrite: false });

    mg.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(mPts1), mMat1));
    mg.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(mPts2), mMat2));
    mg.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(mRungPts), mRMat));

    // Aggiungiamo microscopici ottaedri wireframe lungo i filamenti (nodi nucleotidici olografici)
    const minioctGeo = new THREE.OctahedronGeometry(0.045, 0);
    const minioctMat = new THREE.MeshBasicMaterial({ color: 0xffffff, wireframe: true, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false });
    
    // Mettiamo 8 nodi su ciascuna catena a distanze regolari
    const numNodes = 8;
    for (let n = 0; n <= numNodes; n++) {
      const idx = Math.floor((n / numNodes) * MSEGS);
      
      const s1 = new THREE.Mesh(minioctGeo, minioctMat);
      s1.position.copy(mPts1[idx]);
      mg.add(s1);

      const s2 = new THREE.Mesh(minioctGeo, minioctMat);
      s2.position.copy(mPts2[idx]);
      mg.add(s2);
    }

    // Bounding box olegrafico (faint scanner box)
    const boxGeo = new THREE.BoxGeometry(2.4, 1.0, 0.5);
    const boxMat = new THREE.MeshBasicMaterial({ color: 0x00ffff, wireframe: true, transparent: true, opacity: 0.12, blending: THREE.AdditiveBlending, depthWrite: false });
    const scannerBox = new THREE.Mesh(boxGeo, boxMat);
    mg.add(scannerBox);
    mg.userData.scannerBox = scannerBox;

    gridGroup.add(mg);
    tlDnaGroups.push(mg);
  }

  // Click + hover sui nodi
  tlNodeEls.forEach((el, s) => {
    el.addEventListener('mouseenter', () => { tlDnaHovers[s] = true; });
    el.addEventListener('mouseleave', () => { tlDnaHovers[s] = false; });
    el.addEventListener('click', () => {
      hideTimelineView();
      selectedDnaGene = s;
      showDNAView();
    });
  });

  function showTimelineView() {
    panelL.classList.add('hidden-panel');
    panelR.classList.add('hidden-panel');
    tlArcLine.visible = true;
    if (tlArcLine.userData.glow) tlArcLine.userData.glow.visible = true;
    tlTickObjs.forEach(t => { t.visible = true; });
    tlNodeEls.forEach(el => { el.style.opacity = '1'; el.style.pointerEvents = 'auto'; });
    tlInfoEl.style.opacity = '1';
    tlInfoEl.innerHTML = '<div style="color:rgba(140,215,255,0.65);font-size:20px;letter-spacing:0.12em;text-transform:uppercase">Seleziona un frammento di memoria</div>';
    tlBackEl.style.opacity = '1';
    tlBackEl.style.pointerEvents = 'auto';
    tlDnaGroups.forEach(g => { g.visible = true; });
  }

  function hideTimelineView() {
    tlArcLine.visible = false;
    if (tlArcLine.userData.glow) tlArcLine.userData.glow.visible = false;
    tlTickObjs.forEach(t => { t.visible = false; });
    tlNodeEls.forEach(el => { el.style.opacity = '0'; el.style.pointerEvents = 'none'; el.classList.remove('active'); });
    tlInfoEl.style.opacity = '0';
    tlBackEl.style.opacity = '0';
    tlBackEl.style.pointerEvents = 'none';
    tlDnaGroups.forEach((g, s) => { g.visible = false; tlDnaHovers[s] = false; });
    panelL.classList.remove('hidden-panel');
    panelR.classList.remove('hidden-panel');
  }

  tlBackEl.addEventListener('click', () => hideTimelineView());

  // Dichiarazioni anticipate (usate sopra negli IIFE)
  var tlArcLine, tlTickObjs, tlNodeEls, tlNodeCsss, tlInfoEl, tlBackEl, tlDnaGroups, tlDnaHovers;
  var outerRing, innerRing, animusParticles, animusParticlesMat;
  var topSweep1, topSweep2, bottomSweep1, bottomSweep2, sweepMat;
  var memoryBlocks;

  // HOVER STATES PER INGRANDIMENTO FLUIDO IN 3D
  let hoverL = false;
  let hoverR = false;

  panelL.addEventListener('mouseenter', () => hoverL = true);
  panelL.addEventListener('mouseleave', () => hoverL = false);

  panelR.addEventListener('mouseenter', () => hoverR = true);
  panelR.addEventListener('mouseleave', () => hoverR = false);


  /* ══════════════════════════════════════════════
     DNA 3D MODEL
  ══════════════════════════════════════════════ */
  const DNA_TURNS = 6;
  const DNA_RAD   = 1.1;
  const r_dna     = 18;

  const dnaGroup = new THREE.Group();
  dnaGroup.visible = false;
  gridGroup.add(dnaGroup);

  // Materiali DNA olografici
  const matStrand1     = new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.90, blending: THREE.AdditiveBlending, depthWrite: false, linewidth: 2 });
  const matStrand1Glow = new THREE.LineBasicMaterial({ color: 0x00ffff, transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false, linewidth: 5 });
  const matStrand2     = new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.90, blending: THREE.AdditiveBlending, depthWrite: false, linewidth: 2 });
  const matStrand2Glow = new THREE.LineBasicMaterial({ color: 0x00ffff, transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false, linewidth: 5 });
  const matRung        = new THREE.LineBasicMaterial({ color: 0x00ffff, transparent: true, opacity: 0.50, blending: THREE.AdditiveBlending, depthWrite: false });
  
  // Ottaedri wireframe bianchi per i nodi standard (stile pixel/data vettoriale)
  const matSph1        = new THREE.MeshBasicMaterial({ color: 0xffffff, wireframe: true, transparent: true, opacity: 0.70, blending: THREE.AdditiveBlending, depthWrite: false });
  const matSph2        = new THREE.MeshBasicMaterial({ color: 0xffffff, wireframe: true, transparent: true, opacity: 0.70, blending: THREE.AdditiveBlending, depthWrite: false });

  // Geometrie aggiornabili ogni frame
  const STRAND_SEGS = 200;
  const NUM_RUNGS   = DNA_TURNS * 9;
  const arr1     = new Float32Array((STRAND_SEGS + 1) * 3);
  const arr2     = new Float32Array((STRAND_SEGS + 1) * 3);
  const arrRungs = new Float32Array((NUM_RUNGS  + 1) * 6);

  const geo1 = new THREE.BufferGeometry(); geo1.setAttribute('position', new THREE.BufferAttribute(arr1, 3));
  const geo2 = new THREE.BufferGeometry(); geo2.setAttribute('position', new THREE.BufferAttribute(arr2, 3));
  dnaGroup.add(new THREE.Line(geo1, matStrand1));
  dnaGroup.add(new THREE.Line(geo1, matStrand1Glow));
  dnaGroup.add(new THREE.Line(geo2, matStrand2));
  dnaGroup.add(new THREE.Line(geo2, matStrand2Glow));

  const geoRungs = new THREE.BufferGeometry(); geoRungs.setAttribute('position', new THREE.BufferAttribute(arrRungs, 3));
  dnaGroup.add(new THREE.LineSegments(geoRungs, matRung));

  // Ottaedri olografici (diamanti pixelati al posto di sfere biologiche pesanti)
  const gSph = new THREE.OctahedronGeometry(0.08, 0);
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
  const matSphSpecial = new THREE.MeshBasicMaterial({ color: 0x00ffff, wireframe: false, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false });
  
  // Hitbox invisibili per facilitare la selezione col mouse (calibrata)
  const hitBoxes = [];
  const hitBoxGeo = new THREE.SphereGeometry(0.85, 8, 8);
  const hitBoxMat = new THREE.MeshBasicMaterial({ visible: false });

  specialGenes.forEach(pair => {
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
  const reticleGeo = new THREE.RingGeometry(0.24, 0.28, 4, 1);
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
  let selectedDnaGene = -1; // -1 = nessuno; 0-4 = sezione selezionata dalla timeline
  updateDNA(0);

  const dnaBackArrow = document.getElementById('dnaBackArrow');
  const dnaInstructions = document.getElementById('dnaInstructions');

  function showDNAView() {
    panelL.classList.add('hidden-panel');
    panelR.classList.add('hidden-panel');
    dnaGroup.visible           = true;
    dnaBackArrow.style.display = 'block';
    dnaInstructions.style.display = 'block';
    dnaLabelEls.forEach(el => { 
      el.style.opacity = ''; // Rimuovi inline
      el.classList.add('visible'); 
    });
  }

  function hideDNAView() {
    dnaGroup.visible           = false;
    dnaBackArrow.style.display = 'none';
    dnaInstructions.style.display = 'none';
    dnaLabelEls.forEach(el => { 
      el.classList.remove('visible'); 
    });
    allDnaSpheres.forEach(sp => sp.scale.setScalar(1));
    selectedDnaGene = -1;
    panelL.classList.remove('hidden-panel');
    panelR.classList.remove('hidden-panel');
  }

  // Se il DNA è stato aperto dalla timeline, freccia indietro → torna alla timeline
  dnaBackArrow.addEventListener('click', () => {
    if (selectedDnaGene !== -1) {
      hideDNAView();
      showTimelineView();
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

  // Impostiamo l'opacità HTML a zero per iniziare e disabilitiamo i click
  logoEl.style.opacity = "0";
  panelL.style.opacity = "0";
  panelR.style.opacity = "0";
  panelL.style.pointerEvents = "none";
  panelR.style.pointerEvents = "none";

  let ledProgress = 0;
  let panelProgress = 0;

  function animate(){
    requestAnimationFrame(animate);

    // --- ANIMUS BOOT ANIMATION: rotazione pura, nessuna dissolvenza ---
    if (bootProgress < 1) {
      bootProgress += 0.004; // Velocità aumentata
      if (bootProgress >= 1) {
        bootProgress = 1;
        // Imposta opacità finali dei materiali 3D alla fine della rotazione
        screenGlassMat.opacity = 1;
        bezelMat.opacity = 1;
        gridMatHoriz.opacity = 0.15;
        gridMatVert.opacity = 0.08;
        if (!hasBooted) {
          hasBooted = true;
          eMouse.set(0, 0);
        }
      }
      
      const ease = 1 - Math.pow(1 - bootProgress, 4);
      
      // Rotazione pura: il display gira da destra verso il centro
      gridGroup.rotation.y = (-Math.PI * 1.5) * (1 - ease);

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

    // Animazione fluida dell'ingrandimento in 3D
    const targetScaleL = hoverL ? 0.037 : 0.035;
    cssObjL.scale.lerp(new THREE.Vector3(targetScaleL, targetScaleL, targetScaleL), 0.15);

    const targetScaleR = hoverR ? 0.037 : 0.035;
    cssObjR.scale.lerp(new THREE.Vector3(targetScaleR, targetScaleR, targetScaleR), 0.15);

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
        dnaRaycaster.setFromCamera(dnaMouse, camera);
        const hits = dnaRaycaster.intersectObjects(hitBoxes);
        
        let isHoveringDNA = hits.length > 0;
        let hoveredGene = -1;
        
        if (isHoveringDNA) {
          const hit = hits[0].object;
          const parentNode = hit.parent; // hitBox è figlio del gene
          for (let s = 0; s < NUM_SECTIONS; s++) {
            if (specialGenes[s].includes(parentNode)) {
              hoveredGene = s;
              break;
            }
          }
        }
        
        // Aggiorna le etichette: evidenzia gene hovered o gene selezionato dalla timeline
        for (let s = 0; s < NUM_SECTIONS; s++) {
          if (s === hoveredGene || s === selectedDnaGene) {
            dnaLabelEls[s].classList.add('hovered');
          } else {
            dnaLabelEls[s].classList.remove('hovered');
          }
        }

        // Il DNA si ferma se c'è un gene selezionato o in hover
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
            // È un gene speciale selezionabile (spicca dal resto)
            targetScale = 1.4;
            
            // Ingrandimento moderato se ci passo il cursore o lo seleziono
            if (hoveredGene === s || selectedDnaGene === s) {
               targetScale = 2.4;
            }
          }
          
          tempScale.set(targetScale, targetScale, targetScale);
          sphArr1[i].scale.lerp(tempScale, 0.15);
          sphArr2[i].scale.lerp(tempScale, 0.15);
        }

        // Animazione dei 5 reticoli HUD a diamante (rotazione, scala e pulsazione)
        const tempRScale = new THREE.Vector3();
        for (let s = 0; s < NUM_SECTIONS; s++) {
          const isTarget = (hoveredGene === s || selectedDnaGene === s);
          
          // Scala
          const targetRScaleVal = isTarget ? 2.2 : 1.0;
          tempRScale.set(targetRScaleVal, targetRScaleVal, targetRScaleVal);
          reticleArr1[s].scale.lerp(tempRScale, 0.15);
          reticleArr2[s].scale.lerp(tempRScale, 0.15);

          // Pulsazione opacità
          const targetOpacity = isTarget ? (0.6 + 0.4 * Math.sin(now * 12.0)) : 0.4;
          reticleArr1[s].material.opacity = targetOpacity;
          reticleArr2[s].material.opacity = targetOpacity;

          // Rotazione local Z + billboarding
          const spinSpeed = isTarget ? 4.0 : 0.8;
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

      // Mini DNA sulla timeline: rotazione continua + ingrandimento su hover
      if (tlDnaGroups && tlArcLine && tlArcLine.visible) {
        const tV = new THREE.Vector3();
        tlDnaGroups.forEach((g, s) => {
          g.rotation.x += 0.008;
          const ts = tlDnaHovers[s] ? 4.0 : 2.0;
          tV.set(ts, ts, ts);
          g.scale.lerp(tV, 0.1);

          // Animazione bounding box olegrafico
          if (g.userData.scannerBox) {
            const baseOpacity = tlDnaHovers[s] ? 0.45 : 0.12;
            const baseScale = tlDnaHovers[s] ? 1.12 : 1.0;
            // Pulsazione sinusoidale delicata
            const pulse = baseOpacity + 0.06 * Math.sin(now * 5.0);
            g.userData.scannerBox.material.opacity = pulse;
            g.userData.scannerBox.scale.setScalar(baseScale);
            // Rotazione lieve inversa per scompigliare
            g.userData.scannerBox.rotation.y = now * 0.05;
          }
        });
      }

    }   // fine if (hasBooted)
  }     // fine function animate()

  /* Logo ora gestito come SVG inline nell'HTML, processLogo() non più necessario */


  /* ══════════════════════════════════════════
     LOGICA SPA: CAMBIO SCHERMATA
  ══════════════════════════════════════════ */
  function showDetailView(title, content) {
    panelL.classList.add('hidden-panel');
    panelR.classList.add('hidden-panel');
    
    document.getElementById('detail-title').innerHTML = title;
    document.getElementById('detail-content').innerHTML = content;
    
    panelDetail.classList.remove('hidden-panel');
  }

  function showCardsView() {
    panelDetail.classList.add('hidden-panel');
    
    panelL.classList.remove('hidden-panel');
    panelR.classList.remove('hidden-panel');
  }

  panelL.addEventListener('click', () => {
    showDNAView();
  });

  panelR.addEventListener('click', () => { showTimelineView(); });

  document.getElementById('btn-back-floating').addEventListener('click', () => { hideTimelineView(); });

  document.getElementById('btn-back').addEventListener('click', () => {
    showCardsView();
  });

  animate();
})();
