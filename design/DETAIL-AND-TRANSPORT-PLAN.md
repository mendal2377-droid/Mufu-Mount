# Detail and transport plan (31 October 2026)

The owner's verdict on the ten worlds: the places and shapes are right, but the scenes look
"brutal" and not yet amazing. The references are [Everycol](https://everycol.com/) and its
[launch video](https://x.com/shubroski/status/2116198150671339631/video/1): real cycling routes
rebuilt from map and elevation data, in a custom Rust/WebGPU engine. We already have the same
kind of data. What Everycol has and we lack is finish.

## Why ours looks crude, and what fixes it

| What you see now | Cause | Fix |
| --- | --- | --- |
| Flat colour on big boxes | One toon colour per material, with no texture or surface detail | Standard (PBR) materials with procedural detail in the shader: roof-tile rows, brick and stone courses, timber grain, asphalt grain, wet sheen on paving. Toon banding is softened, not dropped, to keep the illustrated warmth. |
| Buildings read as blocks | The kit models masses only | Kit v2: tiled roof surfaces with eave rafters and ridge beasts, bracket bands (dougong) under eaves, lattice doors and windows, column bases, stair balustrades, window grids and parapets on modern blocks, shop signs and awnings in the old town. |
| Lollipop trees | 5 icospheres per tree | Real tree models per species: London plane (the avenues), camphor, Chinese cedar, ginkgo, red maple, cherry, willow, bamboo. Branching trunks and leaf-card crowns that sway in the wind, with LOD to silhouettes (already in place). |
| Bare green ground | Flat colour per terrain material | Ground shaded by slope and height (grass, dirt, rock, leaf litter), instanced grass and shrubs near the camera, flower beds, fallen leaves in autumn. |
| Empty world | Only the traveller, pigeons and a few boats | Pedestrians, cyclists and cars on the avenues, rowing boats on the lakes, tourists on the plazas: simple instanced figures with walk cycles. |
| Light is flat | Hemisphere plus sun, simple fog | A physical sky with sun and clouds; soft shadows near the camera; ambient occlusion; height fog with aerial perspective; reflective water; warm dusk with lamps. |

## Transport per scene

Each world declares the ways of moving it allows. A small picker shows them, with keys 1 to 4.

| Mode | How it works | Where |
| --- | --- | --- |
| Walk | As now | Everywhere |
| Bike | A bicycle under the traveller at about 18 km/h, leaning in turns, on roads and paved paths only (a road grid exported beside the walk grid) | The avenues: Lingyuan Road's plane-tree tunnel (Zhongshan), the Xuanwu Lake ring, the city-wall top, the bridge deck |
| Boat | Steer your own boat anywhere on water (a water grid), or take the guided boat ride (as now) | Qinhuai (painted boats), Xuanwu Lake (rowing boats), the Yangtze (a ferry under the bridge) |
| Fly | The paraglider (as now), with take-off points on ridges and thermals over sunny slopes | Purple Mountain, Niushou, Qixia, the bridge |

A new avenue world would also answer the earlier request to make Xinjiekou recognisable:
Zhongshan Road from Xinjiekou to Gulou, the plane-tree boulevard under the real skyline, ridden
by bike.

## Order of work

1. **Pilot (one scene, every layer):** Zhongshan's Lingyuan Road and the Music Stage. Lighting
   and sky, PBR plus detail shaders, plane trees, ground detail, kit v2 on its buildings, people,
   and the bike. The owner judges it before the rest are upgraded.
2. Roll the renderer and material upgrade out to all worlds. It is shared, so every world gains
   at once.
3. Kit v2 rebuilds world by world: Old South, North, Palace, Niushou, Qixia, then the Bridge.
4. Transports: bike, then boat steering, then flight take-off points.
5. The avenue world (Xinjiekou to Gulou).
6. A performance pass: a phone tier and a desktop tier, measured on a real phone.

## Limits and risks

- Everycol uses its own WebGPU engine. We stay on three.js, which supports WebGPU and falls back
  to WebGL, so phones keep working. The heavier look needs a quality tier per device.
- Google's photorealistic 3D tiles do not cover mainland China and need a paid key, so the
  detail stays modelled from OSM, the DEM, photographs and published figures, as now.
- Downloads of size grow. Each world is 1 to 4 MB now. The target is under 10 MB per world,
  with textures generated in the shader, not downloaded.

## Decisions (31 October 2026)

- Look: **rich illustrated**. Keep the approved painted, Miyazaki-like warmth, and add real detail, light and life. Not photoreal.
- Pilot: **Zhongshan with Lingyuan Road**: walk the Sacred Way, bike the plane-tree road, fly over Purple Mountain.

## Style target (31 October 2026): the sunlit low-poly diorama

The owner added a second reference: [jakub_works' Warsaw city](https://x.com/jakub_works/status/2116154993833079271/video/1), "if too many details are heavy, you can try this style". It stays deliberately low-poly. Its richness comes from:

- a warm low sun with long soft shadows and ambient occlusion;
- window grids on every façade, with cornices, dormers and balconies as simple shapes;
- varied wall and roof colours from building to building;
- trees as clusters of small blobs in mixed autumn colours;
- life everywhere: trams, buses, parked cars, street lamps, crossings, lane markings;
- a pastel gradient sky at street level.

This is lighter than the detail list above, so it becomes the target: light, façade shaders, colour variation, tree clusters and traffic before any heavy geometry.

## Decision (31 October 2026): Tiny Nanjing

The owner pointed to [Tiny Warsaw](https://tinywarsaw.app/) ("research deeply and choose the best"). Its About page describes the method:

- Ordinary buildings are generated from OSM outlines plus height and roof-colour data, with windows and shop fronts drawn by a shader.
- Over a thousand landmarks are dedicated low-poly models, each a short program that builds the shape from photos and maps, written by AI.
- Roads, tracks and bridges are generated procedurally from street data.
- Everything streams in small compressed chunks and renders with three.js r187 and WebGL.

What we measured: about 20 MB on first load, KTX2 textures, a far-tree layer, a low warm sun with long shadows, and tilt-shift blur. Vehicles: car, bus, helicopter, balloon, scooter, plane, jet.

**Chosen:** build Tiny Nanjing the same way.

- **City:** one continuous, streamed low-poly map of central Nanjing.
  - Every OSM building is extruded, with heights from OSM levels or estimated by district and footprint.
  - A façade shader draws windows and shop fronts; roof colours follow rules by district.
  - Roads, rail, bridges, water and parks come from OSM, with plane trees on the avenues.
- **Landmarks:** our Blender models become the hero models placed inside the city.
- **Light:** a low sun, shadows, ambient occlusion, and tilt-shift seen from above.
- **Transport:** walk, bike, car or bus, boat, and balloon or paraglider.
- **Pilot:** the city core, Xinjiekou → Zhongshan Road → Presidential Palace → Jiming and Xuanwu. Zhongshan, Niushou and Qixia stay as separate worlds and get the shared lighting.

## Owner's additions (31 October 2026, after the first Tiny Nanjing views: "great progress")

- **Systems:** weather, time of day and seasons, as one compact control. Seasons recolour the trees (spring cherry, summer green, autumn gold and red, winter bare and snow) and change the light.
- **Ways to explore:**
  - on foot;
  - by bike on the roads, on the road graph, so you can ride anywhere in the city;
  - by paraglider over the city;
  - by boat on the Qinhuai, Xuanwu Lake and the Yangtze.
- **Main page:** a more elegant and brief landmark list.
- **Night (owner, 1 November):**
  - **Street lamps** light the streets all around: lamp posts along the roads, glowing heads, warm pools of light on the pavement.
  - **Window lights follow the clock:** most windows light at dusk and go dark one by one as the night goes on, leaving few after midnight; shops close around 22:00.
