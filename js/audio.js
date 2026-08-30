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

    // Errore — tono discendente
    playError() {
      const t = ac().currentTime;
      tone(400, 'sawtooth', t, 0.25, 0.14, 160);
    },
  };
})();
