import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = new URL("../", import.meta.url);
const data = JSON.parse(
  fs.readFileSync(new URL("public/memories/memories.json", root)),
);
const routes = JSON.parse(
  fs.readFileSync(new URL("public/world/routes.json", root)),
);

test("Every published frame has both an image and a thumbnail on disk", () => {
  for (const memory of data.memories) {
    for (const key of ["src", "thumb"]) {
      const file = new URL(`public${memory[key]}`, root);
      assert.ok(fs.existsSync(file), `${memory.id}: missing ${memory[key]}`);
      assert.ok(
        fs.statSync(file).size > 2048,
        `${memory.id}: ${memory[key]} is suspiciously small`,
      );
    }
  }
});

test("Published images carry no EXIF, and therefore no GPS or timestamps", () => {
  const dir = new URL("public/memories/", root);
  for (const name of fs.readdirSync(dir).filter((f) => f.endsWith(".jpg"))) {
    const bytes = fs.readFileSync(path.join(dir.pathname.slice(1), name));
    // APP1 is the marker EXIF and XMP travel in; these copies are rewritten
    // pixel-by-pixel from the private originals and must not contain one.
    for (let i = 0; i < bytes.length - 1; i++) {
      if (bytes[i] === 0xff && bytes[i + 1] === 0xe1) {
        assert.fail(`${name} still contains an APP1 (EXIF/XMP) segment`);
      }
      // Only the header needs scanning; pixel data can coincidentally match.
      if (i > 8192) break;
    }
    assert.ok(
      !bytes.subarray(0, 8192).includes(Buffer.from("Exif")),
      `${name} still contains an Exif header`,
    );
  }
});

test("The frames run in the order the morning happened", () => {
  const minutes = data.memories.map((m) => m.minutes);
  const sorted = [...minutes].sort((a, b) => a - b);
  assert.deepEqual(minutes, sorted);
  assert.equal(minutes[0], 6 * 60 + 16);
  assert.equal(minutes.at(-1), 8 * 60 + 26);
  for (const memory of data.memories) {
    const [h, m] = memory.time.split(":").map(Number);
    assert.equal(h * 60 + m, memory.minutes, `${memory.id}: time disagrees`);
  }
});

test("Each frame stands beside its own route, close enough to walk up to", () => {
  for (const memory of data.memories) {
    const route = routes[memory.route];
    assert.ok(route, `${memory.id}: route ${memory.route} does not exist`);
    let nearest = Infinity;
    for (const point of route.points) {
      const d = Math.hypot(
        point[0] - memory.position[0],
        point[2] - memory.position[2],
      );
      if (d < nearest) nearest = d;
    }
    // Walkers are held within width * 0.38 of the centreline, so a frame has
    // to sit just off the path: outside it, but inside the opening range.
    assert.ok(
      nearest > route.width * 0.38,
      `${memory.id}: frame is inside the walkable corridor`,
    );
    assert.ok(nearest < 6, `${memory.id}: frame is ${nearest.toFixed(1)} m away`);
  }
});

test("Placement is described as inferred, never as surveyed", () => {
  assert.match(data.note, /not by measured GPS|network fixes/i);
  assert.equal(data.memories.length, 20);
});
