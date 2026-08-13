import * as THREE from 'three';

/* ------------------------------------------------------------------
   Materials

   The source asset ships a showroom-red concept car. Everything the
   viewer sees here is re-authored: graphite paint under a clearcoat,
   tinted glass, machined rims, champagne calipers, dark leather.

   Two rules hold for every override:

   1. Maps carry over, values do not. Normal / AO / roughness maps are
      reused from the source (they encode real surface detail); colour,
      metalness and roughness are art direction and are set here.

   2. Emissive is cleared. The source authors the Khronos wordmark as a
      full-strength emissive decal on the hardware, mirror, brake and
      rim materials — see ATTRIBUTION.md. Only the lamps opt back in.
   ------------------------------------------------------------------ */

const PALETTE = {
  accent: 0xbc9a6a,
  paint: 0x14171b,
  paintLower: 0x0c0e11,
  carbon: 0x121418,
  leather: 0x16181c,
  leatherAlt: 0x1c1f24,
  leatherTrim: 0x3b3126,
  rimFace: 0x6e7278,
  rimBarrel: 0x33363b,
  steel: 0x7d8189,
  cast: 0x2a2d33,
  rubber: 0x0a0b0c,
  glass: 0x05070a,
};

/**
 * Build a MeshPhysicalMaterial that inherits the source material's maps
 * but none of its look. Any map slot can be suppressed with `drop`.
 */
/* Physical-only features. A material asking for none of them gets the
   standard shader, which is materially cheaper per fragment — and on a
   car most surfaces (rubber, cast, leather, mats, housings) want nothing
   the standard model does not already give them. */
const PHYSICAL_PROPS = [
  'clearcoat',
  'clearcoatRoughness',
  'transmission',
  'iridescence',
  'sheen',
  'specularIntensity',
];

function derive(source, props = {}, drop = []) {
  const physical = PHYSICAL_PROPS.some((k) => props[k] !== undefined);
  const mat = physical ? new THREE.MeshPhysicalMaterial() : new THREE.MeshStandardMaterial();
  mat.name = source.name;

  // Surface detail worth keeping — these encode geometry, not styling.
  for (const slot of ['normalMap', 'aoMap', 'roughnessMap', 'metalnessMap', 'map']) {
    if (drop.includes(slot)) continue;
    if (source[slot]) mat[slot] = source[slot];
  }
  if (mat.normalMap && source.normalScale) mat.normalScale.copy(source.normalScale);
  if (mat.aoMap) mat.aoMapIntensity = source.aoMapIntensity ?? 1;

  // Branding decal lives in emissive — off unless a lamp asks for it.
  mat.emissive = new THREE.Color(0x000000);
  mat.emissiveMap = null;
  mat.emissiveIntensity = 1;

  // These three are objects on the material but scalars in the override
  // tables, so they are applied by hand rather than assigned over.
  const { color, emissive, normalScale, ...rest } = props;
  Object.assign(mat, rest);

  if (color !== undefined) mat.color.set(color);
  if (emissive !== undefined) mat.emissive.set(emissive);
  if (normalScale !== undefined) mat.normalScale.setScalar(normalScale);

  return mat;
}

/** A lamp: emissive is the point, so the source emissive map is re-enabled only if it is not the decal. */
function lamp(source, color, intensity) {
  return derive(source, {
    color: 0x0b0c0e,
    emissive: color,
    emissiveIntensity: intensity,
    metalness: 0.1,
    roughness: 0.18,
    envMapIntensity: 1.4,
  });
}

/* -------------------------------------------------------- Plate texture */

/**
 * The source plate carries the Khronos wordmark as its base colour map.
 * Replaced with a generated NOVA plate so the mesh can stay in the scene.
 */
function createPlateTexture() {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 128;
  const ctx = c.getContext('2d');

  ctx.fillStyle = '#0d0f12';
  ctx.fillRect(0, 0, 512, 128);

  ctx.strokeStyle = 'rgba(236,232,226,0.22)';
  ctx.lineWidth = 4;
  ctx.strokeRect(10, 10, 492, 108);

  ctx.fillStyle = '#d8d4ce';
  ctx.font = '500 62px Archivo, Inter, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.letterSpacing = '18px';
  ctx.fillText('NOVA', 256, 68);

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  tex.flipY = false; // glTF UV convention
  return tex;
}

/* ----------------------------------------------------------- Overrides */

/**
 * Keyed by the source material name. Each entry receives the original
 * material and returns its replacement.
 */
