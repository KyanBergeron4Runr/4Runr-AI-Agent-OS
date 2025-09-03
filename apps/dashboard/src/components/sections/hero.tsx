'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { trackClick } from '@/lib/analytics';

// Dynamically import Framer Motion to avoid blocking LCP
const useFramerMotion = () => {
  const [motion, setMotion] = useState<any>(null);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    import('framer-motion').then((module) => {
      setMotion(module);
      setIsLoaded(true);
    });
  }, []);

  return { motion, isLoaded };
};

// Trust logos placeholder SVGs
const trustLogos = [
  {
    name: 'TechCorp',
    svg: (
      <svg className="w-16 h-8" viewBox="0 0 64 32" fill="currentColor" aria-hidden="true">
        <rect x="4" y="8" width="12" height="16" rx="2" />
        <rect x="20" y="12" width="8" height="8" rx="1" />
        <rect x="32" y="10" width="10" height="12" rx="2" />
        <rect x="46" y="14" width="6" height="4" rx="1" />
        <rect x="56" y="8" width="4" height="16" rx="1" />
      </svg>
    )
  },
  {
    name: 'DataFlow',
    svg: (
      <svg className="w-16 h-8" viewBox="0 0 64 32" fill="currentColor" aria-hidden="true">
        <circle cx="12" cy="16" r="6" />
        <circle cx="32" cy="16" r="6" />
        <circle cx="52" cy="16" r="6" />
        <path d="M18 16h8M44 16h8" stroke="currentColor" strokeWidth="2" />
      </svg>
    )
  },
  {
    name: 'CloudSync',
    svg: (
      <svg className="w-16 h-8" viewBox="0 0 64 32" fill="currentColor" aria-hidden="true">
        <path d="M16 12c0-4.4 3.6-8 8-8s8 3.6 8 8c0 2.2-.9 4.2-2.3 5.7C26.8 20.3 24 22 20 22c-4.4 0-8-3.6-8-8s3.6-8 8-8c1.1 0 2.1.2 3.1.6" />
        <path d="M44 16c0-3.3 2.7-6 6-6s6 2.7 6 6c0 1.7-.7 3.2-1.8 4.2" />
      </svg>
    )
  },
  {
    name: 'SecureNet',
    svg: (
      <svg className="w-16 h-8" viewBox="0 0 64 32" fill="currentColor" aria-hidden="true">
        <rect x="8" y="12" width="48" height="8" rx="4" />
        <rect x="20" y="8" width="24" height="16" rx="2" />
        <circle cx="32" cy="16" r="3" />
      </svg>
    )
  },
  {
    name: 'AIFirst',
    svg: (
      <svg className="w-16 h-8" viewBox="0 0 64 32" fill="currentColor" aria-hidden="true">
        <path d="M12 8l8 8-8 8M28 8l8 8-8 8M44 8l8 8-8 8" stroke="currentColor" strokeWidth="2" fill="none" />
        <circle cx="16" cy="16" r="2" />
        <circle cx="32" cy="16" r="2" />
        <circle cx="48" cy="16" r="2" />
      </svg>
    )
  },
  {
    name: 'NextGen',
    svg: (
      <svg className="w-16 h-8" viewBox="0 0 64 32" fill="currentColor" aria-hidden="true">
        <polygon points="8,24 16,8 24,24 32,8 40,24 48,8 56,24" />
        <rect x="4" y="26" width="56" height="2" rx="1" />
      </svg>
    )
  }
];

// Status dot component for plan preview
function StatusDot({ status }: { status: 'completed' | 'active' | 'pending' }) {
  const statusClasses = {
    completed: 'bg-success-500',
    active: 'bg-brand-600 animate-pulse',
    pending: 'bg-ink-300'
  };

  return (
    <div className={`w-2 h-2 rounded-full ${statusClasses[status]}`} />
  );
}

// Stat component for metrics
function Stat({ label, value, trend }: { label: string; value: string; trend?: 'up' | 'down' }) {
  return (
    <div className="text-center">
      <div className="text-h3 font-semibold text-ink-900 mb-1">{value}</div>
      <div className="text-body text-ink-600">{label}</div>
      {trend && (
        <div className={`text-sm ${trend === 'up' ? 'text-success-600' : 'text-danger-600'}`}>
          {trend === 'up' ? '↗' : '↘'} {trend === 'up' ? '12%' : '3%'}
        </div>
      )}
    </div>
  );
}

