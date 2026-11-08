# Real buildings and real trees: plan (item 40)

The owner, 3 November 2026: get tools that build 3D from the map. Instead of modelling tools, which
would only reuse the OSM we already have, two open datasets were fetched to E:\nanjing-geodata:

- **CMAB**, the China Multi-Attribute Building dataset (Zhang et al., Scientific Data 2025, CC BY
  4.0). It holds rooftops traced from satellite imagery, with height, use and year estimated by
  machine learning.
- **Meta and WRI's 1 m canopy height map** (Tolan et al. 2024, CC BY 4.0).

## What the city does today

- **OSM buildings.** There are 23,102 in the core. 9,397 have a mapped height or floor count; the
  other 13,589 get a guess from their tag and footprint (`estimate_height` in
  `blender/build_core.py`).
- **Infill.** Where OSM maps no buildings, about 26,600 slab blocks are made up on a 34 m lattice,
  in rows turned to the nearest street.
- **Trees.** Purple Mountain already stands where the canopy map has trees, at its heights (3 Nov).
  The other parks get 9,000 trees scattered at random.

## What the data says

All checks are in `tests/cmab-check.py`, run on 9 November 2026.

- **Alignment.** CMAB's rooftops sit on OSM's footprints to within 2 m; there is no Chinese map
  offset.
- **Coverage.** CMAB has 33,568 rooftops in the core. 24,260 of them (10.9 km²) are under no OSM
  building. These are real buildings seen from above, where the build now invents blocks.
- **CMAB's heights are not usable here.** Against 1,890 OSM buildings under 100 m with a mapped
  height:
  - CMAB is off by a median of 8.4 m, and its correlation with the mapped height is 0.07.
  - It makes low houses 11 m too tall, and towers 36–95 m too short; its tallest building in the
    core is 99 m.
  - Our own guess does better, at a median 7.0 m.
- **CMAB's use labels are usable.** Feed CMAB's label (Residence, Business, Office, Public service)
  into our rule in place of OSM's bare `building=yes`:
  - The median error falls to 4.7 m and the bias from −6.1 m to −1.1 m.
  - This was measured on 1,697 `building=yes` buildings that do have a mapped height.
  - 7,225 OSM buildings without a height are `building=yes`.
- **CMAB's years are not usable.** Half of all rooftops carry the same year, 1985: a filler, not a
  date.

Caveat: the mapped heights are themselves not surveyed, and mappers tag the notable buildings more
often than ordinary ones.

## The plan

1. **Prepare.** `tools/research/cmab-prep.py` clips CMAB to the core and simplifies the rooftops to
   0.5 m. The output is `research/core/data/cmab.json`, 6.3 MB, with the source credited.
2. **OSM buildings without a height** that sit on a CMAB rooftop: if OSM says only
   `building=yes`, the rule uses CMAB's use label instead. A mapped height or floor count always
   wins. CMAB's own height is not used.
3. **Infill becomes real.**
   - The made-up slab lattice is removed.
   - Each CMAB rooftop under no OSM building is extruded from its own outline. Its height comes from
     the rule, given its use label and footprint. Its window style comes from the label and the land
     use around it.
   - A rooftop is skipped where it would stand on a road or in water. Those are the same checks the
     infill had, and they take precedence over CMAB.
   - Where CMAB sees no building, none is built.
4. **Park trees.** These are the green spaces outside Purple Mountain, Xuanwu's islands and the
   Mufu wood.
   - Trees stand where the canopy map covers the ground (over 3 m), on a jittered lattice.
   - Each is scaled to the canopy's height there, as on the mountain.
   - Species stay the city's census mix.
   - This replaces the 9,000 random scatter.
5. **Provenance.** The credits name CMAB and the canopy map. The site's copy says the heights are
   estimated, not surveyed.

## Audits

- **The CMAB check.** `tests/cmab-check.py` prints the comparison above, for each rebuild of the
  data.
- **The build's counts.**
  - Infill buildings from CMAB, and how many rooftops were skipped for a road or water.
  - Heights taken from CMAB's use label.
  - Park trees from the canopy map.
- **The existing audits must still pass:** the scene audit (no roof over water, no tree under a
  roof) and the city audit (no tree on a carriageway).
- **Screenshots.** Wutang Square's old compounds, Xinjiekou from the air, and a city park, before
  and after.

## Results: build 11 (9 November 2026)

**The build's counts.**

| Count | Number |
| --- | --- |
| CMAB rooftops built as infill | 20,198 |
| Covered by an OSM building, so not built | 9,354 |
| Skipped for a road or building | 2,894 |
| Skipped for a landmark | 964 |
| Skipped for water | 136 |
| Skipped at the map edge | 22 |
| OSM `building=yes` given CMAB's use label | 3,664 |
| Park trees from the canopy map | 26,288 |

The scene file grew from 41.9 to 45.4 MB, and trees.json from 12.7 to 13.9 MB.

**Tests.** Every one passed:

- the scene audit (3 of 130,214 roofs over water, no tree under a roof);
- the city audit (`banks` still fails 2 of 20 samples, the known fault);
- the Xuanwu browser test;
- both journeys;
- `npm test`, 118 of 118.

**Screenshots** (test-results/shots/cmab-*.png):

- **Xinjiekou and Wutang Square:** about the same density as before, now on real outlines.
- **Mochou Lake Park** has new trees where the canopy map has them.
- **Mochou Lake's surroundings** are a regression: blocks the made-up slabs used to fill are now
  partly empty ground.

**Why: CMAB misses buildings.** I overlaid CMAB and OSM on Esri imagery. The tiles were fetched only
to check this and are not shipped; they sit in E:/nanjing-geodata/imagery-check. Then I measured
both shortfalls in `tests/cmab-check.py`.

- **Recall.** CMAB finds 53 % of the buildings OSM maps in the core, 66 % of their footprint area.
  By footprint size:

  | OSM footprint | Share CMAB finds |
  | --- | --- |
  | Under 100 m² | 22 % |
  | 100–300 m² | 49 % |
  | 300–1,000 m² | 56 % |
  | Over 1,000 m² | 70 % |

  The towers south of Mochou Lake are missing from it.
- **Outline size.** Its outlines are smaller than the buildings: the median area is 0.85 of the
  matching OSM building. Growing each outline outward by a median of 0.77 m would close the gap.
  The figure rises with size, from 0.30 m under 200 m² to 1.36 m over 2,000 m². In the imagery, the
  slab housing west of Mochou Lake is traced at roughly half to two-thirds of its true depth.

So where OSM maps nothing, CMAB alone stands for about two-thirds of the real built area.

**Next, needing the owner's choice:**

- **(a) Real outlines only.** Grow each outline by the measured offset for its size, and accept the
  gaps CMAB leaves.
- **(b) As (a), then fill the gaps with estimated buildings.** Only in built-up land-use blocks, and
  only up to the cover that fully mapped blocks of the same use show. These are labelled as
  estimates.
