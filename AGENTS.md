# Working on this repository

Read [HANDOFF.md](HANDOFF.md) first. It is short, and sections 4 and 6 will
save you from the mistakes that already cost real debugging time here.

The essentials, if you read nothing else:

- **The repository root is the web app.** No server, no API, no database. Vite
  plus three.js. `npm test` needs no browser and takes a second; run it.
- **Pushing to `main` deploys to production** at mufu-mount.vercel.app. There
  is no staging. Build and test before you push.
- **Do not weaken the EXIF test.** `tests/memories.test.js` scans every
  published JPEG for metadata. The images are stripped copies of private
  photographs; the full-resolution originals and their GPS data must never
  enter this repository.
- **Nothing here is surveyed.** Terrain, routes, pavilion placement, the ships
  and the beacon are approximations or artistic additions, and the photo frames
  are placed in chronological order rather than by GPS. Keep any copy you write
  honest about that, and do not "fix" the placement by connecting raw
  coordinates.
- **Renderer traps** — the composer's buffer roles are pinned deliberately,
  near-tree crowns must not cast shadows, raw shaders must not tone map
  themselves, and the rail opening is a runtime edit rather than an export
  change. HANDOFF.md §4 explains each one at the code site.
- **Drive time with `window.__mufu.step(frames, dt)` in browser checks**, never
  wall-clock waits: a software renderer manages a frame or two a second and
  anything timed in real seconds will fail for no reason.
- Match the surrounding style. Comments here explain *why*, especially where
  something looks odd on purpose.

Report what you actually verified, and say plainly what you did not.
