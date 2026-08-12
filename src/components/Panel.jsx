/**
 * A section of copy, overlaid on the continuous 3D shot.
 *
 * Panels do not stack in a document — they all occupy the same fixed
 * frame and are exchanged by the master scroll timeline, which is what
 * keeps the experience reading as one take. `register` hands the
 * element to that timeline.
 */
export function Panel({ id, register, variant = 'left', label, children }) {
  return (
    <section
      ref={(el) => register(id, el)}
      className={`panel panel--${variant}`}
      aria-label={label}
    >
      {children}
    </section>
  );
}

/** Ordinal + rule + name. The opening mark of every section. */
export function Eyebrow({ index, children }) {
  return (
    <div className="eyebrow">
      <span className="ordinal">{index}</span>
      <span className="eyebrow__rule" />
      <p className="label">{children}</p>
    </div>
  );
}

/** Key/value rows under a hairline. Used wherever specifications appear. */
export function SpecList({ rows }) {
  return (
    <dl className="spec">
      {rows.map(([key, value]) => (
        <div className="spec__row" key={key}>
          <dt className="spec__key">{key}</dt>
          <dd className="spec__value">{value}</dd>
        </div>
      ))}
    </dl>
  );
}
