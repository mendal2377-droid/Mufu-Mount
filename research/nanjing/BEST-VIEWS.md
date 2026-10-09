# Best views: ten places rebuilt to their best photograph

Ten places are rebuilt so that the first thing a visitor sees is the view people photograph
them for. The reference photographs are the project owner's own collection (`D:\blender\nanjing`,
one folder per place, about 40 images from public sites; several carry watermarks). They are
**reference only**: nothing was copied into the repository, used as a texture, traced, or
redistributed, and the originals must not be committed. The code is in `src/city-sets*.js`; each set
returns its own walk, first-frame look, light and season.

| Place | The photographs show | The view now |
| --- | --- | --- |
| Ming Xiaoling | The Sacred Way: a wide stone road between paired stone camels, elephants, horses and robed officials, clipped hedges, tall trees overhead | A 200 m road, bent as the real one is, with lions, xiezhi, camels, elephants, qilin and horses in pairs, two pairs of officials, hedges, tall trees; the gate at the end. Morning |
| Zhongshan Mausoleum | The axis: blue-roofed archway, dark cedar walls, tomb gate, stele pavilion, the great stair, the hall | Archway at the head of a cedar avenue, three-doored tomb gate, open stele pavilion, then the stair and hall on a levelled plateau terrace. Morning |
| Jiming Temple | Nine-storey dark-red pagoda with gold finial and upswept black eaves; peach-pink halls with grey roofs either side of a stone axis | Nine storeys, pairs of peach halls along the axis, incense burner, clipped trees, yellow outer wall. Morning |
| Qinhuai River | A canal at dusk: gold-roofed pleasure boats, white-walled houses with lit eaves, the red-and-gold temple pavilion, strings of lanterns | A walled canal with raised stone embankments, white balustrades, houses on both banks, a three-roof gold pavilion, lantern strings across the water, boats moving along it. Sunset |
| Mochou Lake | A two-storey red-and-white lakeside pavilion with upswept roofs; willow curtains; a white statue on a rockery among red blossom | The pavilion on the shore, the statue and rockery beside it, weeping willows leaning over the path with the view kept open. Sunset |
| Xuanwu Lake | Arching trees over the shore path; lotus fields; Zifeng Tower across the water above the old wall | Big trees leaning over the promenade, lotus leaves and pink blooms on the shallows, first frame turned towards Zifeng. Morning |
| Zifeng Tower | A slim, almost parallel-sided silver-blue prism with a stepped crown and a tall spire | A faceted shaft, two setbacks and a spire (it had been a cone) |
| Qixia Mountain | Autumn: a red wooden boardwalk with red railings through red maples | A winding red boardwalk with railings, a canopy of red and gold maples, the hill in autumn colours. Sunset |
| Purple Mountain | A road under a tunnel of tall plane trees, golden leaves, pale trunks; the semicircular music stage | A 230 m asphalt road under golden plane trees, ending at a fan of stone terraces facing a white curved screen. Sunset |
| Niushou | A golden lattice dome beside a rose-gold shell, and a golden-roofed dark-red pagoda on a pale plaza | Pale plaza, gold lattice domes, a nine-storey pagoda with gold roofs. Morning |

## What was changed to make room

- Terrain: ways with a controlled grade (`WAYS`) for the Sacred Way, the Mausoleum approach, Jiming's axis and the plane-tree road; a level terrace for the music stage; the Mausoleum's axis moved 25 m east and 65 m north onto its plateau (`AXIS`), because the pin's own ground is a hillside.
- Trees: red maple and golden plane tree (same painted crowns, colour re-mapped by luminance in the shader, so no new texture); a shared near-tree budget of 660 across all species; `force` planting for composed views.
- Light: each place has the weather it looks best in. It is applied when a visitor enters from a pin, the destination list or the Places panel, unless they have already chosen a weather themselves.

## What this is not

- Not a reconstruction. Layouts are compressed: Jiming's axis is 55 m because the Presidential Palace is 80 m away on the atlas; the Sacred Way is 200 m, not 800; the real Qixia boardwalk descends a mountainside, ours winds across a plateau because the hillside is too steep to walk.
- The atlas's neighbours constrain several views; where two places overlap on the map one of them gives way.
- Not checked against the photographs pixel by pixel: the compositions were matched by eye in a software-rendered preview.
