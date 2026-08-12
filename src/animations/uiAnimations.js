import gsap from 'gsap';
import { ScrollToPlugin } from 'gsap/ScrollToPlugin';

gsap.registerPlugin(ScrollToPlugin);

/* ------------------------------------------------------------------
   Interface motion

   Everything here is short, eased out, and never bounces. The 3D scene
   carries the drama; the interface's job is to arrive quietly and get
   out of the way.
   ------------------------------------------------------------------ */

export const reducedMotion = () =>
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * Counts the engineering figures up as their panel arrives. Driven from
 * the master timeline rather than a trigger of their own, so scrubbing
 * backwards counts them down again.
 */
export function addCounters(tl, root, at) {
  if (!root) return;

  const nodes = root.querySelectorAll('[data-count]');
  nodes.forEach((el, i) => {
    const to = parseFloat(el.dataset.count);
    const decimals = parseInt(el.dataset.decimals ?? '0', 10);
    const proxy = { v: 0 };

    tl.to(
      proxy,
      {
        v: to,
        duration: 0.06,
        ease: 'power2.out',
        onUpdate: () => {
          el.textContent = proxy.v.toFixed(decimals);
        },
      },
      // A whisper of stagger: the figures resolve left to right.
      at + i * 0.008
    );
  });
}

/**
 * The handover from the loading screen. The vehicle is already
 * rendering behind the veil; this only lifts the veil and sets the
 * hero type.
 */
export function playIntro({ veil, brand, nav, headline, sub, actions, aside }) {
  const tl = gsap.timeline({ defaults: { ease: 'power3.out' } });

  if (reducedMotion()) {
    gsap.set([brand, nav, headline, sub, actions, aside].filter(Boolean), {
      autoAlpha: 1,
      y: 0,
      clipPath: 'inset(0% 0% 0% 0%)',
    });
    return tl.to(veil, { autoAlpha: 0, duration: 0.4 });
  }

  tl.to(veil, { autoAlpha: 0, duration: 1.1, ease: 'power2.inOut' })

    // Chrome first, and quietly.
    .fromTo(
      [brand, nav, aside].filter(Boolean),
      { autoAlpha: 0, y: -10 },
      { autoAlpha: 1, y: 0, duration: 1, stagger: 0.08 },
      '-=0.55'
    )

    // The headline wipes up from its own baseline rather than fading —
    // a fade at this size reads as a loading state.
    .fromTo(
      headline?.querySelectorAll('.hero__line') ?? [],
      { yPercent: 108 },
      { yPercent: 0, duration: 1.35, stagger: 0.09, ease: 'expo.out' },
      '-=0.85'
    )

    .fromTo(sub, { autoAlpha: 0, y: 14 }, { autoAlpha: 1, y: 0, duration: 1 }, '-=0.9')
    .fromTo(
      actions?.children ?? [],
      { autoAlpha: 0, y: 14 },
      { autoAlpha: 1, y: 0, duration: 0.9, stagger: 0.08 },
      '-=0.8'
    );

  return tl;
}

/** Smooth scroll to a progress point on the master timeline. */
export function scrollToProgress(progress, driver, duration = 1.6) {
  if (!driver) return;

  const max = driver.scrollHeight - window.innerHeight;
  const to = max * progress;

  gsap.to(window, {
    scrollTo: to,
    duration: reducedMotion() ? 0 : duration,
    ease: 'power2.inOut',
    overwrite: true,
  });
}
