import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

import { addCameraBeats, addFocusBeats } from './cameraAnimations.js';
import { addCounters, reducedMotion } from './uiAnimations.js';

gsap.registerPlugin(ScrollTrigger);

/* ------------------------------------------------------------------
   Master scroll timeline

   One timeline, one scrub, normalised so that timeline time == scroll
   progress (0 → 1). Everything the scroll controls is added here:
   camera, explode amounts, focus light, exposure and section copy.

   Nothing else in the app is allowed its own ScrollTrigger. That is
   the reason the copy always lands on the same frame as the camera —
   they are literally the same tween engine reading the same clock.
   ------------------------------------------------------------------ */

/** group, start, end — the order parts leave the car. */
const TEARDOWN = [
  ['wheel', 0.155, 0.26],
  ['rimShell', 0.175, 0.285],
  ['door', 0.275, 0.375],
  ['hood', 0.335, 0.44],
  ['glass', 0.4, 0.5],
  ['roof', 0.405, 0.505],
  ['pillars', 0.415, 0.515],
  ['rear', 0.42, 0.53],
  ['lower', 0.43, 0.535],
  ['engine', 0.6, 0.7],
];

/** The reverse, staggered so the car does not snap shut in one frame. */
const REBUILD = [
  ['engine', 0.9, 0.95],
  ['lower', 0.905, 0.96],
  ['rear', 0.908, 0.962],
  ['pillars', 0.912, 0.964],
  ['roof', 0.915, 0.966],
  ['glass', 0.918, 0.968],
  ['hood', 0.925, 0.97],
  ['door', 0.935, 0.977],
  ['rimShell', 0.94, 0.98],
  ['wheel', 0.948, 0.986],
];

/** Section copy, in scroll progress. `out: null` means it stays. */
export const PANEL_TIMING = {
  hero: { in: 0, out: 0.12 },
  chassis: { in: 0.17, out: 0.26 },
  engineering: { in: 0.29, out: 0.38 },
  architecture: { in: 0.41, out: 0.50 },
  interior: { in: 0.53, out: 0.62 },
  powertrain: { in: 0.64, out: 0.73 },
  technology: { in: 0.75, out: 0.86 },
  cta: { in: 0.91, out: null },
};

const FADE = 0.045;

export function buildScrollTimeline({ state, driver, panels, onProgress }) {
  const tl = gsap.timeline({
    defaults: { ease: 'none' },
    scrollTrigger: {
      trigger: driver,
      start: 'top top',
      end: 'bottom bottom',
      // Scrub adds the weight. Without it the camera tracks the wheel
      // one-to-one and the whole thing feels like a scrubbing a video.
      //
      // Under reduced motion it becomes exactly that: `true` locks the
      // timeline to the scrollbar, so nothing continues moving after the
      // visitor has stopped.
      scrub: reducedMotion() ? true : 1.15,
      invalidateOnRefresh: true,
      onUpdate: (self) => {
        state.progress = self.progress;
        onProgress?.(self.progress);
      },
    },
  });

  // Pin the timeline's length to exactly 1 so beat positions can be
  // written as raw progress values everywhere above.
  tl.to({}, { duration: 1 }, 0);

  addCameraBeats(tl, state.cam);
  addFocusBeats(tl, state.focus);

  /* ---------------------------------------------------- the explode */

  for (const [group, from, to] of TEARDOWN) {
    tl.to(state.explode, { [group]: 1, duration: to - from, ease: 'power2.inOut' }, from);
  }
  for (const [group, from, to] of REBUILD) {
    tl.to(state.explode, { [group]: 0, duration: to - from, ease: 'power2.inOut' }, from);
  }

  // The assembly floats clear of the floor while it is apart, which is
  // what gives the sills and the chassis room to separate downward.
  tl.to(state, { lift: 0.55, duration: 0.12, ease: 'power2.inOut' }, 0.4);
  tl.to(state, { lift: 0, duration: 0.067, ease: 'power2.inOut' }, 0.918);

  // A single scalar the audio bed reads for its mechanical layer.
  tl.to(state, { disassembly: 1, duration: 0.35, ease: 'none' }, 0.15);
  tl.to(state, { disassembly: 0, duration: 0.085, ease: 'none' }, 0.9);

  /* ------------------------------------------------------- exposure */

  // Half a stop up inside the cabin, half a stop down in the corridor.
  tl.to(state, { exposure: 1.08, duration: 0.05, ease: 'power1.inOut' }, 0.55);
  tl.to(state, { exposure: 1, duration: 0.05, ease: 'power1.inOut' }, 0.63);
  tl.to(state, { exposure: 0.92, duration: 0.04, ease: 'power1.inOut' }, 0.85);
  tl.to(state, { exposure: 1, duration: 0.04, ease: 'power1.inOut' }, 0.93);

  /* ---------------------------------------------------------- copy */

  for (const [id, timing] of Object.entries(PANEL_TIMING)) {
    const el = panels[id];
    if (!el) continue;

    if (timing.in > 0) {
      gsap.set(el, { autoAlpha: 0, y: 26 });
      tl.to(el, { autoAlpha: 1, y: 0, duration: FADE, ease: 'power2.out' }, timing.in);
    } else {
      gsap.set(el, { autoAlpha: 1, y: 0 });
    }

    if (timing.out !== null) {
      tl.to(el, { autoAlpha: 0, y: -18, duration: FADE, ease: 'power2.in' }, timing.out);
    }
  }

  addCounters(tl, panels.engineering, PANEL_TIMING.engineering.in);

  return {
    timeline: tl,
    refresh: () => ScrollTrigger.refresh(),
    destroy: () => {
      tl.scrollTrigger?.kill();
      tl.kill();
    },
  };
}
