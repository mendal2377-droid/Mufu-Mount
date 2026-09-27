import * as THREE from "three";

/**
 * A camera on rails, shared by the loop that plays behind the title and by the
 * circuit that walks the whole place hands-free.
 *
 * A tour is a list of legs. A `walk` leg glides along a stretch of one of the
 * exported routes at eye height; an `air` leg lifts off it to show where you
 * have been; a `hold` leg stands still and looks at something. Each leg fades
 * up from black and back down, so the cuts between them are cuts, not jumps.
 */

function arcTable(points) {
  const lengths = [0];
  for (let i = 1; i < points.length; i++) {
    lengths.push(
      lengths[i - 1] +
        Math.hypot(
          points[i][0] - points[i - 1][0],
          points[i][2] - points[i - 1][2],
        ),
    );
  }
  return lengths;
}

export function createCinematic(routes) {
  const tables = routes.map((r) => arcTable(r.points));

  function sample(routeIndex, distance, out = new THREE.Vector3()) {
    const points = routes[routeIndex].points;
    const lengths = tables[routeIndex];
    const total = lengths[lengths.length - 1];
    const s = THREE.MathUtils.clamp(distance, 0, total - 0.001);
    let lo = 0,
      hi = lengths.length - 1;
    while (lo + 1 < hi) {
      const mid = (lo + hi) >> 1;
      if (lengths[mid] <= s) lo = mid;
      else hi = mid;
    }
    const a = points[lo],
      b = points[Math.min(lo + 1, points.length - 1)];
    const span = lengths[lo + 1] - lengths[lo] || 1;
    const f = (s - lengths[lo]) / span;
    return out.set(
      a[0] + (b[0] - a[0]) * f,
      a[1] + (b[1] - a[1]) * f,
      a[2] + (b[2] - a[2]) * f,
    );
  }

  function routeLength(routeIndex) {
    const lengths = tables[routeIndex];
    return lengths[lengths.length - 1];
  }

  let legs = [];
  let loop = false;
  let index = 0;
  let elapsed = 0;
  let running = false;

  const here = new THREE.Vector3(),
    ahead = new THREE.Vector3(),
    target = new THREE.Vector3();

  const api = {
    get running() {
      return running;
    },
    get leg() {
      return legs[index];
    },
    get legIndex() {
      return index;
    },
    get legCount() {
      return legs.length;
    },
    /** 0..1 across the whole tour, by leg time. */
    get progress() {
      if (!legs.length) return 0;
      const total = legs.reduce((sum, l) => sum + l.seconds, 0);
      let done = 0;
      for (let i = 0; i < index; i++) done += legs[i].seconds;
      return THREE.MathUtils.clamp((done + elapsed) / total, 0, 1);
    },
    play(nextLegs, options = {}) {
      legs = nextLegs;
      loop = !!options.loop;
      index = options.from || 0;
      elapsed = 0;
      running = true;
    },
    stop() {
      running = false;
    },
    /**
     * Advances the tour and writes the camera. Returns the leg that is playing,
     * how far into it, and how black the frame should be right now.
     */
    update(dt, camera, time) {
      if (!running || !legs.length) return null;
      const leg = legs[index];
      elapsed += dt;

      let finished = false;
      if (elapsed >= leg.seconds) {
        elapsed = 0;
        index++;
        if (index >= legs.length) {
          if (loop) index = 0;
          else {
            index = legs.length - 1;
            elapsed = legs[index].seconds;
            running = false;
            finished = true;
          }
        }
      }

      const active = legs[index];
      const t = THREE.MathUtils.clamp(elapsed / active.seconds, 0, 1);
      const eased = active.kind === "hold" ? t : t * t * (3 - 2 * t) * 0.15 + t * 0.85;

      if (active.kind === "air") {
        here.fromArray(active.from).lerp(
          new THREE.Vector3().fromArray(active.to),
          eased,
        );
        target
          .fromArray(active.look)
          .lerp(new THREE.Vector3().fromArray(active.lookTo || active.look), eased);
        camera.position.copy(here);
        camera.lookAt(target);
      } else {
        const length = routeLength(active.route);
        const from = (active.from ?? 0) * length;
        const to = (active.to ?? active.from ?? 0) * length;
        const distance = from + (to - from) * eased;
        sample(active.route, distance, here);
        const forward = to >= from ? 1 : -1;
        sample(active.route, distance + 14 * forward, ahead);

        const height = active.height ?? 1.9;
        camera.position.set(here.x, here.y + height, here.z);
        if (active.lookAt) {
          // An absolute point, for shots that have to face something specific
          // — the sun going down the river — rather than along the path.
          target.fromArray(active.lookAt);
          camera.lookAt(target);
        } else {
          target.set(ahead.x, ahead.y + height + (active.rise ?? 0), ahead.z);
          camera.lookAt(target);
          if (active.yaw) camera.rotation.y += active.yaw;
          if (active.pitch) camera.rotation.x += active.pitch;
        }
      }

      // A slow drift so nothing ever looks locked to a rail.
      camera.rotation.y += Math.sin(time * 0.11 + index) * 0.012;
      camera.rotation.x += Math.sin(time * 0.083 + index * 2.1) * 0.006;
      camera.rotation.z = 0;

      const fadeIn = THREE.MathUtils.smoothstep(elapsed, 0, 1.1);
      const fadeOut = THREE.MathUtils.smoothstep(
        active.seconds - elapsed,
        0,
        1.1,
      );
      return {
        leg: active,
        index,
        t,
        fade: 1 - Math.min(fadeIn, fadeOut),
        finished,
      };
    },
  };
  return api;
}

