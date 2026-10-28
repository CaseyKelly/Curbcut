const iconProps = {
  width: 20,
  height: 20,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  'aria-hidden': true,
  focusable: false,
} as const;

export function SearchIcon() {
  return (
    <svg {...iconProps}>
      <circle cx="11" cy="11" r="7" />
      <path d="M20 20l-4-4" />
    </svg>
  );
}

export function CartIcon() {
  return (
    <svg {...iconProps}>
      <path d="M3 4h2l2.5 11h11L21 7H7" />
      <circle cx="9" cy="20" r="1.5" />
      <circle cx="18" cy="20" r="1.5" />
    </svg>
  );
}

export function LeafIcon() {
  return (
    <svg {...iconProps}>
      <path d="M5 19C5 10 11 5 19 5C19 13 14 19 5 19Z" />
      <path d="M5 19L13 11" />
    </svg>
  );
}
