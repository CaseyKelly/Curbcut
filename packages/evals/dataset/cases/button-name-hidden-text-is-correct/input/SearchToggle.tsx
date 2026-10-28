export default function SearchToggle() {
  return (
    <button type="button" className="icon-button">
      <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true">
        <circle cx="9" cy="9" r="6" fill="none" stroke="currentColor" strokeWidth="2" />
        <path d="M14 14l4 4" stroke="currentColor" strokeWidth="2" />
      </svg>
      <span className="visually-hidden">Search</span>
    </button>
  );
}