// Hero Card component
function HeroCard() {
  return (
    <div className="bg-bg-primary border border-borderColors-primary rounded-xl shadow-lg overflow-hidden">
      {/* Top gradient strip */}
      <div className="h-2 bg-gradient-to-r from-brand-500 to-brand-700" />
      
      {/* Plan Preview */}
      <div className="p-4 border-b border-borderColors-primary/20">
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-body font-semibold text-ink-900">Plan Preview</h4>
          <div className="px-2 py-1 bg-success-50 text-success-700 text-xs font-medium rounded-full border border-success-200">
            Cost Cap: $50
          </div>
        </div>
        
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <StatusDot status="completed" />
            <span className="text-sm text-ink-600">Agent deployed</span>
          </div>
          <div className="flex items-center gap-3">
            <StatusDot status="active" />
            <span className="text-sm text-ink-900 font-medium">Processing request</span>
          </div>
          <div className="flex items-center gap-3">
            <StatusDot status="pending" />
            <span className="text-sm text-ink-600">Response generation</span>
          </div>
        </div>
      </div>
      
      {/* Decision Log Preview */}
      <div className="p-4 border-b border-borderColors-primary/20">
        <h4 className="text-body font-semibold text-ink-900 mb-2">Decision Log</h4>
        <div className="space-y-1 text-sm text-ink-600 font-mono">
          <div>✓ Request validated (2ms)</div>
          <div>✓ Security check passed</div>
          <div>→ Routing to agent-001</div>
        </div>
      </div>
      
      {/* Metrics strip */}
      <div className="p-4 bg-bg-secondary">
        <div className="grid grid-cols-3 gap-4">
          <Stat label="Requests/min" value="1.2k" trend="up" />
          <Stat label="Avg Response" value="45ms" />
          <Stat label="Success Rate" value="99.8%" />
        </div>
      </div>
    </div>
  );
}

// Trust logos row
function TrustLogos() {
  return (
    <div className="mt-8">
      <h2 className="sr-only">Trusted by</h2>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-6 items-center">
        {trustLogos.map((logo, index) => (
          <div
            key={logo.name}
            className="flex justify-center items-center text-ink-400 hover:text-ink-600 transition-colors duration-200"
            aria-label={`${logo.name} logo`}
          >
            {logo.svg}
          </div>
        ))}
      </div>
    </div>
  );
}

// Scroll affordance
function ScrollAffordance() {
  const handleScroll = () => {
    trackClick({
      id: 'hero_scroll_affordance',
      category: 'navigation',
      action: 'scroll_to_pillars',
    });
    
    const element = document.getElementById('pillars');
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <button
      onClick={handleScroll}
      className="
        mt-12 p-2 text-ink-400 hover:text-ink-600 
        hover:-translate-y-1 transition-all duration-200
        focus:ring-2 focus:ring-brand-600 focus:outline-none rounded-lg
      "
      aria-label="Scroll to learn more about 4Runr pillars"
      data-analytics-id="hero_scroll_affordance"
    >
      <svg
        className="w-6 h-6 animate-bounce"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
        viewBox="0 0 24 24"
        stroke="currentColor"
        aria-hidden="true"
      >
        <path d="M19 14l-7 7m0 0l-7-7m7 7V3" />
      </svg>
    </button>
  );
}