const OVERRIDES = {
  /* --- Bodywork ------------------------------------------------- */

  // Primary shell. Deep graphite with a hint of blue, under clearcoat —
  // the clearcoat is what makes the studio strips read as paint depth.
  'Paint 1 Carmine': (m) =>
    derive(m, {
      color: PALETTE.paint,
      metalness: 0.72,
      roughness: 0.26,
      clearcoat: 1,
      clearcoatRoughness: 0.045,
      envMapIntensity: 1.5,
      normalScale: 0.55,
    }),

  // Lower panels and sills — satin, so the car reads as two-tone in
  // reflection only, never in colour.
  'Paint 2 Carmine': (m) =>
    derive(m, {
      color: PALETTE.paintLower,
      metalness: 0.55,
      roughness: 0.42,
      clearcoat: 0.55,
      clearcoatRoughness: 0.14,
      envMapIntensity: 1.1,
      normalScale: 0.5,
    }),

  'Panel Sides': (m) =>
    derive(m, {
      color: PALETTE.carbon,
      metalness: 0.4,
      roughness: 0.56,
      envMapIntensity: 0.9,
    }),

  /* --- Glazing --------------------------------------------------- */

  // Deliberately *not* KHR transmission: a transmissive pass re-renders
  // the scene every frame for a surface that reads better as flat tint.
  Glass: (m) =>
    derive(m, {
      color: PALETTE.glass,
      metalness: 0.2,
      roughness: 0.035,
      transparent: true,
      opacity: 0.44,
      envMapIntensity: 2.4,
      side: THREE.DoubleSide,
      depthWrite: false,
    }),

  /* --- Wheels and brakes ----------------------------------------- */

  Rim1: (m) =>
    derive(m, {
      color: PALETTE.rimFace,
      metalness: 1,
      roughness: 0.31,
      envMapIntensity: 1.7,
    }),

  Rim2: (m) =>
    derive(m, {
      color: PALETTE.rimBarrel,
      metalness: 1,
      roughness: 0.46,
      envMapIntensity: 1.2,
    }),

  // The single place the accent touches the vehicle itself.
  Brake: (m) =>
    derive(m, {
      color: PALETTE.accent,
      metalness: 0.9,
      roughness: 0.34,
      envMapIntensity: 1.5,
    }),

  Disc: (m) =>
    derive(m, {
      color: 0x8f9298,
      metalness: 1,
      roughness: 0.44,
      envMapIntensity: 1.3,
    }),

  Tireside: (m) =>
    derive(m, { color: PALETTE.rubber, metalness: 0, roughness: 0.93, envMapIntensity: 0.4 }),

  Tiretread: (m) =>
    derive(m, {
      color: PALETTE.rubber,
      metalness: 0,
      roughness: 0.96,
      envMapIntensity: 0.35,
      normalScale: 1.1,
    }),

  /* --- Structure and hardware ------------------------------------ */

  Mechanical: (m) =>
    derive(m, { color: PALETTE.cast, metalness: 0.85, roughness: 0.42, envMapIntensity: 1.1 }),

  Hardware: (m) =>
    derive(m, { color: PALETTE.steel, metalness: 1, roughness: 0.3, envMapIntensity: 1.4 }),

  Mirror: (m) =>
    derive(m, { color: 0xb9bcc0, metalness: 1, roughness: 0.06, envMapIntensity: 2.2 }),

  /* --- Cabin ------------------------------------------------------ */

  'Interior 1': (m) =>
    derive(m, { color: PALETTE.leather, metalness: 0.04, roughness: 0.76, envMapIntensity: 0.7 }),

  'Interior 2': (m) =>
    derive(m, { color: PALETTE.leatherAlt, metalness: 0.04, roughness: 0.82, envMapIntensity: 0.6 }),

  // Was carmine leather. Now the champagne thread that ties cabin to caliper.
  'Interior 3 Carmine': (m) =>
    derive(m, { color: PALETTE.leatherTrim, metalness: 0.12, roughness: 0.62, envMapIntensity: 0.9 }),

  Floormat: (m) =>
    derive(m, { color: 0x0d0f11, metalness: 0, roughness: 0.95, envMapIntensity: 0.35 }),

  // Instrument binnacle — keeps its own emissive graphic, tinted to accent.
  Dashboard: (m) => {
    const mat = derive(m, {
      color: 0x0a0b0d,
      metalness: 0.3,
      roughness: 0.45,
      envMapIntensity: 0.8,
    });
    mat.emissiveMap = m.emissiveMap ?? null;
    mat.emissive = new THREE.Color(PALETTE.accent);
    mat.emissiveIntensity = 0.55;
    return mat;
  },

  /* --- Lamps ------------------------------------------------------ */

  Headlight: (m) => lamp(m, 0xdbe6f5, 2.4),
  Brakelight: (m) => lamp(m, 0x8c1f16, 1.1),
  Signallight: (m) => lamp(m, 0x8a5a1c, 0.7),

  /* --- Plate ------------------------------------------------------ */

  License: (m) => {
    const mat = derive(m, { color: 0xffffff, metalness: 0.2, roughness: 0.6 }, ['map']);
    mat.map = createPlateTexture();
    return mat;
  },
};

/* Unnamed in the source: the generic trim/structure material used by
   gaskets, wipers, seat frames, cage, door cards and light housings. */
const GENERIC = (m) =>
  derive(m, { color: 0x0f1114, metalness: 0.3, roughness: 0.68, envMapIntensity: 0.75 });

/**
 * Replace every material on the vehicle. Returns the flat list so the
 * scene can drive envMapIntensity globally during focus transitions.
 */
export function applyMaterials(root) {
  const cache = new Map();
  const created = [];

  root.traverse((node) => {
    if (!node.isMesh) return;

    const swap = (source) => {
      const key = source.uuid;
      if (cache.has(key)) return cache.get(key);

      const factory = OVERRIDES[source.name] ?? GENERIC;
      const next = factory(source);
      // Paint variants (Pearl / Graphite) share a base name prefix; the
      // Carmine entries above cover the default variant the loader binds.
      cache.set(key, next);
      created.push(next);
      source.dispose();
      return next;
    };

    node.material = Array.isArray(node.material)
      ? node.material.map(swap)
      : swap(node.material);
  });

  return created;
}

export { PALETTE };
