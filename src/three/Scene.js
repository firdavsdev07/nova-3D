import * as THREE from 'three';

import { CameraRig } from './Camera.js';
import { setupLighting } from './Lighting.js';
import { Vehicle } from './Vehicle.js';
import { ANNOTATIONS } from './VehicleParts.js';

/* ------------------------------------------------------------------
   Experience

   Owns the renderer, the loop and the lifecycle. React never touches
   any of this — it mounts a canvas, hands over a state object, and
   stays out of the way. The scroll timeline writes to `state`; this
   file reads it, once per frame.
   ------------------------------------------------------------------ */

/** Triangular presence curve over a scroll window, with soft shoulders. */
function fadeWindow(progress, [from, to], edge = 0.022) {
  if (progress <= from - edge || progress >= to + edge) return 0;
  const rise = (progress - (from - edge)) / edge;
  const fall = (to + edge - progress) / edge;
  return Math.max(0, Math.min(1, rise, fall));
}

function detectQuality() {
  const coarse = window.matchMedia('(pointer: coarse)').matches;
  const narrow = window.innerWidth < 820;
  const mobile = coarse || narrow;

  return {
    mobile,
    // Beyond 2x the cost is real and the gain is not visible.
    pixelRatio: Math.min(window.devicePixelRatio, mobile ? 1.5 : 2),
    shadowMap: mobile ? 1024 : 2048,
    antialias: !mobile,
    // Shorter throws on small screens keep parts inside the frame.
    explodeScale: mobile ? 0.72 : 1,
  };
}

export class Experience {
  constructor(canvas) {
    this.canvas = canvas;
    this.quality = detectQuality();
    this.running = false;
    this.ready = false;

    /* ---------------------------------------------------- renderer */

    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: this.quality.antialias,
      powerPreference: 'high-performance',
      alpha: false,
      stencil: false,
    });
    this.renderer.setPixelRatio(this.quality.pixelRatio);
    this.renderer.setSize(window.innerWidth, window.innerHeight, false);
    this.renderer.setClearColor(0x08090a, 1);
    this.renderer.shadowMap.enabled = true;
    // PCFSoft is deprecated in current three; softness comes from
    // shadow.radius on the key light instead.
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1;

    this.scene = new THREE.Scene();
    this.rig = new CameraRig(window.innerWidth / window.innerHeight);
    this.lighting = setupLighting(this.scene, this.renderer, { quality: this.quality });

    /* ------------------------------------------------------- state
       The single surface the scroll timeline writes to.            */

    this.state = {
      cam: this.rig.target,
      explode: {
        wheel: 0,
        rimShell: 0,
        brakeCore: 0,
        door: 0,
        hood: 0,
        roof: 0,
        glass: 0,
        pillars: 0,
        rear: 0,
        lower: 0,
        engine: 0,
        chassis: 0,
        cabin: 0,
      },
      lift: 0,
      /** Scroll progress, written by ScrollTrigger. Drives label presence. */
      progress: 0,
      /** 0 → 1 across the teardown; read by the audio bed. */
      disassembly: 0,
      focus: { x: 0, y: 0.6, z: 0, intensity: 0 },
      exposure: 1,
    };

    this.vehicle = null;

    /* -------------------------------------------------- annotations */

    this.annotations = ANNOTATIONS.map((a) => ({
      ...a,
      el: null,
      offset: new THREE.Vector3(...a.offset),
    }));
    this._projected = new THREE.Vector3();

    this._last = 0;
    this._onResize = this._resize.bind(this);
    this._onPointer = this._pointer.bind(this);
    this._loop = this._frame.bind(this);

    window.addEventListener('resize', this._onResize, { passive: true });
    window.addEventListener('pointermove', this._onPointer, { passive: true });
  }

  async load(onProgress) {
    // Explode throws are authored for desktop framing and scaled down
    // rather than removed on small screens.
    this.vehicle = new Vehicle({ explodeScale: this.quality.explodeScale });
    await this.vehicle.load(onProgress);
    this.scene.add(this.vehicle.container);

    this.ready = true;
    return this.vehicle;
  }

  /** Called by React once the annotation elements exist. */
  bindAnnotation(id, el) {
    const a = this.annotations.find((x) => x.id === id);
    if (a) a.el = el;
  }

  start() {
    if (this.running) return;
    this.running = true;
    this._last = performance.now();
    this._raf = requestAnimationFrame(this._loop);
  }

  stop() {
    this.running = false;
    if (this._raf) cancelAnimationFrame(this._raf);
  }

  _pointer(event) {
    this.rig.setPointer(
      (event.clientX / window.innerWidth) * 2 - 1,
      -((event.clientY / window.innerHeight) * 2 - 1)
    );
  }

  _resize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    // Re-evaluate the tier: a desktop window can be dragged to phone width.
    this.quality.pixelRatio = Math.min(window.devicePixelRatio, this.quality.mobile ? 1.5 : 2);
    this.renderer.setPixelRatio(this.quality.pixelRatio);
    this.renderer.setSize(w, h, false);
    this.rig.resize(w / h);
  }

  _frame(now) {
    if (!this.running) return;
    this._raf = requestAnimationFrame(this._loop);

    // A tab returning from the background must not deliver a 4-second
    // delta into the dampers.
    const dt = Math.min((now - this._last) / 1000, 1 / 30);
    this._last = now;
    const { state } = this;

    this.rig.update(dt);

    if (this.vehicle) this.vehicle.update(state);

    this.lighting.setFocus(state.focus.x, state.focus.y, state.focus.z, state.focus.intensity);
    // The contact shadow belongs to a car on the floor, not to an
    // assembly floating in a void.
    this.lighting.contact.material.opacity = 0.9 * (1 - Math.min(state.lift / 0.4, 1));
    this.renderer.toneMappingExposure = state.exposure;

    this._updateAnnotations();
    this.renderer.render(this.scene, this.rig.camera);
  }

  _updateAnnotations() {
    if (!this.vehicle) return;

    const camera = this.rig.camera;
    const progress = this.state.progress;
    const w = window.innerWidth;
    const h = window.innerHeight;

    for (const a of this.annotations) {
      if (!a.el) continue;

      const presence = fadeWindow(progress, a.range);
      if (presence <= 0.001) {
        // Fully out: stop projecting it entirely.
        if (a.el.style.visibility !== 'hidden') {
          a.el.style.visibility = 'hidden';
          a.el.style.opacity = '0';
        }
        continue;
      }

      if (!this.vehicle.anchorOf(a.anchor, this._projected)) continue;

      this._projected.add(a.offset);
      this._projected.project(camera);

      // Behind the camera, or pushed out of frame by a close-up.
      const off = this._projected.z > 1 || Math.abs(this._projected.x) > 1.05;

      a.el.style.visibility = 'visible';
      a.el.style.opacity = off ? '0' : presence.toFixed(3);

      const x = (this._projected.x * 0.5 + 0.5) * w;
      const y = (-this._projected.y * 0.5 + 0.5) * h;
      a.el.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0)`;
    }
  }

  dispose() {
    this.stop();
    window.removeEventListener('resize', this._onResize);
    window.removeEventListener('pointermove', this._onPointer);

    this.vehicle?.dispose();
    this.lighting.dispose();
    this.renderer.dispose();
  }
}
