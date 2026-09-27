import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";

// Ships follow a parallel lane on the river side of the exported promenade.
export function makeRiverRoute(points) {
  const lengths = [0];
  for (let i = 1; i < points.length; i++)
    lengths.push(
      lengths[i - 1] +
        Math.hypot(
          points[i][0] - points[i - 1][0],
          points[i][2] - points[i - 1][2],
        ),
    );
  return {
    length: lengths.at(-1),
    sample(distance, offset = 0) {
      const s = THREE.MathUtils.clamp(distance, 0, lengths.at(-1) - 0.001);
      let lo = 0,
        hi = lengths.length - 1;
      while (lo + 1 < hi) {
        const mid = (lo + hi) >> 1;
        if (lengths[mid] <= s) lo = mid;
        else hi = mid;
      }
      const a = points[lo],
        b = points[lo + 1],
        f = (s - lengths[lo]) / (lengths[lo + 1] - lengths[lo] || 1);
      const dx = b[0] - a[0],
        dz = b[2] - a[2],
        n = Math.hypot(dx, dz) || 1;
      return {
        x: a[0] + dx * f + (dz / n) * offset,
        y: a[1] + (b[1] - a[1]) * f,
        z: a[2] + dz * f - (dx / n) * offset,
        dx: dx / n,
        dz: dz / n,
      };
    },
  };
}

const waterFragment = `
uniform float time,sunset,storm,snow,flash;
uniform vec4 ships[4]; uniform vec3 beacon; uniform float beaconPower;
varying vec3 p;
float hash(vec2 q){return fract(sin(dot(q,vec2(127.1,311.7)))*43758.5453);}
float noise(vec2 q){vec2 i=floor(q),f=fract(q);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+1.),f.x),f.y);}
vec3 reflectedSky(vec3 d){float h=max(d.y,0.);vec3 horizon=mix(vec3(.48,.64,.60),vec3(.78,.39,.20),sunset);vec3 zenith=mix(vec3(.14,.30,.43),vec3(.25,.20,.32),sunset);vec3 sky=mix(horizon,zenith,pow(h,.55));sky=mix(sky,mix(vec3(.25,.33,.34),vec3(.07,.12,.15),h),storm*.87);sky=mix(sky,vec3(.46,.55,.58),snow*.5);vec2 c=d.xz/(.3+abs(d.y))*2.+vec2(time*.009,0.);float cloud=smoothstep(.4,.8,noise(c)*.7+noise(c*2.1)*.3);return mix(sky,mix(vec3(.68,.74,.68),vec3(.20,.26,.27),storm),cloud*.22)*.48;}
void main(){
  vec3 V=normalize(cameraPosition-p);float dist=distance(cameraPosition,p);
  vec2 flow=normalize(vec2(.68,-.73));vec2 q=p.xz-flow*time*.9;
  // Analytic wave slopes: long swells, crossing ripples and advected fine chop.
  vec2 slope=vec2(0.);float swell=0.;
  for(int i=0;i<6;i++){float f=float(i);vec2 d=normalize(vec2(cos(f*2.17+.4),sin(f*2.17+.4)));float k=.055*pow(1.95,f);float a=.13*pow(.62,f)*(1.+storm*.9);float phase=dot(q,d)*k-time*(.5+f*.31);float aa=1.-smoothstep(.3,1.5,length(fwidth(p.xz))*k);slope+=d*cos(phase)*k*a*aa;swell+=sin(phase)*a;}
  float chop=noise(q*.065+vec2(swell));slope+=vec2(sin(q.y*.9+chop*5.),cos(q.x*.7+chop*5.))*.032*(1.-smoothstep(80.,700.,dist));
  vec3 N=normalize(vec3(-slope.x,1.,-slope.y));vec3 R=reflect(-V,N);
  float fresnel=.035+.965*pow(1.-max(0.,dot(N,V)),5.);
  vec3 sediment=mix(vec3(.12,.205,.17),vec3(.22,.265,.18),chop);sediment=mix(sediment,vec3(.09,.14,.14),storm*.55);
  vec3 color=mix(sediment,reflectedSky(R),.28+fresnel*.68);
  vec3 L=normalize(vec3(-.8,mix(.55,.08,sunset),-.6));vec3 H=normalize(L+V);
  float spec=pow(max(dot(N,H),0.),mix(180.,65.,storm));
  color+=vec3(1.,mix(.88,.49,sunset),mix(.62,.20,sunset))*spec*(1.-storm*.93)*(1.-snow*.65)*1.6;
  // Thin foam streaks travel downstream instead of a tiled stationary pattern.
  float streak=pow(noise(vec2(dot(q,vec2(-flow.y,flow.x))*.14,dot(q,flow)*.009)),9.);
  color+=vec3(.24,.28,.24)*streak*(.18+storm*.8)*(1.-smoothstep(300.,1600.,dist));
  float wake=0.;
  for(int i=0;i<4;i++){vec2 delta=p.xz-ships[i].xy;vec2 dir=ships[i].zw;float behind=-dot(delta,dir);float side=abs(dot(delta,vec2(-dir.y,dir.x)));float width=6.+max(0.,behind)*.18;float edge=exp(-pow((side-width)/(1.3+behind*.01),2.));float propeller=exp(-side*side/45.)*(.55+.45*sin(behind*1.7-time*8.));float gate=smoothstep(3.,18.,behind)*(1.-smoothstep(80.,330.,behind));wake+=gate*(edge*.7+propeller*.6);}
  color=mix(color,vec3(.71,.79,.74),clamp(wake,0.,.8));
  // Lantern glitter is stretched towards the observer across the ripples.
  vec2 toLight=beacon.xz-p.xz;vec3 B=normalize(vec3(toLight.x,beacon.y,toLight.y));float bspec=pow(max(dot(N,normalize(B+V)),0.),55.);color+=vec3(1.,.48,.12)*bspec*beaconPower*4./(1.+dot(toLight,toLight)/6000.);
  float fog=1.-exp(-dist*.00017);color=mix(color,reflectedSky(vec3(R.x,.04,R.z)),fog*.7);color+=flash*.2;
  // Left in linear HDR: the post-processing chain tone maps and encodes once,
  // for the water, the sky dome and the lit scene together.
  gl_FragColor=vec4(color,1.);
}`;

