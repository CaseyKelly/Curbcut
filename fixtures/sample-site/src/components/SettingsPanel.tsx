import { useState, type KeyboardEvent } from 'react';

const speeds = ['Standard', 'Next day', 'Same day'];

export function SettingsPanel() {
  const [sms, setSms] = useState(false);
  const [speed, setSpeed] = useState('Standard');

  const onSwitchKey = (e: KeyboardEvent) => {
    if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault();
      setSms((v) => !v);
    }
  };

  return (
    <section className="settings" aria-labelledby="settings-heading">
      <h2 id="settings-heading">Delivery preferences</h2>
      <div className="setting">
        <span className="setting-label">Text me when my order ships</span>
        <div
          role="switch"
          aria-checked={sms}
          tabIndex={0}
          className="switch"
          onClick={() => setSms((v) => !v)}
          onKeyDown={onSwitchKey}
        />
      </div>
      <div className="setting">
        <input id="setting-leave-safe" type="checkbox" />
        <label htmlFor="setting-leave-safe">Leave it somewhere safe if I am out</label>
      </div>
      <div className="setting">
        <span id="delivery-window-label" className="setting-label">
          Earliest delivery time
        </span>
        <div
          role="slider"
          aria-labelledby="delivery-window-label"
          aria-valuemin={8}
          aria-valuemax={20}
          tabIndex={0}
          className="slider"
        >
          <span className="slider-thumb" />
        </div>
      </div>
      <div className="setting">
        <span className="setting-label">Delivery speed</span>
        <div role="radio-group" className="segmented">
          {speeds.map((s) => (
            <button
              key={s}
              type="button"
              aria-pressed={speed === s}
              onClick={() => setSpeed(s)}
            >
              {s}
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}
