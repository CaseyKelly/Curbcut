import { useState } from 'react';

export default function GiftWrapOption() {
  const [checked, setChecked] = useState(false);
  return (
    <div className="option">
      <input
        id="gift-wrap"
        type="checkbox"
        checked={checked}
        onChange={(e) => setChecked(e.target.checked)}
      />
      <label htmlFor="gift-wrap">Add gift wrap (£3)</label>
    </div>
  );
}
