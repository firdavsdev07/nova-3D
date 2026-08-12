import { Eyebrow, Panel } from './Panel.jsx';

/**
 * Three beats over the teardown: the contact patch as the rims slide
 * off the brakes, the figures against a clean side elevation, then the
 * full exploded state.
 *
 * The figures carry `data-count` — the master timeline finds them and
 * counts them up as the panel arrives, and back down if the visitor
 * scrolls away.
 */
const FIGURES = [
  { value: 640, unit: 'HP', label: 'Power' },
  { value: 800, unit: 'NM', label: 'Torque' },
  { value: 3.4, unit: 'Sec', label: '0–100 km/h', decimals: 1 },
  { value: 320, unit: 'Km/h', label: 'Top speed' },
];

export function Engineering({ register }) {
  return (
    <>
      {/* Camera is at hub height; the rim has just left the disc. */}
      <Panel id="chassis" register={register} variant="left" label="Foundation">
        <div className="panel__block">
          <Eyebrow index="02">Foundation</Eyebrow>
          <h2 className="display display--sm">
            Every
            <br />
            contact patch
          </h2>
          <p className="body-text">
            Four points of contact, each the size of an open hand. Everything above them
            exists to keep them loaded.
          </p>
        </div>
      </Panel>

      {/* Clean side elevation — the numbers get the base of the frame. */}
      <Panel id="engineering" register={register} variant="stats" label="Performance">
        <div className="panel__block">
          <Eyebrow index="03">Performance</Eyebrow>
          <h2 className="display display--sm">
            Measured,
            <br />
            not claimed
          </h2>
        </div>

        <div className="stats">
          {FIGURES.map((figure) => (
            <div className="stat" key={figure.label}>
              <p className="stat__figure">
                <span data-count={figure.value} data-decimals={figure.decimals ?? 0}>
                  0
                </span>
                <span className="stat__unit">{figure.unit}</span>
              </p>
              <p className="label">{figure.label}</p>
            </div>
          ))}
        </div>
      </Panel>

      {/* Fully apart, camera high and wide. */}
      <Panel id="architecture" register={register} variant="right" label="Architecture">
        <div className="panel__block">
          <Eyebrow index="04">Architecture</Eyebrow>
          <h2 className="display display--sm">
            Ninety-seven
            <br />
            components
          </h2>
          <p className="body-text">
            Nothing here is decorative. Each element is placed for load, for airflow, or
            for the hand that reaches for it.
          </p>
        </div>
      </Panel>
    </>
  );
}
