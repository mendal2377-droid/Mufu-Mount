# Film tools: "Light Walk"

An offline film of the Mufu mountain, made from the live app. Nothing here ships to visitors; the output
(`film-out/`) is git-ignored.

```bash
npx vite --host 127.0.0.1 --port 5178 &      # the app the renderer drives
node tools/film/render.mjs                    # 48 fps frames -> film-out/frames   (about 10 minutes on an Intel Iris Xe)
python tools/film/score.py                    # music and sound design -> film-out/score.wav
python tools/film/assemble.py                 # frames + score + captions + title -> film-out/mufu-light-walk.mp4
```

`render.mjs --preview` renders three frames per shot at half size (`film-out/preview`, then
`python tools/film/preview_sheet.py`) so a storyboard change can be judged in about a minute.

## How it works

- `storyboard.mjs` is the whole edit: every shot, its route or air path, camera moves, weather and light cues,
  in bars of 100 bpm. `score.py` reads the same timeline (`film-out/timeline.json`), so every cut, flash,
  lightning strike and weather change has a matching sound.
- `lib.mjs` opens the app on the GPU (ANGLE/D3D11), steps out of the Nanjing atlas, and exposes `window.film`:
  `shotFrame(shot, k, fps)` sets the camera, weather, fade, flash and letterbox for frame `k` and returns the
  finished 1080p frame. Time advances by `step(1, 1/48)`, never by the wall clock, so frames are deterministic.
- `src/main.js` has one small hook, `window.__director`, which only exists when a script defines it. It
  takes over the last few grade inputs (fade, flash, letterbox, shadow lift) just before the final pass.
- `assemble.py` blends frame pairs (a 180-degree shutter, so 48 becomes 24 fps with motion blur), adds a light
  grade and grain, bilingual captions in the lower bar, a title card, and muxes the score (H.264 + AAC).
- Everything the sound needs is synthesised in `score.py` (numpy only): kalimba and glockenspiel tones, a pad, bass,
  a light drum kit, whooshes, rain, thunder, wind, water and birds.

Known limits: the weather snaps (the film uses that as its flash cuts), the app's own sky and trees are
those of the website, and the music was balanced by measurement (loudness, spectrum, clipping), not by ear.
