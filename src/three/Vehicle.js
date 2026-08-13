import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';

import { applyMaterials } from './Materials.js';
import { EXPLODE, classify, classifyWheelChild } from './VehicleParts.js';

/* ------------------------------------------------------------------
   Vehicle

   Loading, and then one structural change that the whole experience
   depends on.

   The source asset parents every single part under the chassis mesh:

       BodyUnderside  (a mesh, and also the root)
         ├─ BodyHood ─ headlights, grille
         ├─ BodyDoorLColor1 ─ glass, mirror, handle, door card
         ├─ WheelFrontL ─ rim, tyre, disc, caliper
         └─ … 40 more

   Which means moving the chassis moves the entire car, and the chassis
   can never move independently of it. So on load every direct child is
   re-attached to a neutral root (`attach` preserves world transforms),
   leaving the chassis as a sibling of the parts it used to own. Nested
   sub-parts stay where they are — a door still carries its own glass.
   ------------------------------------------------------------------ */

const MODEL_URL = '/models/nova-vehicle.glb';

/**
 * Stream the GLB so the loading screen can report real bytes rather
 * than a fabricated curve. Falls back to a plain fetch if the server
 * does not report a length.
 */
async function fetchWithProgress(url, onProgress) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Vehicle asset failed to load (${res.status})`);

  const total = Number(res.headers.get('content-length')) || 0;
  if (!total || !res.body) {
    onProgress(0.85);
    return res.arrayBuffer();
  }

  const reader = res.body.getReader();
  const chunks = [];
  let loaded = 0;

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    loaded += value.length;
    onProgress(Math.min(loaded / total, 1));
  }

  const out = new Uint8Array(loaded);
  let at = 0;
  for (const c of chunks) {
    out.set(c, at);
    at += c.length;
  }
  return out.buffer;
}

export class Vehicle {
  constructor({ explodeScale = 1 } = {}) {
    /** Small screens use shorter throws so parts stay in frame. */
    this.explodeScale = explodeScale;

    /** Translated so the car sits centred on the floor. */
    this.container = new THREE.Group();
    this.container.name = 'Vehicle';

    /** Identity space. Part offsets are world-aligned because of this. */
    this.root = new THREE.Group();
    this.root.name = 'VehicleRoot';
    this.container.add(this.root);

    this.parts = [];
    this.byName = new Map();
    this.materials = [];
    this.baseY = 0;
    this.size = new THREE.Vector3();

    this._q = new THREE.Quaternion();
    this._e = new THREE.Euler();
    this._v = new THREE.Vector3();
    this._applied = new Map();
  }

  async load(onProgress) {
    const buffer = await fetchWithProgress(MODEL_URL, onProgress);

    const loader = new GLTFLoader();
    loader.setMeshoptDecoder(MeshoptDecoder);

    const gltf = await new Promise((resolve, reject) => {
      loader.parse(buffer, '', resolve, reject);
    });

    this._build(gltf.scene);
    return this;
  }

  _build(source) {
    source.updateMatrixWorld(true);

    // Flatten the assembly one level: every direct child of the top node
    // becomes an independent sibling under `root`.
    const top = source.children[0];
    const assemblies = [...top.children];

    this.root.updateMatrixWorld(true);
    for (const child of assemblies) this.root.attach(child);
    this.root.attach(top); // the chassis, now just another part

    this.materials = applyMaterials(this.root);

    this.root.traverse((node) => {
      if (!node.isMesh) return;
      const isGlass = node.material?.name === 'Glass';
      // Transparent casters would drop an opaque shadow through the cabin.
      node.castShadow = !isGlass;
      node.receiveShadow = true;
      // Culling stays on through the explode: three tests each mesh
      // against its own bounding sphere transformed by its own
      // matrixWorld, so a part that flies out carries its bounds with
      // it. Turning it off costs all 97 meshes on every close beat,
      // where most of the car is far outside the frame.
      node.frustumCulled = true;
    });

    /* ---- centre on the floor ------------------------------------- */

    this.container.updateMatrixWorld(true);
    const bounds = new THREE.Box3().setFromObject(this.root);
    const centre = bounds.getCenter(new THREE.Vector3());
    bounds.getSize(this.size);

    this.container.position.set(-centre.x, -bounds.min.y, -centre.z);
    this.baseY = this.container.position.y;
    this.container.updateMatrixWorld(true);

    /* ---- register parts ------------------------------------------ */

    for (const obj of this.root.children) {
      const group = classify(obj.name, this._localCentre(obj, centre));
      this._register(obj, group, centre);

      // A wheel is two assemblies: the shell that slides off, and the
      // brake that stays on the hub.
      if (group === 'wheel') {
        for (const sub of obj.children) {
          this._register(sub, classifyWheelChild(sub.name), centre, true);
        }
      }
    }
  }

  /** Bounding-box centre of a node, in the root's space. */
  _localCentre(obj, fallback) {
    const box = new THREE.Box3().setFromObject(obj);
    if (box.isEmpty()) return fallback.clone();
    return this.root.worldToLocal(box.getCenter(new THREE.Vector3()));
  }

  _register(obj, group, vehicleCentre, isChild = false) {
    const centreLocal = this._localCentre(obj, vehicleCentre);

    // Pin point for annotations: the part's visual centre, expressed in
    // its own space so it travels with the part through the explode.
    const worldCentre = this.root.localToWorld(centreLocal.clone());
    const anchor = obj.worldToLocal(worldCentre.clone());

    const part = {
      name: obj.name,
      obj,
      group,
      isChild,
      home: obj.position.clone(),
      homeQuat: obj.quaternion.clone(),
      anchor,
      // Which flank the part belongs to, so one rule serves both sides.
      side: centreLocal.x >= vehicleCentre.x ? 1 : -1,
    };

    this.parts.push(part);
    if (obj.name) this.byName.set(obj.name, part);
  }

  /** World-space pin point for a named part, written into `out`. */
  anchorOf(name, out) {
    const part = this.byName.get(name);
    if (!part) return false;
    out.copy(part.anchor);
    part.obj.localToWorld(out);
    return true;
  }

  /**
   * Apply the current explode state. Called once per frame; the amounts
   * themselves are tweened by the scroll timeline.
   */
  update(state) {
    const amounts = state.explode;
    let moved = false;

    for (const part of this.parts) {
      const rule = EXPLODE[part.group];
      if (!rule) continue;
      const amount = (amounts[part.group] ?? 0) * this.explodeScale;

      // Groups that never move, and groups sitting at rest, cost nothing.
      const last = this._applied.get(part);
      if (last === amount) continue;
      this._applied.set(part, amount);
      moved = true;

      part.obj.position.set(
        part.home.x + rule.out * part.side * amount,
        part.home.y + rule.up * amount,
        part.home.z + rule.fwd * amount
      );

      if (rule.rot) {
        // Delta is pre-multiplied so the part turns about world axes —
        // the source hierarchy bakes a Z-up conversion into every local
        // rotation, which would otherwise send the hood sideways.
        this._e.set(
          rule.rot[0] * amount,
          rule.rot[1] * amount * part.side,
          rule.rot[2] * amount
        );
        this._q.setFromEuler(this._e);
        part.obj.quaternion.copy(this._q).multiply(part.homeQuat);
      }
    }

    // The assembly rises off the floor as it comes apart, which gives
    // the sills somewhere to drop to.
    const y = this.baseY + state.lift * this.explodeScale;
    if (y !== this.container.position.y) {
      this.container.position.y = y;
      moved = true;
    }

    // Reported so the caller can skip work that only geometry motion
    // invalidates — the shadow map, above all.
    return moved;
  }

  dispose() {
    this.root.traverse((node) => {
      if (node.geometry) node.geometry.dispose();
    });
    for (const mat of this.materials) {
      for (const key of ['map', 'normalMap', 'aoMap', 'roughnessMap', 'metalnessMap', 'emissiveMap']) {
        mat[key]?.dispose?.();
      }
      mat.dispose();
    }
    this.parts.length = 0;
    this.byName.clear();
    this._applied.clear();
    this.container.removeFromParent();
  }
}
