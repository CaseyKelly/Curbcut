export function Hero() {
  return (
    <section className="hero">
      <img src="/hero.svg" className="hero-image" width={1200} height={400} />
      <h1>Plants that like your flat as much as you do</h1>
      <p className="hero-tagline">Free delivery on orders over $40</p>
      <img src="/divider.svg" alt="" className="divider" width={600} height={8} />
      <a href="#shop" className="button">
        Shop plants
      </a>
    </section>
  );
}
