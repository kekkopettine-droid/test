(function () {
  'use strict';

  var memoryBlocks = [];

  /* ══════════════════════════════════════════════
     RENDERER & SCENE
  ══════════════════════════════════════════════ */
  const canvas   = document.getElementById('threeCanvas');

  /* Creazione resiliente del renderer WebGL: se intro.js occupa ancora
     l'unico contesto disponibile, aspettiamo il segnale di rilascio. */
  let renderer;
  function createRenderer() {
    try {
      return new THREE.WebGLRenderer({
        canvas,
        antialias: true,
        alpha: false,
        powerPreference: 'high-performance',
        failIfMajorPerformanceCaveat: false
      });
    } catch (e) {
      return null;
    }
  }

  function initRenderer(r) {
    r.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    r.setSize(window.innerWidth, window.innerHeight);
    r.setClearColor(0x1a1a1a, 1);
  }

  renderer = createRenderer();
  if (renderer) {
    initRenderer(renderer);
  } else if (window.introIsActive) {
    /* L'intro sta usando il contesto WebGL — aspettiamo il suo rilascio
       invece di creare contesti in loop (che causa errori). */
    console.info('[Animus] In attesa che intro.js rilasci il contesto WebGL...');
    let retryCount = 0;
    const MAX_RETRIES = 50;

    function tryCreateAfterRelease() {
      renderer = createRenderer();
      if (renderer) {
        initRenderer(renderer);
        return;
      }
      retryCount++;
      if (retryCount < MAX_RETRIES) {
        setTimeout(tryCreateAfterRelease, 300);
      } else {
        console.error('[Animus] Impossibile creare il contesto WebGL dopo ' + MAX_RETRIES + ' tentativi.');
      }
    }

    window.addEventListener('introContextReleased', function onRelease() {
      window.removeEventListener('introContextReleased', onRelease);
      /* Piccolo ritardo per dare tempo al browser di riciclare il contesto */
      setTimeout(tryCreateAfterRelease, 100);
    });
  } else {
    console.error('[Animus] WebGL non disponibile su questo dispositivo.');
  }

  /* Gestione perdita/ripristino contesto WebGL */
  canvas.addEventListener('webglcontextlost', (e) => {
    e.preventDefault();
    console.warn('[Animus] WebGL context perso, in attesa di ripristino...');
  });
  canvas.addEventListener('webglcontextrestored', () => {
    console.info('[Animus] WebGL context ripristinato.');
    if (renderer) {
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      renderer.setSize(window.innerWidth, window.innerHeight);
      renderer.setClearColor(0x1a1a1a, 1);
    }
  });

  const cssRenderer = new THREE.CSS3DRenderer();
  cssRenderer.setSize(window.innerWidth, window.innerHeight);
  cssRenderer.domElement.style.position = 'fixed';
  cssRenderer.domElement.style.top = '0';
  cssRenderer.domElement.style.left = '0';
  cssRenderer.domElement.style.zIndex = '5';
  cssRenderer.domElement.style.pointerEvents = 'auto';
  document.body.appendChild(cssRenderer.domElement);

  /* Quando i pannelli gene sono aperti, qualsiasi click sul cssRenderer chiude —
     il CSS3D hit-testing è inaffidabile per elementi inclinati in prospettiva */
  cssRenderer.domElement.addEventListener('click', (e) => {
    // Se il click origina dall'interno di un pannello interattivo, non chiudere
    if (e.target.closest('.sc-panel') || e.target.closest('.char-detail-panel') ||
        e.target.closest('.cart-panel') || e.target.closest('.payment-panel') ||
        e.target.closest('.cart-btn') || e.target.closest('.tl-node-item') ||
        e.target.closest('.char-row') || e.target.closest('.dna-back-arrow') ||
        e.target.closest('.timeline-node') || e.target.closest('.btn-return-animus')) {
      return;
    }
    
    /* Chiude i pannelli gene se aperti (tranne PRENOTA) */
    if (typeof selectedDnaGene !== 'undefined' && selectedDnaGene !== -1) {
      const id = e.target && e.target.id;
      if (id === 'scConfirmBtn') return;
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
  // gridGroup.add(cssObjL); // Hide completely

  // 3) PANNELLO DESTRO
  const panelR = document.getElementById('panelR');
  const cssObjR = new THREE.CSS3DObject(panelR);
  const thetaR = thetaCenter;
  cssObjR.position.set(Math.cos(thetaR) * panelRadiusCSS, -1, Math.sin(thetaR) * panelRadiusCSS);
  cssObjR.scale.set(0.035, 0.035, 0.035);
  cssObjR.lookAt(0, -1, 0);
  gridGroup.add(cssObjR);

  // PANNELLO INTRODUTTIVO CENTRALE
  const introTextEl = document.getElementById('introTextPanel');
  introTextEl.style.opacity = '0';
  const cssIntroText = new THREE.CSS3DObject(introTextEl);
  cssIntroText.position.set(Math.cos(thetaCenter) * panelRadiusCSS, -1, Math.sin(thetaCenter) * panelRadiusCSS);
  cssIntroText.scale.set(0.035, 0.035, 0.035);
  cssIntroText.lookAt(0, -1, 0);
  gridGroup.add(cssIntroText);

  document.getElementById('btnExploreExperiences').addEventListener('click', (e) => {
    e.stopPropagation();
    if (window.audioEngine) window.audioEngine.playClick();
    
    // Fade out intro
    introTextEl.style.transition = "opacity 0.5s ease";
    introTextEl.style.opacity = '0';
    introTextEl.style.pointerEvents = 'none';

    setTimeout(() => {
      window.experiencesRevealed = true;
      
      // PRELOAD: precarica il video
      const cinVid = document.getElementById('cinematicVideo');
      if (cinVid && cinVid.preload !== 'auto') {
        cinVid.preload = 'auto';
        cinVid.load(); // Forza il caricamento
      }

      // Fade in panels
      panelL.style.transition = "opacity 0.5s ease";
      panelR.style.transition = "opacity 0.5s ease";
      cartBtnEl.style.transition = "opacity 0.5s ease";
      
      panelL.style.opacity = '1';
      panelR.style.opacity = '1';
      cartBtnEl.style.opacity = '1';

      panelL.style.pointerEvents = "auto";
      panelR.style.pointerEvents = "auto";
      cartBtnEl.style.pointerEvents = "auto";
    }, 500);
  });

  const exBackBtn = document.getElementById('experiencesBackArrow');
  if (exBackBtn) {
    exBackBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (window.audioEngine) window.audioEngine.playClick();
      
      const panelL = document.getElementById('panelL');
      const panelR = document.getElementById('panelR');
      const cartBtnEl = document.getElementById('cartButton');
      
      if (panelL) {
        panelL.style.opacity = '0';
        panelL.style.pointerEvents = "none";
      }
      if (panelR) {
        panelR.style.opacity = '0';
        panelR.style.pointerEvents = "none";
      }
      if (cartBtnEl) {
        cartBtnEl.style.opacity = '0';
        cartBtnEl.style.pointerEvents = "none";
      }
      
      window.experiencesRevealed = false;
      
      if (introTextEl) {
        introTextEl.style.opacity = '1';
        introTextEl.style.pointerEvents = 'auto';
      }
    });
  }

  // 4) CARRELLO CSS3D (Button and Panel)
  const cartBtnEl = document.getElementById('cartButton');
  cartBtnEl.style.opacity = '0';
  cartBtnEl.style.pointerEvents = 'none';
  const cssCartBtn = new THREE.CSS3DObject(cartBtnEl);
  const thetaCartBtn = thetaCenter + 1.0;
  cssCartBtn.position.set(Math.cos(thetaCartBtn) * panelRadiusCSS, 8.0, Math.sin(thetaCartBtn) * panelRadiusCSS);
  cssCartBtn.scale.set(0.035, 0.035, 0.035);
  cssCartBtn.lookAt(0, 8.0, 0);
  gridGroup.add(cssCartBtn);

  const ticketBtnEl = document.getElementById('ticketButton');
  if (ticketBtnEl) {
    ticketBtnEl.style.opacity = '0';
    ticketBtnEl.style.pointerEvents = 'none';
    window.cssTicketBtn = new THREE.CSS3DObject(ticketBtnEl);
    const thetaTicketBtn = thetaCenter + 1.15;
    window.cssTicketBtn.position.set(Math.cos(thetaTicketBtn) * panelRadiusCSS, 8.0, Math.sin(thetaTicketBtn) * panelRadiusCSS);
    window.cssTicketBtn.scale.set(0.035, 0.035, 0.035);
    window.cssTicketBtn.lookAt(0, 8.0, 0);
    gridGroup.add(window.cssTicketBtn);

    ticketBtnEl.addEventListener('click', (e) => {
      e.stopPropagation();
      if (window.audioEngine) window.audioEngine.playClick();
      if (typeof showTicketsView === 'function') {
        showTicketsView();
      }
    });
  }

  const cartPanelEl = document.getElementById('cartPanel');
  const cssCartPanel = new THREE.CSS3DObject(cartPanelEl);
  cssCartPanel.position.set(Math.cos(thetaCartBtn) * panelRadiusCSS, 1.5, Math.sin(thetaCartBtn) * panelRadiusCSS);
  cssCartPanel.scale.set(0.035, 0.035, 0.035);
  cssCartPanel.lookAt(0, 1.5, 0);
  gridGroup.add(cssCartPanel);

  const ticketsPanelEl = document.getElementById('ticketsPanel');
  let cssTicketsPanel = null;
  if (ticketsPanelEl) {
    cssTicketsPanel = new THREE.CSS3DObject(ticketsPanelEl);
    cssTicketsPanel.position.set(Math.cos(thetaCartBtn) * panelRadiusCSS, 1.5, Math.sin(thetaCartBtn) * panelRadiusCSS);
    cssTicketsPanel.scale.set(0.035, 0.035, 0.035);
    cssTicketsPanel.lookAt(0, 1.5, 0);
    gridGroup.add(cssTicketsPanel);
  }

  /* ── Piani WebGL invisibili per hit-testing affidabile ──
     Nella scene principale (NON gridGroup) con posizioni world dopo boot.
     gridGroup.position = (0,0,5), rotation.y = 0 dopo boot.
     World pos pannello = local pos + (0,0,5) */
  const panelHitMat = new THREE.MeshBasicMaterial({ visible: false, side: THREE.DoubleSide });
  const panelHitGeo = new THREE.PlaneGeometry(480 * 0.035, 380 * 0.035); /* 16.8 × 13.3 */

  const hitPlaneL = new THREE.Mesh(panelHitGeo, panelHitMat);
  hitPlaneL.position.set(
    0,
    -10000,
    0
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

  const cartHitGeo = new THREE.PlaneGeometry(160 * 0.035, 160 * 0.035);
  const hitPlaneCart = new THREE.Mesh(cartHitGeo, panelHitMat);
  hitPlaneCart.position.set(
    Math.cos(thetaCartBtn) * panelRadiusCSS,
    8.0,
    Math.sin(thetaCartBtn) * panelRadiusCSS + 5
  );
  // Orientato verso la camera (z=18), come hitPlaneL/hitPlaneR — fix click mancati
  hitPlaneCart.lookAt(0, 8.0, 18);
  scene.add(hitPlaneCart);

  const hitPlaneTicket = new THREE.Mesh(cartHitGeo, panelHitMat);
  const thetaTicketBtn = thetaCenter + 1.15;
  hitPlaneTicket.position.set(
    Math.cos(thetaTicketBtn) * panelRadiusCSS,
    8.0,
    Math.sin(thetaTicketBtn) * panelRadiusCSS + 5
  );
  hitPlaneTicket.lookAt(0, 8.0, 18);
  scene.add(hitPlaneTicket);

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

  // Linea timeline — particelle stile DNA (ciano, breathing, scanner)
  (function() {
    // Soft circular texture (come pTex, ma creata localmente)
    const tlTC = document.createElement('canvas');
    tlTC.width = tlTC.height = 32;
    const tlTCx = tlTC.getContext('2d');
    const tlTGr = tlTCx.createRadialGradient(16,16,0, 16,16,16);
    tlTGr.addColorStop(0,   'rgba(255,255,255,1)');
    tlTGr.addColorStop(0.4, 'rgba(255,255,255,0.8)');
    tlTGr.addColorStop(1,   'rgba(255,255,255,0)');
    tlTCx.fillStyle = tlTGr;
    tlTCx.beginPath(); tlTCx.arc(16,16,16,0,Math.PI*2); tlTCx.fill();
    const tlTex = new THREE.CanvasTexture(tlTC);

    const TL_LINE_PTS = 700;
    const tlPos = new Float32Array(TL_LINE_PTS * 3);
    const tlOff = new Float32Array(TL_LINE_PTS);
    const tlT   = new Float32Array(TL_LINE_PTS);
    for (let i = 0; i < TL_LINE_PTS; i++) {
      const t   = i / (TL_LINE_PTS - 1);
      const phi = panelArcStart + t * arcLength;
      tlPos[i*3]   = Math.cos(phi) * TL_R;
      tlPos[i*3+1] = TL_Y;
      tlPos[i*3+2] = Math.sin(phi) * TL_R;
      tlOff[i] = Math.random() * Math.PI * 2;
      tlT[i]   = t;
    }
    const tlLineGeo = new THREE.BufferGeometry();
    tlLineGeo.setAttribute('position', new THREE.BufferAttribute(tlPos, 3));
    tlLineGeo.setAttribute('aOffset',  new THREE.BufferAttribute(tlOff, 1));

    const tlVS = `
      uniform float uTime;
      attribute float aOffset;
      varying float vAlpha;
      varying vec3  vColor;
      void main() {
        float breath = sin(uTime * 2.5 + aOffset) * 0.5 + 0.5;
        float size   = 2.8 + breath * 1.2;
        vec3 pos = position;
        if (fract(aOffset * 17.31) > 0.97)
          pos.y += sin(uTime * 9.0 + aOffset * 4.0) * 0.05;
        vColor = vec3(0.05, 0.91, 0.80);
        vAlpha = 0.55 + breath * 0.35;
        vec4 mvPos = modelViewMatrix * vec4(pos, 1.0);
        gl_Position  = projectionMatrix * mvPos;
        gl_PointSize = size * (38.0 / -mvPos.z);
      }
    `;
    const tlFS = `
      uniform sampler2D uTex;
      varying float vAlpha;
      varying vec3  vColor;
      void main() {
        vec4 tex = texture2D(uTex, gl_PointCoord);
        if (tex.a < 0.01) discard;
        gl_FragColor = vec4(vColor * tex.rgb, tex.a * vAlpha);
      }
    `;
    const tlLineMat = new THREE.ShaderMaterial({
      uniforms: { uTime: { value: 0 }, uTex: { value: tlTex } },
      vertexShader: tlVS, fragmentShader: tlFS,
      blending: THREE.AdditiveBlending, depthWrite: false, transparent: true,
    });
    tlArcLine = new THREE.Points(tlLineGeo, tlLineMat);
    tlArcLine.visible = false;
    gridGroup.add(tlArcLine);

    tlArcLine.userData.lineMat = tlLineMat;
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

    // Doppia elica stile particelle — stesso look del DNA principale
    const MN = 2, MSEGS = 80, MAMP = 0.18, MH = 2.0, MDEPTH = 0.04;
    const mArr1 = new Float32Array((MSEGS + 1) * 3);
    const mArr2 = new Float32Array((MSEGS + 1) * 3);
    const MRUNGS = MN * 9; /* più aste per densità */
    const mArrR = new Float32Array((MRUNGS + 1) * 6);

    /* Particelle sui filamenti */
    const MPTS = 160;
    const mPts = new Float32Array(MPTS * 3);
    const mPtsGeo = new THREE.BufferGeometry();
    mPtsGeo.setAttribute('position', new THREE.BufferAttribute(mPts, 3));
    const mPtsMat = new THREE.PointsMaterial({ color: 0x00e8cc, size: 0.055, sizeAttenuation: true, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false });
    mg.add(new THREE.Points(mPtsGeo, mPtsMat));

    /* Anellini luminosi sui geni (pochi punti più grandi) */
    const MRINGS = 12;
    const mRingPts = new Float32Array(MRINGS * 3);
    const mRingGeo = new THREE.BufferGeometry();
    mRingGeo.setAttribute('position', new THREE.BufferAttribute(mRingPts, 3));
    const mRingMat = new THREE.PointsMaterial({ color: 0xffffff, size: 0.11, sizeAttenuation: true, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false });
    mg.add(new THREE.Points(mRingGeo, mRingMat));

    const mGeo1 = new THREE.BufferGeometry(); mGeo1.setAttribute('position', new THREE.BufferAttribute(mArr1, 3));
    const mGeo2 = new THREE.BufferGeometry(); mGeo2.setAttribute('position', new THREE.BufferAttribute(mArr2, 3));
    const mGeoR = new THREE.BufferGeometry(); mGeoR.setAttribute('position', new THREE.BufferAttribute(mArrR, 3));

    mg.add(new THREE.Line(mGeo1, new THREE.LineBasicMaterial({ color: 0x00e8cc, transparent: true, opacity: 0.45, blending: THREE.AdditiveBlending, depthWrite: false })));
    mg.add(new THREE.Line(mGeo2, new THREE.LineBasicMaterial({ color: 0x00e8cc, transparent: true, opacity: 0.40, blending: THREE.AdditiveBlending, depthWrite: false })));
    mg.add(new THREE.LineSegments(mGeoR, new THREE.LineBasicMaterial({ color: 0x00d4bb, transparent: true, opacity: 0.30, blending: THREE.AdditiveBlending, depthWrite: false })));

    mg.userData.mArr1 = mArr1; mg.userData.mArr2 = mArr2; mg.userData.mArrR = mArrR;
    mg.userData.mGeo1 = mGeo1; mg.userData.mGeo2 = mGeo2; mg.userData.mGeoR = mGeoR;
    mg.userData.mPts = mPts; mg.userData.mPtsGeo = mPtsGeo;
    mg.userData.mRingPts = mRingPts; mg.userData.mRingGeo = mRingGeo;
    mg.userData.MN = MN; mg.userData.MSEGS = MSEGS; mg.userData.MAMP = MAMP;
    mg.userData.MH = MH; mg.userData.MDEPTH = MDEPTH; mg.userData.MRUNGS = MRUNGS;
    mg.userData.MPTS = MPTS; mg.userData.MRINGS = MRINGS;
    mg.userData.phase = s * 0.8; // Fase iniziale diversa per ogni nodo

    gridGroup.add(mg);
    tlDnaGroups.push(mg);
  }

  /* ══ PERSONAGGI STORICI per epoca ══ */
  const historicalChars = [
    [ /* 1500 - Rinascimento */
      { name: 'Leonardo da Vinci',   dates: '1452–1519', role: 'Artista, scienziato e inventore. Mente universale del Rinascimento.' },
      { name: 'Lorenzo de\' Medici', dates: '1449–1492', role: 'Signore di Firenze, mecenate delle arti, centro del potere politico.' },
      { name: 'Michelangelo',         dates: '1475–1564', role: 'Scultore e pittore. Creatore della Cappella Sistina e del David.' },
    ],
    [ /* 1600 - Pirateria */
      { name: 'Barbanera',       dates: '1680–1718', role: 'Il pirata più temuto dei Caraibi. Simbolo del terrore dei mari.' },
      { name: 'Anne Bonny',      dates: '1697–1782', role: 'Piratessa leggendaria. Sfidò le convenzioni di un\'epoca intera.' },
      { name: 'Henry Morgan',    dates: '1635–1688', role: 'Corsaro gallese, poi Governatore della Giamaica. Doppio gioco supremo.' },
    ],
    [ /* 1700 - Rivoluzione Americana */
      { name: 'George Washington',  dates: '1732–1799', role: 'Generale e primo Presidente degli Stati Uniti d\'America.' },
      { name: 'Benjamin Franklin',  dates: '1706–1790', role: 'Scienziato, diplomatico e Padre Fondatore.' },
      { name: 'Thomas Jefferson',   dates: '1743–1826', role: 'Autore della Dichiarazione di Indipendenza americana.' },
    ],
    [ /* 1800 - Rivoluzione Francese */
      { name: 'Napoleone Bonaparte', dates: '1769–1821', role: 'Generale e Imperatore. Rivoluzionò l\'Europa con armi e leggi.' },
      { name: 'Marie Antoinette',    dates: '1755–1793', role: 'Regina di Francia. Simbolo del potere assoluto e della sua caduta.' },
      { name: 'Maximilien Robespierre', dates: '1758–1794', role: 'Architetto del Terrore rivoluzionario. Il volto oscuro degli ideali.' },
    ],
    [ /* 1900 - Rivoluzione Industriale */
      { name: 'Nikola Tesla',   dates: '1856–1943', role: 'Inventore visionario. Padre dell\'elettricità alternata.' },
      { name: 'Charles Darwin', dates: '1809–1882', role: 'Naturalista. La teoria dell\'evoluzione scosse le basi del sapere.' },
      { name: 'Thomas Edison',  dates: '1847–1931', role: 'Inventore e imprenditore. Pioniere dell\'era elettrica.' },
    ],
  ];

  /* ══ VISTA PERSONAGGI — lista a sinistra, descrizione a destra, entrambi sempre visibili ══ */
  let charViewEpoch = -1;
  let selectedCharIdx = -1;
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
  charDetailEl.innerHTML = `<div class="sc-panel" style="width:360px; position:relative;">
    <button id="charCloseBtn" class="payment-close" style="position: absolute; right: 10px; top: 10px; z-index: 1000; cursor: pointer; pointer-events: auto; background: transparent; border: none; font-size: 28px; color: #0ff; line-height: 1; padding: 5px;">&times;</button>
    <div class="sc-panel-tag">PROFILO STORICO</div>
    <div class="sc-epoch" id="charName" style="margin-bottom:4px;">Seleziona un personaggio</div>
    <div style="font-size:10px;letter-spacing:.18em;color:rgba(0,255,255,.55);margin-bottom:8px;" id="charDates"></div>
    <div class="sc-divider"></div>
    <div id="charRole" style="color:rgba(200,240,255,.82);font-size:15px;line-height:1.65;margin:8px 0 12px;font-family:Rajdhani,sans-serif;">—</div>
    <div class="sc-actions" id="charActions" style="display:none;">
      <button class="sc-btn-confirm" id="charConfirmBtn">INIZIA ESPERIENZA</button>
    </div>
    <div class="sc-confirm-msg" id="charConfirmMsg" style="display:none">⬡ ESPERIENZA AGGIUNTA AL CARRELLO</div>
  </div>`;
  charDetailEl.style.cssText = 'opacity:0;transition:opacity .4s ease;pointer-events:none;';
  document.getElementById('hud-container').appendChild(charDetailEl);
  const charDetailCss = new THREE.CSS3DObject(charDetailEl);
  charDetailCss.scale.setScalar(0.028);
  charDetailCss.position.set(0, 1000, 0); // Sposta fuori schermo
  scene.add(charDetailCss);

  let charConfirmTimeout = null;
  document.getElementById('charConfirmBtn').addEventListener('click', () => {
    if (window.audioEngine) window.audioEngine.playClick();
    document.getElementById('charConfirmBtn').disabled = true;
    document.getElementById('charConfirmMsg').style.display = 'block';
    
    // Add item to cart
    if (charViewEpoch !== -1 && selectedCharIdx !== -1) {
      const ch = historicalChars[charViewEpoch][selectedCharIdx];
      const charName = ch.name;
      const charRole = ch.role;
      cartItems.push({
        title: charName,
        date: 'Personaggio Storico',
        time: charRole.split(' - ')[0] || 'N/D',
        price: '€ 120'
      });
      if (window.updateCartUI) window.updateCartUI();
    }
  });

  document.getElementById('charCloseBtn').addEventListener('click', (e) => {
    e.stopPropagation();
    if (window.audioEngine) window.audioEngine.playClick();
    hideCharacterView(true);
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
        if (window.audioEngine) window.audioEngine.playHover();
        if (selectedCharIdx !== i) row.style.background = 'rgba(0,255,255,.06)';
        updateCharDetail(epochIdx, i, false);
      });
      row.addEventListener('mouseleave', () => { 
        if (selectedCharIdx !== i) {
          row.style.background = ''; 
          if (selectedCharIdx !== -1) {
            updateCharDetail(epochIdx, selectedCharIdx, true);
          } else {
            document.getElementById('charName').textContent = 'Seleziona un personaggio';
            document.getElementById('charDates').textContent = '';
            document.getElementById('charRole').textContent  = '—';
            document.getElementById('charActions').style.display = 'none';
          }
        }
      });
      row.addEventListener('click', () => {
        if (window.audioEngine) window.audioEngine.playClick();
        selectedCharIdx = i;
        charListEl.querySelectorAll('.char-row').forEach(r => {
          r.style.background = '';
        });
        row.style.background = 'rgba(0,255,255,.15)';
        updateCharDetail(epochIdx, i, true);
      });
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
    selectedCharIdx = -1;
    document.getElementById('charName').textContent = 'Seleziona un personaggio';
    document.getElementById('charDates').textContent = '';
    document.getElementById('charRole').textContent  = '—';
    document.getElementById('charActions').style.display = 'none';
    document.getElementById('charConfirmMsg').style.display = 'none';

    charListEl.style.opacity   = '1'; charListEl.style.pointerEvents   = 'auto';
    charDetailEl.style.opacity = '1'; charDetailEl.style.pointerEvents = 'auto';
    dnaBackArrow.style.display = 'block';
  }

  function hideCharacterView(returnToTimeline = true) {
    if (charConfirmTimeout) {
      clearTimeout(charConfirmTimeout);
      charConfirmTimeout = null;
    }
    charListEl.style.opacity   = '0'; charListEl.style.pointerEvents   = 'none';
    charDetailEl.style.opacity = '0'; charDetailEl.style.pointerEvents = 'none';
    charListCss.position.set(0, 1000, 0);
    charDetailCss.position.set(0, 1000, 0);
    charViewEpoch = -1;
    if (returnToTimeline) showTimelineView();
  }

  // Click + hover sui nodi
  tlNodeEls.forEach((el, s) => {
    el.addEventListener('mouseenter', () => { 
      if (window.audioEngine) window.audioEngine.playHover();
      tlDnaHovers[s] = true; 
    });
    el.addEventListener('mouseleave', () => { tlDnaHovers[s] = false; });
    el.addEventListener('pointerdown', () => {
      if (window.audioEngine) window.audioEngine.playClick();
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
    tlNodeEls.forEach((el, s) => { 
      el.style.opacity = '1'; 
      el.style.pointerEvents = 'auto'; 
      el.style.zIndex = '1000'; 
      if (el.parentElement) el.parentElement.style.zIndex = '1000';
      if (tlNodeCsss && tlNodeCsss[s]) {
        tlNodeCsss[s].position.y = TL_Y + tlNodeOffsets[s];
      }
    });
    dnaBackArrow.style.display = 'block';
    tlGuideTimeouts.forEach(t => clearTimeout(t));
    tlGuideTimeouts.forEach(t => clearTimeout(t));
    tlGuideTimeouts = [];
    tlGuideEl.forEach((el, i) => {
      el.style.opacity = '0';
      if (el.parentElement) el.parentElement.style.pointerEvents = 'none';
      tlGuideTimeouts.push(setTimeout(() => { el.style.opacity = '1'; }, i * 38));
    });
    tlDnaGroups.forEach(g => { g.visible = true; });
    
    // --- NASCONDI DISPLAY 3D E MOSTRA VIDEO IN LOOP ---
    const canvas = document.getElementById('threeCanvas');
    if (canvas) {
      canvas.style.transition = 'none'; // Nascondi istantaneamente per evitare flash visivi
      canvas.style.opacity = '0';
    }
    
    const bgContainer = document.getElementById('timelineBgContainer');
    const bgVideo = document.getElementById('timelineBgVideo');
    if (bgContainer && bgVideo) {
      bgContainer.classList.remove('hidden');
      bgVideo.play().catch(e => console.warn('Bg video play error', e));
    }
  }

  function hideTimelineElements() {
    tlArcLine.visible = false;
    if (tlArcLine.userData.glow) tlArcLine.userData.glow.visible = false;
    tlTickObjs.forEach(t => { t.visible = false; });
    tlNodeEls.forEach((el, s) => { 
      el.style.opacity = '0'; 
      el.style.pointerEvents = 'none'; 
      el.classList.remove('active'); 
      if (tlNodeCsss && tlNodeCsss[s]) {
        tlNodeCsss[s].position.y = 1000;
      }
    });
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
    
    // --- RIPRISTINA DISPLAY 3D E NASCONDI IL VIDEO DI SFONDO ---
    const overlay = document.getElementById('cinematicOverlay');
    if (overlay) {
      overlay.classList.add('hidden');
    }
    
    const bgContainer = document.getElementById('timelineBgContainer');
    const bgVideo = document.getElementById('timelineBgVideo');
    if (bgContainer && bgVideo) {
      bgContainer.classList.add('hidden');
      bgVideo.pause();
    }
    
    const canvas = document.getElementById('threeCanvas');
    if (canvas) {
      canvas.style.transition = 'opacity 0.8s ease'; // Ripristina il fade morbido
      canvas.style.opacity = '1';
    }
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

  // ── PLEXUS BACKGROUND NETWORK ──
  const plexusGroup = new THREE.Group();
  dnaGroup.add(plexusGroup);

  const PLEXUS_NODES = 150;
  const plexusPts = new Float32Array(PLEXUS_NODES * 3);
  const plexusVel = [];
  for (let i = 0; i < PLEXUS_NODES; i++) {
    const angle = panelArcStart + Math.random() * arcLength;
    const radius = r_dna - 3 + Math.random() * 6;
    const y = (Math.random() - 0.5) * 14;
    plexusPts[i*3]   = Math.cos(angle) * radius;
    plexusPts[i*3+1] = y;
    plexusPts[i*3+2] = Math.sin(angle) * radius;
    plexusVel.push(new THREE.Vector3(
      (Math.random() - 0.5) * 0.008,
      (Math.random() - 0.5) * 0.008,
      (Math.random() - 0.5) * 0.008
    ));
  }
  const plexusGeo = new THREE.BufferGeometry();
  plexusGeo.setAttribute('position', new THREE.BufferAttribute(plexusPts, 3));

  // Soft circular texture for particles and plexus nodes
  const pCanvas = document.createElement('canvas');
  pCanvas.width = 64; pCanvas.height = 64;
  const pCtx = pCanvas.getContext('2d');
  const pGrad = pCtx.createRadialGradient(32, 32, 0, 32, 32, 32);
  pGrad.addColorStop(0, 'rgba(255,255,255,1)');
  pGrad.addColorStop(0.15, 'rgba(200,255,255,0.9)');
  pGrad.addColorStop(0.4, 'rgba(0,200,200,0.3)');
  pGrad.addColorStop(1, 'rgba(0,0,0,0)');
  pCtx.fillStyle = pGrad;
  pCtx.fillRect(0, 0, 64, 64);
  const pTex = new THREE.CanvasTexture(pCanvas);

  // Ring texture for "anellini" particles
  const ringCanvas = document.createElement('canvas');
  ringCanvas.width = 64; ringCanvas.height = 64;
  const ringCtx = ringCanvas.getContext('2d');
  ringCtx.clearRect(0, 0, 64, 64);
  ringCtx.beginPath();
  ringCtx.arc(32, 32, 24, 0, Math.PI * 2);
  ringCtx.lineWidth = 4;
  ringCtx.strokeStyle = 'rgba(0,255,240,0.9)';
  ringCtx.shadowColor = 'rgba(0,255,240,0.6)';
  ringCtx.shadowBlur = 8;
  ringCtx.stroke();
  const ringTex = new THREE.CanvasTexture(ringCanvas);

  const plexusNodeMat = new THREE.PointsMaterial({
    map: pTex, color: 0x00ddcc, size: 0.25, transparent: true, opacity: 0.7,
    blending: THREE.AdditiveBlending, depthWrite: false, sizeAttenuation: true
  });
  const plexusNodes = new THREE.Points(plexusGeo, plexusNodeMat);
  plexusGroup.add(plexusNodes);

  const MAX_PLEXUS_LINES = PLEXUS_NODES * 10;
  const plexusLineGeo = new THREE.BufferGeometry();
  const plexusLinePos = new Float32Array(MAX_PLEXUS_LINES * 2 * 3);
  plexusLineGeo.setAttribute('position', new THREE.BufferAttribute(plexusLinePos, 3));
  plexusLineGeo.setDrawRange(0, 0);

  const plexusLineMat = new THREE.LineBasicMaterial({
    color: 0x00ccbb, transparent: true, opacity: 0.14,
    blending: THREE.AdditiveBlending, depthWrite: false
  });
  const plexusLines = new THREE.LineSegments(plexusLineGeo, plexusLineMat);
  plexusGroup.add(plexusLines);

  // ── HOLOGRAPHIC PARTICLE DNA (dots + rings + ambient) ──
  const PARTICLE_COUNT = 24000;
  const RING_COUNT     = 2000;
  const pGeo = new THREE.BufferGeometry();
  const pPos    = new Float32Array(PARTICLE_COUNT * 3);
  const pOffset = new Float32Array(PARTICLE_COUNT);
  const pType   = new Float32Array(PARTICLE_COUNT); // 0=strand1, 1=strand2, 2=rung, 3=ambient
  const pT      = new Float32Array(PARTICLE_COUNT); // position along helix [0..1]

  for (let i = 0; i < PARTICLE_COUNT; i++) {
    const rnd = Math.random();
    if (rnd < 0.30)      pType[i] = 0.0; // strand 1
    else if (rnd < 0.60) pType[i] = 1.0; // strand 2
    else if (rnd < 0.92) pType[i] = 2.0; // rungs / base pairs
    else                 pType[i] = 3.0; // ambient floaters
    pT[i]      = Math.random();
    pOffset[i] = Math.random() * Math.PI * 2;
  }
  pGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3));
  pGeo.setAttribute('aOffset',  new THREE.BufferAttribute(pOffset, 1));
  pGeo.setAttribute('aType',    new THREE.BufferAttribute(pType, 1));
  pGeo.setAttribute('aT',       new THREE.BufferAttribute(pT, 1));

  const pShaderMat = new THREE.ShaderMaterial({
    uniforms: {
      uTime:      { value: 0 },
      uTex:       { value: pTex },
      uScanner:   { value: 0 },
      uHoveredT:  { value: -1.0 },
      uSelectedT: { value: -1.0 }
    },
    vertexShader: `
      uniform float uTime;
      uniform float uScanner;
      uniform float uHoveredT;
      uniform float uSelectedT;
      attribute float aOffset;
      attribute float aType;
      attribute float aT;
      varying float vAlpha;
      varying vec3  vColor;
      varying float vScanGlow;
      void main() {
        vec3 pos = position;

        // Breathing: each particle pulses at its own phase
        float breath = sin(uTime * 2.5 + aOffset) * 0.5 + 0.5;
        float size = 1.8 + breath * 1.2;

        // Type-specific sizing
        if (aType < 0.5)      size *= 1.2;          // strand 1: medium dots
        else if (aType < 1.5) size *= 1.3;          // strand 2: slightly larger
        else if (aType < 2.5) size *= 0.7;          // rungs: small dense dots
        else                  size *= 0.8 + breath; // ambient: variable

        // Micro-glitch: occasional jitter on ~5% of particles
        if (fract(aOffset * 17.31) > 0.95) {
          pos.x += sin(uTime * 8.0 + aOffset * 3.0) * 0.06;
          pos.y += cos(uTime * 9.0 + aOffset * 5.0) * 0.06;
          pos.z += sin(uTime * 7.0 + aOffset * 7.0) * 0.06;
        }

        // Ambient floaters drift slowly
        if (aType > 2.5) {
          pos.x += sin(uTime * 0.4 + aOffset) * 0.3;
          pos.y += cos(uTime * 0.5 + aOffset * 1.3) * 0.3;
          pos.z += sin(uTime * 0.6 + aOffset * 0.7) * 0.3;
        }

        // Scanner beam distance
        float scanDist = abs(aT - uScanner);
        if (scanDist > 0.5) scanDist = 1.0 - scanDist;
        float scanGlow = smoothstep(0.025, 0.0, scanDist);
        vScanGlow = scanGlow;
        size += scanGlow * 2.5;

        // Hover / selection highlight
        float highlight = 0.0;
        if (uHoveredT >= 0.0 && abs(aT - uHoveredT) < 0.05) highlight = 0.7;
        if (uSelectedT >= 0.0 && abs(aT - uSelectedT) < 0.05) highlight = 1.0;
        size += highlight * 2.5;

        // Color: teal base → white on highlight/scan
        vec3 teal  = vec3(0.05, 0.85, 0.75);
        vec3 white = vec3(0.9, 1.0, 1.0);
        float brightFactor = clamp(highlight + scanGlow * 0.8 + breath * 0.15, 0.0, 1.0);
        vColor = mix(teal, white, brightFactor);

        // Alpha: depth-based fading + highlight
        vAlpha = 0.7 + breath * 0.3 + highlight * 0.4 + scanGlow * 0.5;
        if (aType > 2.5) vAlpha *= 0.4; // ambient is subtle

        vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
        gl_Position = projectionMatrix * mvPosition;

        // Size attenuation: closer = bigger + brighter, farther = dimmer
        gl_PointSize = size * (38.0 / -mvPosition.z);

        // Depth-based alpha fade
        float depthFade = clamp(1.0 - (-mvPosition.z - 5.0) / 40.0, 0.35, 1.0);
        vAlpha *= depthFade;
      }
    `,
    fragmentShader: `
      uniform sampler2D uTex;
      varying float vAlpha;
      varying vec3  vColor;
      varying float vScanGlow;
      void main() {
        vec4 texColor = texture2D(uTex, gl_PointCoord);
        if (texColor.a < 0.01) discard;
        vec3 finalColor = vColor;
        // Scanner beam adds bright white flash
        finalColor += vec3(0.6, 0.8, 0.8) * vScanGlow;
        gl_FragColor = vec4(finalColor, texColor.a * vAlpha);
      }
    `,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false
  });

  const particleDna = new THREE.Points(pGeo, pShaderMat);
  dnaGroup.add(particleDna);

  // Bloom layer: same geometry, larger + dimmer for soft glow
  const pBloomMat = pShaderMat.clone();
  pBloomMat.uniforms = {
    uTime:      { value: 0 },
    uTex:       { value: pTex },
    uScanner:   { value: 0 },
    uHoveredT:  { value: -1.0 },
    uSelectedT: { value: -1.0 }
  };
  pBloomMat.vertexShader = pBloomMat.vertexShader.replace(
    'gl_PointSize = size * (38.0',
    'gl_PointSize = size * (110.0'
  );
  pBloomMat.fragmentShader = pBloomMat.fragmentShader.replace(
    'texColor.a * vAlpha',
    'texColor.a * vAlpha * 0.20'
  );
  const particleBloom = new THREE.Points(pGeo, pBloomMat);
  dnaGroup.add(particleBloom);

  // ── RING PARTICLES (anellini / circles vuoti) ──
  const ringGeo = new THREE.BufferGeometry();
  const ringPos    = new Float32Array(RING_COUNT * 3);
  const ringOffset = new Float32Array(RING_COUNT);
  const ringT      = new Float32Array(RING_COUNT);
  const ringType   = new Float32Array(RING_COUNT); // 0=strand1, 1=strand2
  for (let i = 0; i < RING_COUNT; i++) {
    ringType[i]   = Math.random() < 0.5 ? 0.0 : 1.0;
    ringT[i]      = Math.random();
    ringOffset[i] = Math.random() * Math.PI * 2;
  }
  ringGeo.setAttribute('position', new THREE.BufferAttribute(ringPos, 3));
  ringGeo.setAttribute('aOffset',  new THREE.BufferAttribute(ringOffset, 1));
  ringGeo.setAttribute('aT',       new THREE.BufferAttribute(ringT, 1));
  ringGeo.setAttribute('aType',    new THREE.BufferAttribute(ringType, 1));

  const ringShaderMat = new THREE.ShaderMaterial({
    uniforms: {
      uTime:      { value: 0 },
      uRingTex:   { value: ringTex },
      uScanner:   { value: 0 },
      uHoveredT:  { value: -1.0 },
      uSelectedT: { value: -1.0 }
    },
    vertexShader: `
      uniform float uTime;
      uniform float uScanner;
      uniform float uHoveredT;
      uniform float uSelectedT;
      attribute float aOffset;
      attribute float aT;
      attribute float aType;
      varying float vAlpha;
      varying vec3  vColor;
      void main() {
        vec3 pos = position;
        float breath = sin(uTime * 1.8 + aOffset * 2.0) * 0.5 + 0.5;
        float size = 4.5 + breath * 4.0 + (aType > 0.5 ? 2.0 : 0.0);

        float scanDist = abs(aT - uScanner);
        if (scanDist > 0.5) scanDist = 1.0 - scanDist;
        float scanGlow = smoothstep(0.03, 0.0, scanDist);
        size += scanGlow * 4.0;

        float highlight = 0.0;
        if (uHoveredT >= 0.0 && abs(aT - uHoveredT) < 0.05) highlight = 0.6;
        if (uSelectedT >= 0.0 && abs(aT - uSelectedT) < 0.05) highlight = 1.0;
        size += highlight * 3.0;

        vColor = mix(vec3(0.0, 0.7, 0.6), vec3(0.8, 1.0, 1.0), clamp(highlight + scanGlow + breath * 0.2, 0.0, 1.0));
        vAlpha = 0.5 + breath * 0.3 + highlight * 0.3 + scanGlow * 0.4;

        vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
        gl_Position = projectionMatrix * mvPosition;
        gl_PointSize = size * (30.0 / -mvPosition.z);
        float depthFade = clamp(1.0 - (-mvPosition.z - 5.0) / 40.0, 0.3, 1.0);
        vAlpha *= depthFade;
      }
    `,
    fragmentShader: `
      uniform sampler2D uRingTex;
      varying float vAlpha;
      varying vec3  vColor;
      void main() {
        vec4 texColor = texture2D(uRingTex, gl_PointCoord);
        if (texColor.a < 0.01) discard;
        gl_FragColor = vec4(vColor, texColor.a * vAlpha);
      }
    `,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false
  });
  const ringParticles = new THREE.Points(ringGeo, ringShaderMat);
  dnaGroup.add(ringParticles);

  // ── INVISIBLE HITBOX SPHERES (raycasting preserved identically) ──
  const NUM_RUNGS   = DNA_TURNS * 9;
  const matSph1 = new THREE.MeshBasicMaterial({ visible: false });
  const matSph2 = new THREE.MeshBasicMaterial({ visible: false });
  const gSph = new THREE.SphereGeometry(0.05, 4, 4);
  const sphArr1 = [], sphArr2 = [];
  for (let i = 0; i <= NUM_RUNGS; i++) {
    const s1 = new THREE.Mesh(gSph, matSph1); dnaGroup.add(s1); sphArr1.push(s1);
    const s2 = new THREE.Mesh(gSph, matSph2); dnaGroup.add(s2); sphArr2.push(s2);
  }

  const NUM_SECTIONS = 5;
  const specialGeneIndices = [15, 21, 27, 33, 39];
  const specialGenes = specialGeneIndices.map(i => [sphArr1[i], sphArr2[i]]);

  const matSphSpecial = new THREE.MeshBasicMaterial({ visible: false });

  const hitBoxes = [];
  const hitBoxGeo = new THREE.SphereGeometry(1.2, 8, 8);
  const hitBoxMat = new THREE.MeshBasicMaterial({ visible: false });

  specialGenes.forEach(pair => {
    const hb1 = new THREE.Mesh(hitBoxGeo, hitBoxMat);
    pair[0].add(hb1);
    hitBoxes.push(hb1);

    const hb2 = new THREE.Mesh(hitBoxGeo, hitBoxMat);
    pair[1].add(hb2);
    hitBoxes.push(hb2);
  });

  const reticleArr1 = [], reticleArr2 = [];
  const reticleGeo = new THREE.RingGeometry(0.14, 0.17, 48, 1);
  for (let s = 0; s < NUM_SECTIONS; s++) {
    const rMat1 = new THREE.MeshBasicMaterial({ color: 0x00ffcc, side: THREE.DoubleSide, transparent: true, opacity: 0.7, blending: THREE.AdditiveBlending, depthWrite: false });
    const r1 = new THREE.Mesh(reticleGeo, rMat1);
    dnaGroup.add(r1);
    reticleArr1.push(r1);

    const rMat2 = new THREE.MeshBasicMaterial({ color: 0x00ffcc, side: THREE.DoubleSide, transparent: true, opacity: 0.7, blending: THREE.AdditiveBlending, depthWrite: false });
    const r2 = new THREE.Mesh(reticleGeo, rMat2);
    dnaGroup.add(r2);
    reticleArr2.push(r2);
  }

  // ── ASTE (base pairs) — linee che collegano i due filamenti ──
  /* ── Aste come colonne dense di particelle uniformi — look linea solida ── */
  const rungCount    = NUM_RUNGS + 1;
  const RUNG_PTS_PER = 16;  /* densità alta → illusione di linea continua */
  const rungPtCount  = rungCount * RUNG_PTS_PER;
  const rungPosArr   = new Float32Array(rungPtCount * 3);
  const rungOffArr   = new Float32Array(rungPtCount); /* phase offset per breathing */
  const rungTArr     = new Float32Array(rungPtCount); /* T lungo l'elica per scanner */
  const rungFArr     = new Float32Array(rungPtCount); /* F lungo l'asta (0..1) per bell */

  for (let i = 0; i < rungCount; i++) {
    const tHelix = i / NUM_RUNGS;
    for (let p = 0; p < RUNG_PTS_PER; p++) {
      const idx = i * RUNG_PTS_PER + p;
      rungOffArr[idx] = Math.random() * Math.PI * 2;
      rungTArr[idx]   = tHelix;
      rungFArr[idx]   = p / (RUNG_PTS_PER - 1);
    }
  }

  const rungGeo = new THREE.BufferGeometry();
  rungGeo.setAttribute('position', new THREE.BufferAttribute(rungPosArr, 3));
  rungGeo.setAttribute('aOffset',  new THREE.BufferAttribute(rungOffArr, 1));
  rungGeo.setAttribute('aT',       new THREE.BufferAttribute(rungTArr,   1));
  rungGeo.setAttribute('aF',       new THREE.BufferAttribute(rungFArr,   1));

  const rungMat = new THREE.ShaderMaterial({
    uniforms: {
      uTime:      { value: 0 },
      uTex:       { value: pTex },
      uScanner:   { value: 0 },
      uHoveredT:  { value: -1.0 },
      uSelectedT: { value: -1.0 },
    },
    vertexShader: `
      uniform float uTime;
      uniform float uScanner;
      uniform float uHoveredT;
      uniform float uSelectedT;
      attribute float aOffset;
      attribute float aT;
      attribute float aF;
      varying float vAlpha;
      varying vec3  vColor;
      void main() {
        float breath = sin(uTime * 2.5 + aOffset) * 0.5 + 0.5;
        float size   = 5.0 + breath * 1.5;

        float scanDist = abs(aT - uScanner);
        if (scanDist > 0.5) scanDist = 1.0 - scanDist;
        float scanGlow = smoothstep(0.025, 0.0, scanDist);
        size += scanGlow * 4.0;

        float highlight = 0.0;
        if (uHoveredT  >= 0.0 && abs(aT - uHoveredT)  < 0.05) highlight = 0.8;
        if (uSelectedT >= 0.0 && abs(aT - uSelectedT) < 0.05) highlight = 1.0;
        size += highlight * 4.0;

        vec3 teal  = vec3(0.05, 0.88, 0.78);
        vec3 white = vec3(0.9, 1.0, 1.0);
        vColor = mix(teal, white, clamp(highlight + scanGlow * 0.8, 0.0, 1.0));
        vAlpha = 0.55 + breath * 0.25 + highlight * 0.4 + scanGlow * 0.5;

        vec4 mvPos = modelViewMatrix * vec4(position, 1.0);
        gl_Position  = projectionMatrix * mvPos;
        gl_PointSize = size * (38.0 / -mvPos.z);
        float depthFade = clamp(1.0 - (-mvPos.z - 5.0) / 40.0, 0.3, 1.0);
        vAlpha *= depthFade;
      }
    `,
    fragmentShader: `
      uniform sampler2D uTex;
      varying float vAlpha;
      varying vec3  vColor;
      void main() {
        vec4 tex = texture2D(uTex, gl_PointCoord);
        if (tex.a < 0.01) discard;
        gl_FragColor = vec4(vColor * tex.rgb, tex.a * vAlpha);
      }
    `,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });

  const rungPoints = new THREE.Points(rungGeo, rungMat);
  dnaGroup.add(rungPoints);

  // Scanner beam line (follows the helix arc)
  const sweepPts = [];
  const dnaSweepSegs = 60;
  for (let i = 0; i <= dnaSweepSegs; i++) {
    const t = i / dnaSweepSegs;
    const phi = panelArcStart + t * arcLength;
    sweepPts.push(new THREE.Vector3(Math.cos(phi) * r_dna, 0, Math.sin(phi) * r_dna));
  }
  const sweepLineGeo = new THREE.BufferGeometry().setFromPoints(sweepPts);
  const matSweepLine = new THREE.LineBasicMaterial({ color: 0x44ffdd, transparent: true, opacity: 0.6, blending: THREE.AdditiveBlending, depthWrite: false });
  const sweepLine = new THREE.Line(sweepLineGeo, matSweepLine);
  dnaGroup.add(sweepLine);

  // Scanner phase tracking
  let scannerPhase = 0;
  let prevDnaTime = performance.now();


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
    // ── 1. HITBOX SPHERES (same math as original — curved arc) ──
    for (let i = 0; i <= NUM_RUNGS; i++) {
      const t   = i / NUM_RUNGS;
      const phi = panelArcStart + t * arcLength;
      const ha  = t * Math.PI * 2 * DNA_TURNS + phase;
      const cx  = Math.cos(phi) * r_dna, cz = Math.sin(phi) * r_dna;
      const vO  = Math.sin(ha) * DNA_RAD;
      sphArr1[i].position.set(cx, vO,  cz);
      sphArr2[i].position.set(cx, -vO, cz);
    }

    // Aggiorna aste: ogni asta collega sphArr1[i] a sphArr2[i]
    for (let i = 0; i < rungCount; i++) {
      const p1 = sphArr1[i].position, p2 = sphArr2[i].position;
      for (let p = 0; p < RUNG_PTS_PER; p++) {
        const f   = p / (RUNG_PTS_PER - 1);
        const idx = (i * RUNG_PTS_PER + p) * 3;
        rungPosArr[idx]     = p1.x + (p2.x - p1.x) * f;
        rungPosArr[idx + 1] = p1.y + (p2.y - p1.y) * f;
        rungPosArr[idx + 2] = p1.z + (p2.z - p1.z) * f;
      }
    }
    rungGeo.attributes.position.needsUpdate = true;

    // Riposiziona i 5 reticoli HUD rotanti esattamente sui 5 geni speciali
    for (let s = 0; s < NUM_SECTIONS; s++) {
      const idx = specialGeneIndices[s];
      reticleArr1[s].position.copy(sphArr1[idx].position);
      reticleArr2[s].position.copy(sphArr2[idx].position);
    }

    // ── 2. SHADER UNIFORMS ──
    const now = performance.now();
    const dt  = now - prevDnaTime;
    prevDnaTime = now;
    const uTime = now * 0.001;

    scannerPhase = (scannerPhase + dt * 0.00012) % 1.0;

    // Compute hover/selection T values
    let hoverT = -1.0, selT = -1.0;
    if (lastHoveredGene !== -1) hoverT = specialGeneIndices[lastHoveredGene] / NUM_RUNGS;
    if (selectedDnaGene !== -1) selT   = specialGeneIndices[selectedDnaGene] / NUM_RUNGS;

    // Update all shader uniforms
    pShaderMat.uniforms.uTime.value      = uTime;
    pShaderMat.uniforms.uScanner.value   = scannerPhase;
    pShaderMat.uniforms.uHoveredT.value  = hoverT;
    pShaderMat.uniforms.uSelectedT.value = selT;
    pBloomMat.uniforms.uTime.value       = uTime;
    pBloomMat.uniforms.uScanner.value    = scannerPhase;
    pBloomMat.uniforms.uHoveredT.value   = hoverT;
    pBloomMat.uniforms.uSelectedT.value  = selT;
    ringShaderMat.uniforms.uTime.value      = uTime;
    ringShaderMat.uniforms.uScanner.value   = scannerPhase;
    ringShaderMat.uniforms.uHoveredT.value  = hoverT;
    ringShaderMat.uniforms.uSelectedT.value = selT;
    rungMat.uniforms.uTime.value            = uTime;
    rungMat.uniforms.uScanner.value         = scannerPhase;
    rungMat.uniforms.uHoveredT.value        = hoverT;
    rungMat.uniforms.uSelectedT.value       = selT;

    // ── 3. PARTICLE POSITIONS (dots on strands + rungs + ambient) ──
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const t    = pT[i];
      const type = pType[i];
      const phi  = panelArcStart + t * arcLength;
      const ha   = t * Math.PI * 2 * DNA_TURNS + phase;
      const cx   = Math.cos(phi) * r_dna, cz = Math.sin(phi) * r_dna;
      const vO   = Math.sin(ha) * DNA_RAD;

      if (type < 0.5) {
        // Strand 1: particles cluster around the first strand with slight spread
        const spread = Math.sin(i * 11.0) * 0.08;
        pPos[i*3]   = cx + Math.cos(phi + 0.01) * spread;
        pPos[i*3+1] = vO + Math.sin(i * 13.0) * 0.08;
        pPos[i*3+2] = cz + Math.sin(phi + 0.01) * spread;
      } else if (type < 1.5) {
        // Strand 2: cluster around second strand
        const spread = Math.cos(i * 17.0) * 0.08;
        pPos[i*3]   = cx + Math.cos(phi - 0.01) * spread;
        pPos[i*3+1] = -vO + Math.cos(i * 19.0) * 0.08;
        pPos[i*3+2] = cz + Math.sin(phi - 0.01) * spread;
      } else if (type < 2.5) {
        // Rungs: interpolate between strand1 and strand2 at same phi
        const lerp = Math.sin(i * 77.7) * 0.5 + 0.5;
        pPos[i*3]   = cx + Math.sin(i * 31.1) * 0.03;
        pPos[i*3+1] = vO * lerp + (-vO) * (1 - lerp);
        pPos[i*3+2] = cz + Math.cos(i * 41.1) * 0.03;
      } else {
        // Ambient floaters: scattered near the helix
        const aR   = r_dna + Math.sin(i * 12.3) * 2.5;
        const aPhi = panelArcStart + t * arcLength + Math.cos(i * 7.7) * 0.15;
        pPos[i*3]   = Math.cos(aPhi) * aR;
        pPos[i*3+1] = Math.sin(i * 14.5) * 3.0;
        pPos[i*3+2] = Math.sin(aPhi) * aR;
      }
    }
    pGeo.attributes.position.needsUpdate = true;

    // ── 4. RING PARTICLE POSITIONS ──
    for (let i = 0; i < RING_COUNT; i++) {
      const t    = ringT[i];
      const type = ringType[i];
      const phi  = panelArcStart + t * arcLength;
      const ha   = t * Math.PI * 2 * DNA_TURNS + phase;
      const cx   = Math.cos(phi) * r_dna, cz = Math.sin(phi) * r_dna;
      const vO   = Math.sin(ha) * DNA_RAD;
      const spread = Math.sin(i * 23.0) * 0.06;

      if (type < 0.5) {
        ringPos[i*3]   = cx + Math.cos(phi) * spread;
        ringPos[i*3+1] = vO + Math.cos(i * 29.0) * 0.06;
        ringPos[i*3+2] = cz + Math.sin(phi) * spread;
      } else {
        ringPos[i*3]   = cx + Math.cos(phi) * spread;
        ringPos[i*3+1] = -vO + Math.sin(i * 31.0) * 0.06;
        ringPos[i*3+2] = cz + Math.sin(phi) * spread;
      }
    }
    ringGeo.attributes.position.needsUpdate = true;

    // ── 5. PLEXUS NETWORK ──
    const plexusPositions = plexusGeo.attributes.position.array;
    for (let i = 0; i < PLEXUS_NODES; i++) {
      plexusPositions[i*3]   += plexusVel[i].x;
      plexusPositions[i*3+1] += plexusVel[i].y;
      plexusPositions[i*3+2] += plexusVel[i].z;

      const radius = Math.sqrt(plexusPositions[i*3]*plexusPositions[i*3] + plexusPositions[i*3+2]*plexusPositions[i*3+2]);
      if (radius > r_dna + 4 || radius < r_dna - 4) {
        plexusVel[i].x *= -1;
        plexusVel[i].z *= -1;
      }
      if (plexusPositions[i*3+1] > 10 || plexusPositions[i*3+1] < -10) {
        plexusVel[i].y *= -1;
      }
    }
    plexusGeo.attributes.position.needsUpdate = true;

    // Connect nearby plexus nodes with lines
    const linePts = plexusLineGeo.attributes.position.array;
    let lineIdx = 0;
    const maxLineVerts = MAX_PLEXUS_LINES * 2 * 3;
    for (let i = 0; i < PLEXUS_NODES && lineIdx < maxLineVerts - 6; i++) {
      for (let j = i + 1; j < PLEXUS_NODES && lineIdx < maxLineVerts - 6; j++) {
        const dx = plexusPositions[i*3]   - plexusPositions[j*3];
        const dy = plexusPositions[i*3+1] - plexusPositions[j*3+1];
        const dz = plexusPositions[i*3+2] - plexusPositions[j*3+2];
        if (dx*dx + dy*dy + dz*dz < 18.0) {
          linePts[lineIdx++] = plexusPositions[i*3];
          linePts[lineIdx++] = plexusPositions[i*3+1];
          linePts[lineIdx++] = plexusPositions[i*3+2];
          linePts[lineIdx++] = plexusPositions[j*3];
          linePts[lineIdx++] = plexusPositions[j*3+1];
          linePts[lineIdx++] = plexusPositions[j*3+2];
        }
      }
    }
    plexusLineGeo.setDrawRange(0, lineIdx / 3);
    plexusLineGeo.attributes.position.needsUpdate = true;
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
      el.style.display = '';
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
      desc: 'Un\'epoca di straordinario fervore intellettuale e artistico, in cui le grandi famiglie si contendono il controllo degli stati attraverso alleanze, tradimenti e veleni. Sotto la superficie del rinnovamento culturale, antiche fratellanze segrete muovono le loro pedine per destinare il futuro dell\'umanità.' },
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
    { mat: matSph1,      base: 1.0  },
    { mat: matSph2,      base: 1.0  },
    { mat: matSphSpecial, base: 0.9 },
  ];

  // (showcase group rimosso — il gene si evidenzia in place)

  // ── Pannello sinistro: data/orario ──
  const scLeftEl = document.createElement('div');
  scLeftEl.innerHTML = `<div class="sc-panel" style="position:relative;">
    <button id="scCloseBtn" class="payment-close" style="position: absolute; right: 10px; top: 10px; z-index: 1000; cursor: pointer; pointer-events: auto; background: transparent; border: none; font-size: 28px; color: #0ff; line-height: 1; padding: 5px;">&times;</button>
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

    /* Hide DNA group so the interface is clean */
    dnaGroup.visible = false;

    /* Pannelli centrati sulla superficie interna del display curvo. */
    const r        = gridRadius - 2.5;
    const gY       = 0; // Centered vertically

    /* Centered panels around thetaCenter */
    const margin = 0.35; // Spacing from center
    const phiL = thetaCenter + margin;
    const phiR = thetaCenter - margin;

    scLeftCss.position.set(Math.cos(phiL) * r, gY, Math.sin(phiL) * r + 5);
    scLeftCss.lookAt(0, gY, 18);
    scRightCss.position.set(Math.cos(phiR) * r, gY, Math.sin(phiR) * r + 5);
    scRightCss.lookAt(0, gY, 18);

    scLeftEl.style.opacity  = '1'; scLeftEl.style.pointerEvents  = 'auto';
    scRightEl.style.opacity = '1'; scRightEl.style.pointerEvents = 'auto';
    dnaGuideTimeouts.forEach(t => clearTimeout(t));
    dnaGuideTimeouts = [];
    dnaGuideEls.forEach(el => { el.style.opacity = '0'; el.style.display = 'none'; });
    dnaLabelEls.forEach(el => { el.style.opacity = '0'; el.classList.remove('hovered'); });
  }
  function hideGeneInfo() {
    if (typeof scConfirmTimeout !== 'undefined' && scConfirmTimeout) {
      clearTimeout(scConfirmTimeout);
      scConfirmTimeout = null;
    }
    selectedDnaGene = -1;
    lastHoveredGene = -1;
    scLeftEl.style.opacity  = '0'; scLeftEl.style.pointerEvents  = 'none';
    scRightEl.style.opacity = '0'; scRightEl.style.pointerEvents = 'none';

    /* Restore DNA visibility */
    dnaGroup.visible = true;

    allDnaSpheres.forEach(sp => sp.scale.setScalar(1));
    dnaGuideEls.forEach(el => { el.style.display = ''; el.style.opacity = '1'; });
  }

  let scConfirmTimeout = null;
  document.getElementById('scConfirmBtn').addEventListener('click', () => {
    if (window.audioEngine) window.audioEngine.playClick();
    document.getElementById('scConfirmBtn').disabled = true;
    document.getElementById('scConfirmMsg').style.display = 'block';

    const gene = geneData[selectedDnaGene];
    if (gene) {
      const dateVal = document.getElementById('scDate').value;
      const timeVal = document.getElementById('scTime').value;
      cartItems.push({
        title: gene.epoch.toUpperCase() + ' - ' + gene.year,
        date: dateVal,
        time: timeVal,
        price: gene.price
      });
      window.updateCartUI();
    }

  });

  document.getElementById('scCloseBtn').addEventListener('click', (e) => {
    e.stopPropagation();
    if (window.audioEngine) window.audioEngine.playClick();
    hideGeneInfo();
  });

  /* ── Click globale su WINDOW — funziona ovunque, anche su CSS3D ── */

  /* Helper: proietta un punto 3D sullo schermo e ritorna la distanza in pixel
     dal click. Se l'oggetto è dietro la camera, ritorna Infinity. */
  function screenDistFromClick(worldPos, clickX, clickY) {
    const projected = worldPos.clone().project(camera);
    if (projected.z > 1) return Infinity; // dietro la camera
    const sx = (projected.x * 0.5 + 0.5) * window.innerWidth;
    const sy = (-projected.y * 0.5 + 0.5) * window.innerHeight;
    const dx = sx - clickX;
    const dy = sy - clickY;
    return Math.sqrt(dx * dx + dy * dy);
  }

  window.addEventListener('click', e => {
    if (blockCanvasClick) return;
    if (selectedDnaGene !== -1) return;

    /* Coordinate NDC calcolate dall'evento click. */
    const clickNDC = new THREE.Vector2(
      (e.clientX / window.innerWidth) * 2 - 1,
      -(e.clientY / window.innerHeight) * 2 + 1
    );

    /* Forza aggiornamento delle matrici mondo prima del raycasting,
       altrimenti gli hitbox invisibili o in gruppi animati possono
       avere matrici stale. */
    scene.updateMatrixWorld(true);

    if (hasBooted) {
      panelRaycaster.setFromCamera(clickNDC, camera);
      
      /* ── Carrello: raycaster primario + fallback screen-space ── */
      if (!cartViewActive && paymentPanelEl && paymentPanelEl.classList.contains('hidden') && paymentSuccessPanelEl && paymentSuccessPanelEl.classList.contains('hidden')) {
        let cartClicked = false;
        if (cartBtnEl && cartBtnEl.style.opacity === '1') {
          cartClicked = panelRaycaster.intersectObject(hitPlaneCart).length > 0;
          if (!cartClicked) {
            const cartWorldPos = new THREE.Vector3();
            cssCartBtn.getWorldPosition(cartWorldPos);
            const dist = screenDistFromClick(cartWorldPos, e.clientX, e.clientY);
            if (dist < 50) cartClicked = true;
          }
        }

        if (cartClicked) {
          e.stopPropagation();
          e.preventDefault();
          if (window.audioEngine) window.audioEngine.playClick();
          showCartView();
          return;
        }

        let ticketClicked = false;
        const tBtn = document.getElementById('ticketButton');
        if (tBtn && tBtn.style.opacity === '1') {
          ticketClicked = panelRaycaster.intersectObject(hitPlaneTicket).length > 0;
          if (!ticketClicked && window.cssTicketBtn) {
            const ticketWorldPos = new THREE.Vector3();
            window.cssTicketBtn.getWorldPosition(ticketWorldPos);
            const dist = screenDistFromClick(ticketWorldPos, e.clientX, e.clientY);
            if (dist < 50) ticketClicked = true;
          }
        }

        if (ticketClicked) {
          const tBtn = document.getElementById('ticketButton');
          if (tBtn && tBtn.classList.contains('has-ticket')) {
            e.stopPropagation();
            e.preventDefault();
            if (window.audioEngine) window.audioEngine.playClick();
            if (typeof showTicketsView === 'function') showTicketsView();
            return;
          }
        }
      }

      /* Pannelli principali: raycasting su hitPlane invisibili */
      if (window.experiencesRevealed && !panelL.classList.contains('hidden-panel')) {
        if (panelRaycaster.intersectObject(hitPlaneL).length > 0) { 
          if (window.audioEngine) window.audioEngine.playClick();
          showDNAView(); 
          return; 
        }
        if (panelRaycaster.intersectObject(hitPlaneR).length > 0) { 
          if (window.audioEngine) window.audioEngine.playClick();
          playCinematicTransition(); 
          return; 
        }
      }
    }

    /* ── Geni DNA: raycaster primario + fallback screen-space ── */
    if (dnaGroup.visible) {
      /* Metodo 1: raycasting diretto sugli hitbox */
      dnaRaycaster.setFromCamera(clickNDC, camera);
      const geneHits = dnaRaycaster.intersectObjects(hitBoxes);
      if (geneHits.length > 0) {
        const hitParent = geneHits[0].object.parent;
        for (let s = 0; s < NUM_SECTIONS; s++) {
          if (specialGenes[s].includes(hitParent)) {
            e.stopPropagation();
            e.preventDefault();
            if (window.audioEngine) window.audioEngine.playClick();
            showGeneInfo(s);
            return;
          }
        }
      }

      /* Metodo 2 (fallback): proietta ogni gene sphere sullo schermo e
         controlla la distanza in pixel. Questo funziona anche quando il
         raycaster fallisce per via della rotazione continua del DNA o
         della curva del display (gene 1900 in particolare). */
      let closestGene = -1;
      let closestDist = 100; // soglia in pixel (aumentata per touch/high-DPI)
      for (let s = 0; s < NUM_SECTIONS; s++) {
        const idx = specialGeneIndices[s];
        // Controlla entrambe le sfere (filamento 1 e filamento 2)
        for (const sph of [sphArr1[idx], sphArr2[idx]]) {
          const worldPos = new THREE.Vector3();
          sph.getWorldPosition(worldPos);
          const dist = screenDistFromClick(worldPos, e.clientX, e.clientY);
          if (dist < closestDist) {
            closestDist = dist;
            closestGene = s;
          }
        }
      }
      if (closestGene !== -1) {
        e.stopPropagation();
        e.preventDefault();
        if (window.audioEngine) window.audioEngine.playClick();
        showGeneInfo(closestGene);
        return;
      }
    }
  }, true); // USE CAPTURE PHASE! Supera qualsiasi stopPropagation dei figli.

  // Freccia indietro: gestisce showcase, DNA, timeline e carrello
  dnaBackArrow.addEventListener('click', () => {
    if (window.audioEngine) window.audioEngine.playClick();
    if (selectedDnaGene !== -1) {
      hideGeneInfo();
    } else if (charViewEpoch !== -1) {
      hideCharacterView();
    } else if (tlArcLine && tlArcLine.visible) {
      hideTimelineView();
    } else if (cartViewActive) {
      hideCartView();
    } else if (typeof ticketsViewActive !== 'undefined' && ticketsViewActive) {
      hideTicketsView();
    } else {
      hideDNAView();
    }
  });

  /* ══════════════════════════════════════════
     RESIZE
  ══════════════════════════════════════════ */
  window.addEventListener('resize', ()=>{
    if (renderer) renderer.setSize(window.innerWidth, window.innerHeight);
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
    if (window.audioEngine) window.audioEngine.playBoot();
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
      if (introTextEl) introTextEl.style.opacity = 0;
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
      
      // Parallax del video di sfondo della timeline (loop)
      const tlBg = document.getElementById('timelineBgContainer');
      if (tlBg && !tlBg.classList.contains('hidden')) {
        tlBg.style.setProperty('--mouse-x', `${-eMouse.x * 2.5}vw`);
        tlBg.style.setProperty('--mouse-y', `${eMouse.y * 1.5}vh`);
      }
      
      // Parallax della transizione video (se mai servisse)
      const cinematicOverlay = document.getElementById('cinematicOverlay');
      if (cinematicOverlay && cinematicOverlay.style.zIndex === '0') {
        cinematicOverlay.style.setProperty('--mouse-x', `${-eMouse.x * 2.5}vw`);
        cinematicOverlay.style.setProperty('--mouse-y', `${eMouse.y * 1.5}vh`);
      }
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
    if (hasBooted && window.experiencesRevealed && !panelL.classList.contains('hidden-panel')) {
      panelRaycaster.setFromCamera(rawMouse, camera);
      hoverL = panelRaycaster.intersectObject(hitPlaneL).length > 0;
      hoverR = panelRaycaster.intersectObject(hitPlaneR).length > 0;
    } else {
      hoverL = false; hoverR = false;
    }

    const exBtnCheck = document.getElementById('experiencesBackArrow');
    if (exBtnCheck) {
      if (window.experiencesRevealed && !panelL.classList.contains('hidden-panel')) {
        if (exBtnCheck.style.display !== 'block') exBtnCheck.style.display = 'block';
      } else {
        if (exBtnCheck.style.display !== 'none') exBtnCheck.style.display = 'none';
      }
    }

    const targetScaleL = hoverL ? 0.042 : 0.035;
    cssObjL.scale.lerp(new THREE.Vector3(targetScaleL, targetScaleL, targetScaleL), 0.12);
    panelL.style.borderColor = hoverL ? 'rgba(0,255,255,0.9)' : '';
    panelL.style.boxShadow   = hoverL ? 'inset 0 0 60px rgba(0,255,255,0.25)' : '';

    const targetScaleR = hoverR ? 0.042 : 0.035;
    cssObjR.scale.lerp(new THREE.Vector3(targetScaleR, targetScaleR, targetScaleR), 0.12);
    panelR.style.borderColor = hoverR ? 'rgba(0,255,255,0.9)' : '';
    panelR.style.boxShadow   = hoverR ? 'inset 0 0 60px rgba(0,255,255,0.25)' : '';

    if (renderer) renderer.render(scene, camera);
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
        
        if (!window.experiencesRevealed) {
          introTextEl.style.opacity = pe;
          if (panelProgress >= 1) {
            introTextEl.style.pointerEvents = "auto";
          }
        } else {
          panelL.style.opacity = pe;
          panelR.style.opacity = pe;
          cartBtnEl.style.opacity = pe;
          if (panelProgress >= 1) {
            panelL.style.pointerEvents = "auto";
            panelR.style.pointerEvents = "auto";
            cartBtnEl.style.pointerEvents = "auto";
          }
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

        // Animazione dei 5 reticoli HUD a diamante (rotazione, scala e pulsazione)
        const tempRScale = new THREE.Vector3();
        for (let s = 0; s < NUM_SECTIONS; s++) {
          const isTarget = (hoveredGene === s || selectedDnaGene === s);

          // Scala reticolo
          const idleRScale = 1.0 + 0.2 * Math.abs(Math.sin(now * 1.8 + s * 0.9));
          const targetRScaleVal = isTarget ? 2.2 : idleRScale;
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
          reticleArr2[s].quaternion.copy(camera.quaternion).multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), -spinAngle));
        }

        // Animazione scorrimento sweep laser (curva di scansione Y)
        if (sweepLine && matSweepLine) {
          // Sweep follows the scanner phase vertically
          sweepLine.position.y = Math.sin(now * 2.5) * 1.5;
          matSweepLine.opacity = 0.3 + 0.4 * Math.cos(now * 5.0);
        }

        // Effetto glitch/jitter di desincronizzazione Animus su dnaGroup
        if (Math.random() < 0.012) {
          dnaGroup.position.set(
            (Math.random() - 0.5) * 0.15,
            (Math.random() - 0.5) * 0.05,
            (Math.random() - 0.5) * 0.15
          );
        } else {
          dnaGroup.position.lerp(new THREE.Vector3(0, 0, 0), 0.25);
        }
      }

      // (animazione booking rimossa — gene si evidenzia in place)

      // Linea timeline DNA — aggiorna scanner e breathing
      if (tlArcLine && tlArcLine.visible && tlArcLine.userData.lineMat) {
        tlArcLine.userData.lineMat.uniforms.uTime.value = now * 0.001;
      }

      // Mini DNA sulla timeline: onde sinusoidali scorrevoli + scala su hover
      if (tlDnaGroups && tlArcLine && tlArcLine.visible) {
        const tV = new THREE.Vector3();
        tlDnaGroups.forEach((g, s) => {
          g.userData.phase = (g.userData.phase || s * 0.8) + 0.04;
          const ph = g.userData.phase;
          const { mArr1, mArr2, mArrR, mGeo1, mGeo2, mGeoR,
                  mPts, mPtsGeo, mRingPts, mRingGeo,
                  MN, MSEGS, MAMP, MH, MDEPTH, MRUNGS, MPTS, MRINGS } = g.userData;

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

            /* Particelle sui filamenti */
            if (mPts && MPTS) {
              for (let i = 0; i < MPTS; i++) {
                const t  = i / (MPTS - 1);
                const a  = t * Math.PI * 2 * MN + ph;
                const x  = (t - 0.5) * MH;
                const sc = Math.sin(i * 7.3) * 0.025;
                if (i % 2 === 0) {
                  mPts[i*3] = x; mPts[i*3+1] =  Math.sin(a) * MAMP + sc; mPts[i*3+2] = Math.cos(a) * MDEPTH;
                } else {
                  mPts[i*3] = x; mPts[i*3+1] = -Math.sin(a) * MAMP + sc; mPts[i*3+2] = Math.cos(a) * MDEPTH;
                }
              }
              mPtsGeo.attributes.position.needsUpdate = true;
            }

            /* Anellini luminosi (ogni ~2 aste) */
            if (mRingPts && MRINGS) {
              for (let i = 0; i < MRINGS; i++) {
                const t = i / (MRINGS - 1);
                const a = t * Math.PI * 2 * MN + ph;
                const x = (t - 0.5) * MH;
                const side = i % 2 === 0 ? 1 : -1;
                mRingPts[i*3] = x; mRingPts[i*3+1] = side * Math.sin(a) * MAMP; mRingPts[i*3+2] = Math.cos(a) * MDEPTH;
              }
              mRingGeo.attributes.position.needsUpdate = true;
            }
          }

          const ts = tlDnaHovers[s] ? 2.2 : 1.4;
          tV.set(ts, ts, ts);
          g.scale.lerp(tV, 0.1);
        });
      }

      // Animazione HUD biglietto (rimossa per adattare il biglietto al display curvo statico)

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
    if (window.audioEngine) window.audioEngine.playClick();
    showCardsView();
  });

  /* ── CART LOGIC ── */
  let cartViewActive = false;

  let cartPreviousState = 'cards';
  let cartPreviousGene = -1;
  let cartPreviousEpoch = -1;

  function showCartView() {
    cartViewActive = true;
    
    if (typeof ticketsViewActive !== 'undefined' && ticketsViewActive) {
      if (typeof hideTicketsView === 'function') hideTicketsView();
    }

    // Chiude qualsiasi interfaccia che potrebbe essere aperta dietro e ne salva lo stato
    if (typeof selectedDnaGene !== 'undefined' && selectedDnaGene !== -1) {
      cartPreviousState = 'gene';
      cartPreviousGene = selectedDnaGene;
      hideGeneInfo();
    } else if (typeof charViewEpoch !== 'undefined' && charViewEpoch !== -1) {
      cartPreviousState = 'character';
      cartPreviousEpoch = charViewEpoch;
      hideCharacterView(false);
    } else if (typeof tlArcLine !== 'undefined' && tlArcLine && tlArcLine.visible) {
      cartPreviousState = 'timeline';
      hideTimelineView();
    } else if (typeof dnaGroup !== 'undefined' && dnaGroup && dnaGroup.visible) {
      cartPreviousState = 'dna';
      hideDNAView();
    } else {
      cartPreviousState = 'cards';
    }

    panelL.classList.add('hidden-panel');
    panelR.classList.add('hidden-panel');
    cartPanelEl.classList.remove('hidden');
    
    // Il logo rimane visibile, nascondiamo solo il bottone del carrello
    cartBtnEl.style.opacity = '0';
    cartBtnEl.style.pointerEvents = 'none';
    
    const ticketBtnEl = document.getElementById('ticketButton');
    if (ticketBtnEl) {
      ticketBtnEl.style.opacity = '0';
      ticketBtnEl.style.pointerEvents = 'none';
    }
    
    // Move to center
    cssCartPanel.position.set(Math.cos(thetaCenter) * panelRadiusCSS, 0, Math.sin(thetaCenter) * panelRadiusCSS);
    cssCartPanel.scale.set(0.045, 0.045, 0.045);
    cssCartPanel.lookAt(0, 0, 0);

    dnaBackArrow.style.display = 'block';
  }

  function hideCartView() {
    cartViewActive = false;
    cartPanelEl.classList.add('hidden');
    
    // Restore previous state
    if (cartPreviousState === 'gene') {
      showDNAView();
      showGeneInfo(cartPreviousGene);
    } else if (cartPreviousState === 'character') {
      showCharacterView(cartPreviousEpoch);
    } else if (cartPreviousState === 'timeline') {
      showTimelineView();
    } else if (cartPreviousState === 'dna') {
      showDNAView();
    } else {
      panelL.classList.remove('hidden-panel');
      panelR.classList.remove('hidden-panel');
      dnaBackArrow.style.display = 'none';
    }
    
    cartBtnEl.style.opacity = '1';
    cartBtnEl.style.pointerEvents = 'auto';

    const ticketBtnEl = document.getElementById('ticketButton');
    if (ticketBtnEl && ticketBtnEl.classList.contains('has-ticket')) {
      ticketBtnEl.style.opacity = '1';
      ticketBtnEl.style.pointerEvents = 'auto';
    }

    // Reset panel position
    cssCartPanel.position.set(Math.cos(thetaCartBtn) * panelRadiusCSS, 1.5, Math.sin(thetaCartBtn) * panelRadiusCSS);
    cssCartPanel.scale.set(0.035, 0.035, 0.035);
    cssCartPanel.lookAt(0, 1.5, 0);
  }

  let ticketsViewActive = false;

  window.showTicketsView = function() {
    ticketsViewActive = true;
    if (cartViewActive) hideCartView();
    
    panelL.classList.add('hidden-panel');
    panelR.classList.add('hidden-panel');
    const ticketsPanelEl = document.getElementById('ticketsPanel');
    if (ticketsPanelEl) ticketsPanelEl.classList.remove('hidden');
    
    cartBtnEl.style.opacity = '0';
    cartBtnEl.style.pointerEvents = 'none';
    
    const ticketBtnEl = document.getElementById('ticketButton');
    if (ticketBtnEl) {
      ticketBtnEl.style.opacity = '0';
      ticketBtnEl.style.pointerEvents = 'none';
    }
    
    if (cssTicketsPanel) {
      cssTicketsPanel.position.set(Math.cos(thetaCenter) * panelRadiusCSS, 0, Math.sin(thetaCenter) * panelRadiusCSS);
      cssTicketsPanel.scale.set(0.045, 0.045, 0.045);
      cssTicketsPanel.lookAt(0, 0, 0);
    }
    dnaBackArrow.style.display = 'block';
  }

  window.hideTicketsView = function() {
    ticketsViewActive = false;
    const ticketsPanelEl = document.getElementById('ticketsPanel');
    if (ticketsPanelEl) ticketsPanelEl.classList.add('hidden');
    
    panelL.classList.remove('hidden-panel');
    panelR.classList.remove('hidden-panel');
    dnaBackArrow.style.display = 'none';
    
    cartBtnEl.style.opacity = '1';
    cartBtnEl.style.pointerEvents = 'auto';

    const ticketBtnEl = document.getElementById('ticketButton');
    if (ticketBtnEl && ticketBtnEl.classList.contains('has-ticket')) {
      ticketBtnEl.style.opacity = '1';
      ticketBtnEl.style.pointerEvents = 'auto';
    }

    if (cssTicketsPanel) {
      cssTicketsPanel.position.set(Math.cos(thetaCartBtn) * panelRadiusCSS, 1.5, Math.sin(thetaCartBtn) * panelRadiusCSS);
      cssTicketsPanel.scale.set(0.035, 0.035, 0.035);
      cssTicketsPanel.lookAt(0, 1.5, 0);
    }
  }

  const cartItems = [];
  const purchasedTickets = [];
  const cartBtn = document.getElementById('cartButton');
  const cartPanel = document.getElementById('cartPanel');
  const cartCloseBtn = document.getElementById('closeCartBtn');
  const closeTicketsBtn = document.getElementById('closeTicketsBtn');
  const cartItemsContainer = document.getElementById('cartItems');
  const ticketsListContainer = document.getElementById('ticketsList');
  const cartCountEl = document.getElementById('cartCount');
  const ticketCountEl = document.getElementById('ticketCount');
  const checkoutBtn = document.getElementById('checkoutBtn');

  if (cartBtn && cartPanel && cartCloseBtn) {
    cartBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (!cartViewActive) {
        showCartView();
      }
      if (window.audioEngine) window.audioEngine.playClick();
    });
    cartCloseBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (cartViewActive) {
        hideCartView();
      }
      if (window.audioEngine) window.audioEngine.playClick();
    });
    // Evita che cliccando nel carrello si chiuda o interagisca col 3D
    cartPanel.addEventListener('click', e => e.stopPropagation());
  }
  
  if (closeTicketsBtn) {
    closeTicketsBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (ticketsViewActive) {
        hideTicketsView();
      }
      if (window.audioEngine) window.audioEngine.playClick();
    });
  }
  
  if (ticketsPanelEl) {
    ticketsPanelEl.addEventListener('click', e => e.stopPropagation());
  }

  // Aggiungi click listeners per i nodi della timeline HTML (#floatingTimeline)
  const htmlTimelineNodes = document.querySelectorAll('#floatingTimeline .timeline-node');
  htmlTimelineNodes.forEach((node, idx) => {
    node.addEventListener('click', (e) => {
      e.stopPropagation();
      if (window.audioEngine) window.audioEngine.playClick();
      // Mostra le info del frammento genetico corrispondente (stesso indice)
      showGeneInfo(idx);
    });
  });

  // Make updateCartUI global so it can be called from inside handlers
  window.updateCartUI = function() {
    if (!cartItemsContainer || !cartCountEl || !checkoutBtn) return;
    
    cartCountEl.textContent = cartItems.length;
    
    if (cartItems.length === 0) {
      cartBtn.classList.remove('cart-has-items');
      cartItemsContainer.innerHTML = '<div class="cart-empty">Il carrello è vuoto.</div>';
      checkoutBtn.disabled = true;
      return;
    }
    
    cartBtn.classList.add('cart-has-items');
    checkoutBtn.disabled = false;
    cartItemsContainer.innerHTML = '';
    cartItems.forEach((item, index) => {
      const el = document.createElement('div');
      el.className = 'cart-item';
      el.innerHTML = `
        <div class="cart-item-header">
          <span class="cart-item-title">${item.title}</span>
          <button class="cart-item-remove" data-index="${index}">X</button>
        </div>
        <div class="cart-item-details">
          <span>${item.date} - ${item.time}</span>
          <span class="cart-item-price">${item.price}</span>
        </div>
      `;
      cartItemsContainer.appendChild(el);
    });

    // Add remove listeners
    document.querySelectorAll('.cart-item-remove').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const idx = parseInt(e.target.getAttribute('data-index'), 10);
        cartItems.splice(idx, 1);
        if (window.audioEngine) window.audioEngine.playClick();
        window.updateCartUI();
      });
    });
  };

  window.updateTicketsUI = function() {
    const tBtn = document.getElementById('ticketButton');
    if (tBtn) {
      if (purchasedTickets.length > 0) {
        tBtn.classList.add('cart-has-items');
      } else {
        tBtn.classList.remove('cart-has-items');
      }
    }

    if (ticketCountEl) {
      ticketCountEl.textContent = purchasedTickets.length.toString();
    }
    
    if (!ticketsListContainer) return;
    
    if (purchasedTickets.length === 0) {
      ticketsListContainer.innerHTML = '<div class="cart-empty">Nessun biglietto acquistato.</div>';
      return;
    }
    
    ticketsListContainer.innerHTML = '';
    purchasedTickets.forEach((item, index) => {
      const el = document.createElement('div');
      el.className = 'cart-item ticket-item';
      el.innerHTML = `
        <div class="cart-item-header">
          <span class="cart-item-title">${item.title}</span>
        </div>
        <div class="cart-item-details">
          <span>${item.date} - ${item.time}</span>
          <span class="cart-item-price">ACQUISTATO</span>
        </div>
      `;
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        if (window.audioEngine) window.audioEngine.playClick();
        
        // Chiudi il pannello dei biglietti
        if (typeof hideTicketsView === 'function') hideTicketsView();
        
        // Popola i dati del biglietto animus
        const animusTicketEl = document.getElementById('animusTicket');
        const expNameEl = document.getElementById('ticketExperienceName');
        const uNameEl = document.getElementById('ticketUserName');
        
        if (expNameEl) expNameEl.textContent = item.title;
        
        const nameInput = document.getElementById('userName');
        const surnameInput = document.getElementById('userSurname');
        let fullName = 'SCONOSCIUTO';
        if (nameInput && surnameInput) {
          const n = nameInput.value.trim();
          const s = surnameInput.value.trim();
          if (n || s) fullName = (n + ' ' + s).trim();
        }
        if (uNameEl) uNameEl.textContent = fullName.toUpperCase();
        
        const qrImg = document.getElementById('ticketQrCode');
        if (qrImg) {
          let baseUrl = '';
          if (window.location.protocol === 'file:') {
            baseUrl = 'http://172.20.10.3:8000/';
          } else {
            baseUrl = window.location.href.split('?')[0];
            if (baseUrl.endsWith('index.html')) baseUrl = baseUrl.replace('index.html', '');
            if (!baseUrl.endsWith('/')) baseUrl += '/';
          }
          const mobileUrl = baseUrl + `mobile_ticket.html?name=${encodeURIComponent(fullName.toUpperCase())}&exp=${encodeURIComponent(item.title)}`;
          qrImg.src = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(mobileUrl)}`;
          qrImg.style.display = 'block';
        }
        
        // Mostra il biglietto e nascondi gli altri pannelli per adattarlo allo schermo curvo
        if (animusTicketEl) animusTicketEl.classList.remove('hidden-panel');
        
        const btnRet = document.getElementById('btnReturnAnimus');
        if (btnRet) btnRet.style.display = 'none';
        
        const btnCloseTicket = document.getElementById('closeTicketBtn');
        if (btnCloseTicket) {
          btnCloseTicket.style.display = 'block';
        }
        
        // Nascondi i bottoni HUD per evitare click accidentali e overlap
        const cartBtn = document.getElementById('cartButton');
        if (cartBtn) { cartBtn.style.opacity = '0'; cartBtn.style.pointerEvents = 'none'; }
        const tBtn = document.getElementById('ticketButton');
        if (tBtn) { tBtn.style.opacity = '0'; tBtn.style.pointerEvents = 'none'; }
        const dnaBackArrow = document.getElementById('dnaBackArrow');
        if (dnaBackArrow) dnaBackArrow.style.display = 'none';
        
        const panelL = document.getElementById('panelL');
        const panelR = document.getElementById('panelR');
        const dnaView = document.getElementById('floatingTimeline');
        const globalTimeline = document.querySelector('.global-timeline');
        
        if (panelL) panelL.classList.add('hidden-panel');
        if (panelR) panelR.classList.add('hidden-panel');
        if (dnaView) dnaView.classList.add('hidden-panel');
        if (globalTimeline) globalTimeline.classList.add('hidden-panel');
      });
      ticketsListContainer.appendChild(el);
    });
  };

  /* ── PAYMENT LOGIC ── */
  const paymentPanelEl = document.getElementById('paymentPanel');
  const userInfoPanelEl = document.getElementById('userInfoPanel');
  const paymentSuccessPanelEl = document.getElementById('paymentSuccessPanel');
  
  const cssPaymentPanel = new THREE.CSS3DObject(paymentPanelEl);
  cssPaymentPanel.position.set(Math.cos(thetaCartBtn) * panelRadiusCSS, 1.5, Math.sin(thetaCartBtn) * panelRadiusCSS);
  cssPaymentPanel.scale.set(0.035, 0.035, 0.035);
  cssPaymentPanel.lookAt(0, 1.5, 0);
  gridGroup.add(cssPaymentPanel);

  const cssUserInfoPanel = new THREE.CSS3DObject(userInfoPanelEl);
  cssUserInfoPanel.position.set(Math.cos(thetaCartBtn) * panelRadiusCSS, 1.5, Math.sin(thetaCartBtn) * panelRadiusCSS);
  cssUserInfoPanel.scale.set(0.035, 0.035, 0.035);
  cssUserInfoPanel.lookAt(0, 1.5, 0);
  gridGroup.add(cssUserInfoPanel);

  const cssPaymentSuccessPanel = new THREE.CSS3DObject(paymentSuccessPanelEl);
  cssPaymentSuccessPanel.position.set(Math.cos(thetaCartBtn) * panelRadiusCSS, 1.5, Math.sin(thetaCartBtn) * panelRadiusCSS);
  cssPaymentSuccessPanel.scale.set(0.035, 0.035, 0.035);
  cssPaymentSuccessPanel.lookAt(0, 1.5, 0);
  gridGroup.add(cssPaymentSuccessPanel);

  const syncScreenEl = document.getElementById('syncScreen');
  const cssSyncScreen = new THREE.CSS3DObject(syncScreenEl);
  cssSyncScreen.position.set(Math.cos(thetaCenter) * panelRadiusCSS, 0, Math.sin(thetaCenter) * panelRadiusCSS);
  cssSyncScreen.scale.set(0.045, 0.045, 0.045);
  cssSyncScreen.lookAt(0, 0, 0);
  gridGroup.add(cssSyncScreen);

  const animusTicketEl = document.getElementById('animusTicket');
  const cssAnimusTicket = new THREE.CSS3DObject(animusTicketEl);
  // Fissiamo il biglietto allo schermo curvo come gli altri pannelli, allineato alle linee (Y=1.5)
  cssAnimusTicket.position.set(Math.cos(thetaCenter) * panelRadiusCSS, 1.5, Math.sin(thetaCenter) * panelRadiusCSS);
  cssAnimusTicket.scale.set(0.038, 0.038, 0.038); 
  cssAnimusTicket.lookAt(0, 1.5, 0); 
  gridGroup.add(cssAnimusTicket);
  window.cssAnimusTicket = cssAnimusTicket; 
  scene.add(camera);

  const closePaymentBtn = document.getElementById('closePaymentBtn');
  const confirmPaymentBtn = document.getElementById('confirmPaymentBtn');
  const closeSuccessBtn = document.getElementById('closeSuccessBtn');
  const paymentTotalAmount = document.getElementById('paymentTotalAmount');

  function calculateTotal() {
    let total = 0;
    cartItems.forEach(item => {
      const val = parseInt(item.price.replace(/[^\d]/g, ''), 10);
      if (!isNaN(val)) total += val;
    });
    return total;
  }

  function showPaymentView() {
    cartPanelEl.classList.add('hidden');
    paymentPanelEl.classList.remove('hidden');
    userInfoPanelEl.classList.remove('hidden');
    
    // Position User Info on the left
    const thetaUserInfo = thetaCenter - 0.28;
    cssUserInfoPanel.position.set(Math.cos(thetaUserInfo) * panelRadiusCSS, 0, Math.sin(thetaUserInfo) * panelRadiusCSS);
    cssUserInfoPanel.scale.set(0.045, 0.045, 0.045);
    cssUserInfoPanel.lookAt(0, 0, 0);

    // Position Payment on the right
    const thetaPayment = thetaCenter + 0.35;
    cssPaymentPanel.position.set(Math.cos(thetaPayment) * panelRadiusCSS, 0, Math.sin(thetaPayment) * panelRadiusCSS);
    cssPaymentPanel.scale.set(0.045, 0.045, 0.045);
    cssPaymentPanel.lookAt(0, 0, 0);

    paymentTotalAmount.textContent = '€ ' + calculateTotal();
  }

  function hidePaymentView() {
    paymentPanelEl.classList.add('hidden');
    userInfoPanelEl.classList.add('hidden');
    cartPanelEl.classList.remove('hidden');
    
    // Reset positions
    cssPaymentPanel.position.set(Math.cos(thetaCartBtn) * panelRadiusCSS, 1.5, Math.sin(thetaCartBtn) * panelRadiusCSS);
    cssPaymentPanel.scale.set(0.035, 0.035, 0.035);
    cssPaymentPanel.lookAt(0, 1.5, 0);

    cssUserInfoPanel.position.set(Math.cos(thetaCartBtn) * panelRadiusCSS, 1.5, Math.sin(thetaCartBtn) * panelRadiusCSS);
    cssUserInfoPanel.scale.set(0.035, 0.035, 0.035);
    cssUserInfoPanel.lookAt(0, 1.5, 0);
  }

  if (checkoutBtn) {
    checkoutBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (window.audioEngine) window.audioEngine.playClick();
      showPaymentView();
    });
  }

  if (closePaymentBtn) {
    closePaymentBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (window.audioEngine) window.audioEngine.playClick();
      hidePaymentView();
    });
  }

  if (confirmPaymentBtn) {
    confirmPaymentBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (window.audioEngine) window.audioEngine.playClick();
      
      confirmPaymentBtn.textContent = "ELABORAZIONE...";
      confirmPaymentBtn.disabled = true;
      
      setTimeout(() => {
        paymentPanelEl.classList.add('hidden');
        userInfoPanelEl.classList.add('hidden');
        
        // Reset payment panel positions since they are hidden now
        cssPaymentPanel.position.set(Math.cos(thetaCartBtn) * panelRadiusCSS, 1.5, Math.sin(thetaCartBtn) * panelRadiusCSS);
        cssPaymentPanel.scale.set(0.035, 0.035, 0.035);
        cssPaymentPanel.lookAt(0, 1.5, 0);

        cssUserInfoPanel.position.set(Math.cos(thetaCartBtn) * panelRadiusCSS, 1.5, Math.sin(thetaCartBtn) * panelRadiusCSS);
        cssUserInfoPanel.scale.set(0.035, 0.035, 0.035);
        cssUserInfoPanel.lookAt(0, 1.5, 0);

        // Hide everything from the curved display
        const panelL = document.getElementById('panelL');
        const panelR = document.getElementById('panelR');
        const logo = document.getElementById('abstergoLogo');
        const cartBtn = document.getElementById('cartButton');
        const dnaView = document.getElementById('floatingTimeline');
        const globalTimeline = document.querySelector('.global-timeline');
        
        if (panelL) panelL.classList.add('hidden-panel');
        if (panelR) panelR.classList.add('hidden-panel');
        if (logo) logo.classList.add('hidden-panel');
        if (cartBtn) cartBtn.style.opacity = '0';
        if (dnaView) dnaView.classList.add('hidden-panel');
        if (globalTimeline) globalTimeline.classList.add('hidden-panel');
        
        if (typeof tlNodeEls !== 'undefined') {
          tlNodeEls.forEach(el => el.style.opacity = '0');
        }
        if (typeof tlTickObjs !== 'undefined') {
          tlTickObjs.forEach(obj => obj.visible = false);
        }
        if (typeof tlArcLine !== 'undefined') {
          tlArcLine.visible = false;
          if (tlArcLine.userData && tlArcLine.userData.glow) {
            tlArcLine.userData.glow.visible = false;
          }
        }

        // Show sync screen
        if (syncScreenEl) syncScreenEl.classList.remove('hidden-panel');
        
        const btnRet = document.getElementById('btnReturnAnimus');
        if (btnRet) btnRet.style.display = 'block';
        
        const btnCloseTicket = document.getElementById('closeTicketBtn');
        if (btnCloseTicket) btnCloseTicket.style.display = 'none';
        
        confirmPaymentBtn.textContent = "CONFERMA E SINCRONIZZA";
        confirmPaymentBtn.disabled = false;
        
        // Save ticket info before emptying cart
        const userNameInput = document.getElementById('userNameInput');
        const ticketUserName = document.getElementById('ticketUserName');
        const ticketExperienceName = document.getElementById('ticketExperienceName');
        
        if (ticketUserName) {
          ticketUserName.textContent = userNameInput && userNameInput.value.trim() ? userNameInput.value.toUpperCase() : 'SCONOSCIUTO';
        }
        if (ticketExperienceName) {
          if (cartItems.length > 0) {
            const expName = cartItems.map(item => item.title).join(' + ').toUpperCase();
            ticketExperienceName.textContent = expName;
            
            const qrImg = document.getElementById('ticketQrCode');
            if (qrImg) {
              const uName = ticketUserName ? ticketUserName.textContent : 'SCONOSCIUTO';
              let baseUrl = '';
              if (window.location.protocol === 'file:') {
                baseUrl = 'http://172.20.10.3:8000/';
              } else {
                baseUrl = window.location.href.split('?')[0];
                if (baseUrl.endsWith('index.html')) baseUrl = baseUrl.replace('index.html', '');
                if (!baseUrl.endsWith('/')) baseUrl += '/';
              }
              const mobileUrl = baseUrl + `mobile_ticket.html?name=${encodeURIComponent(uName)}&exp=${encodeURIComponent(expName)}`;
              qrImg.src = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(mobileUrl)}`;
              qrImg.style.display = 'block';
            }
          } else {
            ticketExperienceName.textContent = 'NESSUNA';
            const qrImg = document.getElementById('ticketQrCode');
            if (qrImg) qrImg.style.display = 'none';
          }
        }
        
        // Add to purchased tickets
        purchasedTickets.push(...cartItems);
        window.updateTicketsUI();
        
        // Empty cart
        cartItems.length = 0;
        window.updateCartUI();

        const ticketBtnEl = document.getElementById('ticketButton');
        if (ticketBtnEl) {
          ticketBtnEl.classList.add('has-ticket');
          ticketBtnEl.style.display = 'flex';
        }

        // --- ANIMAZIONE CHIUSURA OCCHI E WHITE ROOM ---
        // Avvia la transizione cinematica in 3 fasi
        setTimeout(() => {
          if (window.playSyncTransition) {
            window.playSyncTransition();
          } else {
            console.error("Transizione non trovata, fallback alla white room");
            transitionToWhiteRoom();
            if (syncScreenEl) syncScreenEl.classList.add('hidden-panel');
            setTimeout(() => {
              const animusTicketEl = document.getElementById('animusTicket');
              if (animusTicketEl) animusTicketEl.classList.remove('hidden-panel');
            }, 1000);
          }
        }, 2500); // 2.5 seconds of "SINCRONIZZAZIONE..."
      }, 1500);
    });
  }

  if (closeSuccessBtn) {
    closeSuccessBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (window.audioEngine) window.audioEngine.playClick();
      
      paymentSuccessPanelEl.classList.add('hidden');
      
      // Reset position
      cssPaymentSuccessPanel.position.set(Math.cos(thetaCartBtn) * panelRadiusCSS, 1.5, Math.sin(thetaCartBtn) * panelRadiusCSS);
      cssPaymentSuccessPanel.scale.set(0.035, 0.035, 0.035);
      cssPaymentSuccessPanel.lookAt(0, 1.5, 0);
      
      hideCartView();
    });
  }

  /* ── WHITE ROOM TRANSITION ── */
  function transitionToWhiteRoom() {
    bgGroup.visible = false;
    gridGroup.visible = false;
    
    // Cambia il colore di sfondo e la nebbia ad un bianco luminoso/grigio chiaro
    if (renderer) renderer.setClearColor(0xe6ecef, 1);
    scene.fog = new THREE.FogExp2(0xe6ecef, 0.012);
    
    const whiteRoomGroup = new THREE.Group();
    window.animusState.whiteRoomGroup = whiteRoomGroup; // Salvo per poterla rimuovere
    scene.add(whiteRoomGroup);
    
    // Griglie orizzontali in stile stanza della simulazione (sopra e sotto)
    const gridHelper = new THREE.GridHelper(200, 100, 0xffffff, 0xdddddd);
    gridHelper.position.y = -10;
    whiteRoomGroup.add(gridHelper);

    const gridHelperTop = new THREE.GridHelper(200, 100, 0xffffff, 0xdddddd);
    gridHelperTop.position.y = 10;
    whiteRoomGroup.add(gridHelperTop);
    
    // Linee luminose verticali e orizzontali sparse per dare senso di infinito digitale
    const lineMat = new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.8 });
    for (let i = 0; i < 80; i++) {
      const x = (Math.random() - 0.5) * 150;
      const z = (Math.random() - 0.5) * 150;
      
      // Linee verticali
      const geo = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(x, -20, z),
        new THREE.Vector3(x, 20, z)
      ]);
      whiteRoomGroup.add(new THREE.Line(geo, lineMat));
      
      // Alcune linee orizzontali che fluttuano
      if (Math.random() > 0.5) {
        const y = (Math.random() - 0.5) * 20;
        const x2 = (Math.random() - 0.5) * 150;
        const geoH = new THREE.BufferGeometry().setFromPoints([
          new THREE.Vector3(x, y, z),
          new THREE.Vector3(x2, y, z)
        ]);
        whiteRoomGroup.add(new THREE.Line(geoH, lineMat));
      }
    }

    // Luce extra per far risaltare il bianco
    const ambient = new THREE.AmbientLight(0xffffff, 1.8);
    whiteRoomGroup.add(ambient);

    // Modifica gli effetti CSS post processing (vignettatura e scanlines)
    const scanlines = document.getElementById('scanlines');
    if(scanlines) scanlines.style.opacity = '0.05';
    const vignette = document.getElementById('vignette');
    if(vignette) vignette.style.background = 'radial-gradient(ellipse 110% 90% at 50% 55%, transparent 50%, rgba(255, 255, 255, 0.5) 100%)';
  }

  if (paymentPanelEl) paymentPanelEl.addEventListener('click', e => e.stopPropagation());
  if (userInfoPanelEl) userInfoPanelEl.addEventListener('click', e => e.stopPropagation());
  if (paymentSuccessPanelEl) paymentSuccessPanelEl.addEventListener('click', e => e.stopPropagation());

  // Esponi lo stato per la transizione cinematica (transition.js)
  window.animusState = {
    scene: scene,
    camera: camera,
    renderer: renderer,
    bgGroup: bgGroup,
    gridGroup: gridGroup,
    transitionToWhiteRoom: transitionToWhiteRoom
  };

  // Funzione per tornare indietro dopo l'acquisto
  window.closeTicketView = function(e) {
    if (e) {
      e.stopPropagation();
      e.preventDefault();
    }
    if (window.audioEngine) window.audioEngine.playClick();
    const animusTicketEl = document.getElementById('animusTicket');
    if (animusTicketEl) animusTicketEl.classList.add('hidden-panel');
    
    // Ripristina i bottoni HUD
    const cartBtnEl = document.getElementById('cartButton');
    if (cartBtnEl) {
      cartBtnEl.style.opacity = '1';
      cartBtnEl.style.pointerEvents = 'auto';
    }
    const tBtn = document.getElementById('ticketButton');
    if (tBtn && tBtn.classList.contains('has-ticket')) {
      tBtn.style.opacity = '1';
      tBtn.style.pointerEvents = 'auto';
    }

    // Forza la chiusura di eventuali viste WebGL rimaste in sottofondo
    if (typeof hideTimelineView === 'function' && typeof tlArcLine !== 'undefined' && tlArcLine && tlArcLine.visible) hideTimelineView();
    if (typeof hideDNAView === 'function' && typeof dnaGroup !== 'undefined' && dnaGroup && dnaGroup.visible) hideDNAView();
    if (typeof hideGeneInfo === 'function' && selectedDnaGene !== -1) hideGeneInfo();
    if (typeof hideCharacterView === 'function' && typeof charViewEpoch !== 'undefined' && charViewEpoch !== -1) hideCharacterView(false);
    
    // Ripristina ESATTAMENTE il Main Menu (solo panelL e panelR)
    const panelL = document.getElementById('panelL');
    const panelR = document.getElementById('panelR');
    const dnaView = document.getElementById('floatingTimeline');
    const globalTimeline = document.querySelector('.global-timeline');
    const dnaBackArrow = document.getElementById('dnaBackArrow');
    
    if (panelL) panelL.classList.remove('hidden-panel');
    if (panelR) panelR.classList.remove('hidden-panel');
    if (dnaView) dnaView.classList.add('hidden-panel');
    if (globalTimeline) globalTimeline.classList.add('hidden-panel');
    if (dnaBackArrow) dnaBackArrow.style.display = 'none';
  };

  const closeTicketBtn = document.getElementById('closeTicketBtn');
  if (closeTicketBtn) closeTicketBtn.addEventListener('click', window.closeTicketView);

  function returnFromWhiteRoom() {
    if (window.animusState.whiteRoomGroup) {
      scene.remove(window.animusState.whiteRoomGroup);
      window.animusState.whiteRoomGroup = null;
    }

    // Ripristina sfondo e nebbia originali
    if (renderer) renderer.setClearColor(0x1a1a1a, 1);
    scene.fog = new THREE.FogExp2(0x1a1a1a, 0.025);

    // Ripristina gruppi della stanza
    bgGroup.visible = true;
    gridGroup.visible = true;

    // Ripristina post processing
    const scanlines = document.getElementById('scanlines');
    if(scanlines) scanlines.style.opacity = '1';
    const vignette = document.getElementById('vignette');
    if(vignette) vignette.style.background = 'radial-gradient(ellipse 110% 90% at 50% 55%, transparent 35%, rgba(0, 0, 0, 0.6) 100%)';

    // Nascondi biglietto e sync screen
    const animusTicketEl = document.getElementById('animusTicket');
    if (animusTicketEl) animusTicketEl.classList.add('hidden-panel');
    if (syncScreenEl) syncScreenEl.classList.add('hidden-panel');
    
    const closeTicketBtn = document.getElementById('closeTicketBtn');
    if (closeTicketBtn) {
      closeTicketBtn.removeEventListener('click', window.closeTicketView);
      closeTicketBtn.addEventListener('click', window.closeTicketView);
    }

    // Mostra HUD e ripristina logo
    const hudContainer = document.getElementById('hud-container');
    if (hudContainer) {
      hudContainer.style.display = 'block';
      hudContainer.style.filter = ''; // Rimuove eventuale blur residuo dalla transizione
    }
    
    const logo = document.getElementById('abstergoLogo');
    if (logo) logo.classList.remove('hidden-panel');

    // Resetta bottone pagamento se l'utente vuole comprare di nuovo
    if (confirmPaymentBtn) {
      confirmPaymentBtn.textContent = "CONFERMA SINCRONIZZAZIONE";
      confirmPaymentBtn.disabled = false;
    }

    // ── Reset completo di TUTTI gli stati di navigazione ──
    // Nascondi pannelli di pagamento
    paymentPanelEl.classList.add('hidden');
    userInfoPanelEl.classList.add('hidden');
    paymentSuccessPanelEl.classList.add('hidden');
    cssPaymentPanel.position.set(Math.cos(thetaCartBtn) * panelRadiusCSS, 1.5, Math.sin(thetaCartBtn) * panelRadiusCSS);
    cssPaymentPanel.scale.set(0.035, 0.035, 0.035);
    cssPaymentPanel.lookAt(0, 1.5, 0);
    cssUserInfoPanel.position.set(Math.cos(thetaCartBtn) * panelRadiusCSS, 1.5, Math.sin(thetaCartBtn) * panelRadiusCSS);
    cssUserInfoPanel.scale.set(0.035, 0.035, 0.035);
    cssUserInfoPanel.lookAt(0, 1.5, 0);
    cssPaymentSuccessPanel.position.set(Math.cos(thetaCartBtn) * panelRadiusCSS, 1.5, Math.sin(thetaCartBtn) * panelRadiusCSS);
    cssPaymentSuccessPanel.scale.set(0.035, 0.035, 0.035);
    cssPaymentSuccessPanel.lookAt(0, 1.5, 0);

    // Nascondi carrello e resetta stato
    cartViewActive = false;
    cartPreviousState = 'cards';
    cartPreviousGene = -1;
    cartPreviousEpoch = -1;
    cartPanelEl.classList.add('hidden');
    cssCartPanel.position.set(Math.cos(thetaCartBtn) * panelRadiusCSS, 1.5, Math.sin(thetaCartBtn) * panelRadiusCSS);
    cssCartPanel.scale.set(0.035, 0.035, 0.035);
    cssCartPanel.lookAt(0, 1.5, 0);

    // Nascondi pannelli gene (booking)
    selectedDnaGene = -1;
    lastHoveredGene = -1;
    scLeftEl.style.opacity  = '0'; scLeftEl.style.pointerEvents  = 'none';
    scRightEl.style.opacity = '0'; scRightEl.style.pointerEvents = 'none';

    // Nascondi pannelli personaggio
    charListEl.style.opacity   = '0'; charListEl.style.pointerEvents   = 'none';
    charDetailEl.style.opacity = '0'; charDetailEl.style.pointerEvents = 'none';
    charListCss.position.set(0, 1000, 0);
    charDetailCss.position.set(0, 1000, 0);
    charViewEpoch = -1;

    // Nascondi DNA
    dnaGroup.visible = false;
    dnaGuideEls.forEach(el => { el.style.opacity = '0'; });
    dnaLabelEls.forEach(el => { el.style.opacity = '0'; });

    // Nascondi timeline
    if (tlArcLine) {
      tlArcLine.visible = false;
      if (tlArcLine.userData && tlArcLine.userData.glow) tlArcLine.userData.glow.visible = false;
    }
    if (tlTickObjs) tlTickObjs.forEach(t => { t.visible = false; });
    if (tlNodeEls) tlNodeEls.forEach((el, s) => {
      el.style.opacity = '0'; el.style.pointerEvents = 'none';
      if (tlNodeCsss && tlNodeCsss[s]) tlNodeCsss[s].position.y = 1000;
    });
    if (tlGuideEl) tlGuideEl.forEach(el => { el.style.opacity = '0'; });
    if (tlDnaGroups) tlDnaGroups.forEach((g, s) => { g.visible = false; if (tlDnaHovers) tlDnaHovers[s] = false; });

    // Ripristina la vista principale: pannelli L e R visibili
    panelL.classList.remove('hidden-panel');
    panelR.classList.remove('hidden-panel');
    panelL.style.opacity = '1';
    panelR.style.opacity = '1';
    panelL.style.pointerEvents = 'auto';
    panelR.style.pointerEvents = 'auto';
    
    // Ripristina carrello e logo visibili
    cartBtnEl.style.opacity = '1';
    cartBtnEl.style.pointerEvents = 'auto';
    
    const ticketBtnEl = document.getElementById('ticketButton');
    if (ticketBtnEl && ticketBtnEl.classList.contains('has-ticket')) {
      ticketBtnEl.style.opacity = '1';
      ticketBtnEl.style.pointerEvents = 'auto';
    }
    logoEl.style.opacity = '1';
    
    // Nascondi freccia indietro (siamo nella vista Cards)
    dnaBackArrow.style.display = 'none';
    
    // Ripristina canvas pointer-events
    canvas.style.pointerEvents = '';
  }

  // Pulsante di ritorno all'animus
  const btnReturnAnimus = document.getElementById('btnReturnAnimus');
  if (btnReturnAnimus) {
    btnReturnAnimus.addEventListener('click', (e) => {
      e.stopPropagation();
      if (window.audioEngine) window.audioEngine.playClick();
      
      const eyelidTop = document.querySelector('.eyelid-top');
      const eyelidBottom = document.querySelector('.eyelid-bottom');
      
      if (eyelidTop && eyelidBottom) {
        // Chiudi gli occhi lentamente
        eyelidTop.style.transition = 'height 1.5s cubic-bezier(0.4, 0.0, 0.2, 1)';
        eyelidBottom.style.transition = 'height 1.5s cubic-bezier(0.4, 0.0, 0.2, 1)';
        eyelidTop.style.height = '50%';
        eyelidBottom.style.height = '50%';
        
        // Quando lo schermo è nero, ripristina la scena
        setTimeout(() => {
          returnFromWhiteRoom();
          
          // Riapri gli occhi
          eyelidTop.style.transition = 'height 1.5s cubic-bezier(0.4, 0.0, 0.2, 1)';
          eyelidBottom.style.transition = 'height 1.5s cubic-bezier(0.4, 0.0, 0.2, 1)';
          eyelidTop.style.height = '0%';
          eyelidBottom.style.height = '0%';
        }, 1600);
      } else {
        returnFromWhiteRoom();
      }
    });
  }

  // --- CINEMATIC TRANSITION LOGIC ---
  function playCinematicTransition() {
    const overlay = document.getElementById('cinematicOverlay');
    const video = document.getElementById('cinematicVideo');
    const skipBtn = document.getElementById('skipCinematicBtn');
    const eyelidTop = document.querySelector('.eyelid-top');
    const eyelidBottom = document.querySelector('.eyelid-bottom');
    
    if (!overlay || !video) {
      doFallbackTransition();
      return;
    }

    // Effetto "svenimento": chiudi le palpebre
    if (eyelidTop && eyelidBottom) {
      eyelidTop.style.transition = 'height 1.5s cubic-bezier(0.4, 0.0, 0.2, 1)';
      eyelidBottom.style.transition = 'height 1.5s cubic-bezier(0.4, 0.0, 0.2, 1)';
      eyelidTop.style.height = '50%';
      eyelidBottom.style.height = '50%';
    }

    // Rewind del video se era già stato riprodotto
    video.currentTime = 0;

    // Attendi la chiusura delle palpebre prima di caricare/avviare il video (1.5s)
    setTimeout(() => {
      // Mostra overlay in primo piano
      overlay.style.zIndex = '9999';
      overlay.style.opacity = '1';
      overlay.classList.remove('hidden');
      overlay.style.pointerEvents = 'auto';
      
      let fallbackTriggered = false;
    let fallbackTimeout = setTimeout(() => {
      if (!fallbackTriggered && video.readyState < 3) {
        console.warn("Video stall timeout (5s). Triggering fallback.");
        doFallbackTransition();
      }
    }, 5000); // 5 secondi per permettere al file pesante di caricarsi
    
    const onVideoError = () => {
      console.warn("Video error event triggered.");
      doFallbackTransition();
    };
    video.addEventListener('error', onVideoError, true);
    
    // Tenta di avviare il video
    let playPromise = video.play();
    
    if (playPromise !== undefined) {
      playPromise.then(() => {
        clearTimeout(fallbackTimeout);
        // Sblocca audio se possibile
        video.muted = false;
        
        // Il video è partito: riapri lentamente le palpebre per rivelare l'inizio
        if (eyelidTop && eyelidBottom) {
          eyelidTop.style.transition = 'height 2s cubic-bezier(0.4, 0.0, 0.2, 1)';
          eyelidBottom.style.transition = 'height 2s cubic-bezier(0.4, 0.0, 0.2, 1)';
          eyelidTop.style.height = '0%';
          eyelidBottom.style.height = '0%';
        }
        
        // Skip dopo 1.5 secondi
        setTimeout(() => {
          if (!overlay.classList.contains('hidden') && !fallbackTriggered) skipBtn.classList.remove('hidden');
        }, 1500);

        let cleanupDone = false;
        const cleanup = () => {
          if (cleanupDone) return;
          cleanupDone = true;
          
          // Nascondiamo il video cinematico con un fade-out
          overlay.style.opacity = '0';
          setTimeout(() => {
            video.pause();
            overlay.classList.add('hidden');
            overlay.style.pointerEvents = 'none';
            skipBtn.classList.add('hidden');
            showTimelineView();
          }, 400); // 400ms fade-out
          
          document.removeEventListener('click', skipHandler);
          document.removeEventListener('keydown', skipHandler);
          video.removeEventListener('ended', cleanup);
          video.removeEventListener('error', onVideoError, true);
        };

        const skipHandler = (e) => {
          if (e.type === 'keydown' && e.key !== 'Escape') return;
          cleanup();
        };

        document.addEventListener('click', skipHandler);
        document.addEventListener('keydown', skipHandler);
        video.addEventListener('ended', cleanup);
        
      }).catch(err => {
        console.warn("Video autoplay failed or missing:", err);
        doFallbackTransition();
      });
    } else {
      doFallbackTransition();
    }
    
    function doFallbackTransition() {
      if (fallbackTriggered) return;
      fallbackTriggered = true;
      clearTimeout(fallbackTimeout);
      video.removeEventListener('error', onVideoError, true);
      
      if (overlay) {
        overlay.classList.add('hidden');
        overlay.style.pointerEvents = 'none';
      }
      // Fallback: transizione più sicura e veloce
      const flash = document.getElementById('animus-white-flash');
      if (flash) {
        flash.style.transition = 'opacity 0.2s ease-in';
        flash.style.background = '#000';
        flash.style.opacity = '1';
        flash.style.pointerEvents = 'auto';
        setTimeout(() => {
          // Nel fallback apri subito gli occhi per evitare che resti nero
          if (eyelidTop && eyelidBottom) {
            eyelidTop.style.transition = 'height 0.5s ease-in';
            eyelidBottom.style.transition = 'height 0.5s ease-in';
            eyelidTop.style.height = '0%';
            eyelidBottom.style.height = '0%';
          }
          showTimelineView();
          flash.style.opacity = '0';
          flash.style.pointerEvents = 'none';
          setTimeout(() => { 
            flash.style.background = ''; 
            flash.style.transition = 'opacity 1.5s ease-in'; 
          }, 300);
        }, 250);
      } else {
        if (eyelidTop && eyelidBottom) {
          eyelidTop.style.height = '0%';
          eyelidBottom.style.height = '0%';
        }
        showTimelineView();
      }
    }
    
    }, 1500); // Fine attesa palpebre chiuse
  }

  animate();
})();
