import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {cityPoint, cityRiverSurfaces} from '../src/city-geography.js';
import {createCityTerrain, PADS} from '../src/city-terrain.js';

// Buildings used to hang off hillsides: Xiaoling's ground fell 48 m across a 46 m
// footprint (a lake "shoulder" slopes the whole hill towards the water), and a pad
// smaller than its building left one corner in the air. These tests fix the ground
// itself, because a footing under every building only hides a slope that should not
// be there.
const data = JSON.parse(fs.readFileSync(new URL('../public/city/nanjing.json', import.meta.url)));
const places = data.landmarks.map(p => ({...p, position: cityPoint(p.coord, data)}));
const rivers = cityRiverSurfaces(data);
const lakes = data.lakes.map(l => ({...l, outer: l.outer.map(r => r.map(p => cityPoint(p, data))), inner: l.inner.map(r => r.map(p => cityPoint(p, data)))}));
const terrain = createCityTerrain(places, rivers, lakes, data.boundary.map(r => r.map(p => cityPoint(p, data))));
const get = id => places.find(p => p.id === id);

function range(x0, z0, rx, rz) {
  let lo = Infinity, hi = -Infinity;
  for (let i = -8; i <= 8; i++) for (let j = -8; j <= 8; j++) {
    const y = terrain.analytic(x0 + i * rx / 8, z0 + j * rz / 8);
    lo = Math.min(lo, y); hi = Math.max(hi, y);
  }
  return {lo, hi, spread: hi - lo};
}

test('every pad is level across its whole footprint', () => {
  // Palace and Jiming are graded by the shared lowland forecourt instead, and sit on the
  // lake shore, so their footprints include the water's edge.
  // Yuejiang and Zifeng stand at the water's edge, where the pad deliberately gives way
  // to the shore; their buildings occupy the inner part of it, which is what is checked.
  const inner = {yuejiang: .5, zifeng: .85};
  for (const [id, pad] of Object.entries(PADS)) {
    if (['palace', 'jiming'].includes(id)) continue;
    const [x, , z] = get(id).position, f = inner[id] ?? .95;
    // The mapped Qinhuai channel winds through the gate's inner courts (z+10 to z+40), so only
    // the great outer arch and its wings, z+43 to z+59, are on level ground to be checked.
    const r = id === 'zhonghua' ? range(x, z + 51, 38, 8) : range(x, z + pad.offset, pad.rx * f, pad.rz * f);
    assert.ok(r.spread < 1, `${id}: ground varies by ${r.spread.toFixed(1)} m under its footprint`);
  }
});

test('Xiaoling no longer stands on a ramp', () => {
  const [x, , z] = get('xiaoling').position;
  const r = range(x, z, 25, 25);
  assert.ok(r.spread < .6, `${r.spread.toFixed(1)} m across the gate hall (was 48 m)`);
});

test('the Sun Yat-sen stair is a ramp and the memorial hall stands on a level terrace at its head', () => {
  const [x, , z] = get('zhongshan').position;
  const top = terrain.analytic(x, z + 8), at = terrain.analytic(x, z + 3), behind = terrain.analytic(x + 10, z - 10), side = terrain.analytic(x + 20, z + 3);
  for (const [name, y] of [['hall front', at], ['behind the hall', behind], ['beside the hall', side]]) {
    assert.ok(Math.abs(y - top) < 1.2, `${name} is ${(y - top).toFixed(1)} m from the stair head; the hall would hang or sink`);
  }
  // And the stair itself climbs steadily rather than stepping.
  let prev = terrain.analytic(x, z + 58);
  for (let zz = z + 56; zz > z + 10; zz -= 2) {
    const y = terrain.analytic(x, zz);
    assert.ok(y - prev > -.01 && y - prev < .6, `stair ground jumps ${(y - prev).toFixed(2)} m at ${zz - z}`);
    prev = y;
  }
});

test('pads do not drag neighbouring landmarks off their own hills', () => {
  // Zhongshan, the Mausoleum, sits 100+ m from Xiaoling's pad on the same mountain.
  const [zx, , zz] = get('zhongshan').position;
  assert.ok(terrain.analytic(zx, zz + 58) > 110, 'the Mausoleum stair has been pulled down the hill');
  assert.ok(terrain.analytic(...(([x, , z]) => [x, z])(get('zijin').position)) > 150, 'Purple Mountain has been flattened');
});
