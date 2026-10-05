# Illustrated Nanjing — imagegen art direction v1

Created 5 October 2026 with the built-in imagegen tool, using the user's two current-game screenshots and then the generated concept as visual references. Screenshots are not redistributed. This is an original artistic interpretation, not surveyed reconstruction or a claim that the concept is a game screenshot.

## Saved assets

- `design/city/nanjing-concept-v1.png`: two-panel concept; design reference only.
- `design/city/foliage-source-v1.png`: original generated RGBA foliage art.
- `design/city/meadow-source-v1.png`: original generated meadow art.
- `public/city/art/foliage-gouache-v1.png`: runtime 1024-square RGBA atlas. Four source quadrants resized to 420 pixels and packed in 512-pixel cells with 46-pixel transparent gutters. Alpha is preserved; no painted edits.
- `public/city/art/meadow-gouache-v1.webp`: runtime 1024-square meadow, quality 88 WebP.

## Implementation

Curved, fixed-orientation foliage sprays surround branching tree volumes; they are not camera-facing billboards. Broadleaf crowns include golden accents, pine crowns use layered needles, and willow crowns have hanging leaves. All crowns remain instanced and never cast shadows. Near detail is capped at 220 trees per species; altitude affects the selection. Pigment ground textures multiply the continuous terrain's jade/sage vertex colours at 48 percent strength. Grounding washes are vertex colours, not floating shadow discs.

Ivory plaster, blue-gray roofs with ribs, vermilion woodwork, compact courtyard clusters and stone lake balustrades translate the concept into geometry. Water uses crossing, warped, derivative-filtered brush ripples; its normals transform into view space, and reflections follow sunset/storm/snow. Public landmark anchors and map sources stay unchanged; terrain, buildings, shoreline paving and planting remain artistic approximations.

## Exact prompts

### City concept

Use case: stylized-concept. Asset type: art-direction concept for an existing navigable 3D Nanjing city game. Input images: both attached screenshots are reference images of the current game, the first a lakeside walk, the second the aerial city atlas. Re-imagine their art direction as one beautifully cohesive hand-painted gouache and ink travel atlas, with volumetric rounded trees, layered jade/sage forest hills, warm ivory limestone, charcoal blue-gray curved Chinese tiled roofs, muted vermilion timber, golden wildflowers and deep blue-green water with irregular painted reflections. Create a wide two-panel art direction sheet: left two thirds is an elevated oblique Nanjing landscape, right third is a close walk beside Xuanwu lake showing textured trees, stone promenade, water and a distant slender stepped modern tower. Preserve the geographic idea of the broad curving Yangtze in the north, the historic city to its south, Xuanwu lake and Purple Mountain east of center; architectural landmarks are deliberately enlarged. Strengthen scenery with linked wooded ridges, compact historic courtyard neighborhoods, bridges, pagoda silhouettes and winding park trails. Avoid generic cubes, faceted cones, uniform neon green, oversized steep barren walls, stripy water or washed-out beige fog. Soft morning sun, legible dappled shading, delicate graphite contour edges, irregular watercolor pigment and tactile grain. Maintain depth and parallax suitable for an actual 3D implementation, not flat sticker vegetation. No UI, no labels, no text, no map pins, no watermark. Original design interpreting the screenshots rather than claiming geographic survey accuracy.

### Foliage atlas

Use case: texture asset. Create a production-ready RGBA foliage atlas for a navigable 3D illustrated Nanjing landscape. Match the jade, sage, moss, ochre highlights and hand-painted gouache pigment of the reference concept. Square canvas, exactly 2 columns by 2 rows of four separate leafy branching sprays: top left a lush dense rounded broadleaf bough, top right a delicate golden ginkgo bough with fan leaves, bottom left a layered dark jade pine branch with soft needle clusters, bottom right an airy pale sage willow bough with hanging slender leaves. Each bough occupies the central 75 percent of its cell; leave completely transparent generous gutters and outer margins. Natural broken leaf silhouettes and tiny transparent holes between leaves, believable darker internal foliage and sunlit outer leaves, subtle visible twig branches. Branch sprays only, no entire trees, no ground, no shadows outside leaves, no white/black background, no cell dividers, no labels or text. Texture painted for alpha-masked curved 3D foliage clusters, with balanced detailed forms legible at small scale. Keep leaf colors varied but not neon. True transparent background.

### Meadow texture

Use case: texture asset. Square seamless repeatable albedo texture for the ground of a hand-painted gouache illustrated Nanjing 3D city. Top-down orthographic material scan, not a landscape. Very subtle pale sage grass, warm ivory dusty earth and tiny gold meadow flecks, delicate watercolor pigment pooling and tactile rice-paper grain. Small irregular overlapping brush patches; neutral light desaturated overall value so it can be multiplied by terrain vertex colors, broad variation gently repeats without obvious grids. Sparse fine grass brushwork, no large flowers, no trees, no objects, no skyline, no text, no shadows or baked directional light, no borders. Match the warm painterly city concept reference. Uniformly detailed throughout, seamless edges on both axes.

