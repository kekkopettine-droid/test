window.audioEngine = (function () {
  let ctx = null;

  function ac() {
    if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }

  function tone(freq, type, t0, dur, vol, freqEnd) {
    const c = ac();
    const osc = c.createOscillator();
    const amp = c.createGain();
    osc.connect(amp);
    amp.connect(c.destination);
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (freqEnd) osc.frequency.exponentialRampToValueAtTime(freqEnd, t0 + dur);
    amp.gain.setValueAtTime(vol, t0);
    amp.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  }

  function click_noise(t0, dur, vol, bandFreq) {
    const c = ac();
    const samples = Math.ceil(c.sampleRate * dur);
    const buf = c.createBuffer(1, samples, c.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < samples; i++) data[i] = Math.random() * 2 - 1;
    const src = c.createBufferSource();
    src.buffer = buf;
    const filt = c.createBiquadFilter();
    filt.type = 'bandpass';
    filt.frequency.value = bandFreq || 3000;
    filt.Q.value = 1.5;
    const amp = c.createGain();
    src.connect(filt); filt.connect(amp); amp.connect(c.destination);
    amp.gain.setValueAtTime(vol, t0);
    amp.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.start(t0); src.stop(t0 + dur + 0.02);
  }

  return {

    // Swipe leggero e serio — soffio d'aria controllato
    playSwipe() {
      const c   = ac();
      const t   = c.currentTime;
      const dur = 0.28;

      // Rumore pink sottile
      const samples = Math.ceil(c.sampleRate * dur);
      const buf  = c.createBuffer(1, samples, c.sampleRate);
      const data = buf.getChannelData(0);
      let b0=0,b1=0,b2=0,b3=0;
      for (let i = 0; i < samples; i++) {
        const w = Math.random() * 2 - 1;
        b0=0.99886*b0+w*0.0555179; b1=0.99332*b1+w*0.0750759;
        b2=0.96900*b2+w*0.1538520; b3=0.86650*b3+w*0.3104856;
        data[i] = (b0+b1+b2+b3)*0.12;
      }
      const src = c.createBufferSource();
      src.buffer = buf;

      // Bandpass stretto — taglia i bassi pesanti e gli acuti giocosi
      const bp = c.createBiquadFilter();
      bp.type = 'bandpass'; bp.Q.value = 0.6;
      bp.frequency.setValueAtTime(500,  t);
      bp.frequency.exponentialRampToValueAtTime(1600, t + dur * 0.45);
      bp.frequency.exponentialRampToValueAtTime(700,  t + dur);

      // Inviluppo rapido e discreto
      const amp = c.createGain();
      amp.gain.setValueAtTime(0.0001, t);
      amp.gain.exponentialRampToValueAtTime(0.13,   t + dur * 0.20);
      amp.gain.exponentialRampToValueAtTime(0.0001, t + dur);

      src.connect(bp); bp.connect(amp); amp.connect(c.destination);
      src.start(t); src.stop(t + dur + 0.02);

      // Leggero tono grave che svanisce subito — dà serietà senza peso
      const sub = c.createOscillator();
      const subAmp = c.createGain();
      sub.type = 'sine';
      sub.frequency.setValueAtTime(80, t);
      sub.frequency.exponentialRampToValueAtTime(45, t + dur * 0.6);
      subAmp.gain.setValueAtTime(0.0001, t);
      subAmp.gain.exponentialRampToValueAtTime(0.04, t + dur * 0.1);
      subAmp.gain.exponentialRampToValueAtTime(0.0001, t + dur * 0.55);
      sub.connect(subAmp); subAmp.connect(c.destination);
      sub.start(t); sub.stop(t + dur);
    },

    // Sottile ping al passaggio del cursore
    playHover() {
      const t = ac().currentTime;
      tone(1100, 'sine', t, 0.055, 0.025);
    },

    // Click digitale secco
    playClick() {
      const t = ac().currentTime;
      tone(1400, 'square', t, 0.035, 0.08);
      click_noise(t, 0.04, 0.06, 4000);
    },

    // Selezione/conferma — due toni ascendenti
    playConfirm() {
      const t = ac().currentTime;
      tone(660,  'sine', t,        0.18, 0.18);
      tone(1100, 'sine', t + 0.14, 0.22, 0.14);
    },

    // Aggiunta al carrello — tripletto soddisfacente
    playCart() {
      const t = ac().currentTime;
      tone(523, 'sine', t,        0.15, 0.16);
      tone(659, 'sine', t + 0.12, 0.15, 0.14);
      tone(880, 'sine', t + 0.24, 0.22, 0.18);
    },

    // Apertura epoca / pannello — whoosh + tono
    playEpoch() {
      const t = ac().currentTime;
      click_noise(t, 0.18, 0.12, 800);
      tone(220, 'sine', t, 0.35, 0.1, 440);
    },

    // Boot iniziale — sequenza ascendente
    playBoot() {
      const t = ac().currentTime;
      [180, 270, 360, 540, 720, 1080].forEach((f, i) => {
        tone(f, 'sine', t + i * 0.14, 0.28, 0.13);
      });
      click_noise(t + 0.7, 0.15, 0.08, 2000);
    },

    // Selezione personaggio storico — conferma solenne
    playCharSelect() {
      const c = ac();
      const t = c.currentTime;
      // Swoosh iniziale
      click_noise(t, 0.12, 0.18, 1200);
      // Accordo discendente profondo
      tone(880, 'sine',     t + 0.04, 0.55, 0.20, 440);
      tone(660, 'sine',     t + 0.10, 0.50, 0.16, 330);
      tone(440, 'sine',     t + 0.18, 0.60, 0.22, 220);
      // Risonanza finale grave
      tone(110, 'triangle', t + 0.35, 0.70, 0.18, 90);
      // Coda di statica soft
      click_noise(t + 0.55, 0.18, 0.07, 600);
    },

    // Errore — tono discendente
    playError() {
      const t = ac().currentTime;
      tone(400, 'sawtooth', t, 0.25, 0.14, 160);
    },

    // Interferenza glitch — statica + distorsione + sweep per l'easter egg
    playGlitch() {
      const c = ac();
      const t = c.currentTime;

      // Burst di statica irregolari
      const burstTimes = [0, 0.07, 0.18, 0.31, 0.47, 0.68, 0.9, 1.15, 1.5, 1.9, 2.4];
      burstTimes.forEach((dt, i) => {
        const dur   = 0.04 + Math.random() * 0.12;
        const vol   = 0.18 + Math.random() * 0.22;
        const band  = 200 + Math.random() * 3000;
        click_noise(t + dt, dur, vol, band);
      });

      // Toni distorti che scendono (radio che perde segnale)
      tone(340, 'sawtooth', t + 0.05, 0.6, 0.12, 60);
      tone(180, 'square',   t + 0.3,  0.5, 0.09, 40);
      tone(520, 'sawtooth', t + 0.9,  0.4, 0.10, 80);

      // Rumore bianco lungo come sottofondo d'interferenza
      const samples = Math.ceil(c.sampleRate * 2.8);
      const buf = c.createBuffer(1, samples, c.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < samples; i++) data[i] = (Math.random() * 2 - 1) * 0.08;
      const src = c.createBufferSource();
      src.buffer = buf;
      const filt = c.createBiquadFilter();
      filt.type = 'lowpass';
      filt.frequency.value = 600;
      const amp = c.createGain();
      src.connect(filt); filt.connect(amp); amp.connect(c.destination);
      amp.gain.setValueAtTime(0.18, t);
      amp.gain.setValueAtTime(0.18, t + 2.0);
      amp.gain.exponentialRampToValueAtTime(0.0001, t + 2.8);
      src.start(t); src.stop(t + 2.85);
    },
  };
})();
