import { products } from '../products';
import { ProductCard } from './ProductCard';

export function ProductGrid() {
  return (
    <section id="shop" aria-labelledby="shop-heading">
      <h2 id="shop-heading">Bestsellers</h2>
      <ul className="product-grid">
        {products.map((product) => (
          <ProductCard key={product.id} product={product} />
        ))}
      </ul>
    </section>
  );
}
