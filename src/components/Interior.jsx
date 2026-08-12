import { Eyebrow, Panel, SpecList } from './Panel.jsx';

const CABIN = [
  ['Upholstery', 'Aniline hide'],
  ['Structure', 'Carbon shell'],
  ['Interface', 'Analogue primary'],
  ['Ambient', '2700 K'],
];

/**
 * The reveal. By this point the roof, glazing and both doors have left
 * the car, so the camera can simply descend into the cabin — there is
 * nothing to cut away and no transparency trick involved.
 */
export function Interior({ register }) {
  return (
    <Panel id="interior" register={register} variant="left" label="Interior">
      <div className="panel__block">
        <Eyebrow index="05">Interior</Eyebrow>
        <h2 className="display display--sm">
          The quiet
          <br />
          side of speed
        </h2>
        <p className="body-text">
          Hide, milled aluminium and open-weave carbon. Warm to the touch, cold to the
          tolerance. The cabin asks nothing of the driver except attention.
        </p>
        <SpecList rows={CABIN} />
      </div>
    </Panel>
  );
}
