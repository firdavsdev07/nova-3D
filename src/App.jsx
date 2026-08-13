import { useCallback, useEffect, useRef, useState } from 'react';

import { Annotations } from './components/Annotations.jsx';
import { CTA } from './components/CTA.jsx';
import { Engineering } from './components/Engineering.jsx';
import { Hero } from './components/Hero.jsx';
import { Interior } from './components/Interior.jsx';
import { Loader } from './components/Loader.jsx';
import { Navigation } from './components/Navigation.jsx';
import { Technology } from './components/Technology.jsx';

import { Experience } from './three/Scene.js';
import { buildScrollTimeline } from './animations/scrollTimeline.js';
import { playIntro, scrollToProgress } from './animations/uiAnimations.js';
import { AudioManager } from './audio/AudioManager.js';

import './styles/global.css';
import './styles/navigation.css';
import './styles/sections.css';
import './styles/loader.css';

/** Scroll length of the film, in viewports. */
const SCREENS = 9;

export default function App() {
  const canvasRef = useRef(null);
  const driverRef = useRef(null);
  const veilRef = useRef(null);
  const panels = useRef({});

  const experienceRef = useRef(null);
  const audioRef = useRef(null);

  const heroRefs = {
    headline: useRef(null),
    sub: useRef(null),
    actions: useRef(null),
  };
  const chromeRefs = {
    brand: useRef(null),
    nav: useRef(null),
    aside: useRef(null),
  };

  const [loadProgress, setLoadProgress] = useState(0);
  const [showLoader, setShowLoader] = useState(true);
  const [error, setError] = useState(null);
  const [progress, setProgress] = useState(0);
  const [soundOn, setSoundOn] = useState(false);

  const registerPanel = useCallback((id, el) => {
    if (el) panels.current[id] = el;
  }, []);

  // Ref callbacks fire during commit, before the mount effect has built
  // the Experience — so elements are parked here and handed over once
  // the scene exists.
  const annotationEls = useRef({});
  const bindAnnotation = useCallback((id, el) => {
    if (!el) return;
    annotationEls.current[id] = el;
    experienceRef.current?.bindAnnotation(id, el);
  }, []);

  /* ---------------------------------------------------------- boot */

  useEffect(() => {
    // A reload must not drop the visitor into the middle of the film
    // while the loader is still up.
    if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
    window.scrollTo(0, 0);

    const experience = new Experience(canvasRef.current);
    experienceRef.current = experience;
    audioRef.current = new AudioManager();

    for (const [id, el] of Object.entries(annotationEls.current)) {
      experience.bindAnnotation(id, el);
    }

    // The scene renders from the first frame, behind the veil, so the
    // handover is a fade rather than a second wait.
    experience.start();

    let scroll = null;
    let cancelled = false;

    experience
      .load((p) => !cancelled && setLoadProgress(p))
      .then(() => {
        if (cancelled) return;

        setLoadProgress(1);
        experience.rig.jumpToTarget();

        scroll = buildScrollTimeline({
          state: experience.state,
          driver: driverRef.current,
          panels: panels.current,
          onProgress: (value) => {
            // Quantised: the chrome only shows half-percent steps, so
            // there is no reason to re-render React any faster.
            setProgress((prev) =>
              Math.abs(prev - value) >= 0.005 || value === 0 || value === 1 ? value : prev
            );
            audioRef.current?.setDisassembly(experience.state.disassembly);
          },
        });

        playIntro({
          veil: veilRef.current,
          brand: chromeRefs.brand.current,
          nav: chromeRefs.nav.current,
          aside: chromeRefs.aside.current,
          headline: heroRefs.headline.current,
          sub: heroRefs.sub.current,
          actions: heroRefs.actions.current,
        }).eventCallback('onComplete', () => setShowLoader(false));

        scroll.refresh();

        // The soundtrack comes up on its own. Browsers will not allow it
        // before the visitor has done something, so this starts it at the
        // first opportunity rather than waiting to be asked.
        audioRef.current?.armAutostart((on) => {
          if (cancelled) return;
          setSoundOn(on);
          if (on) audioRef.current?.setDisassembly(experience.state.disassembly);
        });

        if (import.meta.env.DEV) {
          // Visual QA hook. Lets a headless browser jump the film to an
          // exact progress without waiting out the scrub and the camera
          // damping, which software rendering is far too slow to do.
          window.__nova = {
            experience,
            scroll,
            seek(p) {
              if (!experience.vehicle) return;
              const max = document.documentElement.scrollHeight - window.innerHeight;
              window.scrollTo(0, max * p);
              scroll.timeline.scrollTrigger.update();
              scroll.timeline.progress(p);
              experience.vehicle.update(experience.state);
              experience.rig.jumpToTarget(experience.liftHeight);
            },
          };
        }
      })
      .catch((err) => {
        console.error(err);
        if (!cancelled) setError('The vehicle could not be loaded. Please reload the page.');
      });

    return () => {
      cancelled = true;
      scroll?.destroy();
      audioRef.current?.dispose();
      experience.dispose();
      experienceRef.current = null;
    };
    // Mounted once, for the life of the page.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* --------------------------------------------------------- sound */

  const toggleSound = useCallback(async () => {
    const audio = audioRef.current;
    if (!audio) return;

    const next = await audio.toggle();
    setSoundOn(Boolean(next));
    if (next) audio.setDisassembly(experienceRef.current?.state.disassembly ?? 0);
  }, []);

  const goTo = useCallback((target) => {
    audioRef.current?.tick();
    scrollToProgress(target, driverRef.current);
  }, []);

  /* ---------------------------------------------------------- view */

  return (
    <>
      <div className="stage">
        <canvas ref={canvasRef} />
      </div>

      <div className="atmosphere" aria-hidden="true" />

      <Annotations bind={bindAnnotation} />

      <Navigation
        progress={progress}
        soundOn={soundOn}
        onToggleSound={toggleSound}
        onNavigate={goTo}
        revealRefs={chromeRefs}
      />

      <Hero
        register={registerPanel}
        refs={heroRefs}
        onExplore={() => goTo(0.22)}
        onEngineering={() => goTo(0.33)}
      />
      <Engineering register={registerPanel} />
      <Interior register={registerPanel} />
      <Technology register={registerPanel} />
      <CTA register={registerPanel} onReturn={() => goTo(0)} />

      <div
        className="cue"
        aria-hidden="true"
        style={{ opacity: progress > 0.01 || showLoader ? 0 : 1 }}
      >
        <span className="cue__track">
          <span className="cue__dot" />
        </span>
        <span className="label">Scroll</span>
      </div>

      {/* The empty column of height that the master timeline scrubs against. */}
      <div className="scroll-driver" ref={driverRef} style={{ height: `${SCREENS * 100}vh` }} />

      {showLoader && <Loader progress={loadProgress} error={error} veilRef={veilRef} />}
    </>
  );
}
