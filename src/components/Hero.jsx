import { ArrowRight, ArrowDown } from 'lucide-react';

import { Panel } from './Panel.jsx';

/**
 * The opening frame. Four elements and a great deal of nothing: the
 * vehicle is doing the talking, and the type is only there to name it.
 *
 * Each headline line sits in its own mask so the intro can wipe them up
 * from their baselines — at this size a fade would read as a page still
 * loading.
 */
export function Hero({ register, refs, onExplore, onEngineering }) {
  return (
    <Panel id="hero" register={register} variant="hero" label="Nova">
      <div className="panel__block">
        <h1 className="display hero__headline" ref={refs.headline}>
          <span className="hero__mask">
            <span className="hero__line">The art</span>
          </span>
          <span className="hero__mask">
            <span className="hero__line">of motion</span>
          </span>
        </h1>

        <p className="body-text hero__sub" ref={refs.sub}>
          Precision engineered for the next generation.
        </p>

        <div className="actions" ref={refs.actions}>
          <button type="button" className="action action--primary" onClick={onExplore}>
            Explore the vehicle
            <ArrowRight aria-hidden="true" />
          </button>

          <button type="button" className="action" onClick={onEngineering}>
            Discover engineering
            <ArrowDown aria-hidden="true" />
          </button>
        </div>
      </div>
    </Panel>
  );
}
