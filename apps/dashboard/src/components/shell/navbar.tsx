'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { useScrollHeader } from '@/lib/hooks/useScrollHeader';
import { trackNavigation, trackCTA, trackMobileMenu } from '@/lib/analytics';

const navigation = [
  { name: 'Home', href: '/', id: 'nav_home' },
  { name: 'Demo', href: '/demo', id: 'nav_demo' },
  { name: 'Sandbox', href: '/sandbox', id: 'nav_sandbox' },
  { name: 'Docs', href: '/docs', id: 'nav_docs' },
  { name: 'Pricing', href: '/pricing', id: 'nav_pricing' },
];

interface NavbarProps {
  /**
   * Whether to show the mobile menu toggle
   * @default true
   */
  showMobileToggle?: boolean;
  
  /**
   * Callback when mobile menu is toggled
   */
  onMobileToggle?: () => void;
}

export function Navbar({ showMobileToggle = true, onMobileToggle }: NavbarProps) {
  const pathname = usePathname();
  const { isScrolled, headerClasses } = useScrollHeader();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const handleNavClick = (item: typeof navigation[0]) => {
    trackNavigation(item.id, item.href);
  };

  const handleCTAClick = (type: 'primary' | 'secondary', destination: string, id: string) => {
    trackCTA(id, type, destination);
  };

  const handleMobileToggle = () => {
    const newState = !isMobileMenuOpen;
    setIsMobileMenuOpen(newState);
    trackMobileMenu(newState ? 'open' : 'close');
    
    if (onMobileToggle) {
      onMobileToggle();
    }
  };

  const isActivePage = (href: string) => {
    if (href === '/') {
      return pathname === '/';
    }
    return pathname.startsWith(href);
  };

  return (
    <header 
      className={`
        fixed top-0 left-0 right-0 z-50 
        transition-all duration-300 ease-in-out
        ${headerClasses}
      `}
    >
      <nav className="max-w-7xl mx-auto px-6">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <div className="flex items-center">
            <Link
              href="/"
              className="flex items-center gap-3 hover:-translate-y-[1px] transition-transform duration-200 focus:ring-2 focus:ring-brand-600 focus:outline-none rounded-md"
              onClick={() => handleNavClick({ name: 'Logo', href: '/', id: 'nav_logo' })}
              data-analytics-id="nav_logo"
            >
              <div className="w-8 h-8 bg-brand-600 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-sm">4R</span>
              </div>
              <span className="text-h3 font-semibold text-ink-900">4Runr</span>
              <span className="text-eyebrow text-ink-500 bg-ink-100 px-2 py-0.5 rounded-full">
                Agent OS
              </span>
            </Link>
          </div>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center gap-8">
            <div className="flex items-center gap-1">
              {navigation.map((item) => {
                const isActive = isActivePage(item.href);
                return (
                  <Link
                    key={item.name}
                    href={item.href}
                    className={`
                      px-4 py-2 rounded-lg text-body font-medium
                      transition-all duration-200
                      hover:-translate-y-[1px] hover:shadow-sm
                      focus:ring-2 focus:ring-brand-600 focus:outline-none
                      ${
                        isActive
                          ? 'bg-brand-50 text-brand-700 border border-brand-200'
                          : 'text-ink-600 hover:text-ink-900 hover:bg-ink-50'
                      }
                    `}
                    onClick={() => handleNavClick(item)}
                    data-analytics-id={item.id}
                    aria-current={isActive ? 'page' : undefined}
                  >
                    {item.name}
                  </Link>
                );
              })}
            </div>

            {/* Desktop CTAs */}
            <div className="flex items-center gap-3">
              <Link
                href="/sandbox"
                className="
                  px-4 py-2 text-body font-medium text-ink-600 
                  border border-borderColors-primary rounded-lg
                  hover:-translate-y-[1px] hover:shadow-sm hover:border-borderColors-secondary
                  focus:ring-2 focus:ring-brand-600 focus:outline-none
                  transition-all duration-200
                "
                onClick={() => handleCTAClick('secondary', '/sandbox', 'cta_try_sandbox_desktop')}
                data-analytics-id="cta_try_sandbox_desktop"
              >
                Try Sandbox
              </Link>
              
              <Link
                href="/pricing#contact"
                className="
                  px-4 py-2 text-body font-medium text-white 
                  bg-brand-600 rounded-lg
                  hover:-translate-y-[1px] hover:shadow-md hover:bg-brand-700
                  focus:ring-2 focus:ring-brand-600 focus:outline-none
                  transition-all duration-200
                "
                onClick={() => handleCTAClick('primary', '/pricing#contact', 'cta_request_access_desktop')}
                data-analytics-id="cta_request_access_desktop"
              >
                Request Access
              </Link>
            </div>
          </div>

          {/* Mobile Menu Toggle */}
          {showMobileToggle && (
            <div className="md:hidden">
              <button
                type="button"
                className="
                  p-2 text-ink-500 hover:text-ink-700 hover:bg-ink-50 
                  rounded-lg transition-colors duration-200
                  focus:ring-2 focus:ring-brand-600 focus:outline-none
                "
                onClick={handleMobileToggle}
                data-analytics-id="mobile_menu_toggle"
                aria-expanded={isMobileMenuOpen}
                aria-controls="mobile-menu"
                aria-label="Toggle mobile menu"
              >
                <svg
                  className="w-6 h-6"
                  fill="none"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  aria-hidden="true"
                >
                  {isMobileMenuOpen ? (
                    <path d="M6 18L18 6M6 6l12 12" />
                  ) : (
                    <path d="M4 6h16M4 12h16M4 18h16" />
                  )}
                </svg>
              </button>
            </div>
          )}
        </div>

        {/* Mobile Navigation Dropdown (for demo purposes) */}
        {isMobileMenuOpen && (
          <div 
            className="md:hidden border-t border-borderColors-primary/20 py-4"
            id="mobile-menu"
            role="menu"
            aria-label="Mobile navigation menu"
          >
            <div className="space-y-1" role="none">
              {navigation.map((item) => {
                const isActive = isActivePage(item.href);
                return (
                  <Link
                    key={item.name}
                    href={item.href}
                    className={`
                      block px-4 py-3 text-body font-medium rounded-lg
                      transition-all duration-200
                      focus:ring-2 focus:ring-brand-600 focus:outline-none
                      ${
                        isActive
                          ? 'bg-brand-50 text-brand-700 border border-brand-200'
                          : 'text-ink-600 hover:text-ink-900 hover:bg-ink-50'
                      }
                    `}
                    onClick={() => {
                      handleNavClick(item);
                      setIsMobileMenuOpen(false);
                      trackMobileMenu('link_click', item.name);
                    }}
                    data-analytics-id={`${item.id}_mobile`}
                    role="menuitem"
                    aria-current={isActive ? 'page' : undefined}
                  >
                    {item.name}
                  </Link>
                );
              })}
            </div>

            {/* Mobile CTAs */}
            <div className="mt-6 space-y-3 pt-6 border-t border-borderColors-primary/20">
              <Link
                href="/sandbox"
                className="
                  block w-full px-4 py-3 text-center text-body font-medium 
                  text-ink-600 border border-borderColors-primary rounded-lg
                  hover:bg-ink-50 hover:border-borderColors-secondary
                  focus:ring-2 focus:ring-brand-600 focus:outline-none
                  transition-all duration-200
                "
                onClick={() => {
                  handleCTAClick('secondary', '/sandbox', 'cta_try_sandbox_mobile');
                  setIsMobileMenuOpen(false);
                }}
                data-analytics-id="cta_try_sandbox_mobile"
                role="menuitem"
              >
                Try Sandbox
              </Link>
              
              <Link
                href="/pricing#contact"
                className="
                  block w-full px-4 py-3 text-center text-body font-medium 
                  text-white bg-brand-600 rounded-lg
                  hover:bg-brand-700 hover:shadow-md
                  focus:ring-2 focus:ring-brand-600 focus:outline-none
                  transition-all duration-200
                "
                onClick={() => {
                  handleCTAClick('primary', '/pricing#contact', 'cta_request_access_mobile');
                  setIsMobileMenuOpen(false);
                }}
                data-analytics-id="cta_request_access_mobile"
                role="menuitem"
              >
                Request Access
              </Link>
            </div>
          </div>
        )}
      </nav>
    </header>
  );
}
