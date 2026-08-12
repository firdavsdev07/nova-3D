import { Volume2, VolumeX } from 'lucide-react';

/**
 * Sound is off until asked for — no autoplay to be blocked, and no
 * assumption that a visitor wants audio. The control is an icon and a
 * ring: on, it takes the accent and emits a slow pulse; off, it is
 * another hairline in the chrome.
 */
export function SoundControl({ on, onToggle }) {
  return (
    <button
      type="button"
      className="sound"
      data-on={on}
      onClick={onToggle}
      aria-pressed={on}
      aria-label={on ? 'Mute soundtrack' : 'Play soundtrack'}
      title={on ? 'Sound on' : 'Sound off'}
    >
      <span className="sound__meter" aria-hidden="true" />
      {on ? <Volume2 aria-hidden="true" /> : <VolumeX aria-hidden="true" />}
    </button>
  );
}
