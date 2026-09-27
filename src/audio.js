export class NatureAudio {
  constructor() {
    this.enabled = false;
    this.nodes = {};
    this.lastStep = 0;
    this.started = false;
    this.lastHorn = -60;
  }
  async start() {
    if (this.ctx) {
      await this.ctx.resume();
      return;
    }
    const C = window.AudioContext || window.webkitAudioContext;
    if (!C) return;
    this.ctx = new C();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0;
    this.master.connect(this.ctx.destination);
    await this.ctx.resume();
    await Promise.all(
      ["forest", "wind", "water", "rain", "snow", "bird"].map(async (name) => {
        const res = await fetch(`/audio/${name}.mp3`);
        if (!res.ok) throw Error("Sound download failed");
        const buffer = await this.ctx.decodeAudioData(await res.arrayBuffer());
        const source = this.ctx.createBufferSource();
        source.buffer = buffer;
        source.loop = true;
        const gain = this.ctx.createGain();
        gain.gain.value = 0;
        source.connect(gain);
        gain.connect(this.master);
        source.start();
        this.nodes[name] = { gain, source };
      }),
    );
    this.started = true;
  }
  toggle(on) {
    this.enabled = on;
    if (this.ctx) {
      this.ctx.resume();
      this.master.gain.setTargetAtTime(on ? 0.7 : 0, this.ctx.currentTime, 0.3);
    }
  }
  update(weather, river, moving) {
    if (!this.ctx) return;
    const storm = weather.storm,
      snow = weather.snow;
    const levels = {
      forest: 0.55 * (1 - storm) * (1 - snow * 0.85),
      wind: 0.17 + storm * 0.65 + snow * 0.12,
      water: river * 0.45,
      rain: storm * 0.62,
      snow: snow * (moving ? 0.32 : 0),
      bird: 0.18 * (1 - storm) * (1 - snow),
    };
    Object.entries(this.nodes).forEach(([n, v]) =>
      v.gain.gain.setTargetAtTime(levels[n], this.ctx.currentTime, 0.7),
    );
  }
  noise(duration, volume, frequency) {
    if (!this.ctx || !this.enabled) return;
    const c = this.ctx,
      b = c.createBuffer(1, c.sampleRate * duration, c.sampleRate),
      a = b.getChannelData(0);
    for (let i = 0; i < a.length; i++)
      a[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / a.length, 2);
    const s = c.createBufferSource();
    s.buffer = b;
    const f = c.createBiquadFilter();
    f.type = "lowpass";
    f.frequency.value = frequency;
    const g = c.createGain();
    g.gain.value = volume;
    s.connect(f);
    f.connect(g);
    g.connect(this.master);
    s.start();
    s.onended = () => {
      s.disconnect();
      f.disconnect();
      g.disconnect();
    };
  }
  thunder() {
    this.noise(3.8, 0.38, 170);
  }
  /** A soft two-note bell for the moment a memory opens. */
  chime() {
    if (!this.ctx || !this.enabled) return;
    const c = this.ctx,
      now = c.currentTime;
    [
      [587.33, 0, 0.055],
      [880.0, 0.16, 0.038],
    ].forEach(([hz, delay, peak]) => {
      const o = c.createOscillator(),
        g = c.createGain();
      o.type = "sine";
      o.frequency.value = hz;
      g.gain.setValueAtTime(0.0001, now + delay);
      g.gain.exponentialRampToValueAtTime(peak, now + delay + 0.03);
      g.gain.exponentialRampToValueAtTime(0.0001, now + delay + 2.1);
      o.connect(g);
      g.connect(this.master);
      o.start(now + delay);
      o.stop(now + delay + 2.2);
      o.onended = () => {
        o.disconnect();
        g.disconnect();
      };
    });
  }
  /** Footsteps now come from the walk cycle rather than a fixed interval. */
  footstep(weather) {
    if (!this.ctx || !this.enabled) return;
    const wet = weather?.storm || 0;
    this.noise(0.1 + wet * 0.04, 0.02 + wet * 0.012, 240 + wet * 420);
  }
  riverTraffic(traffic, time, active) {
    if (!this.ctx || !this.started) return;
    const c = this.ctx,
      level = active ? Math.max(0, 1 - traffic.distance / 850) : 0;
    if (!this.engine) {
      const gain = c.createGain(),
        pan = c.createStereoPanner();
      gain.gain.value = 0;
      gain.connect(pan);
      pan.connect(this.master);
      for (const hz of [43, 64.5]) {
        const o = c.createOscillator();
        o.type = "sine";
        o.frequency.value = hz;
        o.connect(gain);
        o.start();
      }
      this.engine = { gain, pan };
    }
    this.engine.gain.gain.setTargetAtTime(
      level * level * 0.013,
      c.currentTime,
      1.5,
    );
    this.engine.pan.pan.setTargetAtTime(traffic.pan, c.currentTime, 0.7);
    if (
      this.enabled &&
      active &&
      traffic.distance < 700 &&
      time - this.lastHorn > 85
    ) {
      this.lastHorn = time;
      const gain = c.createGain(),
        pan = c.createStereoPanner();
      pan.pan.value = traffic.pan;
      gain.gain.setValueAtTime(0, c.currentTime);
      gain.gain.linearRampToValueAtTime(0.027 * level, c.currentTime + 0.5);
      gain.gain.setValueAtTime(0.027 * level, c.currentTime + 1.5);
      gain.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + 3.4);
      gain.connect(pan);
      pan.connect(this.master);
      const voices = [110, 146.8, 220].map((hz) => {
        const o = c.createOscillator();
        o.type = "sine";
        o.frequency.value = hz;
        o.connect(gain);
        o.start();
        o.stop(c.currentTime + 3.5);
        return o;
      });
      voices[0].onended = () => {
        voices.forEach((o) => o.disconnect());
        gain.disconnect();
        pan.disconnect();
      };
    }
  }
}
