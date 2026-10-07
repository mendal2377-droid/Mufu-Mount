# City art direction: a hand-painted storybook look

The brief (7 October 2026): rebuild the city in the spirit of a hand-painted
animated-film background, in the manner of *Spirited Away*, rather than copying
Nanjing as a model. This is an interpretation of that look, not a reproduction of
anything from the film: no frames, characters, props or textures were used, and
nothing here should be presented as affiliated with the film or its studio.

What "that look" means here, and where each part lives:

| Quality | How it is done | Where |
| --- | --- | --- |
| Saturated cobalt sky, pale cyan at the horizon | Gradient replaced when `uPainted = 1` | `src/sky.js` |
| Towering flat-based cumulus round the horizon, cel-shaded in three tones | Noise banks and overhead puffs, quantised into lit / mid / shadow | `src/sky.js` (painted cumulus block) |
| Dusk of indigo and peach, with violet cloud shadows | Same shader, `sunset` / `dawn` blend | `src/sky.js` |
| Lush yellow-green grass, blue-green shade | Terrain vertex palette | `src/city-terrain.js` |
| Cream plaster, verdigris-teal roofs, vermilion lacquer, gold trim | Material palette | `src/city-scene.js` (`materials`) |
| Turquoise water | Water shader colours | `src/city-art.js` |
| Strings of red paper lanterns, lamps on brackets over every road | Props | `lantern()` in `src/city-scene.js` |
| Aerial perspective: distant hills fade to blue | Fog colour and density per weather | `src/nanjing.js` (`frame`) |
| Warm key light, sky-blue fill | Sun and hemisphere colours | `src/nanjing.js` |

Rules that keep it cheap and consistent:

- One sky shader serves Mufu and the city. The city turns `uPainted` on; Mufu leaves it at 0 and is unchanged.
- In clear weather the painted cumulus *replaces* the older cirrus and low deck, so the sky costs fewer noise evaluations than before; overcast brings the old decks back.
- No new textures were added. Everything is flat colour on the existing gouache texture set, so the download did not grow.
- Detailed foliage still casts no shadow; there is still one final tone-mapping pass.
- Roofs are teal, walls are cream or ochre or vermilion, trim is gold. A new building should pick from these, not introduce a fifth colour.

What it is not: there is no hand-drawn linework beyond the existing edge contours,
no painted skyboxes from artwork, and no per-building texture painting. A stronger
version would commission or generate painted textures for walls and roofs (see
`design/city/PROMPTS.md` for how the current set was made).
