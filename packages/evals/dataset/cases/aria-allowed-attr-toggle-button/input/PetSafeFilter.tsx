import { useState } from 'react';

export default function PetSafeFilter() {
  const [on, setOn] = useState(false);
  return (
    <div className="filters">
      <button type="button" aria-checked={on} onClick={() => setOn(!on)}>
        Pet-safe plants only
      </button>
    </div>
  );
}
