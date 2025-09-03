'use client';

import { useState } from 'react';
import { Navbar } from '@/components/shell/navbar';
import { MobileDrawer } from '@/components/shell/mobile-drawer';
import { Footer } from '@/components/shell/footer';

interface SiteLayoutProps {
  children: React.ReactNode;
}

/**
 * Site Layout Component
 * 
 * Wraps all core routes (/, /demo, /sandbox, /docs, /pricing) with:
 * - Sticky navbar with scroll effects
 * - Mobile drawer with focus trap
 * - Comprehensive footer
 * - Proper spacing and accessibility
 */
export default function SiteLayout({ children }: SiteLayoutProps) {
  const [isMobileDrawerOpen, setIsMobileDrawerOpen] = useState(false);

  const handleMobileDrawerToggle = () => {
    setIsMobileDrawerOpen(!isMobileDrawerOpen);
  };

  const handleMobileDrawerClose = () => {
    setIsMobileDrawerOpen(false);
  };

  const handleMobileDrawerOpen = () => {
    setIsMobileDrawerOpen(true);
  };

  return (
    <div className="min-h-screen flex flex-col">
      {/* Navigation */}
      <Navbar 
        showMobileToggle={true}
        onMobileToggle={handleMobileDrawerToggle}
      />
      
      {/* Mobile Drawer */}
      <MobileDrawer
        open={isMobileDrawerOpen}
        onClose={handleMobileDrawerClose}
        onOpen={handleMobileDrawerOpen}
      />

      {/* Main Content */}
      <main className="flex-1 pt-16">
        {/* 
          pt-16 accounts for the fixed navbar height (h-16)
          This ensures content doesn't hide behind the sticky header
        */}
        {children}
      </main>

      {/* Footer */}
      <Footer showBorder={true} />
    </div>
  );
}
