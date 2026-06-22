/**
 * AnimusAudio - Generatore procedurale di effetti sonori tramite Web Audio API
 */
class AnimusAudio {
  constructor() {
    this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.value = 0.4; // Volume ridotto per un effetto più ambientale/elegante
    this.masterGain.connect(this.ctx.destination);
    
    // Filtro pulitissimo, lascia passare alte frequenze da laboratorio
    this.masterFilter = this.ctx.createBiquadFilter();
    this.masterFilter.type = 'lowpass';
    this.masterFilter.frequency.value = 18000;
    this.masterFilter.connect(this.masterGain);
    
    // Auto-unlock policy
    const unlock = () => {
      if (this.ctx.state === 'suspended') {
        this.ctx.resume();
      }
    };
    window.addEventListener('click', unlock, { capture: true, once: true });
    window.addEventListener('touchstart', unlock, { capture: true, once: true });
    window.addEventListener('keydown', unlock, { capture: true, once: true });
  }

  init() {
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  // Hover: Micro-beep clinico/chirurgico (tipo touch di apparecchiatura medica)
  playHover() {
    if (this.ctx.state === 'suspended') return;
    
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    
    // Onda sinusoidale altissima e pulita
    osc.type = 'sine';
    osc.frequency.setValueAtTime(3200, this.ctx.currentTime);
    
    gain.gain.setValueAtTime(0, this.ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0.04, this.ctx.currentTime + 0.005);
    gain.gain.exponentialRampToValueAtTime(0.0001, this.ctx.currentTime + 0.03);
    
    osc.connect(gain);
    gain.connect(this.masterFilter);
    
    osc.start();
    osc.stop(this.ctx.currentTime + 0.03);
  }

  // Click: Doppio beep netto di conferma diagnostica (senza distorsioni)
  playClick() {
    if (this.ctx.state === 'suspended') this.ctx.resume();

    const t = this.ctx.currentTime;
    
    // 1° Beep
    const osc = this.ctx.createOscillator();
    const gainOsc = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(2400, t);
    
    gainOsc.gain.setValueAtTime(0, t);
    gainOsc.gain.linearRampToValueAtTime(0.15, t + 0.005);
    gainOsc.gain.exponentialRampToValueAtTime(0.0001, t + 0.04);
    
    osc.connect(gainOsc);
    gainOsc.connect(this.masterFilter);
    osc.start(t);
    osc.stop(t + 0.04);

    // 2° Beep (leggermente più alto, tipico di conferma scientifica)
    const osc2 = this.ctx.createOscillator();
    const gainOsc2 = this.ctx.createGain();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(3200, t + 0.06);
    
    gainOsc2.gain.setValueAtTime(0, t + 0.06);
    gainOsc2.gain.linearRampToValueAtTime(0.1, t + 0.065);
    gainOsc2.gain.exponentialRampToValueAtTime(0.0001, t + 0.1);
    
    osc2.connect(gainOsc2);
    gainOsc2.connect(this.masterFilter);
    osc2.start(t + 0.06);
    osc2.stop(t + 0.1);
  }

  // Boot: Rumore di fondo di un macchinario ad alta tecnologia (MRI/Server) che si attiva
  playBoot() {
    if (this.ctx.state === 'suspended') return; 

    const t = this.ctx.currentTime;

    // Resonant hum di fondo (onde a bassissima frequenza molto pulite)
    const sub = this.ctx.createOscillator();
    const subGain = this.ctx.createGain();
    sub.type = 'sine';
    sub.frequency.setValueAtTime(50, t);
    
    subGain.gain.setValueAtTime(0, t);
    subGain.gain.linearRampToValueAtTime(0.5, t + 1.0);
    subGain.gain.linearRampToValueAtTime(0.5, t + 2.0);
    subGain.gain.exponentialRampToValueAtTime(0.0001, t + 3.5);
    
    sub.connect(subGain);
    subGain.connect(this.masterFilter);
    sub.start(t);
    sub.stop(t + 3.5);

    // Bip diagnostico che si stabilizza
    const beep = this.ctx.createOscillator();
    const beepGain = this.ctx.createGain();
    beep.type = 'sine';
    beep.frequency.setValueAtTime(2000, t);
    beep.frequency.exponentialRampToValueAtTime(2800, t + 1.5);
    
    beepGain.gain.setValueAtTime(0, t);
    beepGain.gain.linearRampToValueAtTime(0.0, t + 0.5);
    beepGain.gain.linearRampToValueAtTime(0.08, t + 1.0);
    beepGain.gain.exponentialRampToValueAtTime(0.0001, t + 2.0);
    
    beep.connect(beepGain);
    beepGain.connect(this.masterFilter);
    beep.start(t);
    beep.stop(t + 2.0);
  }

  // Aria compressa da camera sterile
  playDoorOpen() {
    if (this.ctx.state === 'suspended') return;
    
    const bufferSize = this.ctx.sampleRate * 1.5;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;

    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;
    
    // Filtro a banda stretta, sibilante tipo gas sterilizzante
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(4500, this.ctx.currentTime);
    filter.Q.value = 1.0;

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0, this.ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0.25, this.ctx.currentTime + 0.1);
    gain.gain.exponentialRampToValueAtTime(0.0001, this.ctx.currentTime + 1.2);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);

