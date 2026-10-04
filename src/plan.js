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

// Never clamp or reflow a world marker. Nearby names can be revealed on hover
// or in the entrance list; changing their position made the map feel detached.
export function projectPin(position, camera, width, height) {
  const p = new THREE.Vector3(...position).project(camera);
  return { x: (p.x * .5 + .5) * width, y: (-p.y * .5 + .5) * height,
    visible: p.z > -1 && p.z < 1 && Math.abs(p.x) < 1.1 && Math.abs(p.y) < 1.1 };
}

export function createPlan({ container, list, points, onEnter }) {
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
    const mobileShortcut=shortcut.cloneNode(true);
    mobileShortcut.onclick=()=>{document.querySelector("#plan-entrances").open=false;onEnter(index);};
    document.querySelector("#mobile-destinations").append(mobileShortcut);
    button.title = point.name;
    return { button, position: point.position };
  });
  return {
    update(camera) {
      const width = innerWidth, height = innerHeight;
      camera.updateMatrixWorld();
      const anchors = records.map(rec => projectPin(rec.position, camera, width, height));
      records.forEach((rec, i) => {
        const p = anchors[i];
        rec.button.hidden = !p.visible;
        rec.button.style.left = `${p.x}px`;
        rec.button.style.top = `${p.y}px`;
        rec.button.classList.toggle("compact", anchors.some((a,j) => j < i && a.visible &&
          Math.abs(a.x-p.x) < 150 && Math.abs(a.y-p.y) < 65));
      });
    },
  };
}