export function Hero() {
  const { motion, isLoaded } = useFramerMotion();

  const handleCTAClick = (type: 'demo' | 'sandbox') => {
    trackClick({
      id: `hero_cta_${type}`,
      category: 'cta',
      action: 'hero_cta_click',
      label: type,
    });
  };

  // Render without animations until Framer Motion loads
  if (!isLoaded || !motion) {
    return (
      <section id="hero" aria-labelledby="hero-title" className="py-sectionY">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            {/* Left side */}
            <div>
              <div className="text-eyebrow text-brand-600 mb-4">AI Agent Operating System</div>
              <h1 id="hero-title" className="text-h1 text-ink-900 mb-6">
                Deploy, Schedule & Heal AI Agents in Real-Time
              </h1>
              <p className="text-body text-ink-600 mb-8 max-w-lg">
                The operating system for AI agents. Deploy, schedule, and heal AI agents in real-time — with bulletproof security and zero-trust architecture.
              </p>
              
              <div className="flex flex-col sm:flex-row gap-4 mb-6">
                <Link
                  href="/demo"
                  className="
                    px-6 py-3 text-body font-medium text-white 
                    bg-brand-600 rounded-lg
                    hover:bg-brand-700 hover:shadow-md
                    focus:ring-2 focus:ring-brand-600 focus:outline-none
                    transition-all duration-200
                  "
                  onClick={() => handleCTAClick('demo')}
                  data-analytics-id="hero_cta_demo"
                  aria-label="Launch the live demo page"
                >
                  Launch Demo
                </Link>
                <Link
                  href="/sandbox"
                  className="
                    px-6 py-3 text-body font-medium text-ink-600 
                    border border-borderColors-primary rounded-lg
                    hover:bg-ink-50 hover:border-borderColors-secondary
                    focus:ring-2 focus:ring-brand-600 focus:outline-none
                    transition-all duration-200
                  "
                  onClick={() => handleCTAClick('sandbox')}
                  data-analytics-id="hero_cta_sandbox"
                  aria-label="Open the agent sandbox"
                >
                  Try Sandbox
                </Link>
              </div>
              
              <p className="text-sm text-ink-500 mb-6">
                ✓ Zero setup required • ✓ Free tier available • ✓ Enterprise security
              </p>
              
              <TrustLogos />
            </div>
            
            {/* Right side */}
            <div className="flex justify-center lg:justify-end">
              <HeroCard />
            </div>
          </div>
          
          <ScrollAffordance />
        </div>
      </section>
    );
  }

  // Render with animations
  const { motion: m } = motion;
  
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1,
        delayChildren: 0.2,
      },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        duration: 0.6,
        ease: [0.25, 0.46, 0.45, 0.94],
      },
    },
  };

  const cardVariants = {
    hidden: { opacity: 0, scale: 0.95, y: 20 },
    visible: {
      opacity: 1,
      scale: 1,
      y: 0,
      transition: {
        duration: 0.8,
        ease: [0.25, 0.46, 0.45, 0.94],
        delay: 0.4,
      },
    },
  };

  return (
    <section id="hero" aria-labelledby="hero-title" className="py-sectionY">
      <m.div
        className="max-w-7xl mx-auto px-6"
        variants={containerVariants}
        initial="hidden"
        animate="visible"
      >
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          {/* Left side */}
          <m.div variants={itemVariants}>
            <m.div 
              className="text-eyebrow text-brand-600 mb-4"
              variants={itemVariants}
            >
              AI Agent Operating System
            </m.div>
            <m.h1 
              id="hero-title" 
              className="text-h1 text-ink-900 mb-6"
              variants={itemVariants}
            >
              Deploy, Schedule & Heal AI Agents in Real-Time
            </m.h1>
            <m.p 
              className="text-body text-ink-600 mb-8 max-w-lg"
              variants={itemVariants}
            >
              The operating system for AI agents. Deploy, schedule, and heal AI agents in real-time — with bulletproof security and zero-trust architecture.
            </m.p>
            
            <m.div 
              className="flex flex-col sm:flex-row gap-4 mb-6"
              variants={itemVariants}
            >
              <Link
                href="/demo"
                className="
                  px-6 py-3 text-body font-medium text-white 
                  bg-brand-600 rounded-lg
                  hover:bg-brand-700 hover:shadow-md
                  focus:ring-2 focus:ring-brand-600 focus:outline-none
                  transition-all duration-200
                "
                onClick={() => handleCTAClick('demo')}
                data-analytics-id="hero_cta_demo"
                aria-label="Launch the live demo page"
              >
                Launch Demo
              </Link>
              <Link
                href="/sandbox"
                className="
                  px-6 py-3 text-body font-medium text-ink-600 
                  border border-borderColors-primary rounded-lg
                  hover:bg-ink-50 hover:border-borderColors-secondary
                  focus:ring-2 focus:ring-brand-600 focus:outline-none
                  transition-all duration-200
                "
                onClick={() => handleCTAClick('sandbox')}
                data-analytics-id="hero_cta_sandbox"
                aria-label="Open the agent sandbox"
              >
                Try Sandbox
              </Link>
            </m.div>
            
            <m.p 
              className="text-sm text-ink-500 mb-6"
              variants={itemVariants}
            >
              ✓ Zero setup required • ✓ Free tier available • ✓ Enterprise security
            </m.p>
            
            <m.div variants={itemVariants}>
              <TrustLogos />
            </m.div>
          </m.div>
          
          {/* Right side */}
          <m.div 
            className="flex justify-center lg:justify-end"
            variants={cardVariants}
          >
            <HeroCard />
          </m.div>
        </div>
        
        <m.div variants={itemVariants}>
          <ScrollAffordance />
        </m.div>
      </m.div>
    </section>
  );
}