export function createLivingRiver(scene, shared, points) {
  const route = makeRiverRoute(points),
    shipUniforms = Array.from({ length: 4 }, () => new THREE.Vector4());
  const beaconPlace = route.sample(2440, 27);
  const uniforms = {
    ...shared,
    ships: { value: shipUniforms },
    beacon: { value: new THREE.Vector3(beaconPlace.x, 22, beaconPlace.z) },
    beaconPower: { value: 0.2 },
  };
  const water = new THREE.Mesh(
    new THREE.PlaneGeometry(70000, 70000),
    new THREE.ShaderMaterial({
      uniforms,
      vertexShader:
        "varying vec3 p;void main(){vec4 w=modelMatrix*vec4(position,1.);p=w.xyz;gl_Position=projectionMatrix*viewMatrix*w;}",
      fragmentShader: waterFragment,
    }),
  );
  water.rotation.x = -Math.PI / 2;
  water.position.set(2300, 0.1, -1800);
  water.name = "Flowing Yangtze — current, sky reflection and wakes";
  scene.add(water);
  const mats = {
    hull: new THREE.MeshStandardMaterial({
      color: 0x702f26,
      roughness: 0.65,
      metalness: 0.25,
    }),
    white: new THREE.MeshStandardMaterial({ color: 0xdedbca, roughness: 0.6 }),
    dark: new THREE.MeshStandardMaterial({
      color: 0x243b3b,
      roughness: 0.55,
      metalness: 0.4,
    }),
    glass: new THREE.MeshStandardMaterial({
      color: 0x29464c,
      roughness: 0.16,
      metalness: 0.45,
    }),
    deck: new THREE.MeshStandardMaterial({ color: 0x657466, roughness: 0.8 }),
  };
  function box(parent, size, pos, mat) {
    const o = new THREE.Mesh(new THREE.BoxGeometry(...size), mat);
    o.position.set(...pos);
    parent.add(o);
    return o;
  }
  function glowTexture() {
    const c = document.createElement("canvas");
    c.width = c.height = 64;
    const ctx = c.getContext("2d"),
      g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, "rgba(255,255,255,1)");
    g.addColorStop(0.13, "rgba(255,255,255,.9)");
    g.addColorStop(0.35, "rgba(255,255,255,.2)");
    g.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 64, 64);
    return new THREE.CanvasTexture(c);
  }
  const glow = glowTexture();
  function lamp(parent, pos, color, size) {
    const sprite = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: glow,
        color,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    );
    sprite.position.set(...pos);
    sprite.scale.set(size, size, 1);
    parent.add(sprite);
    return sprite;
  }
  function ship(index) {
    const g = new THREE.Group(),
      shape = new THREE.Shape();
    shape.moveTo(-43, -7);
    shape.lineTo(29, -7);
    shape.lineTo(43, 0);
    shape.lineTo(29, 7);
    shape.lineTo(-43, 7);
    shape.closePath();
    const geo = new THREE.ExtrudeGeometry(shape, {
      depth: 3,
      bevelEnabled: true,
      bevelSize: 0.4,
      bevelThickness: 0.3,
      bevelSegments: 1,
      steps: 1,
    });
    geo.rotateX(Math.PI / 2);
    const hull = new THREE.Mesh(geo, mats.hull);
    hull.position.y = 3;
    g.add(hull);
    box(g, [65, 0.5, 12], [-4, 3.2, 0], mats.deck);
    box(g, [11, 7, 11], [-31, 7, 0], mats.white);
    box(g, [12, 1.5, 11.5], [-30.5, 9, 0], mats.glass);
    box(g, [13, 0.5, 12], [-31, 10, 0], mats.white);
    const colors = [0x6b847d, 0x9e5940, 0xb49354, 0x3e656e];
    for (let j = 0; j < 4; j++) {
      const m = new THREE.MeshStandardMaterial({
        color: colors[(j + index) % 4],
        roughness: 0.78,
      });
      box(g, [12, 5, 9], [-15 + j * 13, 6, 0], m);
      for (let k = 0; k < 5; k++)
        box(g, [0.14, 4.7, 9.06], [-20 + j * 13 + k * 2.3, 6, 0], mats.dark);
    }
    box(g, [0.35, 7, 0.35], [-30, 13, 0], mats.dark);
    box(g, [3.7, 0.22, 0.3], [-30, 16, 0], mats.white);
    box(g, [3, 4, 2.5], [-38, 12, -2], mats.dark);
    for (const side of [-1, 1]) {
      box(g, [78, 0.12, 0.12], [-3, 4.9, side * 6.8], mats.white);
      for (let x = -40; x < 35; x += 8)
        box(g, [0.12, 1.4, 0.12], [x, 4.2, side * 6.8], mats.white);
    }
    lamp(g, [-28, 10, 6], 0xff4f35, 2.3);
    lamp(g, [-28, 10, -6], 0x7affc1, 2.3);
    lamp(g, [-30, 16.8, 0], 0xffe5b0, 2);
    // Combine rigid parts by material; navigation lamps remain separate sprites.
    const batches = new Map();
    for (const part of [...g.children])
      if (part.isMesh) {
        part.updateMatrix();
        let geometry = part.geometry.clone().applyMatrix4(part.matrix);
        if (geometry.index) geometry = geometry.toNonIndexed();
        if (!batches.has(part.material)) batches.set(part.material, []);
        batches.get(part.material).push(geometry);
        g.remove(part);
        part.geometry.dispose();
      }
    for (const [mat, geometries] of batches) {
      const merged = mergeGeometries(geometries);
      g.add(new THREE.Mesh(merged, mat));
      geometries.forEach((geometry) => geometry.dispose());
    }
    g.scale.setScalar([1.0, 0.85, 1.12, 0.68][index]);
    g.name = `Moving river vessel ${index + 1}`;
    scene.add(g);
    return g;
  }
  const ships = Array.from({ length: 4 }, (_, i) => ({
    mesh: ship(i),
    start: [2270, 3100, 1580, 4200][i],
    lane: [180, 370, 630, 920][i],
    speed: [4.8, -3.9, 5.2, -4.3][i],
  }));
  const beacon = new THREE.Group();
  beacon.position.set(beaconPlace.x, 0, beaconPlace.z);
  beacon.name = "Riverside beacon — animated scenic addition";
  scene.add(beacon);
  const red = new THREE.MeshStandardMaterial({
    color: 0x9c493a,
    roughness: 0.7,
  });
  function cylinder(radiusTop, radiusBottom, height, y, mat) {
    const m = new THREE.Mesh(
      new THREE.CylinderGeometry(radiusTop, radiusBottom, height, 16),
      mat,
    );
    m.position.y = y;
    beacon.add(m);
    return m;
  }
  cylinder(5, 6, 6, 3, mats.dark);
  cylinder(2.1, 2.7, 7, 9.5, mats.white);
  cylinder(1.8, 2.1, 5, 15.5, red);
  cylinder(2.5, 2.5, 0.6, 18.3, mats.white);
  cylinder(
    1.55,
    1.55,
    2.6,
    20,
    new THREE.MeshStandardMaterial({
      color: 0xabc7bc,
      transparent: true,
      opacity: 0.16,
      roughness: 0.15,
      depthWrite: false,
    }),
  );
  const bulb = new THREE.Mesh(
    new THREE.SphereGeometry(0.45, 12, 8),
    new THREE.MeshBasicMaterial({ color: 0xffdda3, toneMapped: false }),
  );
  bulb.position.y = 20.3;
  beacon.add(bulb);
  cylinder(0, 2.4, 1.8, 22.1, red);
  for (let i = 0; i < 10; i++) {
    const angle = (i * Math.PI) / 5;
    box(
      beacon,
      [0.1, 1.1, 0.1],
      [Math.cos(angle) * 2.4, 19, Math.sin(angle) * 2.4],
      mats.dark,
    );
  }
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(2.4, 0.075, 5, 32),
    mats.dark,
  );
  ring.rotation.x = Math.PI / 2;
  ring.position.y = 19.5;
  beacon.add(ring);
  const lens = lamp(beacon, [0, 20.3, 0], 0xffdba0, 9),
    light = new THREE.PointLight(0xffce80, 65, 45, 2);
  light.position.y = 20;
  beacon.add(light);
  const rotor = new THREE.Group();
  rotor.position.y = 20.3;
  beacon.add(rotor);
  const cone = new THREE.Mesh(
    new THREE.ConeGeometry(24, 260, 20, 1, true),
    new THREE.MeshBasicMaterial({
      color: 0xffdaa2,
      transparent: true,
      opacity: 0.04,
      side: THREE.DoubleSide,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    }),
  );
  cone.rotation.z = Math.PI / 2;
  cone.position.x = 130;
  rotor.add(cone);
  const spot = new THREE.SpotLight(0xffdba0, 16000, 500, 0.1, 0.7, 1);
  spot.target.position.set(300, 0, 0);
  rotor.add(spot, spot.target);
  // A few distant, continuously circling birds give scale to the broad water.
  const bg = new THREE.BufferGeometry();
  bg.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(
      [-2, 0, 0, 0, 0.25, 0.25, 0, 0, -0.4, 0, 0, -0.4, 0, 0.25, 0.25, 2, 0, 0],
      3,
    ),
  );
  bg.computeVertexNormals();
  const birdMat = new THREE.MeshStandardMaterial({
    color: 0xe7e3cf,
    side: THREE.DoubleSide,
    roughness: 0.95,
  });
  birdMat.onBeforeCompile = (s) => {
    s.uniforms.riverTime = shared.time;
    s.vertexShader = "uniform float riverTime;\n" + s.vertexShader;
    s.vertexShader = s.vertexShader.replace(
      "#include <begin_vertex>",
      "#include <begin_vertex>\ntransformed.y+=sin(riverTime*3.2+instanceMatrix[3].x)*abs(position.x)*.34;",
    );
  };
  const birds = new THREE.InstancedMesh(bg, birdMat, 14);
  birds.frustumCulled = false;
  scene.add(birds);
  const dummy = new THREE.Object3D();
  let stats = {};
  function update(t, weather, camera) {
    let closest = { distance: Infinity, pan: 0 };
    ships.forEach((s, i) => {
      const distance =
          (((s.start + s.speed * t) % route.length) + route.length) %
          route.length,
        p = route.sample(distance, s.lane),
        sign = Math.sign(s.speed);
      s.mesh.position.set(
        p.x,
        0.12 + Math.sin(t * 0.8 + i) * (0.08 + weather.storm * 0.18),
        p.z,
      );
      s.mesh.rotation.set(
        Math.sin(t * 0.65 + i) * 0.006 * (1 + weather.storm * 2),
        -Math.atan2(p.dz * sign, p.dx * sign),
        Math.sin(t * 0.9 + i) * 0.007,
      );
      shipUniforms[i].set(p.x, p.z, p.dx * sign, p.dz * sign);
      const d = camera.position.distanceTo(s.mesh.position);
      if (d < closest.distance) {
        const right = new THREE.Vector3(1, 0, 0).applyQuaternion(
          camera.quaternion,
        );
        closest = {
          distance: d,
          pan: THREE.MathUtils.clamp(
            s.mesh.position.clone().sub(camera.position).normalize().dot(right),
            -1,
            1,
          ),
        };
      }
    });
    rotor.rotation.y = t * 0.65;
    const eye = Math.atan2(
        camera.position.z - beacon.position.z,
        camera.position.x - beacon.position.x,
      ),
      alignment = Math.pow(Math.max(0, Math.cos(eye + rotor.rotation.y)), 20),
      night = 0.16 + weather.sunset * 0.7 + weather.storm * 0.6;
    uniforms.beaconPower.value = night * (0.22 + alignment * 1.6);
    lens.material.opacity = 0.3 + alignment * 0.7;
    lens.scale.setScalar(7 + alignment * 9);
    cone.material.opacity = night * (0.008 + alignment * 0.025);
    light.intensity = 50 + alignment * 180;
    spot.intensity = 16000 * night;
    for (let i = 0; i < 14; i++) {
      const phase = t * 0.045 + i * 2.4,
        center = route.sample(2350 + i * 14, 100);
      dummy.position.set(
        center.x + Math.cos(phase) * 70,
        26 + Math.sin(phase * 0.7 + i) * 8,
        center.z + Math.sin(phase) * 42,
      );
      dummy.rotation.set(0, -phase, Math.sin(phase) * 0.12);
      dummy.scale.setScalar(0.7 + (i % 3) * 0.14);
      dummy.updateMatrix();
      birds.setMatrixAt(i, dummy.matrix);
    }
    birds.instanceMatrix.needsUpdate = true;
    birds.visible = weather.storm < 0.8;
    stats = {
      ships: ships.map((s) => s.mesh.position.toArray()),
      beaconRotation: rotor.rotation.y,
      beaconPulse: alignment,
      birds: birds.count,
      riverTime: t,
    };
    return closest;
  }
  return {
    water,
    update,
    getStats: () => stats,
    watchView(aspect = 1.6) {
      const p = route.sample(2355, 0);
      return {
        position: new THREE.Vector3(p.x, p.y + 1.7, p.z),
        target: new THREE.Vector3(
          beacon.position.x - (aspect < 1 ? 0 : 50),
          11.5,
          beacon.position.z - (aspect < 1 ? 0 : 45),
        ),
      };
    },
  };
}
