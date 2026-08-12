/**
 * The loading veil.
 *
 * Progress is real: the GLB is streamed and the bar tracks bytes
 * received (see Vehicle.fetchWithProgress), so it moves the way the
 * network actually moves rather than on a timer.
 */
export function Loader({ progress, error, veilRef }) {
  const pct = Math.round(progress * 100);

  return (
    <div className="loader" ref={veilRef} role="status" aria-live="polite">
      <p className="loader__mark">Nova</p>

      {error ? (
        <p className="loader__error">{error}</p>
      ) : (
        <div className="loader__readout">
          <div className="loader__row">
            <span className="label">Loading vehicle</span>
            <span className="loader__value">{String(pct).padStart(2, '0')}%</span>
          </div>

          <div className="loader__track">
            <span className="loader__fill" style={{ transform: `scaleX(${progress})` }} />
          </div>
        </div>
      )}
    </div>
  );
}
