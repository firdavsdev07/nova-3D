import { Eyebrow, Panel, SpecList } from './Panel.jsx';

const SYSTEMS = [
  ['Aerodynamic system', 'Three stage'],
  ['Active cooling', 'Twin circuit'],
  ['Performance braking', 'Carbon ceramic'],
  ['Adaptive suspension', '1 kHz'],
];

/**
 * Powertrain, then systems. Both are close shots — the copy stays a
 * caption to what the camera is already looking at, rather than
 * describing something off screen.
 */
export function Technology({ register }) {
  return (
    <>
      <Panel id="powertrain" register={register} variant="left" label="Powertrain">
        <div className="panel__block">
          <Eyebrow index="06">Powertrain</Eyebrow>
          <h2 className="display display--sm">
            Eight cylinders,
            <br />
            two turbines
          </h2>
          <p className="body-text">
            Dry sumped, flat-plane, and mounted low enough that the centre of gravity
            sits below the driver's hip.
          </p>
        </div>
      </Panel>

      <Panel id="technology" register={register} variant="right" label="Technology">
        <div className="panel__block">
          <Eyebrow index="07">Technology</Eyebrow>
          <h2 className="display display--sm">
            Systems,
            <br />
            not features
          </h2>
          <SpecList rows={SYSTEMS} />
        </div>
      </Panel>
    </>
  );
}
