export function Hero() {
  return (
    <section className="hero">
      <img src="/hero.svg" className="hero-image" width={1200} height={400} />
      <h1>Plants that like your flat as much as you do</h1>
      <p className="hero-tagline">Free delivery on orders over $40</p>
      <div className="ticker">
        <p className="ticker-item">
          New: rare aroids every Friday. <a href="/new-in">See what&apos;s in</a>
        </p>
        <p className="ticker-item ticker-clone" aria-hidden="true">
          New: rare aroids every Friday. <a href="/new-in">See what&apos;s in</a>
        </p>
      </div>
      <img src="/divider.svg" alt="" className="divider" width={600} height={8} />
      <a href="#shop" className="button">
        Shop plants
      </a>
    </section>
  );
}
