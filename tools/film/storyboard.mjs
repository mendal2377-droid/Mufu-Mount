// "Light Walk": a 50-second film of the Mufu mountain, in bars of 96 bpm (2.5 s).
//
// Director's note. The mountain is bright, small and kind, so the film is a walk that keeps
// changing its mind about the weather: first light, a flash, a run of other days, a downpour that
// breaks open, a kite's-eye view of the whole slope, a hush of snow, and the long gold evening. The
// cuts land on the beat; the music (score.py) is written to the same table.
//
// Version 2 (after the first screening): everything moves at a walking pace. Speeds are now stated in
// metres per second (the first cut had the evening shot at 17 m/s and the montage at over 100), the
// montage has eight cuts of a beat and a half instead of twelve of a beat, and the kite flies at a
// glide. The hand-rails that stood across the forest stairs are cut out of the model (main.js).
//
// Camera language: low and moving on the stairs (the sun through the leaves is the picture); forward,
// one phrase per cut in the montage; lower and wider in the rain; high and gliding in the air; still
// and slow in the snow; and in the last shot the whole frame walks into the sun while the lens slowly tightens.

export const FPS = 48;                 // rendered at 48 and blended down to 24 for motion blur
export const BPM = 96;
export const BAR = 60 / BPM * 4;       // 2.5 s
export const BEAT = 60 / BPM;          // 0.625 s

// Routes: 0 ridge trail, 1 forest stairs, 2 rainbow road, 3 Yangtze promenade, 4 river terrace.
// Lengths in metres; `at` is a fraction of the route's length and `speed` is metres per second.
export const ROUTE_LENGTH = [5556, 386, 1748, 6001, 15];
const walk = (o) => ({kind: 'walk', ease: 'inout', ahead: 14, height: [1.9, 1.9], yaw: [0, 0], pitch: [0, 0], fov: [62, 62], sway: 1, speed: 2.2, ...o});

export const SHOTS = [
  // --- 1. First light: the stairs climbing into the sun ------------------------------------------
  walk({id: 'dawn-stairs', bars: 2, weather: 'dawn', route: 1, at: .075, speed: 1.7, height: [1.0, 1.5], pitch: [.0, .16], fov: [50, 58], sway: .7,
    fadeIn: 1.6, label: 'first light'}),
  // --- 2. The same stairs, an hour later: the sun in the leaves --------------------------------------
  walk({id: 'morning-stairs', bars: 2, weather: 'morning', route: 1, at: .43, speed: 2.4, height: [1.15, 1.5], pitch: [.05, .2], fov: [58, 66], sway: 1,
    flashIn: 1, label: 'sun in the leaves'}),
  // --- 3. Flash: other days, other roads, a beat and a half each --------------------------------------
  ...[
    ['ridge',       0, .455, 'morning'],
    ['rainbow',     2, .09,  'sunset'],
    ['promenade',   3, .38,  'storm'],
    ['stairs',      1, .2,   'snow'],
    ['ridge-dawn',  0, .47,  'dawn'],
    ['promenade-2', 3, .25,  'morning'],
    ['terrace',     4, .08,  'sunset'],
    ['rainbow-3',   2, .17,  'morning'],
  ].map(([id, route, at, weather], i) => walk({id: `flash-${i + 1}-${id}`, beats: 1.5, weather, route, at, speed: route === 4 ? 2 : 4.2, height: [1.7, 1.7], fov: [66, 70],
    ease: 'linear', sway: 1.2, flashIn: .9, yaw: [i % 2 ? .08 : -.08, 0], pitch: [.0, .03], montage: true})),
  // --- 4. The downpour: low, wide, close to the wet road ---------------------------------------------
  walk({id: 'rain-road', bars: 3, weather: 'storm', route: 2, at: .2, speed: 2.2, height: [1.25, 1.35], fov: [72, 76], sway: 1.2,
    flashIn: 1, lightning: [1.8, 2.05, 5.4], label: 'rain on the rainbow road'}),
  // --- 5. The kite's-eye view: the whole slope at a glide, morning turning to evening -------------------
  {id: 'kite', kind: 'air', bars: 3, weather: 'morning', ease: 'inout', fov: [68, 72], sway: .6,
    from: [2180, 300, -760], to: [2320, 312, -850], look: [2500, 150, -950], lookTo: [2650, 120, -1180],
    flashIn: 1, changes: [{at: 3.6, weather: 'sunset', flash: true}], label: 'the whole slope'},
  // --- 6. The hush: snow on the ridge, nothing moving but the flakes -----------------------------------
  walk({id: 'snow-ridge', bars: 3, weather: 'snow', route: 0, at: .465, speed: .7, height: [1.8, 1.8], fov: [56, 54], sway: .5, yaw: [.18, .1],
    flashIn: 1, label: 'snow'}),
  // --- 7. The long evening: straight into the sun, the lens slowly tightening -----------------------------
  walk({id: 'sunset-promenade', bars: 4, weather: 'sunset', route: 3, at: .5, speed: 2.4, height: [1.8, 1.9], fov: [62, 46], sway: .6,
    lookAt: [1696, 26, -1603], flashIn: 1, fadeToWhite: 2.5, label: 'evening glow'}),
];

/** Seconds, frame counts, start times and route fractions for every shot. */
export function timeline() {
  let t = 0, frame = 0;
  return SHOTS.map((s, index) => {
    const seconds = s.bars ? s.bars * BAR : s.beats * BEAT;
    const frames = Math.round(seconds * FPS);
    const out = {...s, index, start: t, seconds, frames, frame0: frame};
    if (s.kind === 'walk') out.f = [s.at, Math.min(.998, s.at + s.speed * seconds / ROUTE_LENGTH[s.route])];
    t += seconds; frame += frames;
    return out;
  });
}

export const TOTAL_SECONDS = timeline().reduce((n, s) => n + s.seconds, 0);
