export default function SiteSearch() {
  return (
    <form role="search" action="/search">
      <label htmlFor="site-search" className="visually-hidden">
        Search plants
      </label>
      <input id="site-search" type="search" name="q" />
      <button type="submit">Search</button>
    </form>
  );
}
