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
      /**
       * How much of the vehicle's current lift the camera rides, 0 → 1.
       *
       * The assembly floats off the floor while it is apart, so a beat
       * framing a specific part has to travel with it or it ends up
       * shooting at the empty air the part used to occupy. Beats framing
       * the whole assembly want less than 1, so the rise stays visible.
       *
       * Expressed as a fraction rather than baked into `py`/`ly` because
       * the lift is scaled by `explodeScale` on small screens.
       */
      rise: 0,
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
    /** Scales every idle motion — drift, breathing, parallax. */
    this._motion = 1;

    // Establishes _frameScale / _fovScale for the starting viewport.
    this.resize(aspect);

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

    /* ---- portrait framing ----------------------------------------
       `fov` is the vertical field, so a tall viewport does not crop the
       top and bottom of the desktop frame — it keeps them and throws
       away the sides. Every beat here is composed across the frame (a
       flank, an axle line, a cockpit seen from the shoulder), so on a
       phone the subject falls out of shot sideways.

       Compensated in two parts, because doing it with either one alone
       is worse than doing it with both: the lens opens up a little, and
       the camera dollies back along its own view axis. Widening far
       enough on its own would need ~95° of vertical field, which turns
       a 32mm composition into a fisheye and undoes the reason the beats
       use a long lens at all.

       And on a phone the copy owns the lower half of the screen, so the
       subject is also pushed up out of it: the look point drops, which
       tilts the camera down and lifts the vehicle into the empty top of
       the frame rather than leaving it behind the type.               */

    const REF = 16 / 9;
    const tall = Math.max(REF / aspect, 1);
    this._frameScale = Math.min(1 + (tall - 1) * 0.22, 1.55);
    this._fovScale = Math.min(1 + (tall - 1) * 0.16, 1.45);
    /** Fraction of the half-frame the subject rides above centre. */
    this._highShot = Math.min((tall - 1) * 0.22, 0.42);

    this.camera.updateProjectionMatrix();
  }

  /** The authored lens, opened up for the current viewport shape. */
  _framedFov(fov) {
    return fov * (this._fovScale ?? 1);
  }

  /**
   * Reshapes one beat for the current viewport: dolly back about the
   * look point, then drop the look point so the subject sits high.
   * A no-op at 16:9 and wider.
   */
  _frame(pos, look, fov) {
    if (this._frameScale <= 1) return;

    pos.sub(look).multiplyScalar(this._frameScale).add(look);

    if (this._highShot > 0) {
      const half = pos.distanceTo(look) * Math.tan(THREE.MathUtils.degToRad(this._framedFov(fov)) / 2);
      look.y -= half * this._highShot;
    }
  }

  /**
   * Small screens get less of every idle motion. The same angular drift
   * covers far more of a narrow frame, where it stops reading as a slow
   * push and starts reading as drag inertia.
   */
  setMotionScale(scale) {
    this._motion = scale;
  }

  /**
   * @param dt    seconds since the last frame
   * @param lift  world height the vehicle is currently floating at
   */
  update(dt, lift = 0) {
    this._time += dt;
    const t = this.target;
    this._lift = lift;

    // Frame-rate independent damping. Rate is in "e-folds per second",
    // so the feel is identical at 60, 120 or a stuttering 30.
    const chase = 1 - Math.exp(-dt * 2.6);
    const pointerChase = 1 - Math.exp(-dt * 2.0);

    this._pointerEased.lerp(this._pointer, pointerChase);

    // Beat positions are authored against the vehicle at rest; `rise`
    // adds back however far it has floated by this point in the film.
    const rise = lift * t.rise;
    this._desiredPos.set(t.px, t.py + rise, t.pz);
    this._desiredLook.set(t.lx, t.ly + rise, t.lz);

    this._frame(this._desiredPos, this._desiredLook, t.fov);

    /* ---- slow orbital drift ------------------------------------- */

    const drift = t.drift * this._motion;

    if (drift > 0.001) {
      // A drift, not an orbit: it returns, so it can never fight the
      // scroll choreography or leave the car facing the wrong way.
      const a = Math.sin(this._time * 0.062) * 0.075 * drift;
      const s = Math.sin(a);
      const c = Math.cos(a);

      const dx = this._desiredPos.x - this._desiredLook.x;
      const dz = this._desiredPos.z - this._desiredLook.z;
      this._desiredPos.x = this._desiredLook.x + dx * c - dz * s;
      this._desiredPos.z = this._desiredLook.z + dx * s + dz * c;
      this._desiredPos.y += Math.sin(this._time * 0.083) * 0.11 * drift;
    }

    // Breathing — sub-perceptual, but its absence is felt as "locked".
    this._desiredPos.y += Math.sin(this._time * 0.31) * 0.012 * this._motion;
    this._desiredPos.x += Math.sin(this._time * 0.24 + 1.7) * 0.010 * this._motion;

    /* ---- mouse parallax ------------------------------------------ */

    if (t.parallax > 0.001) {
      this._forward.subVectors(this._desiredLook, this._desiredPos).normalize();
      this._right.crossVectors(this._forward, this._worldUp).normalize();
      this._up.crossVectors(this._right, this._forward).normalize();

      const amt = 0.26 * t.parallax * this._motion;
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

    const fov = this._framedFov(t.fov);
    if (Math.abs(this.camera.fov - fov) > 0.01) {
      this.camera.fov += (fov - this.camera.fov) * chase;
      this.camera.updateProjectionMatrix();
    }
  }

  /** Snap with no easing — the loader handover, and the dev seek hook. */
  jumpToTarget(lift = this._lift ?? 0) {
    const t = this.target;
    const rise = lift * t.rise;
    this._look.set(t.lx, t.ly + rise, t.lz);
    this._pos.set(t.px, t.py + rise, t.pz);
    this._frame(this._pos, this._look, t.fov);

    this.camera.position.copy(this._pos);
    this.camera.lookAt(this._look);

    // Without this the lens keeps easing after a snap, which makes a
    // seeked frame disagree with the same frame reached by scrolling.
    this.camera.fov = this._framedFov(t.fov);
    this.camera.updateProjectionMatrix();
  }
}
