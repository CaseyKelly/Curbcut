import { CheckoutForm } from './components/CheckoutForm';
import { Faq } from './components/Faq';
import { Footer } from './components/Footer';
import { Header } from './components/Header';
import { Hero } from './components/Hero';
import { Newsletter } from './components/Newsletter';
import { ProductGrid } from './components/ProductGrid';
import { SettingsPanel } from './components/SettingsPanel';
import { StoreMap } from './components/StoreMap';

export function App() {
  return (
    <>
      <Header />
      <main>
        <Hero />
        <ProductGrid />
        <Newsletter />
        <CheckoutForm />
        <Faq />
        <SettingsPanel />
        <StoreMap />
      </main>
      <Footer />
    </>
  );
}
