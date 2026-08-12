/* ------------------------------------------------------------------
   Camera beats

   Positions are in the vehicle's centred world space, taken from the
   actual model bounds rather than guessed:

     nose  z +2.18      front axle  z +1.25, x ±0.98, y 0.54
     tail  z −2.18      rear axle   z −1.55
     roof  y  1.31      engine bay  (0, 0.60, 1.73)
     beam  x ±1.36      steering    (0, 0.81, 0.70)

   +X is the left flank, +Z is the nose.

   Two rules govern the ordering of these beats:

   1. No straight line between consecutive positions may pass through
      the car — the rig interpolates position directly, so a cut from
      behind the tail to a front three-quarter would fly through the
      cabin. Arcs are made explicit with intermediate beats.

   2. `drift` and `parallax` fall away as the camera closes in. Idle
      motion that reads as luxurious at seven metres reads as a shaky
      hand at one.
   ------------------------------------------------------------------ */

export const BEATS = [
  {
    // Hero. Long lens, front three-quarter from the left flank.
    // py lowered slightly to reduce the vertically-stretched look.
    at: 0,
    ease: 'power2.inOut',
    cam: { px: 4.8, py: 1.10, pz: 5.4, lx: 0, ly: 0.58, lz: 0.15, fov: 30, drift: 1, parallax: 1 },
  },
  {
    // The approach: lower and nearer, the nose starting to dominate.
    at: 0.1,
    ease: 'power2.out',
    cam: { px: 3.2, py: 0.78, pz: 4.1, lx: 0, ly: 0.54, lz: 0.6, fov: 28, drift: 0.35, parallax: 0.8 },
  },
  {
    // Front-left wheel at hub height, as the rim slides off the brake.
    at: 0.22,
    ease: 'power2.inOut',
    cam: { px: 2.75, py: 0.62, pz: 2.75, lx: 0.95, ly: 0.52, lz: 1.3, fov: 34, drift: 0.1, parallax: 0.5 },
  },
  {
    // Pull to a clean side elevation for the doors and the numbers.
    at: 0.33,
    ease: 'power2.inOut',
    cam: { px: 6.4, py: 1.0, pz: 0.5, lx: 0, ly: 0.68, lz: 0, fov: 30, drift: 0.15, parallax: 0.7 },
  },
  {
    // Rise for the full exploded state — the assembly needs headroom.
    at: 0.45,
    ease: 'power2.inOut',
    cam: { px: 5.2, py: 2.9, pz: 5.2, lx: 0, ly: 0.95, lz: 0, fov: 33, drift: 0.3, parallax: 0.7 },
  },
  {
    // Down into the cabin from the left shoulder, roof already gone.
    // Lower py + adjusted lz so the camera looks clearly at the seats
    // without clipping or a distorted perspective.
    at: 0.57,
    ease: 'power2.inOut',
    cam: { px: 1.6, py: 1.28, pz: 1.9, lx: -0.1, ly: 0.68, lz: -0.2, fov: 38, drift: 0.05, parallax: 0.3 },
  },
  {
    // Engine bay, framed on the powertrain once it has drawn forward.
    at: 0.68,
    ease: 'power2.inOut',
    cam: { px: 2.1, py: 1.35, pz: 3.7, lx: 0, ly: 0.85, lz: 1.85, fov: 34, drift: 0.08, parallax: 0.4 },
  },
  {
    // Around to the rear quarter for aerodynamics.
    at: 0.79,
    ease: 'power2.inOut',
    cam: { px: -3.6, py: 1.15, pz: -4.2, lx: 0, ly: 0.85, lz: -1.5, fov: 32, drift: 0.15, parallax: 0.6 },
  },
  {
    // Line up on the centreline, ahead of the nose. Wider lens: the
    // walls are about to pass very close to the sensor.
    at: 0.855,
    ease: 'power1.inOut',
    cam: { px: 0, py: 0.95, pz: 4.4, lx: 0, ly: 0.86, lz: 0, fov: 42, drift: 0, parallax: 0.2 },
  },
  {
    // Inside, between the seats, travelling aft.
    // Raise py slightly and narrow fov to avoid the ceiling clipping into view.
    at: 0.9,
    ease: 'none',
    cam: { px: 0, py: 0.86, pz: 0.7, lx: 0, ly: 0.72, lz: -2.2, fov: 42, drift: 0, parallax: 0.1 },
  },
  {
    // Out through the tail, turning back as the car reassembles.
    at: 0.935,
    ease: 'power1.out',
    cam: { px: 0.3, py: 0.98, pz: -4.3, lx: 0, ly: 0.75, lz: -1.0, fov: 38, drift: 0, parallax: 0.3 },
  },
  {
    // Arc wide around the left flank — never across the car.
    at: 0.97,
    ease: 'power1.inOut',
    cam: { px: 5.8, py: 1.3, pz: -1.4, lx: 0, ly: 0.68, lz: 0, fov: 34, drift: 0.4, parallax: 0.7 },
  },
  {
    // Home. Whole again, and back on the hero axis.
    at: 1,
    ease: 'power2.out',
    cam: { px: 4.6, py: 1.42, pz: 5.0, lx: 0, ly: 0.62, lz: 0.1, fov: 32, drift: 0.85, parallax: 1 },
  },
];

/**
 * Accent light beats. The focus light is the entire "highlight" system:
 * rather than outlining a part or dimming the rest of the scene, a small
 * champagne source is placed at the component under discussion.
 *
 * Positions account for where a part sits *after* it has exploded.
 */
export const FOCUS_BEATS = [
  { at: 0.19, to: 0.29, pos: [0.95, 0.55, 1.25], intensity: 2.6 }, // front brake
  { at: 0.44, to: 0.53, pos: [0, 0.5, 0], intensity: 1.6 }, // chassis, under the assembly
  { at: 0.55, to: 0.64, pos: [0, 1.15, 0.3], intensity: 3.2 }, // cabin — higher for seat clarity
  { at: 0.65, to: 0.74, pos: [0, 1.3, 2.9], intensity: 3.0 }, // powertrain, drawn forward
  { at: 0.76, to: 0.85, pos: [0, 1.05, -2.6], intensity: 2.4 }, // rear clip, withdrawn
];

/** Adds the camera beats to the master timeline. */
export function addCameraBeats(tl, cam) {
  // Beat zero is the initial state, not a tween.
  Object.assign(cam, BEATS[0].cam);

  for (let i = 1; i < BEATS.length; i++) {
    const beat = BEATS[i];
    const prev = BEATS[i - 1];
    tl.to(
      cam,
      { ...beat.cam, duration: beat.at - prev.at, ease: beat.ease ?? 'power2.inOut' },
      prev.at
    );
  }
}

/** Adds the focus-light beats: fade up on arrival, fade down on leaving. */
export function addFocusBeats(tl, focus) {
  const RAMP = 0.03;

  for (const beat of FOCUS_BEATS) {
    const [x, y, z] = beat.pos;
    // Move while dark, so the light never streaks across the vehicle.
    tl.set(focus, { x, y, z }, Math.max(beat.at - RAMP, 0));
    tl.to(focus, { intensity: beat.intensity, duration: RAMP, ease: 'power2.out' }, beat.at - RAMP);
    tl.to(focus, { intensity: 0, duration: RAMP, ease: 'power2.in' }, beat.to);
  }
}
