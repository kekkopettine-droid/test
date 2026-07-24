(function () {
  'use strict';

  let vortexRaf = null, blurRaf = null, vortexGrp = null, overlayEl = null, syncTickerRaf = null;
  let syncAnimActive = false;

  /* ── Sync screen animation ── */
  function onSyncVisible() {
    if (syncAnimActive) return;
    syncAnimActive = true;
    const fill   = document.getElementById('syncBarFill');
    const pctEl  = document.getElementById('syncPctText');
    const ticker = document.getElementById('syncDnaTicker');
    if (!fill) return;
    requestAnimationFrame(() => { fill.style.width = '85%'; });
    const t0 = performance.now();
    (function countUp(now) {
      const p = Math.min((now - t0) / 2300, 1);
      if (pctEl) pctEl.textContent = Math.round(p * 85) + '%';
      if (p < 1) syncTickerRaf = requestAnimationFrame(countUp);
    })(performance.now());
    const BASES = 'ATCGATCGATCGATCG';
    let off = 0;
    (function tick() {
      off++;
      if (ticker) ticker.textContent = (BASES + BASES).substring(off % BASES.length, off % BASES.length + 55).split('').join(' ');
      syncTickerRaf = requestAnimationFrame(tick);
    })();
    if (window.audioEngine) window.audioEngine.playSyncSequence?.();
  }

  const syncScreenEl0 = document.getElementById('syncScreen');
  if (syncScreenEl0) {
    new MutationObserver(() => {
      if (!syncScreenEl0.classList.contains('hidden-panel')) onSyncVisible();
      else syncAnimActive = false;
    }).observe(syncScreenEl0, { attributes: true, attributeFilter: ['class'] });
  }

  /* ════════════════════════════════════════════════════════
     MAIN TRANSITION
  ════════════════════════════════════════════════════════ */
  window.playSyncTransition = function () {
    const state = window.animusState;
    if (!state) return;

    const eyelidTop      = document.querySelector('.eyelid-top');
    const eyelidBottom   = document.querySelector('.eyelid-bottom');
    const threeCanvas    = document.getElementById('threeCanvas');
    const hudContainer   = document.getElementById('hud-container');
    const syncScreenEl   = document.getElementById('syncScreen');
    const animusTicketEl = document.getElementById('animusTicket');
    const whiteFlash     = document.getElementById('animus-white-flash');
    const fill           = document.getElementById('syncBarFill');
    const pctEl          = document.getElementById('syncPctText');

    if (!eyelidTop || !eyelidBottom) return;
    if (syncTickerRaf) cancelAnimationFrame(syncTickerRaf);

    if (fill) { fill.style.transition = 'width 3.0s linear'; fill.style.width = '99%'; }
    const pctT0 = performance.now();
    (function countFinal(now) {
      const p = Math.min((now - pctT0) / 3000, 1);
      if (pctEl) pctEl.textContent = Math.round(85 + p * 14) + '%';
      if (p < 1) requestAnimationFrame(countFinal);
    })(performance.now());

    /* ── FASE 1: SEDAZIONE (0 → 3800 ms) ── */
    const lid = (h, dur) => {
      const t = `height ${dur}s cubic-bezier(.4,0,.2,1)`;
      eyelidTop.style.transition    = t;
      eyelidBottom.style.transition = t;
      eyelidTop.style.height    = h;
      eyelidBottom.style.height = h;
    };
    lid('28%', 0.28);
    setTimeout(() => lid('6%',  0.22), 350);
    setTimeout(() => lid('52%', 0.32), 820);
    setTimeout(() => lid('16%', 0.38), 1280);
    setTimeout(() => lid('44%', 0.30), 1800);
    setTimeout(() => lid('22%', 0.42), 2280);
    setTimeout(() => lid('48%', 0.50), 2850);
    setTimeout(() => lid('50%', 1.15), 3380);

    const blurT0 = performance.now();
    (function animBlur(now) {
      const p = Math.min((now - blurT0) / 3800, 1);
      const e = p < .5 ? 2 * p * p : -1 + (4 - 2 * p) * p;
      const f = `blur(${e * 16}px) brightness(${1 - e * 0.9}) saturate(${1 - e * 0.95})`;
      if (threeCanvas)  threeCanvas.style.filter  = f;
      if (hudContainer) hudContainer.style.filter = f;
      if (p < 1) blurRaf = requestAnimationFrame(animBlur);
    })(performance.now());

    if (window.audioEngine) window.audioEngine.playSedation?.();

    /* ════════════════════════════════════════════════════════
       FASE 2 — TUNNEL MOLECOLARE NEBULOSO (3800ms →)
       Sfondo grigio-azzurro con strutture molecolari bianche
       semi-trasparenti che scorrono verso la camera.
    ════════════════════════════════════════════════════════ */
    setTimeout(() => {
      if (blurRaf) cancelAnimationFrame(blurRaf);
      if (threeCanvas)  threeCanvas.style.filter  = '';
      if (hudContainer) { hudContainer.style.filter = ''; hudContainer.style.display = 'none'; }
      if (state.bgGroup)   state.bgGroup.visible   = false;
      if (state.gridGroup) state.gridGroup.visible  = false;
      if (syncScreenEl)    syncScreenEl.classList.add('hidden-panel');

      /* Sfondo scuro profondo per far risaltare il tunnel luminoso (Animus warp) */
      state.renderer.setClearColor(0x020508, 1);
      state.scene.fog = new THREE.FogExp2(0x020508, 0.008);

      lid('0%', 0.12);

      vortexGrp = new THREE.Group();
      state.scene.add(vortexGrp);

      const FAR_Z = -100, NEAR_Z = 14;

      /* ── Genera texture canvas (una volta sola, riusate dai sprite) ── */
      const texMolA  = makeMolTexA();
      const texMolB  = makeMolTexB();
      const texDataA = makeDataTexA();
      const texDataB = makeDataTexB();
      const texGlyph = makeGlyphTex();
      const texLogo  = makeLogoTex();
      const allTextures = [texMolA, texMolB, texDataA, texDataB, texGlyph, texLogo];

      /* ── Crea sprite elementi ── */
      const elements = [];

      function addSprites(tex, count, minSz, maxSz, minOp, maxOp, sx, sy) {
        for (let i = 0; i < count; i++) {
          const mat = new THREE.SpriteMaterial({
            map: tex, transparent: true, opacity: 0,
            blending: THREE.AdditiveBlending, depthWrite: false, fog: false,
            rotation: (Math.random() - 0.5) * Math.PI * 0.55,
          });
          const sp  = new THREE.Sprite(mat);
          const sz  = minSz + Math.random() * (maxSz - minSz);
          sp.scale.set(sz, sz * (0.72 + Math.random() * 0.55), 1);
          sp.position.set(
            (Math.random() - 0.5) * (sx || 28),
            (Math.random() - 0.5) * (sy || 20),
            FAR_Z + Math.random() * (NEAR_Z - FAR_Z)
          );
          sp.userData = {
            speedZ: 8 + Math.random() * 15,
            baseOp: minOp + Math.random() * (maxOp - minOp),
          };
          vortexGrp.add(sp);
          elements.push(sp);
        }
      }

      /* Strutture molecolari: piu' grandi, spread piu' stretto */
      addSprites(texMolA,  20, 10, 18, 0.55, 0.90, 22, 16);
      addSprites(texMolB,  16, 8,  15, 0.50, 0.85, 22, 16);
      /* Dati / codici: medi */
      addSprites(texDataA, 30, 4,   9, 0.38, 0.72, 30, 22);
      addSprites(texDataB, 24, 3,   8, 0.32, 0.68, 30, 22);
      /* Glifi tecnici: piccoli */
      addSprites(texGlyph, 36, 2,   7, 0.28, 0.56, 34, 25);
      /* Loghi Abstergo */
      addSprites(texLogo,  18, 4,   8, 0.22, 0.48, 28, 20);

      /* ── Polvere atmosferica (tiny white particles) ── */
      const DCOUNT = 450;
      const dPos  = new Float32Array(DCOUNT * 3);
      const dData = new Array(DCOUNT);
      for (let i = 0; i < DCOUNT; i++) {
        dPos[i*3]   = (Math.random() - 0.5) * 36;
        dPos[i*3+1] = (Math.random() - 0.5) * 26;
        dPos[i*3+2] = FAR_Z + Math.random() * (NEAR_Z - FAR_Z);
        dData[i] = { spd: 3 + Math.random() * 6 };
      }
      const ptc = document.createElement('canvas'); ptc.width = ptc.height = 32;
      const ptx = ptc.getContext('2d');
      const ptg = ptx.createRadialGradient(16,16,0, 16,16,16);
      ptg.addColorStop(0,   'rgba(255,255,255,1)');
      ptg.addColorStop(0.5, 'rgba(255,255,255,0.35)');
      ptg.addColorStop(1,   'rgba(255,255,255,0)');
      ptx.fillStyle = ptg; ptx.beginPath(); ptx.arc(16,16,16,0,Math.PI*2); ptx.fill();
      const ptTex = new THREE.CanvasTexture(ptc);
      const dGeo = new THREE.BufferGeometry();
      dGeo.setAttribute('position', new THREE.BufferAttribute(dPos, 3));
      vortexGrp.add(new THREE.Points(dGeo, new THREE.PointsMaterial({
        size: 0.045, map: ptTex, color: 0xffffff,
        transparent: true, opacity: 0.22,
        blending: THREE.AdditiveBlending, depthWrite: false, sizeAttenuation: true,
      })));

      /* ── WARP LINES (Linee luminose di memoria) ── */
      const WCOUNT = 400;
      const wPos = new Float32Array(WCOUNT * 6);
      const wData = new Array(WCOUNT);
      for (let i = 0; i < WCOUNT; i++) {
        const x = (Math.random() - 0.5) * 70;
        const y = (Math.random() - 0.5) * 50;
        const z = FAR_Z + Math.random() * (NEAR_Z - FAR_Z);
        const length = 4 + Math.random() * 20;
        wPos[i*6]   = x; wPos[i*6+1] = y; wPos[i*6+2] = z;
        wPos[i*6+3] = x; wPos[i*6+4] = y; wPos[i*6+5] = z + length;
        wData[i] = { spd: 15 + Math.random() * 25, length: length };
      }
      const wGeo = new THREE.BufferGeometry();
      wGeo.setAttribute('position', new THREE.BufferAttribute(wPos, 3));
      const wMat = new THREE.LineBasicMaterial({
        color: 0x00ffff,
        transparent: true,
        opacity: 0.65,
        blending: THREE.AdditiveBlending,
        depthWrite: false
      });
      const warpLines = new THREE.LineSegments(wGeo, wMat);
      vortexGrp.add(warpLines);

      /* ── HUD Overlay ── */
      overlayEl = buildOverlay();
      document.body.appendChild(overlayEl);
      requestAnimationFrame(() => {
        const fb = overlayEl && overlayEl.querySelector('.ov-fill');
        if (fb) fb.style.width = '100%';
      });

      /* ── ANIMATION LOOP ── */
      let accel = 0, imploding = false;
      let lastT = performance.now();
      let syncV = 99, seqOff = 0;
      const BSEQ = 'ATCGATCGATCGATCG';

      (function loop(now) {
        vortexRaf = requestAnimationFrame(loop);
        const dt = Math.min((now - lastT) / 1000, 0.05);
        lastT = now;

        if (imploding) accel = Math.min(accel + dt * 3.5, 12);
        const spd = 1 + accel;

        /* Overlay */
        if (imploding && syncV < 100) syncV = Math.min(100, syncV + 2);
        const sPct = overlayEl && overlayEl.querySelector('.ov-pct');
        if (sPct) sPct.textContent = syncV >= 100 ? '⬡ MEMORIA ACQUISITA ⬡' : `SINCRONIZZAZIONE ${syncV}%`;
        seqOff += dt * 5;
        const sSeq = overlayEl && overlayEl.querySelector('.ov-seq');
        if (sSeq) sSeq.textContent = (BSEQ+BSEQ).substring(Math.floor(seqOff)%BSEQ.length, Math.floor(seqOff)%BSEQ.length+42).split('').join(' ');

        /* Aggiorna sprite: movimento + opacita' per profondita' */
        elements.forEach(el => {
          el.position.z += dt * el.userData.speedZ * spd;
          const t = Math.max(0, Math.min(1, (el.position.z - FAR_Z) / (NEAR_Z - FAR_Z)));
          const depthOp = t * t * (3 - 2 * t); // smoothstep
          el.material.opacity = Math.random() > 0.9985
            ? el.userData.baseOp * 0.08   // glitch momentaneo
            : el.userData.baseOp * depthOp;
          if (el.position.z > 22) {
            el.position.z = FAR_Z - Math.random() * 20;
            el.position.x = (Math.random() - 0.5) * 34;
            el.position.y = (Math.random() - 0.5) * 26;
          }
        });

        /* Aggiorna polvere atmosferica */
        for (let i = 0; i < DCOUNT; i++) {
          dPos[i*3+2] += dt * dData[i].spd * spd;
          if (dPos[i*3+2] > 22) {
            dPos[i*3]   = (Math.random() - 0.5) * 36;
            dPos[i*3+1] = (Math.random() - 0.5) * 26;
            dPos[i*3+2] = FAR_Z - Math.random() * 20;
          }
        }
        dGeo.attributes.position.needsUpdate = true;

        /* Aggiorna warp lines */
        for (let i = 0; i < WCOUNT; i++) {
          let z = wPos[i*6+2] + dt * wData[i].spd * (spd * 2.5);
          if (z > NEAR_Z + 15) {
            z = FAR_Z - Math.random() * 30;
            const x = (Math.random() - 0.5) * 70;
            const y = (Math.random() - 0.5) * 50;
            wPos[i*6]   = x; wPos[i*6+1] = y;
            wPos[i*6+3] = x; wPos[i*6+4] = y;
          }
          wPos[i*6+2] = z;
          wPos[i*6+5] = z + (wData[i].length * (1 + accel * 0.5)); // Le linee si allungano con l'accelerazione
        }
        wGeo.attributes.position.needsUpdate = true;

        /* Camera FOV warp per sensazione di velocità */
        if (state.camera && state.camera.isPerspectiveCamera) {
          if (!state.camera.userData.baseFov) state.camera.userData.baseFov = state.camera.fov;
          const targetFov = state.camera.userData.baseFov + accel * 10;
          state.camera.fov += (targetFov - state.camera.fov) * 0.1;
          state.camera.updateProjectionMatrix();
        }

        /* Camera shake + aberrazione cromatica (implosione) */
        if (imploding && threeCanvas) {
          const sh = Math.min(accel * 2.2, 18);
          threeCanvas.style.transform = `translate(${(Math.random()-.5)*sh}px,${(Math.random()-.5)*sh*.55}px)`;
          threeCanvas.style.filter    = `hue-rotate(${Math.sin(now*.013)*accel*3.5}deg) saturate(${1+accel*.08})`;
        }
        if (!imploding && Math.random() > 0.998 && threeCanvas) {
          threeCanvas.style.filter = 'brightness(1.12) saturate(1.15)';
          setTimeout(() => { if (threeCanvas) threeCanvas.style.filter = ''; }, 65);
        }
      })(performance.now());

      if (window.audioEngine) window.audioEngine.playTunnel?.();

      /* ── Accelerazione finale (t+5800ms) ── */
      setTimeout(() => { imploding = true; }, 5800);

      /* ── Flash bianco (t+7800ms) ── */
      setTimeout(() => {
        if (whiteFlash) { whiteFlash.style.transition = 'opacity 0.85s ease-in'; whiteFlash.style.opacity = '1'; }
        if (window.audioEngine) window.audioEngine.playWhiteArrive?.();
      }, 7800);

      /* ── White room + cleanup (t+8700ms) ── */
      setTimeout(() => {
        if (vortexRaf) cancelAnimationFrame(vortexRaf);
        if (vortexGrp) {
          state.scene.remove(vortexGrp);
          dGeo.dispose(); ptTex.dispose();
          wGeo.dispose(); wMat.dispose();
          allTextures.forEach(t => t.dispose());
          elements.forEach(el => { if (el.material) el.material.dispose(); });
          vortexGrp = null;
        }
        if (state.camera && state.camera.isPerspectiveCamera && state.camera.userData.baseFov) {
          state.camera.fov = state.camera.userData.baseFov;
          state.camera.updateProjectionMatrix();
        }
        if (state.scene.fog) state.scene.fog = null;
        if (overlayEl)   { document.body.removeChild(overlayEl); overlayEl = null; }
        if (threeCanvas) { threeCanvas.style.transform = ''; threeCanvas.style.filter = ''; }

        state.transitionToWhiteRoom();

        setTimeout(() => {
          if (whiteFlash) { whiteFlash.style.transition = 'opacity 2.5s cubic-bezier(.2,.8,.2,1)'; whiteFlash.style.opacity = '0'; }
          setTimeout(() => {
            if (animusTicketEl) animusTicketEl.classList.remove('hidden-panel');
            if (window.audioEngine) window.audioEngine.playHover();
          }, 1300);
        }, 450);
      }, 8700);

    }, 3800);
  };

  /* ════════════════════════════════════════════════════════
     GENERATORI TEXTURE CANVAS
  ════════════════════════════════════════════════════════ */

  function makeMolTexA() {
    const c = document.createElement('canvas'); c.width = c.height = 512;
    const ctx = c.getContext('2d');
    ctx.clearRect(0, 0, 512, 512);
    ctx.strokeStyle = 'rgba(255,255,255,0.90)';
    ctx.fillStyle   = 'rgba(255,255,255,0.90)';
    ctx.lineCap     = 'round';
    ctx.lineJoin    = 'round';

    function drawHex(cx, cy, r, ang) {
      ctx.beginPath();
      for (let k = 0; k <= 6; k++) {
        const a = ang + k * Math.PI / 3;
        k === 0
          ? ctx.moveTo(cx + Math.cos(a)*r, cy + Math.sin(a)*r)
          : ctx.lineTo(cx + Math.cos(a)*r, cy + Math.sin(a)*r);
      }
      ctx.closePath(); ctx.stroke();
    }

    const R = 88, cy = 240;
    const cx1 = 170, cx2 = 170 + R * Math.sqrt(3); // ~322

    ctx.lineWidth = 3;
    drawHex(cx1, cy, R, Math.PI/6);
    drawHex(cx2, cy, R, Math.PI/6);

    /* Legami doppi interni (linee a 85% raggio) */
    const Ri = R * 0.84;
    ctx.lineWidth = 2;
    ctx.globalAlpha = 0.58;
    for (let k = 0; k < 3; k++) {
      const a1 = Math.PI/6 + k * 2*Math.PI/3;
      const a2 = a1 + Math.PI/3;
      ctx.beginPath();
      ctx.moveTo(cx1 + Math.cos(a1)*Ri, cy + Math.sin(a1)*Ri);
      ctx.lineTo(cx1 + Math.cos(a2)*Ri, cy + Math.sin(a2)*Ri);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;

    /* Legami di estensione dai vertici esterni del primo esagono */
    // Vertici (ang=PI/6): k=1(bottom), k=2(bl), k=3(tl), k=4(top)
    // k=0 e k=5 sono sul lato condiviso con il secondo esagono
    ctx.lineWidth = 2.5;
    const EXT = 50;
    const extData = [
      { vx: 170,      vy: cy + R,    dx:  0,     dy:  1,    label: 'C=O',  lx: -22, ly:  18 },
      { vx: cx1 - 76, vy: cy + 44,   dx: -0.866, dy:  0.5,  label: 'N-H',  lx: -48, ly:  14 },
      { vx: cx1 - 76, vy: cy - 44,   dx: -0.866, dy: -0.5,  label: 'CH₂',  lx: -48, ly:  -4 },
      { vx: 170,      vy: cy - R,    dx:  0,     dy: -1,    label: 'H₂C',  lx: -22, ly: -12 },
      { vx: cx2 + 76, vy: cy + 44,   dx:  0.866, dy:  0.5,  label: '',     lx:   0, ly:   0 },
      { vx: cx2 + 76, vy: cy - 44,   dx:  0.866, dy: -0.5,  label: '',     lx:   0, ly:   0 },
    ];
    extData.forEach(({ vx, vy, dx, dy, label, lx, ly }) => {
      const tx = vx + dx * EXT, ty = vy + dy * EXT;
      ctx.beginPath(); ctx.moveTo(vx, vy); ctx.lineTo(tx, ty); ctx.stroke();
      if (label) {
        ctx.font = 'bold 20px monospace';
        ctx.globalAlpha = 0.82;
        ctx.fillText(label, tx + lx, ty + ly);
        ctx.globalAlpha = 1;
      }
    });

    /* Codici sequenza */
    ctx.font = '12px monospace';
    ctx.globalAlpha = 0.36;
    ctx.fillText('00064348', 120, 28);
    ctx.fillText('LAYER-A2', 295, 28);
    ctx.fillText('HELIX · ABSTERGO', 160, 500);
    ctx.globalAlpha = 1;

    return new THREE.CanvasTexture(c);
  }

  function makeMolTexB() {
    const c = document.createElement('canvas'); c.width = c.height = 512;
    const ctx = c.getContext('2d');
    ctx.clearRect(0, 0, 512, 512);
    ctx.strokeStyle = 'rgba(255,255,255,0.88)';
    ctx.fillStyle   = 'rgba(255,255,255,0.88)';
    ctx.lineCap     = 'round';

    const cx = 256, cy = 235, R = 108;
    ctx.lineWidth = 3;
    ctx.beginPath();
    for (let k = 0; k <= 6; k++) {
      const a = (k / 6) * Math.PI * 2 - Math.PI / 6;
      const [x, y] = [cx + Math.cos(a)*R, cy + Math.sin(a)*R];
      k === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    }
    ctx.closePath(); ctx.stroke();

    /* Legami doppi alternati (inner ring) */
    const Ri = R * 0.82;
    ctx.lineWidth = 2;
    ctx.globalAlpha = 0.55;
    for (let k = 0; k < 6; k += 2) {
      const a1 = (k/6)*Math.PI*2 - Math.PI/6;
      const a2 = ((k+1)/6)*Math.PI*2 - Math.PI/6;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(a1)*Ri, cy + Math.sin(a1)*Ri);
      ctx.lineTo(cx + Math.cos(a2)*Ri, cy + Math.sin(a2)*Ri);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;

    /* Legami di estensione da tutti i 6 vertici */
    const EXT = 62;
    const labels6 = ['C=O', 'N-H', 'C-C', 'CH₂', 'O=C', 'HN'];
    for (let k = 0; k < 6; k++) {
      const a  = (k / 6) * Math.PI * 2 - Math.PI / 6;
      const vx = cx + Math.cos(a)*R, vy = cy + Math.sin(a)*R;
      const tx = cx + Math.cos(a)*(R + EXT), ty = cy + Math.sin(a)*(R + EXT);
      ctx.lineWidth = k % 2 === 0 ? 2.5 : 1.8;
      ctx.beginPath(); ctx.moveTo(vx, vy); ctx.lineTo(tx, ty); ctx.stroke();
      ctx.font = 'bold 19px monospace';
      ctx.globalAlpha = 0.80;
      ctx.fillText(labels6[k],
        tx + Math.cos(a)*8 - 13,
        ty + Math.sin(a)*8 + 7
      );
      ctx.globalAlpha = 1;
    }

    /* Label centrale */
    ctx.font = 'bold 14px monospace';
    ctx.globalAlpha = 0.48;
    ctx.textAlign = 'center';
    ctx.fillText('C₆H₆', cx, cy + 5);
    ctx.globalAlpha = 1;
    ctx.textAlign = 'left';

    return new THREE.CanvasTexture(c);
  }

  function makeDataTexA() {
    const c = document.createElement('canvas'); c.width = c.height = 256;
    const ctx = c.getContext('2d');
    ctx.clearRect(0, 0, 256, 256);
    ctx.fillStyle = 'rgba(255,255,255,0.92)';

    const rnd8 = () => Math.floor(Math.random()*99999999).toString().padStart(8, '0');
    const rnd2 = () => Math.floor(Math.random()*99).toString().padStart(2, '0');

    /* Numero principale */
    ctx.font = 'bold 29px monospace';
    ctx.fillText(rnd8(), 12, 48);

    /* Numero secondario con separatore */
    ctx.font = '19px monospace';
    ctx.globalAlpha = 0.82;
    ctx.fillText(rnd8() + ' / ' + rnd2(), 12, 76);

    /* Sub-labels */
    ctx.font = '13px monospace';
    ctx.globalAlpha = 0.52;
    ctx.fillText('SEQ: ' + Math.random().toString(36).substring(2,9).toUpperCase(), 12, 100);
    ctx.fillText('ΔT: 0.' + Math.floor(Math.random()*999).toString().padStart(3,'0') + 'ms', 12, 116);

    ctx.globalAlpha = 1;

    /* Barre di riempimento */
    ctx.fillRect(12, 128, 55 + Math.random()*100, 2.5);
    ctx.globalAlpha = 0.55;
    ctx.fillRect(12, 134, 30 + Math.random()*70,  2);
    ctx.globalAlpha = 1;

    /* Codice a barre */
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    for (let i = 0; i < 22; i++) {
      const bw = 2 + Math.random() * 4;
      const bh = 28 + Math.random() * 20;
      ctx.fillRect(12 + i * 10, 148, bw, bh);
    }

    /* Footer */
    ctx.font = '11px monospace';
    ctx.globalAlpha = 0.35;
    ctx.fillText('ABSTERGO INDUSTRIES · GEN-ALPHA', 12, 208);
    ctx.globalAlpha = 1;

    return new THREE.CanvasTexture(c);
  }

  function makeDataTexB() {
    const c = document.createElement('canvas'); c.width = c.height = 256;
    const ctx = c.getContext('2d');
    ctx.clearRect(0, 0, 256, 256);
    ctx.fillStyle   = 'rgba(255,255,255,0.90)';
    ctx.strokeStyle = 'rgba(255,255,255,0.42)';

    /* Bordo decorativo */
    ctx.lineWidth = 1.5;
    ctx.strokeRect(5, 5, 246, 246);
    const corner = (x, y, sx, sy) => {
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + sx*18, y); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y + sy*18); ctx.stroke();
    };
    corner(5, 5, 1, 1); corner(251, 5, -1, 1);
    corner(5, 251, 1, -1); corner(251, 251, -1, -1);

    /* Testo codice */
    const lines = [
      '> SYNC_INIT 0x' + Math.floor(Math.random()*0xFFFF).toString(16).toUpperCase().padStart(4,'0'),
      '  MEM_ID: ' + Math.floor(Math.random()*999999).toString().padStart(6,'0'),
      '  LAYER:  GENETIC-A',
      '  STATUS: ACTIVE',
      '  DEPTH:  0.' + Math.floor(Math.random()*999),
      '',
      '  ATCG ' + Math.random().toString(36).substring(2,8).toUpperCase(),
      '  FRAG: #' + Math.floor(Math.random()*9000+1000),
    ];
    ctx.font = '16px monospace';
    lines.forEach((ln, i) => {
      ctx.globalAlpha = i === 0 ? 0.90 : i > 5 ? 0.62 : 0.72;
      ctx.fillText(ln, 16, 40 + i*25);
    });
    ctx.globalAlpha = 1;

    /* Footer */
    ctx.font = '11px monospace';
    ctx.globalAlpha = 0.32;
    ctx.fillText('■ ANIMUS 3.28 ■ DNA CORRIDOR ACTIVE', 16, 238);
    ctx.globalAlpha = 1;

    return new THREE.CanvasTexture(c);
  }

  function makeGlyphTex() {
    const c = document.createElement('canvas'); c.width = c.height = 256;
    const ctx = c.getContext('2d');
    ctx.clearRect(0, 0, 256, 256);
    ctx.strokeStyle = 'rgba(255,255,255,0.88)';
    ctx.fillStyle   = 'rgba(255,255,255,0.88)';
    ctx.lineWidth   = 2;

    /* Barre glitch sparse */
    ctx.globalAlpha = 0.72;
    for (let k = 0; k < 10; k++) {
      const x = 10 + Math.random()*180, y = 10 + Math.random()*195;
      ctx.fillRect(x, y, 8 + Math.random()*52, 2 + Math.random()*7);
    }

    /* Reticolo con mirino */
    const tcx = 128, tcy = 88, ir = 10, or = 30;
    ctx.globalAlpha = 0.88;
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(tcx, tcy, or, 0, Math.PI*2); ctx.stroke();
    ctx.beginPath(); ctx.arc(tcx, tcy, ir, 0, Math.PI*2); ctx.stroke();
    ctx.beginPath(); ctx.arc(tcx, tcy, 2,  0, Math.PI*2); ctx.fill();
    [[tcx-or-8,tcy,tcx-or,tcy],[tcx+or,tcy,tcx+or+8,tcy],
     [tcx,tcy-or-8,tcx,tcy-or],[tcx,tcy+or,tcx,tcy+or+8]].forEach(([x1,y1,x2,y2]) => {
      ctx.beginPath(); ctx.moveTo(x1,y1); ctx.lineTo(x2,y2); ctx.stroke();
    });

    /* Testo tecnico */
    ctx.font = '14px monospace';
    ctx.globalAlpha = 0.68;
    ['+4.0  -2.3', 'ΔT: 0.14ms', 'SYNC_OK', '◈ MEM.LOCK', 'SECTOR_3'].forEach((m, i) => {
      ctx.fillText(m, 62, 150 + i*19);
    });

    /* Linea tratteggiata in fondo */
    ctx.setLineDash([4, 4]);
    ctx.globalAlpha = 0.42;
    ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(10, 238); ctx.lineTo(246, 238); ctx.stroke();
    ctx.setLineDash([]);

    ctx.globalAlpha = 1;
    return new THREE.CanvasTexture(c);
  }

  function makeLogoTex() {
    const c = document.createElement('canvas'); c.width = c.height = 256;
    const ctx = c.getContext('2d');
    ctx.clearRect(0, 0, 256, 256);
    ctx.strokeStyle = 'rgba(255,255,255,0.85)';
    ctx.fillStyle   = 'rgba(255,255,255,0.85)';
    ctx.lineCap     = 'round';

    /* Esagono esterno */
    ctx.lineWidth = 1.8;
    ctx.globalAlpha = 0.42;
    ctx.beginPath();
    for (let k = 0; k <= 6; k++) {
      const a = (k/6)*Math.PI*2 - Math.PI/6;
      k===0 ? ctx.moveTo(128+Math.cos(a)*96, 115+Math.sin(a)*96)
            : ctx.lineTo(128+Math.cos(a)*96, 115+Math.sin(a)*96);
    }
    ctx.closePath(); ctx.stroke();
    ctx.globalAlpha = 1;

    /* Triangolo Abstergo (wireframe) */
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(128, 30);
    ctx.lineTo(52, 168);
    ctx.lineTo(204, 168);
    ctx.closePath();
    ctx.stroke();

    /* Barra orizzontale */
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(52, 168); ctx.lineTo(204, 168); ctx.stroke();

    /* Triangolo interno */
    ctx.lineWidth = 1.5;
    ctx.globalAlpha = 0.58;
    ctx.beginPath();
    ctx.moveTo(128, 68);
    ctx.lineTo(84, 150);
    ctx.lineTo(172, 150);
    ctx.closePath();
    ctx.stroke();
    ctx.globalAlpha = 1;

    /* Segni sui vertici esagono */
    ctx.lineWidth = 2;
    ctx.globalAlpha = 0.46;
    for (let k = 0; k < 6; k++) {
      const a = (k/6)*Math.PI*2 - Math.PI/6;
      ctx.beginPath();
      ctx.moveTo(128+Math.cos(a)*88, 115+Math.sin(a)*88);
      ctx.lineTo(128+Math.cos(a)*103, 115+Math.sin(a)*103);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;

    /* Testo */
    ctx.font = 'bold 17px sans-serif';
    ctx.globalAlpha = 0.88;
    ctx.textAlign = 'center';
    ctx.fillText('ABSTERGO', 128, 200);
    ctx.font = '11px monospace';
    ctx.globalAlpha = 0.42;
    ctx.fillText('INDUSTRIES', 128, 218);
    ctx.globalAlpha = 1;
    ctx.textAlign = 'left';

    return new THREE.CanvasTexture(c);
  }

  /* ── HUD OVERLAY (tema bianco su sfondo grigio-azzurro) ── */
  function buildOverlay() {
    const el = document.createElement('div');
    el.id = 'anim-transition-overlay';
    el.style.cssText = 'position:fixed;inset:0;z-index:9998;pointer-events:none;font-family:Consolas,"Lucida Console",monospace;color:rgba(255,255,255,0.80);font-size:10px;letter-spacing:2px;';
    const hex = () => Math.floor(Math.random()*0xFFFFFF).toString(16).toUpperCase().padStart(6,'0');
    el.innerHTML = `
      <div style="position:absolute;top:8%;left:50%;transform:translateX(-50%);text-align:center;">
        <div style="font-size:9px;letter-spacing:7px;opacity:0.42;margin-bottom:7px;">A N I M U S · 3 . 2 8 · A B S T E R G O</div>
        <div style="font-size:15px;letter-spacing:5px;text-shadow:0 0 28px rgba(255,255,255,.50);">⬡ ACCESSO MEMORIA GENETICA ⬡</div>
        <div style="font-size:8px;letter-spacing:4px;opacity:0.36;margin-top:5px;">CORRIDOIO APERTO · HELIX 1.0.0 · DNA-ALPHA</div>
      </div>
      <div style="position:absolute;bottom:15%;left:50%;transform:translateX(-50%);text-align:center;width:340px;">
        <div class="ov-pct" style="font-size:13px;letter-spacing:4px;margin-bottom:10px;text-shadow:0 0 18px rgba(255,255,255,.60);">SINCRONIZZAZIONE 99%</div>
        <div style="width:100%;height:2px;background:rgba(255,255,255,.15);border-radius:1px;overflow:hidden;">
          <div class="ov-fill" style="height:100%;width:0%;background:rgba(255,255,255,.78);transition:width 6s linear;box-shadow:0 0 10px rgba(255,255,255,.35);"></div>
        </div>
      </div>
      <div class="ov-seq" style="position:absolute;bottom:7%;left:50%;transform:translateX(-50%);font-size:8px;letter-spacing:6px;opacity:0.20;white-space:nowrap;"></div>
      <div style="position:absolute;top:50%;left:3%;transform:translateY(-50%);opacity:0.17;line-height:2.1;">MEM_ID · ${hex()}<br>ANIMUS · 3.28.1<br>LAYER · GENETIC<br>HEAP · OK<br>DELTA · 0.4ms<br>SYNC · AVVIO</div>
      <div style="position:absolute;top:50%;right:3%;transform:translateY(-50%);text-align:right;opacity:0.17;line-height:2.1;">EAGLE · ON<br>HELIX · 1.0.0<br>FRAMMENTI · ${Math.floor(Math.random()*900+100)}<br>CORRIDOIO · OK<br>TS · ${Date.now()}<br>STATO · STABILE</div>
      <div style="position:absolute;top:4%;left:3%;width:36px;height:36px;border-top:1px solid rgba(255,255,255,.22);border-left:1px solid rgba(255,255,255,.22);"></div>
      <div style="position:absolute;top:4%;right:3%;width:36px;height:36px;border-top:1px solid rgba(255,255,255,.22);border-right:1px solid rgba(255,255,255,.22);"></div>
      <div style="position:absolute;bottom:4%;left:3%;width:36px;height:36px;border-bottom:1px solid rgba(255,255,255,.22);border-left:1px solid rgba(255,255,255,.22);"></div>
      <div style="position:absolute;bottom:4%;right:3%;width:36px;height:36px;border-bottom:1px solid rgba(255,255,255,.22);border-right:1px solid rgba(255,255,255,.22);"></div>`;
    return el;
  }

})();
