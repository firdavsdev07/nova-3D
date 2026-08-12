import * as THREE from 'three';

/* ------------------------------------------------------------------
   Camera rig

   Scroll never moves the camera. Scroll moves a *target*, and the rig
   chases it with critically-damped interpolation. That single
   indirection is what keeps the motion from feeling robotic: the
   timeline can cut hard between beats and the camera still arrives on
   a curve.

   On top of the chase sit two much smaller motions — a slow orbital
   drift so the vehicle is never static, and mouse parallax. Both are
   deliberately under-scaled. Expensive camera work is restrained.
   ------------------------------------------------------------------ */

const FOCAL = 32; // A long lens. Wide angles make cars look like toys.

export class CameraRig {
  constructor(aspect) {
    this.camera = new THREE.PerspectiveCamera(FOCAL, aspect, 0.1, 120);

    /** Written by the scroll timeline. Never read by anything else. */
    this.target = {
      px: 5.0,
      py: 1.35,
      pz: 5.8,
      lx: 0,
      ly: 0.62,
      lz: 0.1,
      fov: FOCAL,
      /** 1 at the hero, 0 once the choreography takes over. */
      drift: 1,
      /** Scales mouse parallax; close-up beats want less of it. */
      parallax: 1,
    };

    this._pos = new THREE.Vector3(this.target.px, this.target.py, this.target.pz);
    this._look = new THREE.Vector3(this.target.lx, this.target.ly, this.target.lz);

    this._pointer = new THREE.Vector2();
    this._pointerEased = new THREE.Vector2();

    this._desiredPos = new THREE.Vector3();
    this._desiredLook = new THREE.Vector3();
    this._right = new THREE.Vector3();
    this._up = new THREE.Vector3();
    this._forward = new THREE.Vector3();
    this._worldUp = new THREE.Vector3(0, 1, 0);

    this._time = 0;

    this.camera.position.copy(this._pos);
    this.camera.lookAt(this._look);
  }

  setPointer(nx, ny) {
    // Clamped to the unit square; a mouse leaving the window must not
    // fling the camera.
    this._pointer.set(THREE.MathUtils.clamp(nx, -1, 1), THREE.MathUtils.clamp(ny, -1, 1));
  }

  resize(aspect) {
    this.camera.aspect = aspect;
    this.camera.updateProjectionMatrix();
  }

  update(dt) {
    this._time += dt;
    const t = this.target;

    // Frame-rate independent damping. Rate is in "e-folds per second",
    // so the feel is identical at 60, 120 or a stuttering 30.
    const chase = 1 - Math.exp(-dt * 2.6);
    const pointerChase = 1 - Math.exp(-dt * 2.0);

    this._pointerEased.lerp(this._pointer, pointerChase);

    this._desiredPos.set(t.px, t.py, t.pz);
    this._desiredLook.set(t.lx, t.ly, t.lz);

    /* ---- slow orbital drift ------------------------------------- */

    if (t.drift > 0.001) {
      // A drift, not an orbit: it returns, so it can never fight the
      // scroll choreography or leave the car facing the wrong way.
      const a = Math.sin(this._time * 0.062) * 0.075 * t.drift;
      const s = Math.sin(a);
      const c = Math.cos(a);

      const dx = this._desiredPos.x - this._desiredLook.x;
      const dz = this._desiredPos.z - this._desiredLook.z;
      this._desiredPos.x = this._desiredLook.x + dx * c - dz * s;
      this._desiredPos.z = this._desiredLook.z + dx * s + dz * c;
      this._desiredPos.y += Math.sin(this._time * 0.083) * 0.11 * t.drift;
    }

    // Breathing — sub-perceptual, but its absence is felt as "locked".
    this._desiredPos.y += Math.sin(this._time * 0.31) * 0.012;
    this._desiredPos.x += Math.sin(this._time * 0.24 + 1.7) * 0.010;

    /* ---- mouse parallax ------------------------------------------ */

    if (t.parallax > 0.001) {
      this._forward.subVectors(this._desiredLook, this._desiredPos).normalize();
      this._right.crossVectors(this._forward, this._worldUp).normalize();
      this._up.crossVectors(this._right, this._forward).normalize();

      const amt = 0.26 * t.parallax;
      this._desiredPos.addScaledVector(this._right, this._pointerEased.x * amt);
      this._desiredPos.addScaledVector(this._up, this._pointerEased.y * amt * 0.6);

      // The look point counter-drifts a fraction of the distance, which
      // reads as the camera turning its head rather than sliding.
      this._desiredLook.addScaledVector(this._right, this._pointerEased.x * amt * -0.16);
    }

    /* ---- apply --------------------------------------------------- */

    this._pos.lerp(this._desiredPos, chase);
    this._look.lerp(this._desiredLook, chase);

    this.camera.position.copy(this._pos);
    this.camera.lookAt(this._look);

    if (Math.abs(this.camera.fov - t.fov) > 0.01) {
      this.camera.fov += (t.fov - this.camera.fov) * chase;
      this.camera.updateProjectionMatrix();
    }
  }

  /** Snap with no easing — used once, when the loader hands over. */
  jumpToTarget() {
    const t = this.target;
    this._pos.set(t.px, t.py, t.pz);
    this._look.set(t.lx, t.ly, t.lz);
    this.camera.position.copy(this._pos);
    this.camera.lookAt(this._look);
  }
}
