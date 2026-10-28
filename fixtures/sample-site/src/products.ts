export interface Product {
  id: string;
  name: string;
  price: number;
  rating: number;
  image: string;
  alt: string;
}

export const products: Product[] = [
  {
    id: 'fern',
    name: 'Boston Fern',
    price: 24,
    rating: 4,
    image: '/plant-fern.svg',
    alt: 'Boston fern with long arching fronds in a white pot',
  },
  {
    id: 'cactus',
    name: 'Barrel Cactus',
    price: 18,
    rating: 5,
    image: '/plant-cactus.svg',
    alt: 'Round barrel cactus in a terracotta pot',
  },
  {
    id: 'monstera',
    name: 'Monstera',
    price: 42,
    rating: 3,
    image: '/plant-monstera.svg',
    alt: 'Monstera with large split leaves in a grey pot',
  },
];
