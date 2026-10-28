import { useState } from 'react';

export default function GiftWrapOption() {
  const [checked, setChecked] = useState(false);
  return (
    <div className="option">
      <div
        role="checkbox"
        tabIndex={0}
        aria-labelledby="gift-wrap-label"
        className={checked ? 'box box-checked' : 'box'}
        onClick={() => setChecked(!checked)}
        onKeyDown={(e) => {
          if (e.key === ' ') setChecked(!checked);
        }}
      />
      <span id="gift-wrap-label">Add gift wrap (£3)</span>
    </div>
  );
}