    noise.start();
  }

  // Transizione: Scansione telemetrica veloce (sequenza di micro-beep molto precisi)
  playTransition() {
    if (this.ctx.state === 'suspended') return;

    const t = this.ctx.currentTime;

    // 6 micro-beep elaborazione dati
    for(let i=0; i<6; i++) {
        const time = t + (i * 0.05);
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = 'sine';
        // Frequenze precise, fredde
        osc.frequency.setValueAtTime(4000 + (Math.random() * 500), time);

        gain.gain.setValueAtTime(0, time);
        gain.gain.linearRampToValueAtTime(0.05, time + 0.005);
        gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.035);

        osc.connect(gain);
        gain.connect(this.masterFilter);

        osc.start(time);
        osc.stop(time + 0.035);
    }
  }

  playSyncSequence() {
    if (this.ctx.state === 'suspended') return;
    const t = this.ctx.currentTime;
    // Sustained hum
    const hum = this.ctx.createOscillator();
    const humGain = this.ctx.createGain();
    hum.type = 'sine'; hum.frequency.value = 80;
    humGain.gain.setValueAtTime(0, t);
    humGain.gain.linearRampToValueAtTime(0.08, t + 0.3);
    humGain.gain.linearRampToValueAtTime(0.06, t + 2.5);
    humGain.gain.exponentialRampToValueAtTime(0.0001, t + 3.0);
    hum.connect(humGain); humGain.connect(this.masterFilter);
    hum.start(t); hum.stop(t + 3.0);
    // Scan beeps
    for (let i = 0; i < 5; i++) {
      const time = t + 0.3 + i * 0.42;
      const o = this.ctx.createOscillator(), g = this.ctx.createGain();
      o.type = 'sine'; o.frequency.value = 2200 + i * 180;
      g.gain.setValueAtTime(0, time);
      g.gain.linearRampToValueAtTime(0.07, time + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, time + 0.08);
      o.connect(g); g.connect(this.masterFilter);
      o.start(time); o.stop(time + 0.08);
    }
  }

  playSedation() {
    if (this.ctx.state === 'suspended') return;
    const t = this.ctx.currentTime;
    // Slow heartbeat-style pulses (two-tone: lub + dub, decelerating)
    const beats = [[0.3, 0.16], [0.55, 0.16], [1.2, 0.15], [1.4, 0.15], [2.3, 0.13], [2.45, 0.13], [3.5, 0.10]];
    beats.forEach(([delay, vol]) => {
      const time = t + delay;
      const o = this.ctx.createOscillator(), g = this.ctx.createGain();
      o.type = 'sine'; o.frequency.value = 55;
      g.gain.setValueAtTime(0, time);
      g.gain.linearRampToValueAtTime(vol, time + 0.04);
      g.gain.exponentialRampToValueAtTime(0.0001, time + 0.25);
      o.connect(g); g.connect(this.masterGain);
      o.start(time); o.stop(time + 0.3);
    });
    // Lowpass filter descends (ovattamento)
    this.masterFilter.frequency.setValueAtTime(18000, t);
    this.masterFilter.frequency.linearRampToValueAtTime(400, t + 3.8);
  }

  playTunnel() {
    if (this.ctx.state === 'suspended') return;
    const t = this.ctx.currentTime;
    // Restore filter
    this.masterFilter.frequency.setValueAtTime(18000, t);
    // Whoosh burst (noise)
    const bufSz = this.ctx.sampleRate * 0.8;
    const buf = this.ctx.createBuffer(1, bufSz, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < bufSz; i++) data[i] = (Math.random() * 2 - 1) * (1 - i/bufSz);
    const ns = this.ctx.createBufferSource(); ns.buffer = buf;
    const nf = this.ctx.createBiquadFilter(); nf.type = 'bandpass'; nf.frequency.value = 2000; nf.Q.value = 0.5;
    const ng = this.ctx.createGain();
    ng.gain.setValueAtTime(0.35, t); ng.gain.exponentialRampToValueAtTime(0.0001, t + 0.8);
    ns.connect(nf); nf.connect(ng); ng.connect(this.masterGain);
    ns.start(t);
    // Sustained data-stream tone (rising)
    const o = this.ctx.createOscillator(), g = this.ctx.createGain();
    o.type = 'sawtooth'; o.frequency.setValueAtTime(220, t); o.frequency.linearRampToValueAtTime(440, t + 6.0);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.04, t + 0.5);
    g.gain.linearRampToValueAtTime(0.04, t + 5.5); g.gain.exponentialRampToValueAtTime(0.0001, t + 6.5);
    const f2 = this.ctx.createBiquadFilter(); f2.type = 'lowpass'; f2.frequency.value = 800;
    o.connect(f2); f2.connect(g); g.connect(this.masterFilter);
    o.start(t); o.stop(t + 6.5);
  }

  playWhiteArrive() {
    if (this.ctx.state === 'suspended') return;
    const t = this.ctx.currentTime;
    this.masterFilter.frequency.setValueAtTime(18000, t);
    // Bright reverberant ping
    const o = this.ctx.createOscillator(), g = this.ctx.createGain();
    o.type = 'sine'; o.frequency.setValueAtTime(3800, t); o.frequency.exponentialRampToValueAtTime(2200, t + 2.0);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.18, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 2.5);
    o.connect(g); g.connect(this.masterFilter);
    o.start(t); o.stop(t + 2.5);
    // Sub impact
    const o2 = this.ctx.createOscillator(), g2 = this.ctx.createGain();
    o2.type = 'sine'; o2.frequency.value = 60;
    g2.gain.setValueAtTime(0.3, t); g2.gain.exponentialRampToValueAtTime(0.0001, t + 0.8);
    o2.connect(g2); g2.connect(this.masterGain);
    o2.start(t); o2.stop(t + 0.8);
  }
}

window.audioEngine = new AnimusAudio();
