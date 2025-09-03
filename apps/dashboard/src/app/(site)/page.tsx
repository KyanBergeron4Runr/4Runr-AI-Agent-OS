import { Hero } from '@/components/sections/hero';
import { Pillars } from '@/components/sections/pillars';
import { DemoPromo } from '@/components/sections/demo-promo';

export default function HomePage() {
  return (
    <>
      {/* Hero Section */}
      <Hero />
      
      {/* Pillars Section */}
      <Pillars />
      
      {/* Demo Promo Section */}
      <DemoPromo />
    </>
  );
}
