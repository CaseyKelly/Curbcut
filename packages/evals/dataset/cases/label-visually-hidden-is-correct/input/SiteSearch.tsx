const visuallyHidden = {
  position: 'absolute',
  width: 1,
  height: 1,
  overflow: 'hidden',
  clipPath: 'inset(50%)',
  whiteSpace: 'nowrap',
} as const;

export default function SiteSearch() {
  return (
    <form role="search" action="/search">
      <label htmlFor="site-search" style={visuallyHidden}>
        Search plants
      </label>
      <input id="site-search" type="search" name="q" />
      <button type="submit">Search</button>
    </form>
  );
}
