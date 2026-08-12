import { SoundControl } from './SoundControl.jsx';

/* Section anchors, as positions on the master timeline. */
const NAV = [
  { label: 'Vehicle', at: 0.22, until: 0.28 },
  { label: 'Engineering', at: 0.33, until: 0.54 },
  { label: 'Interior', at: 0.57, until: 0.65 },
  { label: 'Technology', at: 0.79, until: 1.01 },
];

/* The telemetry readout: where in the film the viewer currently is. */
const CHAPTERS = [
  { at: 0, index: '01', name: 'The art of motion' },
  { at: 0.17, index: '02', name: 'Foundation' },
  { at: 0.29, index: '03', name: 'Performance' },
  { at: 0.42, index: '04', name: 'Architecture' },
  { at: 0.54, index: '05', name: 'Interior' },
  { at: 0.65, index: '06', name: 'Powertrain' },
  { at: 0.76, index: '07', name: 'Technology' },
  { at: 0.86, index: '08', name: 'Reassembly' },
];

function chapterFor(progress) {
  let current = CHAPTERS[0];
  for (const chapter of CHAPTERS) {
    if (progress >= chapter.at) current = chapter;
  }
  return current;
}

function activeNav(progress) {
  for (const item of NAV) {
    if (progress < item.until) return item.label;
  }
  return NAV[NAV.length - 1].label;
}

/**
 * Fixed chrome: brand, section list, status, sound. Plus the two
 * readouts at the base of the frame — chapter on the left, position on
 * the right — which do the work a scrollbar would, without being one.
 */
export function Navigation({ progress, soundOn, onToggleSound, onNavigate, revealRefs }) {
  const chapter = chapterFor(progress);
  const active = activeNav(progress);

  return (
    <>
      <header className="masthead">
        <div className="brand" ref={revealRefs.brand}>
          <span className="brand__mark">Nova</span>
          <span className="brand__rule" aria-hidden="true" />
        </div>

        <nav className="nav" ref={revealRefs.nav} aria-label="Sections">
          {NAV.map((item) => (
            <button
              type="button"
              key={item.label}
              className="nav__item"
              aria-current={active === item.label}
              onClick={() => onNavigate(item.at)}
            >
              {item.label}
            </button>
          ))}
        </nav>

        <div className="masthead__aside" ref={revealRefs.aside}>
          <div className="status">
            <span className="status__dot" aria-hidden="true" />
            <span className="status__text">
              <span className="label">System status</span>
              <span className="status__value">Nominal</span>
            </span>
          </div>

          <SoundControl on={soundOn} onToggle={onToggleSound} />
        </div>
      </header>

      <div className="telemetry" aria-hidden="true">
        <span className="ordinal telemetry__index">{chapter.index}</span>
        <span className="telemetry__chapter">{chapter.name}</span>
      </div>

      <div className="rail" aria-hidden="true">
        <span className="rail__track">
          <span
            className="rail__fill"
            style={{ transform: `scaleX(${progress.toFixed(4)})` }}
          />
        </span>
        <span className="rail__value">{Math.round(progress * 100)}%</span>
      </div>
    </>
  );
}
