// "Light Walk": a 48-second film of the Mufu mountain, in bars of 100 bpm (2.4 s).
//
// Director's note. The mountain is bright, small and kind, so the film is a walk that keeps
// changing its mind about the weather: first light, a flash, a rush of other days, a downpour that
// breaks open, a kite's-eye view of the whole slope, a hush of snow, and the long gold evening. The
// cuts land on the beat; the music (score.py) is written to the same table.
//
// Camera language: low and moving on the stairs (the sun through the leaves is the picture); fast,
// forward, one beat per cut in the montage; lower and wider in the rain so the water feels close;
// high, wide and fast in the air; still and slow in the snow; and in the last shot the whole frame
// walks into the sun while the lens slowly tightens.

export const FPS = 48;                 // rendered at 48 and blended down to 24 for motion blur
export const BPM = 100;
export const BAR = 60 / BPM * 4;       // 2.4 s
export const BEAT = 60 / BPM;          // 0.6 s

// Routes: 0 ridge trail, 1 forest stairs, 2 rainbow road, 3 Yangtze promenade, 4 river terrace.
// f is the fraction of the route's length, so speed = length * (f1 - f0) / seconds.
const walk = (o) => ({kind: 'walk', ease: 'inout', ahead: 14, height: [1.9, 1.9], yaw: [0, 0], pitch: [0, 0], fov: [62, 62], sway: 1, ...o});

export const SHOTS = [
  // --- 1. First light: the stairs climbing into the sun ------------------------------------------
  walk({id: 'dawn-stairs', bars: 2, weather: 'dawn', route: 1, f: [.075, .13], height: [1.0, 1.5], pitch: [.0, .16], fov: [50, 58], sway: .7,
    fadeIn: 1.6, label: 'first light'}),
  // --- 2. The same stairs, an hour later: the sun in the leaves --------------------------------------
  walk({id: 'morning-stairs', bars: 2, weather: 'morning', route: 1, f: [.42, .5], height: [1.15, 1.5], pitch: [.05, .2], fov: [58, 66], sway: 1,
    flashIn: 1, label: 'sun in the leaves'}),
  // --- 3. Flash: other days, other roads, one beat each -----------------------------------------------
  ...[
    ['ridge',      0, .455, 'morning', .016],
    ['rainbow',    2, .09,  'sunset',  .012],
    ['promenade',  3, .38,  'storm',   .008],
    ['stairs',     1, .2,   'snow',    .045],
    ['ridge-dawn', 0, .47,  'dawn',    .014],
    ['promenade-2', 3, .25, 'morning', .008],
    ['rainbow-2',  2, .5,   'storm',   .014],
    ['terrace',    4, .1,   'sunset',  .22],
    ['stairs-2',   1, .32,  'morning', .05],
    ['promenade-3', 3, .53, 'snow',    .007],
    ['ridge-2',    0, .485, 'sunset',  .012],
    ['rainbow-3',  2, .17,  'morning', .014],
  ].map(([id, route, f, weather, df], i) => walk({id: `flash-${i + 1}-${id}`, beats: 1, weather, route, f: [f, f + df], height: [1.7, 1.7], fov: [66, 72],
    ease: 'linear', sway: 1.6, flashIn: .9, yaw: [i % 2 ? .09 : -.09, 0], pitch: [.0, .03], montage: true})),
  // --- 4. The downpour: low, wide, close to the wet road ---------------------------------------------
  walk({id: 'rain-road', bars: 3, weather: 'storm', route: 2, f: [.2, .235], height: [1.25, 1.35], fov: [72, 76], sway: 1.3,
    flashIn: 1, lightning: [1.7, 1.95, 5.2], label: 'rain on the rainbow road'}),
  // --- 5. The kite's-eye view: the whole slope in one breath, morning turning to evening ---------------
  {id: 'kite', kind: 'air', bars: 3, weather: 'morning', ease: 'inout', fov: [70, 74], sway: .6,
    from: [2180, 300, -760], to: [2560, 330, -1010], look: [2500, 150, -950], lookTo: [2900, 90, -1500],
    flashIn: 1, changes: [{at: 3.4, weather: 'sunset', flash: true}], label: 'the whole slope'},
  // --- 6. The hush: snow on the ridge, nothing moving but the flakes -----------------------------------
  walk({id: 'snow-ridge', bars: 3, weather: 'snow', route: 0, f: [.465, .4685], height: [1.8, 1.8], fov: [56, 54], sway: .5, yaw: [.18, .1],
    flashIn: 1, label: 'snow'}),
  // --- 7. The long evening: straight into the sun, the lens slowly tightening -----------------------------
  walk({id: 'sunset-promenade', bars: 4, weather: 'sunset', route: 3, f: [.5, .5275], height: [1.8, 1.9], fov: [62, 46], sway: .6,
    lookAt: [1696, 26, -1603], flashIn: 1, fadeToWhite: 2.4, label: 'evening glow'}),
];

/** Seconds, frame counts and start times for every shot. */
export function timeline() {
  let t = 0, frame = 0;
  return SHOTS.map((s, index) => {
    const seconds = s.bars ? s.bars * BAR : s.beats * BEAT;
    const frames = Math.round(seconds * FPS);
    const out = {...s, index, start: t, seconds, frames, frame0: frame};
    t += seconds; frame += frames;
    return out;
  });
}

export const TOTAL_SECONDS = timeline().reduce((n, s) => n + s.seconds, 0);
