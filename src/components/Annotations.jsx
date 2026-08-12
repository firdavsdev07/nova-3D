import { ANNOTATIONS } from '../three/VehicleParts.js';

/**
 * Component labels, pinned to the 3D parts they name.
 *
 * These elements are positioned by the render loop, not by React or by
 * CSS: each frame the anchor part's world position is projected to
 * screen and written straight to `transform`. They therefore stay
 * attached while the part flies out during the explode.
 *
 * React's only job is to render them once and hand over the nodes.
 */
export function Annotations({ bind }) {
  return (
    <div className="annotations" aria-hidden="true">
      {ANNOTATIONS.map((annotation) => (
        <div className="annotation" key={annotation.id} ref={(el) => bind(annotation.id, el)}>
          <span className="annotation__pin" />
          <span className="annotation__leader" />

          <div className="annotation__body">
            <p className="annotation__title">{annotation.label}</p>
            <dl className="annotation__spec">
              {annotation.spec.map(([key, value]) => (
                <div className="annotation__row" key={key}>
                  <dt>{key}</dt>
                  <dd>{value}</dd>
                </div>
              ))}
            </dl>
          </div>
        </div>
      ))}
    </div>
  );
}
