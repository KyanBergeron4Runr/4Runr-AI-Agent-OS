'use client';

import { useEffect, useCallback } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import * as Dialog from '@radix-ui/react-dialog';
import { trackNavigation, trackCTA, trackMobileMenu } from '@/lib/analytics';

const navigation = [
  { name: 'Home', href: '/', id: 'nav_home' },
  { name: 'Demo', href: '/demo', id: 'nav_demo' },
  { name: 'Sandbox', href: '/sandbox', id: 'nav_sandbox' },
  { name: 'Docs', href: '/docs', id: 'nav_docs' },
  { name: 'Pricing', href: '/pricing', id: 'nav_pricing' },
];

interface MobileDrawerProps {
  /**
   * Whether the drawer is open
   */
  open: boolean;
  
  /**
   * Callback when the drawer is closed
   */
  onClose: () => void;
  
  /**
   * Callback when the drawer should be opened
   */
  onOpen?: () => void;
}

export function MobileDrawer({ open, onClose, onOpen }: MobileDrawerProps) {
  const pathname = usePathname();

  // Track when drawer opens/closes
  useEffect(() => {
    if (open) {
      trackMobileMenu('open');
    }
  }, [open]);

  const handleNavClick = (item: typeof navigation[0]) => {
    trackNavigation(`${item.id}_drawer`, item.href);
    trackMobileMenu('link_click', item.name);
    onClose();
  };

  const handleCTAClick = (type: 'primary' | 'secondary', destination: string, id: string) => {
    trackCTA(id, type, destination);
    onClose();
  };

  const handleClose = useCallback(() => {
    trackMobileMenu('close');
    onClose();
  }, [onClose]);

  const isActivePage = (href: string) => {
    if (href === '/') {
      return pathname === '/';
    }
    return pathname.startsWith(href);
  };

  // Handle escape key
  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && open) {
        handleClose();
      }
    };

    if (open) {
      document.addEventListener('keydown', handleEscape);
      // Prevent body scroll when drawer is open
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = '';
    };
  }, [open, handleClose]);

  return (
    <Dialog.Root open={open} onOpenChange={(isOpen) => {
      if (!isOpen) {
        handleClose();
      } else if (onOpen) {
        onOpen();
      }
    }}>
      <Dialog.Portal>
        {/* Backdrop */}
        <Dialog.Overlay 
          className="
            fixed inset-0 z-40 bg-ink-900/50 
            backdrop-blur-sm
            data-[state=open]:animate-fadeIn
            data-[state=closed]:animate-fadeOut
          "
          onClick={handleClose}
          data-analytics-id="mobile_drawer_backdrop"
        />
        
        {/* Drawer Content */}
        <Dialog.Content
          className="
            fixed top-0 right-0 z-50 h-full w-80 max-w-[85vw] 
            bg-bg-primary shadow-xl
            transform transition-transform duration-300 ease-in-out
            data-[state=open]:translate-x-0
            data-[state=closed]:translate-x-full
            focus:outline-none
          "
          aria-describedby="mobile-drawer-description"
        >
          {/* Drawer Header */}
          <div className="flex items-center justify-between p-6 border-b border-borderColors-primary">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-brand-600 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-sm">4R</span>
              </div>
              <div>
                <div className="text-h3 font-semibold text-ink-900">4Runr</div>
                <div className="text-eyebrow text-ink-500">Agent OS</div>
              </div>
            </div>
            
            <Dialog.Close asChild>
              <button
                className="
                  p-2 text-ink-500 hover:text-ink-700 hover:bg-ink-50 
                  rounded-lg transition-colors duration-200
                  focus:ring-2 focus:ring-brand-600 focus:outline-none
                "
                aria-label="Close mobile menu"
                data-analytics-id="mobile_drawer_close"
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
                  <path d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </Dialog.Close>
          </div>

          {/* Hidden description for screen readers */}
          <Dialog.Description id="mobile-drawer-description" className="sr-only">
            Mobile navigation menu with links to all main sections of the site and call-to-action buttons.
          </Dialog.Description>

          {/* Navigation Links */}
          <div className="flex-1 overflow-y-auto">
            <nav className="p-6" role="navigation" aria-label="Mobile navigation">
              <div className="space-y-2">
                {navigation.map((item) => {
                  const isActive = isActivePage(item.href);
                  return (
                    <Link
                      key={item.name}
                      href={item.href}
                      className={`
                        flex items-center px-4 py-3 text-body font-medium rounded-lg
                        transition-all duration-200
                        focus:ring-2 focus:ring-brand-600 focus:outline-none
                        ${
                          isActive
                            ? 'bg-brand-50 text-brand-700 border border-brand-200'
                            : 'text-ink-600 hover:text-ink-900 hover:bg-ink-50'
                        }
                      `}
                      onClick={() => handleNavClick(item)}
                      data-analytics-id={`${item.id}_drawer`}
                      aria-current={isActive ? 'page' : undefined}
                    >
                      <span>{item.name}</span>
                      {isActive && (
                        <svg
                          className="ml-auto w-4 h-4 text-brand-600"
                          fill="currentColor"
                          viewBox="0 0 20 20"
                          aria-hidden="true"
                        >
                          <path
                            fillRule="evenodd"
                            d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                            clipRule="evenodd"
                          />
                        </svg>
                      )}
                    </Link>
                  );
                })}
              </div>
            </nav>
          </div>

          {/* CTAs at Bottom */}
          <div className="p-6 border-t border-borderColors-primary bg-bg-secondary">
            <div className="space-y-3">
              <Link
                href="/sandbox"
                className="
                  block w-full px-4 py-3 text-center text-body font-medium 
                  text-ink-600 border border-borderColors-primary rounded-lg
                  hover:bg-ink-50 hover:border-borderColors-secondary
                  focus:ring-2 focus:ring-brand-600 focus:outline-none
                  transition-all duration-200
                "
                onClick={() => handleCTAClick('secondary', '/sandbox', 'cta_try_sandbox_drawer')}
                data-analytics-id="cta_try_sandbox_drawer"
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
                onClick={() => handleCTAClick('primary', '/pricing#contact', 'cta_request_access_drawer')}
                data-analytics-id="cta_request_access_drawer"
              >
                Request Access
              </Link>
            </div>
            
            {/* Quick Links */}
            <div className="mt-6 pt-4 border-t border-borderColors-primary/50">
              <div className="text-eyebrow text-ink-500 mb-3">Quick Links</div>
              <div className="flex flex-wrap gap-2">
                <Link
                  href="/docs/api"
                  className="
                    text-sm text-ink-500 hover:text-brand-600 
                    focus:ring-2 focus:ring-brand-600 focus:outline-none rounded
                    transition-colors duration-200
                  "
                  onClick={() => {
                    trackNavigation('quick_link_api_drawer', '/docs/api');
                    onClose();
                  }}
                  data-analytics-id="quick_link_api_drawer"
                >
                  API Docs
                </Link>
                <span className="text-ink-300">•</span>
                <Link
                  href="/docs/examples"
                  className="
                    text-sm text-ink-500 hover:text-brand-600 
                    focus:ring-2 focus:ring-brand-600 focus:outline-none rounded
                    transition-colors duration-200
                  "
                  onClick={() => {
                    trackNavigation('quick_link_examples_drawer', '/docs/examples');
                    onClose();
                  }}
                  data-analytics-id="quick_link_examples_drawer"
                >
                  Examples
                </Link>
                <span className="text-ink-300">•</span>
                <Link
                  href="/support"
                  className="
                    text-sm text-ink-500 hover:text-brand-600 
                    focus:ring-2 focus:ring-brand-600 focus:outline-none rounded
                    transition-colors duration-200
                  "
                  onClick={() => {
                    trackNavigation('quick_link_support_drawer', '/support');
                    onClose();
                  }}
                  data-analytics-id="quick_link_support_drawer"
                >
                  Support
                </Link>
              </div>
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

/**
 * Mobile Drawer Trigger Button Component
 * Use this as a trigger for the mobile drawer
 */
interface MobileDrawerTriggerProps {
  onClick: () => void;
  isOpen: boolean;
}

export function MobileDrawerTrigger({ onClick, isOpen }: MobileDrawerTriggerProps) {
  return (
    <button
      type="button"
      className="
        p-2 text-ink-500 hover:text-ink-700 hover:bg-ink-50 
        rounded-lg transition-colors duration-200
        focus:ring-2 focus:ring-brand-600 focus:outline-none
        md:hidden
      "
      onClick={onClick}
      data-analytics-id="mobile_drawer_trigger"
      aria-expanded={isOpen}
      aria-controls="mobile-drawer"
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
        {isOpen ? (
          <path d="M6 18L18 6M6 6l12 12" />
        ) : (
          <path d="M4 6h16M4 12h16M4 18h16" />
        )}
      </svg>
    </button>
  );
}
