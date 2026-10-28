export function Newsletter() {
  return (
    <section className="newsletter" aria-labelledby="newsletter-heading">
      <h2 id="newsletter-heading">Get care tips by email</h2>
      <form className="newsletter-form" onSubmit={(e) => e.preventDefault()}>
        <label htmlFor="newsletter-name" className="visually-hidden">
          Name
        </label>
        <input id="newsletter-name" name="name" autoComplete="name" placeholder="Name" />
        <span className="newsletter-caption">Email</span>
        <input id="newsletter-email" name="email" type="email" />
        <button type="submit" className="button subscribe-button">
          Subscribe <a href="/privacy">(privacy)</a>
        </button>
      </form>
    </section>
  );
}
