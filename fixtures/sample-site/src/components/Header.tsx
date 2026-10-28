import { CartIcon, SearchIcon } from './icons';

export function Header() {
  return (
    <header className="site-header">
      <a href="/" className="logo-link">
        <img src="/logo.svg" alt="" width={32} height={32} />
      </a>
      <nav aria-label="Main">
        <ul className="nav-list">
          <li>
            <a href="#shop">Shop</a>
          </li>
          <li>
            <a href="#faq">FAQ</a>
          </li>
          <li>
            <a href="#visit">Visit us</a>
          </li>
        </ul>
      </nav>
      <div className="header-actions">
        <button type="button" className="icon-button search-button" aria-label="Search">
          <SearchIcon />
        </button>
        <button type="button" className="icon-button cart-button">
          <CartIcon />
        </button>
      </div>
    </header>
  );
}
