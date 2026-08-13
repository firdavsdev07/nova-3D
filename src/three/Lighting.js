import * as THREE from 'three';
import { PALETTE } from './Materials.js';

/* ------------------------------------------------------------------
   Lighting

   A car render lives or dies on what it reflects, not on how many
   lights point at it. So the environment is built first — a procedural
   photo studio of emissive strips, baked to a PMREM probe — and the
   real lights only add shadow and a little directional bite on top.

   The long strips overhead are the whole trick: they are what draws
   the continuous highlight down the flank of the car and makes the
   clearcoat read as depth rather than gloss.
   ------------------------------------------------------------------ */

const DOME_VERT = /* glsl */ `
  varying vec3 vPos;
  void main() {
    vPos = position;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const DOME_FRAG = /* glsl */ `
  varying vec3 vPos;
  uniform vec3 uFloor;
  uniform vec3 uHorizon;
  uniform vec3 uSky;
  void main() {
    float h = normalize(vPos).y;
    vec3 c = mix(uFloor, uHorizon, smoothstep(-0.55, 0.0, h));
    c = mix(c, uSky, smoothstep(0.0, 0.75, h));
    gl_FragColor = vec4(c, 1.0);
  }
`;

/** An emissive softbox. Double-sided so placement never needs aiming. */
function panel(w, h, position, rotation, intensity, tint = [1, 1, 1]) {
  const mat = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide, toneMapped: false });
  mat.color.setRGB(tint[0] * intensity, tint[1] * intensity, tint[2] * intensity);

  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
  mesh.position.set(...position);
  if (rotation) mesh.rotation.set(...rotation);
  return mesh;
}

/**
 * The studio, as a scene to be captured into an irradiance probe.
 * Nothing here is ever rendered to screen.
 */
function buildStudio() {
  const studio = new THREE.Scene();

  const dome = new THREE.Mesh(
    new THREE.SphereGeometry(45, 24, 16),
    new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      toneMapped: false,
      vertexShader: DOME_VERT,
      fragmentShader: DOME_FRAG,
      uniforms: {
        uFloor: { value: new THREE.Color(0x040506) },
        uHorizon: { value: new THREE.Color(0x0b0d10) },
        uSky: { value: new THREE.Color(0x161a20) },
      },
    })
  );
  studio.add(dome);

  const FLAT = [-Math.PI / 2, 0, 0];

  studio.add(
    // Two long overhead strips running the length of the car — the
    // signature automotive highlight.
    panel(1.8, 28, [3.4, 9, 0], FLAT, 5.5),
    panel(1.8, 28, [-3.4, 9, 0], FLAT, 4.2),

    // Broad, dim ceiling so the upper surfaces are never pure black.
    panel(24, 24, [0, 16, 0], FLAT, 0.55),

    // Front key — shapes the nose and the windscreen.
    panel(9, 5, [2.2, 4.5, 13], null, 2.6, [1, 0.97, 0.92]),

    // Rear rim pair — separates the shoulders from the void.
    panel(5, 4, [8, 3.5, -9.5], null, 3.4, [0.84, 0.9, 1]),
    panel(5, 4, [-8, 3.5, -9.5], null, 2.6, [0.84, 0.9, 1]),

    // Vertical side strip — lays a highlight down the doors.
    panel(1.6, 18, [11, 3.5, 0], [0, Math.PI / 2, 0], 1.8),
    panel(1.6, 18, [-11, 3.5, 0], [0, Math.PI / 2, 0], 1.4),

    // Low front fill — lifts the sills and the wheel faces out of black.
    panel(15, 1.4, [0, 0.45, 9], null, 1.1, [1, 0.96, 0.9])
  );

  return studio;
}

/** Radial gradient, used for both the ground falloff and the contact shadow. */
function radialTexture(inner, outer, stops = 0.55) {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(128, 128, 0, 128, 128, 128);
  g.addColorStop(0, inner);
  g.addColorStop(stops, inner);
  g.addColorStop(1, outer);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 256, 256);

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function setupLighting(scene, renderer, { quality }) {
  const disposables = [];

  /* ------------------------------------------------ environment probe */

  const pmrem = new THREE.PMREMGenerator(renderer);
  pmrem.compileEquirectangularShader();

  const studio = buildStudio();
  const envRT = pmrem.fromScene(studio, 0.035);
  scene.environment = envRT.texture;
  scene.background = null;

  studio.traverse((o) => {
    if (o.geometry) o.geometry.dispose();
    if (o.material) o.material.dispose();
  });
  pmrem.dispose();
  disposables.push(envRT);

  // Atmospheric depth — enough to feel air in the room, not enough to
  // wash the car at hero distance.
  scene.fog = new THREE.FogExp2(0x08090a, 0.026);

  /* --------------------------------------------------------- lights */

  const key = new THREE.DirectionalLight(0xfff3e6, 2.4);
  key.position.set(5.5, 8, 6.5);
  key.castShadow = true;
  key.shadow.mapSize.set(quality.shadowMap, quality.shadowMap);
  key.shadow.camera.near = 1;
  key.shadow.camera.far = 26;
  key.shadow.camera.left = -4;
  key.shadow.camera.right = 4;
  key.shadow.camera.top = 4;
  key.shadow.camera.bottom = -4;
  key.shadow.bias = -0.0004;
  key.shadow.normalBias = 0.022;
  key.shadow.radius = 3;
  scene.add(key, key.target);

  const rim = new THREE.DirectionalLight(0xc2d4ec, 1.9);
  rim.position.set(-6.5, 4, -7.5);
  scene.add(rim);

  const fill = new THREE.DirectionalLight(0xffffff, 0.3);
  fill.position.set(-3.5, 1.6, 8);
  scene.add(fill);

  // Follows the component under inspection. Idle at zero intensity so it
  // costs nothing until a focus beat calls for it.
  const focus = new THREE.PointLight(PALETTE.accent, 0, 4.2, 2);
  scene.add(focus);

  /* --------------------------------------------------------- ground */

  const groundMap = radialTexture('#16191d', '#08090a', 0.12);
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(80, 80),
    new THREE.MeshStandardMaterial({
      map: groundMap,
      roughness: 0.58,
      metalness: 0.18,
      envMapIntensity: 0.45,
    })
  );
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);
  disposables.push(ground.geometry, ground.material, groundMap);

  // A painted contact shadow under the car. The shadow map alone leaves
  // the vehicle looking a few millimetres off the floor.
  const contactMap = radialTexture('rgba(0,0,0,0.85)', 'rgba(0,0,0,0)', 0.18);
  const contact = new THREE.Mesh(
    new THREE.PlaneGeometry(7.5, 4.6),
    new THREE.MeshBasicMaterial({
      map: contactMap,
      transparent: true,
      opacity: 0.9,
      depthWrite: false,
      toneMapped: false,
    })
  );
  contact.rotation.x = -Math.PI / 2;
  contact.position.y = 0.004;
  contact.renderOrder = -1;
  scene.add(contact);
  disposables.push(contact.geometry, contact.material, contactMap);

  return {
    key,
    rim,
    fill,
    focus,
    ground,
    contact,

    /** Drives the accent light that picks out whichever part is in focus. */
    setFocus(x, y, z, intensity) {
      focus.position.set(x, y, z);
      focus.intensity = intensity;
    },

    /**
     * Follows a quality-tier change. Disposing the old map forces three
     * to allocate at the new size on the next shadow pass — without it
     * the resolution field is ignored for the life of the light.
     */
    setShadowResolution(size) {
      if (key.shadow.mapSize.width === size) return;
      key.shadow.mapSize.set(size, size);
      key.shadow.map?.dispose();
      key.shadow.map = null;
    },

    dispose() {
      scene.environment = null;
      scene.fog = null;
      for (const d of disposables) d.dispose?.();
      scene.remove(key, key.target, rim, fill, focus, ground, contact);
    },
  };
}
