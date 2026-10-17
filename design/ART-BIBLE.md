# Art bible: the Blender rebuild

The target image is `design/city/nanjing-landmarks-concept-v2.png`: warm gouache light, cobalt sky with
flat-based cumulus, dense rounded broadleaf canopies, clean architectural silhouettes and soft
cast shadows. This is our own interpretation of a hand-painted animated-film background. It copies
no frames, characters or textures, and implies no affiliation with any film or studio.

The rule of thumb: **silhouette and colour must be true, surface detail may be painterly.** A
returning visitor recognises a place by roof shape, wall colour, storey count and setting, not by
brick count.

## Palette (sRGB, base colours before lighting)

| Role | Colour | Used for |
| --- | --- | --- |
| Granite / memorial white | `#E9E4D8` | Zhongshan hall, arch, balustrades; Music Stage screen (shade it toward `#C9CED3`) |
| Paving | `#CFC6B4`, joints `#A79E8C` | Plazas, steps |
| **Zhongshan cobalt roof** | `#2B3F9E`, highlight `#4A63C8`, shade `#1A2466` | Mausoleum roofs only: they are famously ultramarine, so this is an exception to the city's teal rule |
| Meiling green tile | `#3E7D5A`, highlight `#6BA57A` | Meiling Palace roofs |
| Grey tile (old city) | `#5D6670` | Residential and temple roofs |
| Vermilion lacquer | `#B8432F` | Columns, doors, balconies |
| Ochre temple wall | `#E2B04A` | Jiming, temple walls |
| Ming brick | `#8E8C86` | City wall, Zhonghua Gate |
| Gold trim | `#D6A640` | Finials, inscriptions |
| Foliage, sunlit / mid / shade | `#A7C24A` / `#5E8F3A` / `#2F5A3A` | Broadleaf canopy bands |
| Cedar and cypress | `#3D5E3F`, shade `#22392C` | Mausoleum avenue, hedges |
| Autumn plane / maple | `#E2B233` / `#D0622E` | Season dial |
| Water | `#5FA8B5`, deep `#2E6C7E` | Pools, lakes, river |

## Lighting and shading

- **Three-band toon diffuse** (light / mid / shadow) with a painted ramp per material, and a sky-blue
  fill in shadow so shadow is never grey.
- **Foliage:** clumped card crowns with spherical normals (so crowns shade as soft balls), a painted
  leaf atlas, and a warm rim on the sun side. No foliage casts a shadow except through the existing proxies.
- **Architecture:** baked ambient occlusion in Blender (vertex colour or one AO map per kit piece),
  a soft ink outline on silhouettes only, and bevelled edges so light catches the profiles.
- Aerial perspective: distant mountains fade to blue-violet. Fog is set per weather (existing system).
- One final tone-map pass, as today.

## Geometry rules

- **Modelled detail where the eye goes:** roof curves and lifted corners, eave brackets as one
  merged strip, balustrades with real posts, steps as real steps (the 392 steps exist; walkers feel them).
- **Painted detail elsewhere:** tile rows, stone joints and carving friezes are texture plus normal, not mesh.
- **Kit first:** every repeated piece is a Blender asset (roof, eave strip, balustrade post and rail,
  stair flight, hedge, lamp, lion, tripod, tree types). A landmark is assembled from kit plus a few hero meshes.
- **Scale:** real metres from the research pack. Where we compress, write it in that landmark's FACTS.md.

## Recognition checklist (per landmark, before export)

1. Is the silhouette from the main photo angle a match side by side?
2. Are the roof colour and wall colour right?
3. Are counts right where people notice them (storeys, arches, doors, columns, flights of stairs)?
4. Is the setting right: forest type, water, mountain behind?
5. Does it still look painted rather than photographic?

## Tools note

This session has no image-generation tool, so new concept art comes from **Blender look-dev renders**
(toon shading, the palette above), compared with the reference photos and the v2 concept. The older
imagegen concepts and runtime textures stay valid.
