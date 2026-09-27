import * as THREE from "three";

/**
 * Walking weight for the camera: a footfall bob, a lean into strafing, a
 * little breathing while you stand still, and a field of view that opens up
 * when you break into a run. The offsets are applied after the controls have
 * had their say and removed again before the next frame, so nothing
 * accumulates into the real position.
 */
export function createCameraFeel(camera, baseFov = 68) {
  const applied = new THREE.Vector3();
  let phase = 0;
  let bob = 0;
  let roll = 0;
  let appliedRoll = 0;
  let fov = baseFov;
  let speedBlend = 0;
  let shake = 0;

  return {
    baseFov,
    get stride() {
      return phase;
    },
    /** True on the frame a foot lands, so a step sound can be triggered. */
    step: false,
    kick(amount = 1) {
      shake = Math.min(1.4, shake + amount);
    },
    /** Undo last frame's offset before the controls move the camera. */
    unapply() {
      camera.position.sub(applied);
      camera.rotation.z -= appliedRoll;
      applied.set(0, 0, 0);
      appliedRoll = 0;
    },
    update(dt, { moving, running, strafe, sprinting }) {
      const wanted = moving ? (running ? 1 : 0.55) : 0;
      speedBlend = THREE.MathUtils.damp(speedBlend, wanted, 6, dt);

      const previous = Math.sin(phase);
      if (moving) phase += dt * (running ? 10.4 : 6.6);
      const now = Math.sin(phase);
      this.step = moving && previous > 0 && now <= 0;

      // Vertical bob is twice the stride frequency; the sideways sway is not.
      const targetBob = speedBlend * 0.055;
      bob = THREE.MathUtils.damp(bob, targetBob, 8, dt);
      const breathe = (1 - speedBlend) * Math.sin(phase * 0.42 + 1.1) * 0.012;

      const targetRoll = -strafe * 0.019 * (0.4 + speedBlend);
      roll = THREE.MathUtils.damp(roll, targetRoll, 5, dt);

      shake = Math.max(0, shake - dt * 2.2);
      const jolt = shake * 0.03;

      applied.set(
        Math.cos(phase) * bob * 0.62 + (Math.random() - 0.5) * jolt,
        Math.abs(now) * bob - bob * 0.45 + breathe + (Math.random() - 0.5) * jolt,
        0,
      );
      // The bob is in view space; rotate it into the world before adding it.
      applied.applyQuaternion(camera.quaternion);
      camera.position.add(applied);

      appliedRoll = roll;
      camera.rotation.z += appliedRoll;

      const targetFov = baseFov + (sprinting ? 5.2 : 0) * speedBlend;
      if (Math.abs(fov - targetFov) > 0.01) {
        fov = THREE.MathUtils.damp(fov, targetFov, 4, dt);
        camera.fov = fov;
        camera.updateProjectionMatrix();
      }
    },
    reset() {
      applied.set(0, 0, 0);
      appliedRoll = 0;
      phase = 0;
      bob = 0;
      roll = 0;
      shake = 0;
    },
  };
}
