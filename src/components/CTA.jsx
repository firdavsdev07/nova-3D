import { ArrowRight, ArrowUp } from 'lucide-react';

import { Eyebrow, Panel } from './Panel.jsx';

/**
 * The close, on a reassembled car back at the hero angle. Also carries
 * the attribution the source model's licence requires — visible in the
 * experience rather than buried in a repository file.
 */
export function CTA({ register, onReturn }) {
  return (
    <Panel id="cta" register={register} variant="foot" label="Commission">
      <div className="panel__block">
        <Eyebrow index="08">Nova</Eyebrow>
        <h2 className="display display--sm">
          Assembled
          <br />
          for one
        </h2>

        <div className="actions">
          <a className="action action--primary" href="#commission">
            Request a commission
            <ArrowRight aria-hidden="true" />
          </a>

          <button type="button" className="action" onClick={onReturn}>
            Return to start
            <ArrowUp aria-hidden="true" />
          </button>
        </div>

        <div className="colophon">
          <p>
            NOVA is a fictional marque, built as an interactive study. Vehicle model{' '}
            <a
              href="https://github.com/KhronosGroup/glTF-Sample-Assets/tree/main/Models/CarConcept"
              target="_blank"
              rel="noreferrer noopener"
            >
              Car Concept
            </a>{' '}
            by Eric Chadwick, Darmstadt Graphics Group, licensed{' '}
            <a
              href="https://creativecommons.org/licenses/by/4.0/"
              target="_blank"
              rel="noreferrer noopener"
            >
              CC BY 4.0
            </a>
            . Materials, lighting and choreography are original.
          </p>
        </div>
      </div>
    </Panel>
  );
}
