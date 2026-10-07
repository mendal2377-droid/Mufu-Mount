// Shared by the browser test and its positive control: the distance from the camera to the
// nearest model surface, evaluated in the page. Surfaces more than .6 m away report Infinity.
export const surfaceClearance = (opts = {}) => {
    const m = window.__mufu, out = [];
    const meshes = [];
    m.city.scene.traverse(o => { if (o.isMesh && /Nanjing atlas|continuous relief/.test(o.name) && !/water/.test(o.name)) meshes.push(o); });
    for (const p of m.city.places.filter(q => q.kind !== 'mount' && (!opts.only || q.id === opts.only))) {
      m.city.enter(p.id); m.step(2, .1);
      if (opts.shift) m.camera.position.x += opts.shift[0], m.camera.position.y += opts.shift[1], m.camera.position.z += opts.shift[2];
      const P = m.camera.position, px = P.x, py = P.y, pz = P.z;
      let nearest = Infinity, where = '';
      for (const o of meshes) {
        const a = o.geometry.attributes.position, idx = o.geometry.index, n = idx ? idx.count : a.count;
        for (let t = 0; t < n; t += 3) {
          const i0 = idx ? idx.getX(t) : t, i1 = idx ? idx.getX(t + 1) : t + 1, i2 = idx ? idx.getX(t + 2) : t + 2;
          const ax = a.getX(i0), ay = a.getY(i0), az = a.getZ(i0), bx = a.getX(i1), by = a.getY(i1), bz = a.getZ(i1), cx = a.getX(i2), cy = a.getY(i2), cz = a.getZ(i2);
          if (px < Math.min(ax, bx, cx) - .6 || px > Math.max(ax, bx, cx) + .6 || py < Math.min(ay, by, cy) - .6 || py > Math.max(ay, by, cy) + .6 || pz < Math.min(az, bz, cz) - .6 || pz > Math.max(az, bz, cz) + .6) continue;
          // distance from the point to the triangle's plane, if it projects inside the triangle
          const ux = bx - ax, uy = by - ay, uz = bz - az, vx = cx - ax, vy = cy - ay, vz = cz - az;
          let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx; const nl = Math.hypot(nx, ny, nz); if (nl < 1e-9) continue;
          nx /= nl; ny /= nl; nz /= nl;
          const d = Math.abs((px - ax) * nx + (py - ay) * ny + (pz - az) * nz);
          const qx = px - nx * d * Math.sign((px - ax) * nx + (py - ay) * ny + (pz - az) * nz), qy = py - ny * d * Math.sign((px - ax) * nx + (py - ay) * ny + (pz - az) * nz), qz = pz - nz * d * Math.sign((px - ax) * nx + (py - ay) * ny + (pz - az) * nz);
          const wx = qx - ax, wy = qy - ay, wz = qz - az;
          const d00 = ux * ux + uy * uy + uz * uz, d01 = ux * vx + uy * vy + uz * vz, d11 = vx * vx + vy * vy + vz * vz, d20 = wx * ux + wy * uy + wz * uz, d21 = wx * vx + wy * vy + wz * vz;
          const den = d00 * d11 - d01 * d01; if (!den) continue;
          const bv = (d11 * d20 - d01 * d21) / den, bw = (d00 * d21 - d01 * d20) / den;
          if (bv >= -.05 && bw >= -.05 && bv + bw <= 1.05 && d < nearest) { nearest = d; where = o.name; }
        }
      }
      out.push({id: p.id, nearest, where});
    }
    return out;
  };
