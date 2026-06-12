(function() {
  'use strict';

  let tunnelRafId = null;
  let blurRafId = null;
  let tunnelGroup = null;

  window.playSyncTransition = function() {
    const state = window.animusState;
    if (!state) {
      console.error("Animus state not found. Fallback.");
      return;
    }

    const eyelidTop = document.querySelector('.eyelid-top');
    const eyelidBottom = document.querySelector('.eyelid-bottom');
    const threeCanvas = document.getElementById('threeCanvas');
    const hudContainer = document.getElementById('hud-container');
    const syncScreenEl = document.getElementById('syncScreen');
    const animusTicketEl = document.getElementById('animusTicket');
    const whiteFlash = document.getElementById('animus-white-flash');

    if (!eyelidTop || !eyelidBottom) return;

    // Se c'è l'audio, proviamo a far partire dei suoni appropriati se disponibili
    if (window.audioEngine) {
      // Un suono di click profondo o heartbeat se esiste
      window.audioEngine.playClick();
    }

    // --- FASE 1: ADDORMENTAMENTO REALISTICO (~3-4s) ---
    // Animazione palpebre: lotto per tenere aperti gli occhi
    // Ripristiniamo la transizione veloce per i movimenti bruschi
    eyelidTop.style.transition = 'height 0.3s cubic-bezier(0.4, 0.0, 0.2, 1)';
    eyelidBottom.style.transition = 'height 0.3s cubic-bezier(0.4, 0.0, 0.2, 1)';

    setTimeout(() => { setEyelids(eyelidTop, eyelidBottom, '35%'); }, 100);
    setTimeout(() => { setEyelids(eyelidTop, eyelidBottom, '10%'); }, 500);
    setTimeout(() => { setEyelids(eyelidTop, eyelidBottom, '65%'); }, 1100);
    setTimeout(() => { 
      // Riapertura a fatica e tremolante
      eyelidTop.style.transition = 'height 0.6s cubic-bezier(0.4, 0.0, 0.2, 1)';
      eyelidBottom.style.transition = 'height 0.6s cubic-bezier(0.4, 0.0, 0.2, 1)';
      setEyelids(eyelidTop, eyelidBottom, '30%'); 
    }, 1700);
    
    // Chiusura definitiva lenta
    setTimeout(() => { 
      eyelidTop.style.transition = 'height 1.4s cubic-bezier(0.4, 0.0, 0.2, 1)';
      eyelidBottom.style.transition = 'height 1.4s cubic-bezier(0.4, 0.0, 0.2, 1)';
      setEyelids(eyelidTop, eyelidBottom, '50%'); 
    }, 2400);

    // Animazione sfocatura (blur) progressiva e vignettatura scura
    let startTime = performance.now();
    function animateBlur(now) {
      let elapsed = now - startTime;
      let progress = Math.min(elapsed / 3600, 1.0); // 3.6 secondi
      
      // Easing per blur organico
      let eased = progress < 0.5 ? 2 * progress * progress : -1 + (4 - 2 * progress) * progress;
      
      let blurVal = eased * 12; // Sfoca fino a 12px
      let brightVal = 1.0 - (eased * 0.8); // Scurisce fino al 20%
      let satVal = 1.0 - (eased * 0.7); // Desatura
      
      let filterStr = `blur(${blurVal}px) brightness(${brightVal}) saturate(${satVal})`;
      
      if (threeCanvas) threeCanvas.style.filter = filterStr;
      if (hudContainer) hudContainer.style.filter = filterStr;
      
      if (progress < 1.0) {
        blurRafId = requestAnimationFrame(animateBlur);
      }
    }
    blurRafId = requestAnimationFrame(animateBlur);

    // --- FASE 2: TUNNEL DI DATI ANIMUS (~5-6s) ---
    // Inizia quando gli occhi sono completamente chiusi al nero (t=3900)
    setTimeout(() => {
      if (blurRafId) cancelAnimationFrame(blurRafId);
      
      // Pulizia filtri e HUD precedente
      if (threeCanvas) threeCanvas.style.filter = '';
      if (hudContainer) {
        hudContainer.style.filter = '';
        hudContainer.style.display = 'none'; // Nasconde i pannelli CSS3D
      }

      // Nascondi elementi scena corrente
      if (state.bgGroup) state.bgGroup.visible = false;
      if (state.gridGroup) state.gridGroup.visible = false;
      
      // Nascondi la scritta SINCRONIZZAZIONE
      if (syncScreenEl) syncScreenEl.classList.add('hidden-panel');

      // Configura sfondo e nebbia della simulazione tunnel
      state.renderer.setClearColor(0x8797a8, 1); // Grigio-azzurro chiaro
      state.scene.fog = new THREE.FogExp2(0x8797a8, 0.018); // Nebbiosa

      tunnelGroup = new THREE.Group();
      state.scene.add(tunnelGroup);

      // Luci soffuse e oniriche per il tunnel
      const ambient = new THREE.AmbientLight(0xffffff, 1.2);
      tunnelGroup.add(ambient);
      const dirLight = new THREE.DirectionalLight(0xe0f0ff, 1.5);
      dirLight.position.set(0, 0, 10);
      tunnelGroup.add(dirLight);

      // Genera texture dei dati (formule, codici, etc)
      const dataTex = generateAnimusTexture();
      const spriteMaterial = new THREE.SpriteMaterial({ 
        map: dataTex, 
        color: 0xffffff, 
        transparent: true, 
        opacity: 0.85,
        blending: THREE.AdditiveBlending 
      });

      // Particelle (Mesh piatte possono avere distorsione, usiamo Sprite per mantenerle sempre visibili, 
      // ma aggiungiamo anche alcuni Plane per farli scorrere come fogli di dati)
      const planeGeo = new THREE.PlaneGeometry(12, 12);
      const planeMat = new THREE.MeshBasicMaterial({
        map: dataTex,
        color: 0xffffff,
        transparent: true,
        opacity: 0.7,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
        depthWrite: false
      });

      const tunnelElements = [];

      // Aggiungiamo 200 elementi al tunnel
      for (let i = 0; i < 200; i++) {
        let isSprite = Math.random() > 0.3;
        let el = isSprite ? new THREE.Sprite(spriteMaterial) : new THREE.Mesh(planeGeo, planeMat);
        
        el.position.x = (Math.random() - 0.5) * 60;
        el.position.y = (Math.random() - 0.5) * 40;
        el.position.z = (Math.random() - 1.0) * 120; // Sparse in profondità
        
        let scale = 0.5 + Math.random() * 2.5;
        if (!isSprite) {
          scale *= 0.8;
          el.rotation.z = (Math.random() - 0.5) * 0.5; // Leggera inclinazione
        } else {
          el.scale.set(scale * 12, scale * 12, 1);
        }

        el.userData = {
          baseOpacity: 0.2 + Math.random() * 0.6,
          speedZ: 0.2 + Math.random() * 0.4,
          isSprite: isSprite
        };
        
        tunnelGroup.add(el);
        tunnelElements.push(el);
      }

      // Riapri gli occhi di scatto per la rivelazione del tunnel
      eyelidTop.style.transition = 'height 0.2s cubic-bezier(0.1, 0.9, 0.2, 1)';
      eyelidBottom.style.transition = 'height 0.2s cubic-bezier(0.1, 0.9, 0.2, 1)';
      setEyelids(eyelidTop, eyelidBottom, '0%');

      let tunnelSpeedMultiplier = 1.0;
      let phase3Started = false;
      let globalTime = 0;

      // Animazione tunnel
      function animateTunnel() {
        tunnelRafId = requestAnimationFrame(animateTunnel);
        globalTime += 0.016;

        if (phase3Started) {
          tunnelSpeedMultiplier += 0.15; // Accelerazione esponenziale
        }

        tunnelElements.forEach((el, index) => {
          el.position.z += el.userData.speedZ * tunnelSpeedMultiplier;
          
          // Glitch occasionale
          if (Math.random() > 0.995) {
            el.position.x += (Math.random() - 0.5) * 2;
            el.material.opacity = el.userData.baseOpacity * 0.2;
          } else {
            // Opacità basata sulla distanza (lontani = trasparenti, vicini = definiti)
            let zDist = Math.abs(el.position.z - state.camera.position.z);
            let depthOpacity = Math.max(0, 1.0 - (zDist / 80));
            el.material.opacity = el.userData.baseOpacity * depthOpacity;
          }

          // Se l'elemento supera la camera, rimettilo in fondo
          if (el.position.z > state.camera.position.z + 5) {
            el.position.z = -120 - Math.random() * 30;
            el.position.x = (Math.random() - 0.5) * 60;
            el.position.y = (Math.random() - 0.5) * 40;
          }
        });
      }
      animateTunnel();

      // --- FASE 3: ARRIVO NELLA WHITE ROOM (~1.5-2s) ---
      setTimeout(() => {
        phase3Started = true; // Scatta l'accelerazione

        // Subito dopo inizia il flash bianco
        setTimeout(() => {
          if (whiteFlash) {
            whiteFlash.style.opacity = '1';
          }
          
          if (window.audioEngine) window.audioEngine.playHover(); // O un suono apposito per il flash

          // Al picco del flash bianco, esegue lo switch vero e proprio
          setTimeout(() => {
            if (tunnelRafId) cancelAnimationFrame(tunnelRafId);
            if (tunnelGroup) {
              state.scene.remove(tunnelGroup);
              spriteMaterial.dispose();
              planeMat.dispose();
              planeGeo.dispose();
              dataTex.dispose();
            }

            if (syncScreenEl) syncScreenEl.classList.add('hidden-panel');
            
            // Richiama la funzione originale di app.js per impostare la scena white room
            state.transitionToWhiteRoom();
            
            // Inizia a dissipare il flash bianco rivelando la white room
            setTimeout(() => {
              if (whiteFlash) {
                whiteFlash.style.transition = 'opacity 2.5s cubic-bezier(0.2, 0.8, 0.2, 1)';
                whiteFlash.style.opacity = '0';
              }
              
              // Mostra il biglietto Animus
              setTimeout(() => {
                if (animusTicketEl) animusTicketEl.classList.remove('hidden-panel');
                if (window.audioEngine) window.audioEngine.playHover();
              }, 1200);
              
            }, 600); // Tieni il bianco pieno per un istante

          }, 1400); // Tempo di flash in
        }, 1200); // Ritardo per far notare l'accelerazione prima di flashare

      }, 4800); // 4.8s nel tunnel

    }, 3900); // Pausa quando si chiudono gli occhi per transizione fluida

  };

  function setEyelids(top, bottom, height) {
    if (top) top.style.height = height;
    if (bottom) bottom.style.height = height;
  }

  // Genera un texture canvas con formule chimiche, frammenti di codice e loghi
  function generateAnimusTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 1024;
    const ctx = canvas.getContext('2d');

    ctx.clearRect(0, 0, 1024, 1024);
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2.5;

    // Disegna forme esagonali (formule chimiche)
    function drawHexagon(cx, cy, r) {
      ctx.beginPath();
      for (let i = 0; i < 6; i++) {
        let a = (Math.PI / 3) * i;
        let x = cx + r * Math.cos(a);
        let y = cy + r * Math.sin(a);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.stroke();
    }

    // Popola il canvas con ~30 frammenti visivi
    for (let j = 0; j < 30; j++) {
      let x = Math.random() * 900 + 50;
      let y = Math.random() * 900 + 50;
      let type = Math.random();
      
      if (type < 0.35) {
        // Strutture molecolari collegate
        let size = 20 + Math.random() * 25;
        drawHexagon(x, y, size);
        if (Math.random() > 0.4) {
          drawHexagon(x + size * 1.5, y + size * 0.866, size); // Collegato in basso a destra
          
          ctx.font = "bold 14px monospace";
          ctx.fillText("N-H", x - size, y - size);
          ctx.fillText("C=O", x + size * 2, y + size * 1.5);
          
          // Linee di legame
          ctx.beginPath();
          ctx.moveTo(x, y - size);
          ctx.lineTo(x, y - size - 15);
          ctx.stroke();
        }
      } else if (type < 0.70) {
        // Sequenze numeriche e testuali
        ctx.font = (18 + Math.random() * 12) + "px monospace";
        let code = Math.floor(Math.random() * 100000000).toString().padStart(8, '0');
        let code2 = Math.floor(Math.random() * 99).toString().padStart(2, '0');
        ctx.fillText(code + " / " + code2, x, y);
        
        ctx.font = "12px monospace";
        ctx.fillStyle = 'rgba(255,255,255,0.6)';
        ctx.fillText("SEQ: " + Math.random().toString(36).substring(2, 8).toUpperCase(), x, y + 16);
        ctx.fillStyle = '#ffffff';
        
        // Barre decorative
        ctx.fillRect(x, y + 25, 40 + Math.random() * 60, 3);
        ctx.fillRect(x, y + 32, 20 + Math.random() * 30, 1);
      } else {
        // Glitch geometrici e marcatori tecnici
        ctx.globalAlpha = 0.6;
        for (let k = 0; k < 6; k++) {
          ctx.fillRect(x + Math.random() * 80, y + Math.random() * 40, 
                       5 + Math.random() * 30, 2 + Math.random() * 6);
        }
        
        // Cerchietti target
        ctx.beginPath();
        ctx.arc(x + 40, y + 20, 8, 0, Math.PI * 2);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(x + 40, y + 20, 2, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.globalAlpha = 1.0;
      }
    }

    const tex = new THREE.CanvasTexture(canvas);
    return tex;
  }

})();
