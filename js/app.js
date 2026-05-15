(function () {
  'use strict';

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

  // Griglia architettonica stampata sul muro (simula pannelli metallici)
  const wallGrid = new THREE.GridHelper(400, 80, 0x111111, 0x111111);
  wallGrid.rotation.x = Math.PI / 2;
  wallGrid.position.set(0, 0, -34.8);
  bgGroup.add(wallGrid);

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
    side: THREE.BackSide,
    depthWrite: false // Evita problemi visivi con gli elementi dietro
  });
  gridGroup.add(new THREE.Mesh(screenGlassGeo, screenGlassMat));

  // CORNICI METALLICHE SPESSE (Sopra e Sotto il vetro)
  const bezelGeo = new THREE.CylinderGeometry(gridRadius + 0.2, gridRadius + 0.2, 1.5, 64, 1, true, cylThetaStart, arcLength);
  const bezelMat = new THREE.MeshStandardMaterial({ 
    color: 0x11161a, 
    metalness: 0.9, 
    roughness: 0.4, 
    side: THREE.BackSide,
    transparent: true
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
    opacity: 0, // Parte spento, si accende alla fine
    side: THREE.BackSide,
    blending: THREE.AdditiveBlending
  });
  const topGlowMat = new THREE.MeshBasicMaterial({ 
    color: 0x00ffff, 
    transparent: true, 
    opacity: 0, // Parte spento, si accende alla fine
    side: THREE.BackSide,
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

  /* ══════════════════════════════════════════════
     CSS3D PANELS (Anchored to the Grid)
  ══════════════════════════════════════════════ */
  const spread = 0.42;
  const panelRadiusCSS = 24.8; // Appena dentro il vetro

  // 1) LOGO
  const logoEl = document.getElementById('abstergoLogo');
  const cssLogo = new THREE.CSS3DObject(logoEl);
  const thetaLogo = thetaCenter - 0.55;
  cssLogo.position.set(Math.cos(thetaLogo) * panelRadiusCSS, 5.5, Math.sin(thetaLogo) * panelRadiusCSS);
  cssLogo.scale.set(0.03, 0.03, 0.03);
  cssLogo.lookAt(0, 5.5, 0); 
  gridGroup.add(cssLogo);

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
  cssObjDetail.position.set(Math.cos(thetaCenter) * panelRadiusCSS, -1, Math.sin(thetaCenter) * panelRadiusCSS);
  cssObjDetail.scale.set(0.035, 0.035, 0.035);
  cssObjDetail.lookAt(0, -1, 0);
  gridGroup.add(cssObjDetail);

  // HOVER STATES PER INGRANDIMENTO FLUIDO IN 3D
  let hoverL = false;
  let hoverR = false;

  panelL.addEventListener('mouseenter', () => hoverL = true);
  panelL.addEventListener('mouseleave', () => hoverL = false);

  panelR.addEventListener('mouseenter', () => hoverR = true);
  panelR.addEventListener('mouseleave', () => hoverR = false);


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
  
  // Impostazioni iniziali: la struttura in vetro è già al centro, ma ruotata per nascondere le schede a destra
  gridGroup.position.set(0, 0, 5); 
  gridGroup.rotation.y = -Math.PI / 1.1; 
  
  // Impostiamo l'opacità HTML a zero per iniziare
  logoEl.style.opacity = "0";
  panelL.style.opacity = "0";
  panelR.style.opacity = "0";

  let ledProgress = 0;

  function animate(){
    requestAnimationFrame(animate);

    // --- ANIMUS BOOT ANIMATION ---
    if (bootProgress < 1) {
      bootProgress += 0.0015; // Movimento rallentato
      if (bootProgress >= 1) {
        bootProgress = 1;
        if (!hasBooted) {
          hasBooted = true;
        }
      }
      
      // Quartic ease out per un arrivo morbido
      const ease = 1 - Math.pow(1 - bootProgress, 4);
      
      // Effetto meccanismo che scorre: rotazione da destra verso sinistra
      gridGroup.rotation.y = (-Math.PI / 1.1) * (1 - ease);

      // Comparsa graduale (fade in) dell'intero display olografico
      const fadeEase = ease; // L'opacità segue la curva di ease
      
      screenGlassMat.opacity = fadeEase;
      bezelMat.opacity = fadeEase;
      // I LED (glowMat) restano spenti finché lo scorrimento non finisce
      gridMatHoriz.opacity = 0.15 * fadeEase;
      gridMatVert.opacity = 0.08 * fadeEase;

      logoEl.style.opacity = fadeEase;
      panelL.style.opacity = fadeEase;
      panelR.style.opacity = fadeEase;
    } else {
      // Quando il meccanismo ha finito di scorrere, si accendono i LED
      if (ledProgress < 1) {
        ledProgress += 0.05;
        if (ledProgress >= 1) {
          ledProgress = 1;
          // Opacity fissa finale: non verrà più toccata
          bottomGlowMat.opacity = 0.9;
          topGlowMat.opacity = 0.9;
        } else {
          // Effetto accensione (power-up)
          bottomGlowMat.opacity = 0.9 * ledProgress;
          topGlowMat.opacity = 0.9 * ledProgress;
        }
      }
    }

    eMouse.x += (rawMouse.x - eMouse.x) * EASE;
    eMouse.y += (rawMouse.y - eMouse.y) * EASE;

    camera.position.set(0, 0, 18);
    // Movimento della camera ristretto per far sembrare il vetro più grande
    camera.lookAt(eMouse.x * 10, eMouse.y * 5, 0);

    // Animazione fluida dell'ingrandimento in 3D
    const targetScaleL = hoverL ? 0.037 : 0.035;
    cssObjL.scale.lerp(new THREE.Vector3(targetScaleL, targetScaleL, targetScaleL), 0.15);

    const targetScaleR = hoverR ? 0.037 : 0.035;
    cssObjR.scale.lerp(new THREE.Vector3(targetScaleR, targetScaleR, targetScaleR), 0.15);

    renderer.render(scene, camera);
    cssRenderer.render(scene, camera);
  }

  /* ══════════════════════════════════════════
     PROCESS LOGO IMAGE
  ══════════════════════════════════════════ */
  function processLogo() {
    const img = new Image();
    img.crossOrigin = "Anonymous";
    img.src = 'image/abstergo_logo.png?v=' + new Date().getTime(); 
    img.onload = () => {
      const cvs = document.createElement('canvas');
      cvs.width = img.width;
      cvs.height = img.height;
      const ctx = cvs.getContext('2d');
      ctx.drawImage(img, 0, 0);
      const imgData = ctx.getImageData(0, 0, cvs.width, cvs.height);
      const data = imgData.data;

      for (let i = 0; i < data.length; i += 4) {
        let r = data[i], g = data[i+1], b = data[i+2], a = data[i+3];
        if (a < 50) continue;
        if (r > 150 && g > 150 && b > 150) {
          data[i+3] = 0; 
          continue;
        }
        if (r < 150 && g < 150 && b < 150) {
          data[i] = 0; 
          data[i+1] = 221; 
          data[i+2] = 255; 
        }
      }
      ctx.putImageData(imgData, 0, 0);

      const finalImg = document.createElement('img');
      finalImg.src = cvs.toDataURL();
      finalImg.style.width = '100%';
      finalImg.style.height = 'auto';
      finalImg.style.filter = 'drop-shadow(0 0 15px rgba(0, 255, 255, 0.8))'; // Glow più intenso

      const container = document.getElementById('abstergoLogo');
      container.innerHTML = '';
      container.appendChild(finalImg);
    };
  }
  processLogo();

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
    showDetailView(
      "SEQUENZA DNA - SOGGETTO 17",
      "Analisi del corredo genetico in corso... <br><br>Soggetto identificato: Desmond Miles.<br>Antenati rilevati: Altaïr Ibn-La'Ahad, Ezio Auditore da Firenze, Ratonhnhaké:ton.<br><br>Sincronizzazione dei ricordi genotipici pronta per l'estrazione. Il sistema sta stabilizzando i ricordi per evitare il collasso neurale."
    );
  });

  panelR.addEventListener('click', () => {
    showDetailView(
      "SIMULAZIONE STORICA",
      "Inizializzazione ambiente virtuale... <br><br>Epoca selezionata: Rinascimento Italiano (1476).<br>Luogo: Firenze, Repubblica Fiorentina.<br><br>Avvertenza: Mantenere la sincronizzazione seguendo le memorie dell'antenato. Deviazioni significative causeranno la desincronizzazione."
    );
  });

  document.getElementById('btn-back').addEventListener('click', () => {
    showCardsView();
  });

  animate();
})();
