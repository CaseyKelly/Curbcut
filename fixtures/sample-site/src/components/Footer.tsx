import { LeafIcon } from './icons';

export function Footer() {
  return (
    <footer className="site-footer">
      <div className="footer-links">
        <li>
          <a href="/about">About</a>
        </li>
        <li>
          <a href="/delivery">Delivery</a>
        </li>
        <li>
          <a href="/contact">Contact</a>
        </li>
      </div>
      <a href="/community" className="social-link">
        <LeafIcon />
        <span className="visually-hidden">Join the Fernleaf plant community</span>
      </a>
      <p className="footer-legal">© 2026 Fernleaf Plants. Prices include VAT.</p>
    </footer>
  );
}
