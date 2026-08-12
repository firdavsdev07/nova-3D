/* ------------------------------------------------------------------
   Vehicle parts

   The exploded view is authored here, not improvised at runtime.

   The source hierarchy gives us real assembly groups — the hood, both
   doors and all four wheels are already separate nodes with their own
   pivots, and their sub-parts (handles, mirrors, glass, brake discs)
   are parented underneath. So the explode moves assemblies, the way a
   workshop would take the car apart, rather than scattering meshes.

   Axis convention, after the vehicle is centred and dropped onto the
   floor:  +X left flank · +Y up · +Z nose.  Origin sits on the ground
   at the centre of the bounding box, so the whole car lives in
   x ±1.36, y 0 → 1.31, z ±2.18.

   `out` is signed by the part's own side, so one rule serves both
   flanks and nothing has to be written twice.
   ------------------------------------------------------------------ */

/**
 * Explode groups. Each is a displacement applied to the part's home
 * transform, scaled 0 → 1 by the scroll timeline.
 *
 *   out — lateral, away from the centreline (sign follows the part)
 *   up  — vertical
 *   fwd — along the car's nose
 *   rot — radians added to the home rotation
 */
export const EXPLODE = {
  /** The structural spine. It never moves; everything leaves *it*. */
  chassis: { out: 0, up: 0, fwd: 0 },

  /** Likewise the cabin — it is the thing being revealed. */
  cabin: { out: 0, up: 0, fwd: 0 },

  // Wheels step out just far enough to clear the arches.
  wheel: { out: 0.44, up: 0, fwd: 0 },
  // Rim and tyre then slide off the hub, leaving the brake behind.
  rimShell: { out: 0.54, up: 0, fwd: 0 },
  brakeCore: { out: 0, up: 0, fwd: 0 },

  // Doors swing out on their hinge line and drift up a little, which
  // reads as "lifted away" rather than "fallen off".
  door: { out: 0.98, up: 0.12, fwd: 0, rot: [0, 0.10, 0] },

  // Clamshell hood: forward and up, tipped on its front hinge.
  hood: { out: 0, up: 0.88, fwd: 0.64, rot: [-0.10, 0, 0] },

  roof: { out: 0, up: 1.12, fwd: -0.04 },
  glass: { out: 0, up: 1.34, fwd: 0.30 },
  pillars: { out: 0, up: 0.84, fwd: 0 },

  // The rear clip withdraws along the axis it was fitted on.
  rear: { out: 0, up: 0.28, fwd: -1.18 },

  // Sills and valance drop clear — possible because the whole assembly
  // lifts off the floor during the explode (see `lift` in the timeline).
  lower: { out: 0, up: -0.54, fwd: 0 },

  // Powertrain draws forward and up out of the bay.
  engine: { out: 0, up: 0.64, fwd: 1.12 },
};

/**
 * Classify a node by name. Returns an EXPLODE key.
 *
 * Matched in order — the first hit wins, so specific names must precede
 * the prefix rules.
 */
export function classify(name, position) {
  const n = name.toLowerCase();

  if (n.startsWith('wheel')) return 'wheel';
  if (n.startsWith('bodydoor')) return 'door';
  if (n === 'bodyhood') return 'hood';
  if (n === 'bodyroofpanel') return 'roof';
  if (n === 'bodypillars') return 'pillars';
  if (n === 'bodypanelscolor2') return 'lower';
  if (n.startsWith('bodyrearpanels')) return 'rear';
  if (n.startsWith('bodywindshield')) return 'glass';
  if (n === 'engine') return 'engine';
  if (n === 'bodyunderside' || n === 'axles') return 'chassis';
  if (n.startsWith('interior')) return 'cabin';

  // The plate rides with whichever clip it is mounted to.
  if (n.includes('license')) return position.z >= 0 ? 'hood' : 'rear';

  return 'cabin';
}

/** Sub-parts inside a wheel assembly: the shell slides, the brake stays. */
export function classifyWheelChild(name) {
  const n = name.toLowerCase();
  if (n.includes('brake')) return 'brakeCore';
  return 'rimShell'; // rim + tyre
}

/* ------------------------------------------------------------------
   Component focus

   Editorial labels, anchored to a part so they track it through the
   explode. `anchor` is the node the label is pinned to; `offset` nudges
   the pin off the part's origin so the leader line does not sit on top
   of the geometry it is pointing at.

   `range` is the scroll window the label lives in. Visibility is read
   from scroll progress every frame rather than tweened, so scrubbing
   backwards is exactly as correct as scrubbing forwards.
   ------------------------------------------------------------------ */

export const ANNOTATIONS = [
  {
    id: 'brakes',
    range: [0.19, 0.29],
    anchor: 'WheelFrontLBrakeDisc',
    offset: [0.1, 0.22, 0],
    label: 'Braking system',
    spec: [
      ['Carbon ceramic', '410 MM'],
      ['Caliper', '10-piston'],
    ],
  },
  {
    id: 'wheel',
    range: [0.305, 0.395],
    anchor: 'WheelRearLRim',
    offset: [0.1, 0.24, 0],
    label: 'Rear axle',
    spec: [
      ['Forged monoblock', '21 IN'],
      ['Torque vectoring', 'Active'],
    ],
  },
  {
    id: 'cabin',
    range: [0.55, 0.64],
    anchor: 'InteriorSteeringCylinder',
    offset: [0, 0.3, 0],
    label: 'Cabin',
    spec: [
      ['Driver interface', 'Analogue'],
      ['Seating', 'Carbon shell'],
    ],
  },
  {
    id: 'seats',
    range: [0.565, 0.64],
    anchor: 'InteriorSeatsColor1',
    offset: [0.3, 0.28, -0.2],
    label: 'Occupant cell',
    spec: [['Weight', '8.2 KG']],
  },
  {
    id: 'engine',
    range: [0.655, 0.745],
    anchor: 'Engine',
    offset: [0, 0.34, 0],
    label: 'Powertrain',
    spec: [
      ['V8 twin turbo', '640 HP'],
      ['Torque', '800 NM'],
    ],
  },
  {
    id: 'chassis',
    range: [0.44, 0.53],
    anchor: 'BodyUnderside',
    offset: [0, -0.18, 0.2],
    label: 'Monocoque',
    spec: [
      ['Carbon tub', '1,412 KG'],
      ['Torsional rigidity', '41 KNM'],
    ],
  },
  {
    id: 'aero',
    range: [0.765, 0.85],
    anchor: 'BodyRearPanelsColor1',
    offset: [0, 0.24, -0.2],
    label: 'Aerodynamics',
    spec: [
      ['Active rear wing', '3 stage'],
      ['Downforce', '380 KG'],
    ],
  },
];
