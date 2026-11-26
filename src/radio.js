import {createMusic} from './generative-music.js';

// The radio in the taxi, on the bike and in the boat (design/TAXI-PLAN.md): R turns through four
// stations and off. The stations and their music are invented, composed live in the browser like the
// bench music (src/generative-music.js): no recordings, no real station. Each change crackles through
// the dial and shows the station's name large at the top for a moment.

export const STATIONS = [
  {id: 'strings', zh: '秦淮丝弦', en: 'Qinhuai Strings', fm: '89.7', about: 'guzheng and flute'},
  {id: 'jazz', zh: '金陵夜色', en: 'Jinling Night Jazz', fm: '93.4', about: 'piano, bass and brushes'},
  {id: 'rain', zh: '钟山雨', en: 'Purple Mountain Rain', fm: '101.2', about: 'rain, pads and bells'},
  {id: 'beats', zh: '鼓楼节拍', en: 'Drum Tower Beats', fm: '106.9', about: 'an easy beat and keys'},
];

const hz = midi => 440 * 2 ** ((midi - 69) / 12);

export function createRadio(audio) {
  let ctx = null, out = null, noise = null, on = -1, gen = null;
  const strings = createMusic(audio);

  function ensure() {
    if (ctx || !audio?.ctx) return !!ctx;
    ctx = audio.ctx;
    out = ctx.createGain(); out.gain.value = 0;
    // A car radio's band: no deep bass, a softened top.
    const lo = ctx.createBiquadFilter(); lo.type = 'highpass'; lo.frequency.value = 55;
    const hi = ctx.createBiquadFilter(); hi.type = 'lowpass'; hi.frequency.value = 7500;
    out.connect(lo); lo.connect(hi); hi.connect(audio.master);
    noise = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const d = noise.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    return true;
  }
  const env = (g, t, a, peak, dec) => { g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + a); g.gain.exponentialRampToValueAtTime(.0001, t + a + dec); };
  const done = (nodes, t) => setTimeout(() => nodes.forEach(n => n.disconnect()), Math.max(0, (t - ctx.currentTime + .3) * 1000));

  // --- Voices -------------------------------------------------------------------------------------------
  function epiano(t, midi, vel = 1, dur = 1.6) {
    const f = hz(midi), g = ctx.createGain(), trem = ctx.createOscillator(), tg = ctx.createGain();
    env(g, t, .008, .05 * vel, dur);
    trem.frequency.value = 4.6; tg.gain.value = .012 * vel; trem.connect(tg); tg.connect(g.gain);
    const nodes = [g, trem, tg];
    for (const [mul, amp] of [[1, 1], [2, .28], [3.98, .08]]) {
      const o = ctx.createOscillator(), og = ctx.createGain();
      o.type = 'sine'; o.frequency.value = f * mul; og.gain.value = amp;
      o.connect(og); og.connect(g); o.start(t); o.stop(t + dur + .1); nodes.push(o, og);
    }
    trem.start(t); trem.stop(t + dur + .1);
    g.connect(out); done(nodes, t + dur);
  }
  function bass(t, midi, dur = .5, vel = 1) {
    const o = ctx.createOscillator(), g = ctx.createGain(), lp = ctx.createBiquadFilter();
    o.type = 'triangle'; o.frequency.value = hz(midi); lp.type = 'lowpass'; lp.frequency.value = 700;
    env(g, t, .01, .16 * vel, dur);
    o.connect(lp); lp.connect(g); g.connect(out); o.start(t); o.stop(t + dur + .1); done([o, g, lp], t + dur);
  }
  function hiss(t, dur, freq, q, peak, type = 'bandpass') {
    const s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    s.buffer = noise; s.loop = true; f.type = type; f.frequency.value = freq; f.Q.value = q;
    env(g, t, .004, peak, dur);
    s.connect(f); f.connect(g); g.connect(out); s.start(t, Math.random()); s.stop(t + dur + .05); done([s, f, g], t + dur);
  }
  function kick(t, vel = 1) {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.frequency.setValueAtTime(120, t); o.frequency.exponentialRampToValueAtTime(42, t + .18);
    env(g, t, .003, .5 * vel, .3);
    o.connect(g); g.connect(out); o.start(t); o.stop(t + .4); done([o, g], t + .4);
  }
  function bell(t, midi, vel = 1) {
    const f = hz(midi), nodes = [];
    for (const [mul, amp, dec] of [[1, 1, 3.5], [2.76, .3, 1.6], [5.4, .12, .8]]) {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.frequency.value = f * mul; env(g, t, .004, .03 * amp * vel, dec);
      o.connect(g); g.connect(out); o.start(t); o.stop(t + dec + .1); nodes.push(o, g);
    }
    done(nodes, t + 3.6);
  }
  function pad(t, midis, dur) {
    const g = ctx.createGain(), lp = ctx.createBiquadFilter(), nodes = [g, lp];
    lp.type = 'lowpass'; lp.frequency.value = 900;
    g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(.018, t + dur * .35); g.gain.exponentialRampToValueAtTime(.0001, t + dur);
    for (const m of midis) for (const det of [-6, 6]) {
      const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = hz(m); o.detune.value = det;
      o.connect(lp); o.start(t); o.stop(t + dur + .1); nodes.push(o);
    }
    lp.connect(g); g.connect(out); done(nodes, t + dur);
  }

  // --- The stations' sequencers: each schedules its notes a little ahead, called every frame ----------
  const pick = a => a[Math.floor(Math.random() * a.length)];
  function jazz() {
    // ii-V-I-vi in F, two beats a chord change at times; a walking bass; brushes on two and four.
    const beat = 60 / 96, chords = [[55, 58, 62, 65], [48, 52, 55, 58], [53, 57, 60, 64], [50, 53, 57, 60]];
    const roots = [43, 36, 41, 38];
    let next = ctx.currentTime + .3, step = 0;
    return () => {
      while (next < ctx.currentTime + .25) {
        const bar = Math.floor(step / 4) % 4, b = step % 4, ch = chords[bar];
        if (b === 0 || (b === 2 && Math.random() < .35)) ch.forEach((m, i) => epiano(next + i * .012, m + (Math.random() < .2 ? 12 : 0), .8, beat * 2.2));
        if (Math.random() < .3 && b % 2) epiano(next + beat * .66, pick(ch) + 12, .55, beat);
        const walk = [roots[bar], roots[bar] + 4, roots[bar] + 7, roots[(bar + 1) % 4] + (Math.random() < .5 ? 1 : -1)];
        bass(next, walk[b], beat * .9, .9);
        hiss(next + beat * .66, .06, 9000, .7, .012, 'highpass');                 // the swung ride
        hiss(next, .07, 9000, .7, .016, 'highpass');
        if (b % 2) hiss(next, .22, 2500, .6, .03);                                  // brush on 2 and 4
        next += beat; step++;
      }
    };
  }
  function rain() {
    // Rain on the roof: filtered noise, swelling slowly; a pad every eight seconds, a bell now and then.
    const s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), f2 = ctx.createBiquadFilter(), g = ctx.createGain(), lfo = ctx.createOscillator(), lg = ctx.createGain();
    s.buffer = noise; s.loop = true; f.type = 'lowpass'; f.frequency.value = 3200; f2.type = 'highpass'; f2.frequency.value = 500;
    g.gain.value = .05; lfo.frequency.value = .07; lg.gain.value = .02; lfo.connect(lg); lg.connect(g.gain);
    s.connect(f); f.connect(f2); f2.connect(g); g.connect(out); s.start(); lfo.start();
    const PENTA = [0, 2, 4, 7, 9], chords = [[50, 57, 62, 66], [47, 54, 59, 62], [43, 50, 55, 59], [45, 52, 57, 61]];
    let padAt = ctx.currentTime + .2, bellAt = ctx.currentTime + 1.5, k = 0;
    const tick = () => {
      if (padAt < ctx.currentTime + .3) { pad(padAt, chords[k++ % 4], 9.5); padAt += 8; }
      if (bellAt < ctx.currentTime + .3) { bell(bellAt, 74 + PENTA[Math.floor(Math.random() * 5)] + (Math.random() < .3 ? 12 : 0), .9); bellAt += 1.6 + Math.random() * 4.5; }
    };
    tick.stop = () => { try { s.stop(); lfo.stop(); } catch { /* already stopped */ } setTimeout(() => [s, f, f2, g, lfo, lg].forEach(n => n.disconnect()), 300); };
    return tick;
  }
  function beats() {
    // 84 bpm, swung sixteenths: kick, snare on two and four, hats; minor-pentatonic keys over Am-F-C-G.
    const six = 60 / 84 / 4, chords = [[57, 60, 64], [53, 57, 60], [48, 52, 55, 59], [55, 59, 62]], roots = [33, 29, 36, 31];
    let next = ctx.currentTime + .3, step = 0;
    return () => {
      while (next < ctx.currentTime + .25) {
        const s = step % 16, bar = Math.floor(step / 16) % 4, swing = s % 2 ? six * .18 : 0, t = next + swing;
        if (s === 0 || s === 10 || (s === 7 && Math.random() < .5)) kick(t);
        if (s === 4 || s === 12) { hiss(t, .16, 1800, .8, .09); kick(t, .12); }
        if (s % 2 === 0) hiss(t, .04, 8000, .5, s % 4 ? .012 : .02, 'highpass');
        if (s === 0) { chords[bar].forEach((m, i) => epiano(t + i * .01, m, .75, six * 14)); bass(t, roots[bar], six * 6, 1); }
        if (s === 8) bass(t, roots[bar] + (Math.random() < .5 ? 7 : 12), six * 4, .8);
        if ((s === 6 || s === 14) && Math.random() < .45) epiano(t, pick([69, 72, 74, 76, 79]), .45, six * 3);
        next += six; step++;
      }
    };
  }

  // --- The dial ---------------------------------------------------------------------------------------
  const sign = document.createElement('div');
  sign.id = 'radio-sign'; sign.setAttribute('role', 'status'); sign.hidden = true;
  document.body.append(sign);
  let signTimer = 0;
  function show(html) {
    sign.innerHTML = html; sign.hidden = false; sign.classList.remove('show'); void sign.offsetWidth; sign.classList.add('show');
    clearTimeout(signTimer); signTimer = setTimeout(() => { sign.hidden = true; }, 3200);
  }
  function stopGen() {
    if (gen?.stop) gen.stop();
    gen = null;
    strings.stop();
  }
  function tune(i, weather) {
    if (!ensure()) return null;
    stopGen();
    on = i;
    const t = ctx.currentTime;
    // The crackle between stations, heard whatever the volume was.
    out.gain.cancelScheduledValues(t); out.gain.setValueAtTime(1.2, t);
    hiss(t, .32, 1400, .4, .05);
    if (i < 0) { out.gain.setTargetAtTime(0, t + .3, .1); show('<small>Radio</small><b>Off</b>'); return 'off'; }
    out.gain.setTargetAtTime(1.6, t + .3, .3);
    const st = STATIONS[i];
    if (st.id === 'strings') strings.start('default', weather || {});
    else gen = {jazz, rain, beats}[st.id]();
    show(`<small>FM ${st.fm}</small><b>${st.zh}</b><span>${st.en}</span>`);
    return st;
  }
  return {
    get station() { return on >= 0 ? STATIONS[on] : null; },
    /** The next station, or off after the last. */
    next(weather) { return tune(on + 1 >= STATIONS.length ? -1 : on + 1, weather); },
    off() { if (on >= 0) { on = -1; stopGen(); if (ctx) { out.gain.cancelScheduledValues(ctx.currentTime); out.gain.setTargetAtTime(0, ctx.currentTime, .2); } } },
    update() { if (on < 0 || !ctx) return; strings.update(); gen?.(); },
  };
}
