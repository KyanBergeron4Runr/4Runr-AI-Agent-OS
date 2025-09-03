'use client';

import Link from 'next/link';
import { trackNavigation } from '@/lib/analytics';

const footerSections = {
  product: {
    title: 'Product',
    links: [
      { name: 'Sandbox', href: '/sandbox', id: 'footer_sandbox' },
      { name: 'Demo', href: '/demo', id: 'footer_demo' },
      { name: 'API Docs', href: '/docs/api', id: 'footer_api_docs' },
      { name: 'Examples', href: '/docs/examples', id: 'footer_examples' },
      { name: 'Integrations', href: '/docs/integrations', id: 'footer_integrations' },
      { name: 'Pricing', href: '/pricing', id: 'footer_pricing' },
    ],
  },
  company: {
    title: 'Company',
    links: [
      { name: 'About', href: '/about', id: 'footer_about' },
      { name: 'Blog', href: '/blog', id: 'footer_blog' },
      { name: 'Careers', href: '/careers', id: 'footer_careers' },
      { name: 'Press', href: '/press', id: 'footer_press' },
      { name: 'Contact', href: '/contact', id: 'footer_contact' },
      { name: 'Partners', href: '/partners', id: 'footer_partners' },
    ],
  },
  legal: {
    title: 'Legal',
    links: [
      { name: 'Privacy Policy', href: '/privacy', id: 'footer_privacy' },
      { name: 'Terms of Service', href: '/terms', id: 'footer_terms' },
      { name: 'Cookie Policy', href: '/cookies', id: 'footer_cookies' },
      { name: 'Data Processing', href: '/data-processing', id: 'footer_data_processing' },
      { name: 'Security', href: '/security', id: 'footer_security' },
      { name: 'Compliance', href: '/compliance', id: 'footer_compliance' },
    ],
  },
  social: {
    title: 'Connect',
    links: [
      { 
        name: 'Twitter', 
        href: 'https://twitter.com/4runr', 
        id: 'footer_twitter',
        external: true,
        icon: (
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M8.29 20.251c7.547 0 11.675-6.253 11.675-11.675 0-.178 0-.355-.012-.53A8.348 8.348 0 0022 5.92a8.19 8.19 0 01-2.357.646 4.118 4.118 0 001.804-2.27 8.224 8.224 0 01-2.605.996 4.107 4.107 0 00-6.993 3.743 11.65 11.65 0 01-8.457-4.287 4.106 4.106 0 001.27 5.477A4.072 4.072 0 012.8 9.713v.052a4.105 4.105 0 003.292 4.022 4.095 4.095 0 01-1.853.07 4.108 4.108 0 003.834 2.85A8.233 8.233 0 012 18.407a11.616 11.616 0 006.29 1.84" />
          </svg>
        )
      },
      { 
        name: 'GitHub', 
        href: 'https://github.com/4runr', 
        id: 'footer_github',
        external: true,
        icon: (
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path fillRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" clipRule="evenodd" />
          </svg>
        )
      },
      { 
        name: 'LinkedIn', 
        href: 'https://linkedin.com/company/4runr', 
        id: 'footer_linkedin',
        external: true,
        icon: (
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path fillRule="evenodd" d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" clipRule="evenodd" />
          </svg>
        )
      },
      { 
        name: 'Discord', 
        href: 'https://discord.gg/4runr', 
        id: 'footer_discord',
        external: true,
        icon: (
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M20.317 4.3698a19.7913 19.7913 0 00-4.8851-1.5152.0741.0741 0 00-.0785.0371c-.211.3753-.4447.8648-.6083 1.2495-1.8447-.2762-3.68-.2762-5.4868 0-.1636-.3933-.4058-.8742-.6177-1.2495a.077.077 0 00-.0785-.037 19.7363 19.7363 0 00-4.8852 1.515.0699.0699 0 00-.0321.0277C.5334 9.0458-.319 13.5799.0992 18.0578a.0824.0824 0 00.0312.0561c2.0528 1.5076 4.0413 2.4228 5.9929 3.0294a.0777.0777 0 00.0842-.0276c.4616-.6304.8731-1.2952 1.226-1.9942a.076.076 0 00-.0416-.1057c-.6528-.2476-1.2743-.5495-1.8722-.8923a.077.077 0 01-.0076-.1277c.1258-.0943.2517-.1923.3718-.2914a.0743.0743 0 01.0776-.0105c3.9278 1.7933 8.18 1.7933 12.0614 0a.0739.0739 0 01.0785.0095c.1202.099.246.1981.3728.2924a.077.077 0 01-.0066.1276 12.2986 12.2986 0 01-1.873.8914.0766.0766 0 00-.0407.1067c.3604.698.7719 1.3628 1.225 1.9932a.076.076 0 00.0842.0286c1.961-.6067 3.9495-1.5219 6.0023-3.0294a.077.077 0 00.0313-.0552c.5004-5.177-.8382-9.6739-3.5485-13.6604a.061.061 0 00-.0312-.0286zM8.02 15.3312c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9555-2.4189 2.157-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419-.0188 1.3332-.9555 2.4189-2.1569 2.4189zm7.9748 0c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9554-2.4189 2.1569-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.9554 2.4189-2.1568 2.4189Z"/>
          </svg>
        )
      },
      { 
        name: 'YouTube', 
        href: 'https://youtube.com/c/4runr', 
        id: 'footer_youtube',
        external: true,
        icon: (
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path fillRule="evenodd" d="M19.812 5.418c.861.23 1.538.907 1.768 1.768C21.998 8.746 22 12 22 12s0 3.255-.418 4.814a2.504 2.504 0 0 1-1.768 1.768c-1.56.419-7.814.419-7.814.419s-6.255 0-7.814-.419a2.505 2.505 0 0 1-1.768-1.768C2 15.255 2 12 2 12s0-3.255.417-4.814a2.507 2.507 0 0 1 1.768-1.768C5.744 5 11.998 5 11.998 5s6.255 0 7.814.418ZM15.194 12 10 15V9l5.194 3Z" clipRule="evenodd" />
          </svg>
        )
      },
    ],
  },
};

