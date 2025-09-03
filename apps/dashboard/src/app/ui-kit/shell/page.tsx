'use client';

import { useState } from 'react';
import { Navbar } from '@/components/shell/navbar';
import { MobileDrawer } from '@/components/shell/mobile-drawer';
import { Footer } from '@/components/shell/footer';

export default function ShellUIKitPage() {
  const [isMobileDrawerOpen, setIsMobileDrawerOpen] = useState(false);
  const [navbarScrolled, setNavbarScrolled] = useState(false);

  const handleMobileDrawerToggle = () => {
    setIsMobileDrawerOpen(!isMobileDrawerOpen);
  };

  const handleMobileDrawerClose = () => {
    setIsMobileDrawerOpen(false);
  };

  const simulateScroll = () => {
    setNavbarScrolled(!navbarScrolled);
  };

  return (
    <div className="min-h-screen bg-bg-secondary">
      {/* Page Header */}
      <div className="max-w-7xl mx-auto px-6 py-20 md:py-[80px]">
        <div className="text-center mb-16">
          <h1 className="text-h1 text-ink-900 mb-4">Shell Components</h1>
          <p className="text-body text-ink-600 max-w-2xl mx-auto">
            Navigation, layout, and structural components that form the foundation of the 4Runr Agent OS interface.
          </p>
        </div>

        {/* Navbar Demo */}
        <section className="mb-16">
          <h2 className="text-h2 text-ink-900 mb-8">Navigation Bar</h2>
          
          <div className="space-y-8">
            {/* Default State */}
            <div>
              <h3 className="text-h3 text-ink-800 mb-4">Default State</h3>
              <div className="bg-bg-primary border border-borderColors-primary rounded-xl overflow-hidden">
                <div style={{ transform: navbarScrolled ? 'translateY(0)' : 'translateY(0)' }}>
                  <Navbar 
                    showMobileToggle={true}
                    onMobileToggle={handleMobileDrawerToggle}
                  />
                </div>
                {/* Spacer to show navbar */}
                <div className="h-16"></div>
                <div className="p-6">
                  <p className="text-body text-ink-600 mb-4">
                    The navbar features active route styling, hover effects, and responsive design.
                  </p>
                  <button
                    onClick={simulateScroll}
                    className="
                      px-4 py-2 text-body font-medium text-brand-600 
                      border border-brand-600 rounded-lg
                      hover:bg-brand-50 transition-colors duration-200
                      focus:ring-2 focus:ring-brand-600 focus:outline-none
                    "
                  >
                    {navbarScrolled ? 'Show Default State' : 'Simulate Scroll Effect'}
                  </button>
                </div>
              </div>
            </div>

            {/* Features */}
            <div>
              <h3 className="text-h3 text-ink-800 mb-4">Features</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-bg-primary border border-borderColors-primary rounded-xl p-6">
                  <h4 className="text-body font-semibold text-ink-800 mb-3">Scroll Effects</h4>
                  <ul className="space-y-2 text-body text-ink-600">
                    <li>• Translucent blurred background on scroll</li>
                    <li>• Subtle shadow and border effects</li>
                    <li>• Smooth transitions using design tokens</li>
                  </ul>
                </div>
                <div className="bg-bg-primary border border-borderColors-primary rounded-xl p-6">
                  <h4 className="text-body font-semibold text-ink-800 mb-3">Accessibility</h4>
                  <ul className="space-y-2 text-body text-ink-600">
                    <li>• Keyboard navigation support</li>
                    <li>• Focus rings on all interactive elements</li>
                    <li>• ARIA labels and semantic markup</li>
                  </ul>
                </div>
                <div className="bg-bg-primary border border-borderColors-primary rounded-xl p-6">
                  <h4 className="text-body font-semibold text-ink-800 mb-3">Analytics</h4>
                  <ul className="space-y-2 text-body text-ink-600">
                    <li>• All clicks tracked with data-analytics-id</li>
                    <li>• Navigation and CTA events</li>
                    <li>• Mobile menu interactions</li>
                  </ul>
                </div>
                <div className="bg-bg-primary border border-borderColors-primary rounded-xl p-6">
                  <h4 className="text-body font-semibold text-ink-800 mb-3">Responsive</h4>
                  <ul className="space-y-2 text-body text-ink-600">
                    <li>• Mobile-first design approach</li>
                    <li>• Collapsible mobile menu</li>
                    <li>• Adaptive CTA placement</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Mobile Drawer Demo */}
        <section className="mb-16">
          <h2 className="text-h2 text-ink-900 mb-8">Mobile Drawer</h2>
          
          <div className="space-y-6">
            <div className="bg-bg-primary border border-borderColors-primary rounded-xl p-6">
              <h3 className="text-h3 text-ink-800 mb-4">Interactive Demo</h3>
              <p className="text-body text-ink-600 mb-6">
                Click the button below to open the mobile drawer. It features focus trapping, 
                keyboard navigation, and can be closed with ESC or backdrop click.
              </p>
              
              <button
                onClick={handleMobileDrawerToggle}
                className="
                  px-6 py-3 text-body font-medium text-white 
                  bg-brand-600 rounded-lg
                  hover:bg-brand-700 hover:shadow-md
                  focus:ring-2 focus:ring-brand-600 focus:outline-none
                  transition-all duration-200
                "
              >
                {isMobileDrawerOpen ? 'Close' : 'Open'} Mobile Drawer
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-bg-primary border border-borderColors-primary rounded-xl p-6">
                <h4 className="text-body font-semibold text-ink-800 mb-3">Features</h4>
                <ul className="space-y-2 text-body text-ink-600">
                  <li>• Radix UI Dialog primitive</li>
                  <li>• Focus trap and keyboard navigation</li>
                  <li>• Backdrop blur and overlay</li>
                  <li>• Smooth slide-in animation</li>
                </ul>
              </div>
              <div className="bg-bg-primary border border-borderColors-primary rounded-xl p-6">
                <h4 className="text-body font-semibold text-ink-800 mb-3">Interactions</h4>
                <ul className="space-y-2 text-body text-ink-600">
                  <li>• ESC key to close</li>
                  <li>• Backdrop click to dismiss</li>
                  <li>• Close button with analytics</li>
                  <li>• Auto-focus management</li>
                </ul>
              </div>
            </div>
          </div>
        </section>

        {/* Footer Demo */}
        <section className="mb-16">
          <h2 className="text-h2 text-ink-900 mb-8">Footer</h2>
          
          <div className="space-y-6">
            <div className="bg-bg-primary border border-borderColors-primary rounded-xl overflow-hidden">
              <div className="p-6 border-b border-borderColors-primary">
                <h3 className="text-h3 text-ink-800 mb-2">Complete Footer</h3>
                <p className="text-body text-ink-600">
                  Four-column layout with Product, Company, Legal, and Social links, 
                  plus newsletter signup and bottom bar.
                </p>
              </div>
              
              {/* Footer Preview */}
              <div style={{ transform: 'scale(0.8)', transformOrigin: 'top left', width: '125%' }}>
                <Footer showBorder={false} />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-bg-primary border border-borderColors-primary rounded-xl p-6">
                <h4 className="text-body font-semibold text-ink-800 mb-3">Structure</h4>
                <ul className="space-y-2 text-body text-ink-600">
                  <li>• Four main columns</li>
                  <li>• Newsletter signup</li>
                  <li>• Social media links</li>
                  <li>• Bottom copyright bar</li>
                </ul>
              </div>
              <div className="bg-bg-primary border border-borderColors-primary rounded-xl p-6">
                <h4 className="text-body font-semibold text-ink-800 mb-3">Content</h4>
                <ul className="space-y-2 text-body text-ink-600">
                  <li>• Product & feature links</li>
                  <li>• Company information</li>
                  <li>• Legal & compliance</li>
                  <li>• Community connections</li>
                </ul>
              </div>
              <div className="bg-bg-primary border border-borderColors-primary rounded-xl p-6">
                <h4 className="text-body font-semibold text-ink-800 mb-3">Design</h4>
                <ul className="space-y-2 text-body text-ink-600">
                  <li>• Responsive grid layout</li>
                  <li>• Consistent spacing</li>
                  <li>• External link indicators</li>
                  <li>• Hover state animations</li>
                </ul>
              </div>
            </div>
          </div>
        </section>

        {/* Implementation Guide */}
        <section className="mb-16">
          <h2 className="text-h2 text-ink-900 mb-8">Implementation Guide</h2>
          
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div className="bg-bg-primary border border-borderColors-primary rounded-xl p-6">
              <h3 className="text-h3 text-ink-800 mb-4">Basic Layout</h3>
              <div className="bg-bg-tertiary p-4 rounded-lg font-mono text-sm">
                <div className="text-ink-600">
                  {`<SiteLayout>`}<br/>
                  {`  <Navbar />`}<br/>
                  {`  <MobileDrawer />`}<br/>
                  {`  <main>{children}</main>`}<br/>
                  {`  <Footer />`}<br/>
                  {`</SiteLayout>`}
                </div>
              </div>
            </div>

            <div className="bg-bg-primary border border-borderColors-primary rounded-xl p-6">
              <h3 className="text-h3 text-ink-800 mb-4">Analytics Setup</h3>
              <div className="bg-bg-tertiary p-4 rounded-lg font-mono text-sm">
                <div className="text-ink-600">
                  {`import { trackNavigation, trackCTA }`}<br/>
                  {`from '@/lib/analytics';`}<br/><br/>
                  {`// Track navigation clicks`}<br/>
                  {`trackNavigation(id, href);`}<br/><br/>
                  {`// Track CTA interactions`}<br/>
                  {`trackCTA(id, type, destination);`}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Usage Guidelines */}
        <section className="bg-bg-primary border border-borderColors-primary rounded-xl p-8">
          <h2 className="text-h2 text-ink-900 mb-6">Usage Guidelines</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div>
              <h3 className="text-h3 text-ink-800 mb-4">✅ Do</h3>
              <ul className="space-y-2 text-body text-ink-700">
                <li>• Use semantic design tokens consistently</li>
                <li>• Maintain focus trap in mobile drawer</li>
                <li>• Include analytics IDs on all interactions</li>
                <li>• Test keyboard navigation thoroughly</li>
                <li>• Ensure active states are clearly visible</li>
              </ul>
            </div>
            
            <div>
              <h3 className="text-h3 text-ink-800 mb-4">❌ Don't</h3>
              <ul className="space-y-2 text-body text-ink-700">
                <li>• Override scroll behavior without testing</li>
                <li>• Remove focus rings or accessibility features</li>
                <li>• Use hardcoded colors or spacing values</li>
                <li>• Forget to close mobile drawer on route change</li>
                <li>• Disable backdrop blur or overlay effects</li>
              </ul>
            </div>
          </div>
        </section>
      </div>

      {/* Mobile Drawer Component */}
      <MobileDrawer
        open={isMobileDrawerOpen}
        onClose={handleMobileDrawerClose}
      />
    </div>
  );
}
