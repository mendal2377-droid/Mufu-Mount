import * as THREE from "three";

const ICONS = ["⌁", "△", "◉", "≈", "↟", "✦"];

// Frame the walking landscape, rather than the much larger water/sky meshes.
// Perspective keeps the same camera and depth pipeline used by the walk.
export function planPose(points, aspect) {
  const bounds = new THREE.Box3();
  points.forEach((p) => bounds.expandByPoint(new THREE.Vector3(...p)));
  bounds.expandByScalar(240);
  const target = bounds.getCenter(new THREE.Vector3());
  target.y = 55;
  const back = new THREE.Vector3(...(aspect >= 1 ? [.60, .84, .80] : [-.78, .96, .60])).normalize();
  const right = new THREE.Vector3().crossVectors(new THREE.Vector3(0, 1, 0), back).normalize();
  const up = new THREE.Vector3().crossVectors(back, right);
  const fov = 40;
  const tanY = Math.tan(THREE.MathUtils.degToRad(fov / 2));
  const tanX = tanY * aspect;
  let distance = 0;
  for (const point of points) {
        const delta = new THREE.Vector3(...point).sub(target);
        distance = Math.max(distance,
          (Math.abs(delta.dot(right)) + 420) / (tanX * 0.82) + delta.dot(back),
          (Math.abs(delta.dot(up)) + 420) / (tanY * 0.8) + delta.dot(back));
  }
  return { target, position: target.clone().addScaledVector(back, distance), fov };
}

// Labels may need to spread out around nearby trailheads. Leader lines retain
// the link to their actual world anchors; they never change a walking spawn.
export function layoutPins(anchors, width, height, panelWidth = 0) {
  const narrow = width < 650;
  const box = { w: narrow ? 116 : 142, h: narrow ? 62 : 74 };
  const placed = [];
  const safe = { left: 12, right: width - panelWidth - 12, top: narrow ? 122 : 126, bottom: height - 75 };
  for (const a of anchors) {
    let best = null;
    // Search in screen space, keeping labels as close as possible to a pin.
    for (let dy = -44; dy <= 260; dy += box.h + 8)
      for (const dx of [0, -154, 154, -308, 308]) {
        const x = THREE.MathUtils.clamp(a.x + dx, safe.left + box.w / 2, safe.right - box.w / 2);
        const y = THREE.MathUtils.clamp(a.y + dy, safe.top + box.h / 2, safe.bottom - box.h / 2);
        const overlapping = placed.some((p) => Math.abs(p.x - x) < box.w + 8 && Math.abs(p.y - y) < box.h + 8);
        const score = (x - a.x) ** 2 + (y - (a.y - 44)) ** 2 + (overlapping ? 1e8 : 0);
        if (!best || score < best.score) best = { ...a, x, y, score, width: box.w, height: box.h };
      }
    placed.push(best);
  }
  return placed;
}

export function createPlan({ container, list, points, onEnter }) {
  const svgNS = "http://www.w3.org/2000/svg";
  const leaders = document.createElementNS(svgNS, "svg");
  leaders.classList.add("pin-leaders");
  leaders.setAttribute("aria-hidden", "true");
  container.append(leaders);
  const records = points.map((point, index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "access-pin";
    button.id = `access-${index}`;
    button.dataset.access = String(index);
    button.setAttribute("aria-label", `Walk in at ${point.name}`);
    button.innerHTML = `<span class="pin-label">${point.name}</span><span class="pin-icon" aria-hidden="true">${ICONS[index]}</span>`;
    button.onclick = () => onEnter(index);
    container.append(button);
    const shortcut = document.createElement("button");
    shortcut.type = "button";
    shortcut.innerHTML = `<span aria-hidden="true">${ICONS[index]}</span>${point.name}`;
    shortcut.setAttribute("aria-label", `Walk in at ${point.name}`);
    shortcut.onclick = () => onEnter(index);
    list.append(shortcut);
    const line = document.createElementNS(svgNS, "line");
    const dot = document.createElementNS(svgNS, "circle");
    dot.setAttribute("r", "3.5");
    leaders.append(line, dot);
    return { button, line, dot, position: new THREE.Vector3(...point.position) };
  });
  const projected = new THREE.Vector3();
  let lastLayout = "";
  return {
    update(camera) {
      const width = innerWidth, height = innerHeight;
      camera.updateMatrixWorld();
      const anchors = records.map((rec, index) => {
        projected.copy(rec.position).project(camera);
        const visible = projected.z > -1 && projected.z < 1;
        rec.button.hidden = !visible;
        return { index, x: (projected.x * .5 + .5) * width, y: (-projected.y * .5 + .5) * height, visible };
      });
      const key = anchors.map(a => `${Math.round(a.x)},${Math.round(a.y)}`).join(";") + `:${width},${height}`;
      if (key === lastLayout) return;
      lastLayout = key;
      const labels = layoutPins(anchors, width, height, width >= 1000 ? 252 : 0);
      labels.forEach((p) => {
        const rec = records[p.index], a = anchors[p.index];
        rec.button.style.left = `${p.x}px`;
        rec.button.style.top = `${p.y}px`;
        rec.line.setAttribute("x1", a.x);
        rec.line.setAttribute("y1", a.y);
        rec.line.setAttribute("x2", p.x);
        rec.line.setAttribute("y2", p.y + 23);
        rec.dot.setAttribute("cx", a.x);
        rec.dot.setAttribute("cy", a.y);
        rec.line.style.display = rec.dot.style.display = a.visible ? "" : "none";
      });
    },
  };
}
