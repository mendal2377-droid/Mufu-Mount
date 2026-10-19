// Music for sitting still: a new short piece every time, composed in the browser.
//
// No samples, no server, no AI service: a seeded random walk over the Chinese gong-mode
// pentatonic (宫 商 角 徵 羽), plucked by a guzheng-like voice over a slow pad, with an
// occasional bamboo-flute phrase. Each sit gets a fresh seed, so no two visits sound alike;
// the place and the weather pick the tempo, register and how sparse it is.
//
// It plays through NatureAudio's master gain, so the visitor's sound toggle mutes it too.

const GONG = [0, 2, 4, 7, 9];           // semitones of the pentatonic within an octave
const ROOTS = {zhongshan: 62, default: 60};  // D for the stage, C elsewhere (MIDI)

const hz = midi => 440 * 2 ** ((midi - 69) / 12);

function rng(seed) {
  let s = seed >>> 0 || 1;
  return () => ((s = Math.imul(s ^ (s >>> 15), 2246822507) ^ Math.imul(s ^ (s >>> 13), 3266489909), (s ^= s >>> 16) >>> 0) / 4294967296);
}

export function createMusic(audio) {
  let ctx = null, out = null, verb = null, playing = false, nextTime = 0, step = 0, rand = Math.random;
  let degree = 7, root = 60, beat = .45, density = .6, chordAt = 0, pad = null, fluteDue = 0;

  function ensure() {
    if (ctx || !audio.ctx) return !!ctx;
    ctx = audio.ctx;
    out = ctx.createGain(); out.gain.value = 0;
    // A small hall: decaying noise impulse, no download.
    verb = ctx.createConvolver();
    const len = ctx.sampleRate * 2.8, ir = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = ir.getChannelData(ch);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len) ** 3.2;
    }
    verb.buffer = ir;
    const wet = ctx.createGain(); wet.gain.value = .32;
    out.connect(audio.master); out.connect(verb); verb.connect(wet); wet.connect(audio.master);
    return true;
  }

  function noteOf(deg) {
    const oct = Math.floor(deg / 5), pc = GONG[((deg % 5) + 5) % 5];
    return root + oct * 12 + pc;
  }

  // Guzheng-ish pluck: bright attack, partials decaying at different rates, a tiny pitch bend
  // into the note as a player's left hand would press the string.
  function pluck(t, midi, vel = 1, bend = 0) {
    const f = hz(midi), g = ctx.createGain(), lp = ctx.createBiquadFilter();
    lp.type = 'lowpass'; lp.frequency.setValueAtTime(f * 9, t); lp.frequency.exponentialRampToValueAtTime(f * 2.2, t + 1.2);
    g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(.09 * vel, t + .006);
    g.gain.exponentialRampToValueAtTime(.0001, t + 3.2);
    g.connect(lp); lp.connect(out);
    [[1, 1], [2, .42], [3, .2], [4.02, .1]].forEach(([mul, amp], i) => {
      const o = ctx.createOscillator(), og = ctx.createGain();
      o.type = i ? 'sine' : 'triangle';
      o.frequency.setValueAtTime(f * mul * (bend ? 2 ** (-bend / 12) : 1), t);
      if (bend) o.frequency.exponentialRampToValueAtTime(f * mul, t + .18);
      og.gain.value = amp;
      o.connect(og); og.connect(g);
      o.start(t); o.stop(t + 3.3);
      o.onended = () => { o.disconnect(); og.disconnect(); };
    });
    setTimeout(() => { g.disconnect(); lp.disconnect(); }, (t - ctx.currentTime + 3.5) * 1000);
  }

  // Bamboo flute: sine with delayed vibrato and a little breath noise.
  function flute(t, midi, dur) {
    const f = hz(midi), o = ctx.createOscillator(), g = ctx.createGain(), vib = ctx.createOscillator(), vg = ctx.createGain();
    o.type = 'sine'; o.frequency.value = f;
    vib.frequency.value = 5.2; vg.gain.setValueAtTime(0, t); vg.gain.linearRampToValueAtTime(f * .012, t + dur * .5);
    vib.connect(vg); vg.connect(o.frequency);
    g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(.035, t + .25);
    g.gain.setValueAtTime(.035, t + dur * .7); g.gain.exponentialRampToValueAtTime(.0001, t + dur + .4);
    o.connect(g); g.connect(out);
    const n = ctx.createBufferSource(), nb = ctx.createBuffer(1, ctx.sampleRate * (dur + .5), ctx.sampleRate), d = nb.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * .5;
    n.buffer = nb;
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = f * 2; bp.Q.value = 2;
    const ng = ctx.createGain(); ng.gain.value = .12;
    n.connect(bp); bp.connect(ng); ng.connect(g);
    for (const s of [o, vib, n]) { s.start(t); s.stop(t + dur + .5); }
    o.onended = () => [o, vib, vg, g, n, bp, ng].forEach(x => x.disconnect());
  }

  // Pad: two detuned triangles per chord tone through a soft low-pass, swelling slowly.
  function padChord(t, degrees, dur) {
    const g = ctx.createGain(), lp = ctx.createBiquadFilter();
    lp.type = 'lowpass'; lp.frequency.value = 900;
    g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(.022, t + dur * .4);
    g.gain.exponentialRampToValueAtTime(.0001, t + dur + 1.5);
    g.connect(lp); lp.connect(out);
    const oscs = [];
    for (const d of degrees) for (const det of [-6, 6]) {
      const o = ctx.createOscillator(); o.type = 'triangle'; o.frequency.value = hz(noteOf(d) - 12); o.detune.value = det;
      o.connect(g); o.start(t); o.stop(t + dur + 1.6); oscs.push(o);
    }
    oscs[0].onended = () => { oscs.forEach(o => o.disconnect()); g.disconnect(); lp.disconnect(); };
  }

  function schedule() {
    // Look ahead 0.6 s; called every frame while playing.
    while (nextTime < ctx.currentTime + .6) {
      const bar = Math.floor(step / 8);
      if (step % 16 === 0 && bar !== chordAt) {
        chordAt = bar;
        const base = [0, 3, 5, 2][Math.floor(step / 16) % 4];
        padChord(nextTime, [base, base + 2, base + 4], beat * 16);
      }
      // Phrase shape: play more on strong beats, breathe at phrase ends.
      const strong = step % 4 === 0, phraseEnd = step % 16 >= 14;
      if (!phraseEnd && rand() < (strong ? .9 : density * .55)) {
        const stepDeg = [-2, -1, -1, 0, 1, 1, 2, 3][Math.floor(rand() * 8)];
        degree = Math.max(3, Math.min(13, degree + stepDeg));
        const ornament = rand() < .18;
        if (ornament) pluck(nextTime - .06, noteOf(degree + 1), .35);
        pluck(nextTime, noteOf(degree), strong ? 1 : .7, rand() < .2 ? 1 : 0);
        // Octave doubling on phrase starts, the way a zheng player marks a line.
        if (step % 16 === 0) pluck(nextTime, noteOf(degree) - 12, .55);
      }
      if (nextTime > fluteDue && step % 16 === 4) {
        fluteDue = nextTime + 18 + rand() * 20;
        let d = degree + 5;
        for (let k = 0; k < 4; k++) { d += [-1, 1, -2, 0][Math.floor(rand() * 4)]; flute(nextTime + k * beat * 2, noteOf(d), beat * 2.2); }
      }
      nextTime += beat * (step % 2 ? .92 : 1.08);   // a little swing: rubato, not a click track
      step++;
    }
  }

  return {
    get playing() { return playing; },
    // place: landmark id; weather: shared weather blend (sunset slows, storm thins out)
    start(place = 'default', weather = {}) {
      if (!ensure()) return false;
      rand = rng((Date.now() ^ (Math.random() * 1e9)) >>> 0);
      root = (ROOTS[place] || ROOTS.default) + (rand() < .3 ? -2 : 0);
      beat = .42 + (weather.sunset || 0) * .12 + rand() * .08;
      density = .65 - (weather.storm || 0) * .35;
      degree = 7 + Math.floor(rand() * 3); step = 0; chordAt = -1;
      nextTime = ctx.currentTime + .4; fluteDue = nextTime + 6 + rand() * 6;
      out.gain.cancelScheduledValues(ctx.currentTime);
      out.gain.setTargetAtTime(2.2, ctx.currentTime, 1.2);   // peaks ~0.18: above the nature beds, never clipping
      playing = true;
      return true;
    },
    stop() {
      if (!playing) return;
      playing = false;
      out.gain.cancelScheduledValues(ctx.currentTime);
      out.gain.setTargetAtTime(0, ctx.currentTime, .8);
    },
    update() { if (playing && ctx) schedule(); },
    // A temple bell: inharmonic partials of a struck bronze bell, a slow beating hum underneath.
    bell() {
      if (!ensure()) return;
      const t = ctx.currentTime + .02, f = 98;
      out.gain.cancelScheduledValues(ctx.currentTime); out.gain.setTargetAtTime(Math.max(out.gain.value, 2.2), ctx.currentTime, .05);
      [[.5, .5, 9], [1, .9, 7], [2.0, .5, 5], [2.76, .35, 4], [5.4, .18, 2.5], [8.93, .08, 1.2]].forEach(([mul, amp, dec], i) => {
        const o = ctx.createOscillator(), g = ctx.createGain();
        o.frequency.value = f * mul * (i === 0 ? 1.004 : 1);
        g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(.06 * amp, t + .01);
        g.gain.exponentialRampToValueAtTime(.0001, t + dec);
        o.connect(g); g.connect(out); o.start(t); o.stop(t + dec + .1);
        o.onended = () => { o.disconnect(); g.disconnect(); };
      });
      if (!playing) setTimeout(() => { if (!playing) out.gain.setTargetAtTime(0, ctx.currentTime, 2); }, 9000);
    },
  };
}