interface FooterProps {
  /**
   * Whether to show the top border
   * @default true
   */
  showBorder?: boolean;
}

export function Footer({ showBorder = true }: FooterProps) {
  const handleLinkClick = (link: typeof footerSections.product.links[0]) => {
    trackNavigation(link.id, link.href);
  };

  const currentYear = new Date().getFullYear();

  return (
    <footer 
      className={`
        bg-bg-secondary 
        ${showBorder ? 'border-t border-borderColors-primary' : ''}
      `}
    >
      {/* Main Footer Content */}
      <div className="max-w-7xl mx-auto px-6 py-16">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12">
          {/* Product Column */}
          <div>
            <h3 className="text-h3 font-semibold text-ink-900 mb-6">
              {footerSections.product.title}
            </h3>
            <ul className="space-y-4">
              {footerSections.product.links.map((link) => (
                <li key={link.name}>
                  <Link
                    href={link.href}
                    className="
                      text-body text-ink-600 hover:text-brand-600
                      focus:ring-2 focus:ring-brand-600 focus:outline-none rounded
                      transition-colors duration-200
                    "
                    onClick={() => handleLinkClick(link)}
                    data-analytics-id={link.id}
                  >
                    {link.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Company Column */}
          <div>
            <h3 className="text-h3 font-semibold text-ink-900 mb-6">
              {footerSections.company.title}
            </h3>
            <ul className="space-y-4">
              {footerSections.company.links.map((link) => (
                <li key={link.name}>
                  <Link
                    href={link.href}
                    className="
                      text-body text-ink-600 hover:text-brand-600
                      focus:ring-2 focus:ring-brand-600 focus:outline-none rounded
                      transition-colors duration-200
                    "
                    onClick={() => handleLinkClick(link)}
                    data-analytics-id={link.id}
                  >
                    {link.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Legal Column */}
          <div>
            <h3 className="text-h3 font-semibold text-ink-900 mb-6">
              {footerSections.legal.title}
            </h3>
            <ul className="space-y-4">
              {footerSections.legal.links.map((link) => (
                <li key={link.name}>
                  <Link
                    href={link.href}
                    className="
                      text-body text-ink-600 hover:text-brand-600
                      focus:ring-2 focus:ring-brand-600 focus:outline-none rounded
                      transition-colors duration-200
                    "
                    onClick={() => handleLinkClick(link)}
                    data-analytics-id={link.id}
                  >
                    {link.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Social Column */}
          <div>
            <h3 className="text-h3 font-semibold text-ink-900 mb-6">
              {footerSections.social.title}
            </h3>
            <div className="space-y-4">
              {footerSections.social.links.map((link) => (
                <div key={link.name}>
                  <Link
                    href={link.href}
                    className="
                      flex items-center gap-3 text-body text-ink-600 hover:text-brand-600
                      focus:ring-2 focus:ring-brand-600 focus:outline-none rounded
                      transition-colors duration-200
                    "
                    onClick={() => handleLinkClick(link)}
                    data-analytics-id={link.id}
                    {...(link.external && {
                      target: '_blank',
                      rel: 'noopener noreferrer',
                    })}
                  >
                    {link.icon}
                    <span>{link.name}</span>
                    {link.external && (
                      <svg
                        className="w-4 h-4 text-ink-400"
                        fill="none"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        aria-hidden="true"
                      >
                        <path d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                      </svg>
                    )}
                  </Link>
                </div>
              ))}
            </div>
            
            {/* Newsletter Signup */}
            <div className="mt-8 pt-6 border-t border-borderColors-primary/50">
              <div className="text-eyebrow text-ink-500 mb-3">Stay Updated</div>
              <div className="text-body text-ink-600 mb-4">
                Get the latest updates on 4Runr Agent OS
              </div>
              <div className="flex gap-2">
                <input
                  type="email"
                  placeholder="Enter your email"
                  className="
                    flex-1 px-3 py-2 text-body 
                    border border-borderColors-primary rounded-lg
                    focus:ring-2 focus:ring-brand-600 focus:border-brand-600 focus:outline-none
                    transition-colors duration-200
                  "
                  aria-label="Email address for newsletter"
                />
                <button
                  type="button"
                  className="
                    px-4 py-2 text-body font-medium text-white 
                    bg-brand-600 rounded-lg
                    hover:bg-brand-700 hover:shadow-sm
                    focus:ring-2 focus:ring-brand-600 focus:outline-none
                    transition-all duration-200
                  "
                  data-analytics-id="footer_newsletter_subscribe"
                >
                  Subscribe
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Bar */}
      <div className="border-t border-borderColors-primary bg-bg-tertiary">
        <div className="max-w-7xl mx-auto px-6 py-6">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            {/* Brand and Copyright */}
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-3">
                <div className="w-6 h-6 bg-brand-600 rounded-md flex items-center justify-center">
                  <span className="text-white font-bold text-xs">4R</span>
                </div>
                <span className="text-body font-semibold text-ink-900">4Runr Agent OS</span>
              </div>
              <span className="text-body text-ink-500">
                © {currentYear} 4Runr. All rights reserved.
              </span>
            </div>

            {/* Legal Links */}
            <div className="flex items-center gap-6">
              <Link
                href="/privacy"
                className="
                  text-body text-ink-500 hover:text-ink-700
                  focus:ring-2 focus:ring-brand-600 focus:outline-none rounded
                  transition-colors duration-200
                "
                data-analytics-id="footer_bottom_privacy"
              >
                Privacy
              </Link>
              <Link
                href="/terms"
                className="
                  text-body text-ink-500 hover:text-ink-700
                  focus:ring-2 focus:ring-brand-600 focus:outline-none rounded
                  transition-colors duration-200
                "
                data-analytics-id="footer_bottom_terms"
              >
                Terms
              </Link>
              <Link
                href="/cookies"
                className="
                  text-body text-ink-500 hover:text-ink-700
                  focus:ring-2 focus:ring-brand-600 focus:outline-none rounded
                  transition-colors duration-200
                "
                data-analytics-id="footer_bottom_cookies"
              >
                Cookies
              </Link>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