/** The loop that plays behind the title: the road, the ridge, and the river. */
export function titleLoop() {
  return [
    {
      kind: "walk",
      route: 2,
      from: 0.055,
      to: 0.095,
      seconds: 26,
      height: 2.2,
      mood: "morning",
      label: "Rainbow road",
    },
    {
      kind: "walk",
      route: 3,
      from: 0.245,
      to: 0.275,
      seconds: 28,
      height: 2.0,
      yaw: 0.5,
      mood: "sunset",
      label: "Riverside promenade",
    },
    {
      kind: "walk",
      route: 0,
      from: 0.462,
      to: 0.482,
      seconds: 24,
      height: 2.1,
      mood: "dawn",
      label: "Ridge trail",
    },
    {
      kind: "walk",
      route: 3,
      from: 0.372,
      to: 0.396,
      seconds: 28,
      height: 2.0,
      yaw: 0.75,
      mood: "sunset",
      label: "The Yangtze",
    },
  ];
}

/**
 * The whole circuit, hands-free: up through the woods at first light, along
 * the ridge, out onto the river terrace, down the coloured road, and finally
 * the long riverside into the evening. Roughly four and a half minutes.
 */
export function wholeCircuit() {
  return [
    {
      kind: "walk",
      route: 1,
      from: 0.04,
      to: 0.62,
      seconds: 44,
      height: 1.9,
      mood: "dawn",
      label: "06:16 · Up through the woods",
    },
    {
      kind: "air",
      from: [2180, 300, -760],
      to: [2560, 330, -1010],
      look: [2500, 150, -950],
      lookTo: [2900, 90, -1500],
      seconds: 16,
      mood: "morning",
      label: "Over the ridge",
    },
    {
      kind: "walk",
      // The high stretch: route 0 tops out at t 0.4965, which is the lookout
      // terrace. This leg climbs the last 200 m to it.
      route: 0,
      from: 0.455,
      to: 0.492,
      seconds: 42,
      height: 1.9,
      mood: "morning",
      label: "The ridge trail",
    },
    {
      kind: "walk",
      route: 4,
      from: 0.0,
      to: 1.0,
      seconds: 16,
      height: 1.85,
      mood: "morning",
      label: "The river terrace",
    },
    {
      kind: "walk",
      route: 2,
      from: 0.06,
      to: 0.175,
      seconds: 40,
      height: 1.9,
      mood: "morning",
      label: "Rainbow road",
    },
    {
      kind: "walk",
      route: 2,
      from: 0.46,
      to: 0.56,
      seconds: 34,
      height: 1.9,
      mood: "morning",
      label: "The green-barrier road",
    },
    {
      kind: "air",
      from: [3050, 240, -1600],
      to: [2200, 120, -1500],
      look: [2600, 60, -1900],
      lookTo: [1900, 10, -1450],
      seconds: 18,
      mood: "sunset",
      label: "Down to the river",
    },
    {
      kind: "walk",
      route: 3,
      from: 0.238,
      to: 0.272,
      seconds: 40,
      height: 1.9,
      yaw: 0.35,
      mood: "sunset",
      label: "Riverside park",
    },
    {
      kind: "walk",
      route: 3,
      from: 0.36,
      to: 0.395,
      seconds: 42,
      height: 1.9,
      yaw: 0.6,
      mood: "sunset",
      label: "The promenade",
    },
    {
      kind: "walk",
      route: 3,
      from: 0.52,
      to: 0.527,
      seconds: 22,
      height: 1.9,
      // Straight down the sun's own bearing, a little above the water: the
      // sunset direction in model space is (-0.9077, 0.0845, 0.4109), so this
      // is about 800 m along it from the end of the promenade leg.
      lookAt: [1696, 26, -1603],
      mood: "sunset",
      label: "燕矶夕照 · Evening glow",
    },
  ];
}
