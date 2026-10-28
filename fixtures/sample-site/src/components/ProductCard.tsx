import type { Product } from '../products';

export function ProductCard({ product }: { product: Product }) {
  const stars = '★'.repeat(product.rating) + '☆'.repeat(5 - product.rating);
  return (
    <div className="product-card">
      <img src={product.image} alt={product.alt} width={200} height={200} />
      <h3>{product.name}</h3>
      <span role="img" className="rating">
        {stars}
      </span>
      <p className="price">${product.price}</p>
      <button type="button" className="button">
        Add to cart
      </button>
    </div>
  );
}
