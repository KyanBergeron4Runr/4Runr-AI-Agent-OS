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

// Status dot component for plan preview
function StatusDot({ status }: { status: 'completed' | 'active' | 'pending' | 'error' }) {
  const statusClasses = {
    completed: 'bg-success-500',
    active: 'bg-brand-600 animate-pulse',
    pending: 'bg-ink-300',
    error: 'bg-danger-500'
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
          {trend === 'up' ? '↗' : '↘'} {trend === 'up' ? '8%' : '2%'}
        </div>
      )}
    </div>
  );
}

// Demo Snapshot Card component
function DemoSnapshotCard() {
  return (
    <div className="bg-bg-primary border border-borderColors-primary rounded-xl shadow-lg overflow-hidden">
      {/* Header */}
      <div className="p-6 border-b border-borderColors-primary/20">
        <h3 className="text-h3 text-ink-900">Demo Snapshot</h3>
        <p className="text-body text-ink-600 mt-2">
          Real-time view of 4Runr Agent OS in action
        </p>
      </div>
      
      {/* Plan Preview */}
      <div className="p-6 border-b border-borderColors-primary/20">
        <div className="flex items-center justify-between mb-4">
          <h4 className="text-body font-semibold text-ink-900">Plan Preview</h4>
          <div className="px-2 py-1 bg-success-50 text-success-700 text-xs font-medium rounded-full border border-success-200">
            Cost Cap: $25
          </div>
        </div>
        
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <StatusDot status="completed" />
            <span className="text-sm text-ink-600">Agent authentication</span>
          </div>
          <div className="flex items-center gap-3">
            <StatusDot status="completed" />
            <span className="text-sm text-ink-600">Policy validation</span>
          </div>
          <div className="flex items-center gap-3">
            <StatusDot status="active" />
            <span className="text-sm text-ink-900 font-medium">Request processing</span>
          </div>
          <div className="flex items-center gap-3">
            <StatusDot status="pending" />
            <span className="text-sm text-ink-600">Response generation</span>
          </div>
        </div>
      </div>
      
      {/* Decision Log */}
      <div className="p-6 border-b border-borderColors-primary/20">
        <h4 className="text-body font-semibold text-ink-900 mb-3">Decision Log</h4>
        <div className="space-y-1 text-sm text-ink-600 font-mono bg-bg-secondary p-3 rounded-lg">
          <div>✓ Agent "data-processor-001" authenticated (1.2ms)</div>
          <div>✓ Policy "data-access-control" validated (0.8ms)</div>
          <div>→ Request routed to processing queue</div>
        </div>
      </div>
      
      {/* Metrics */}
      <div className="p-6 bg-bg-secondary">
        <div className="grid grid-cols-3 gap-4">
          <Stat label="Requests/min" value="856" trend="up" />
          <Stat label="Avg Response" value="23ms" />
          <Stat label="Success Rate" value="99.9%" />
        </div>
      </div>
    </div>
  );
}

export function DemoPromo() {
  const { motion, isLoaded } = useFramerMotion();

  const handleCTAClick = (type: 'launch' | 'audit') => {
    trackClick({
      id: `demo_promo_${type}`,
      category: 'demo_promo',
      action: 'demo_promo_cta_click',
      label: type,
    });
  };

  // Render without animations until Framer Motion loads
  if (!isLoaded || !motion) {
    return (
      <section className="py-sectionY bg-bg-primary">
        <div className="max-w-7xl mx-auto px-6">
          {/* Section Header */}
          <div className="text-center mb-16">
            <div className="text-eyebrow text-brand-600 mb-4">
              See It In Action
            </div>
            <h2 id="demo-promo-title" className="text-h2 text-ink-900 mb-6">
              Experience 4Runr Agent OS Live
            </h2>
            <p className="text-body text-ink-600 max-w-2xl mx-auto">
              Watch real-time agent deployment, policy enforcement, and performance monitoring in our interactive demonstration.
            </p>
          </div>
          
          {/* Demo Snapshot Card */}
          <div className="max-w-3xl mx-auto mb-12">
            <DemoSnapshotCard />
          </div>
          
          {/* CTAs */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
            <Link
              href="/demo"
              className="
                px-8 py-3 text-body font-medium text-white 
                bg-brand-600 rounded-lg
                hover:bg-brand-700 hover:shadow-md
                focus:ring-2 focus:ring-brand-600 focus:outline-none
                transition-all duration-200
              "
              onClick={() => handleCTAClick('launch')}
              data-analytics-id="demo_promo_launch"
              aria-label="Launch the live demo page"
            >
              Launch Live Demo
            </Link>
            <Link
              href="/docs/audit-pack"
              className="
                px-8 py-3 text-body font-medium text-ink-600 
                border border-borderColors-primary rounded-lg
                hover:bg-ink-50 hover:border-borderColors-secondary
                focus:ring-2 focus:ring-brand-600 focus:outline-none
                transition-all duration-200
              "
              onClick={() => handleCTAClick('audit')}
              data-analytics-id="demo_promo_audit"
              aria-label="See an audit example"
            >
              See Audit Example
            </Link>
          </div>
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
        staggerChildren: 0.2,
        delayChildren: 0.1,
      },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 30 },
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
        delay: 0.3,
      },
    },
  };

  return (
    <section className="py-sectionY bg-bg-primary">
      <m.div
        className="max-w-7xl mx-auto px-6"
        variants={containerVariants}
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, margin: "-100px" }}
      >
        {/* Section Header */}
        <m.div className="text-center mb-16" variants={itemVariants}>
          <m.div 
            className="text-eyebrow text-brand-600 mb-4"
            variants={itemVariants}
          >
            See It In Action
          </m.div>
          <m.h2 
            id="demo-promo-title" 
            className="text-h2 text-ink-900 mb-6"
            variants={itemVariants}
          >
            Experience 4Runr Agent OS Live
          </m.h2>
          <m.p 
            className="text-body text-ink-600 max-w-2xl mx-auto"
            variants={itemVariants}
          >
            Watch real-time agent deployment, policy enforcement, and performance monitoring in our interactive demonstration.
          </m.p>
        </m.div>
        
        {/* Demo Snapshot Card */}
        <m.div 
          className="max-w-3xl mx-auto mb-12"
          variants={cardVariants}
        >
          <DemoSnapshotCard />
        </m.div>
        
        {/* CTAs */}
        <m.div 
          className="flex flex-col sm:flex-row gap-4 justify-center items-center"
          variants={itemVariants}
        >
          <Link
            href="/demo"
            className="
              px-8 py-3 text-body font-medium text-white 
              bg-brand-600 rounded-lg
              hover:bg-brand-700 hover:shadow-md
              focus:ring-2 focus:ring-brand-600 focus:outline-none
              transition-all duration-200
            "
            onClick={() => handleCTAClick('launch')}
            data-analytics-id="demo_promo_launch"
            aria-label="Launch the live demo page"
          >
            Launch Live Demo
          </Link>
          <Link
            href="/docs/audit-pack"
            className="
              px-8 py-3 text-body font-medium text-ink-600 
              border border-borderColors-primary rounded-lg
              hover:bg-ink-50 hover:border-borderColors-secondary
              focus:ring-2 focus:ring-brand-600 focus:outline-none
              transition-all duration-200
            "
            onClick={() => handleCTAClick('audit')}
            data-analytics-id="demo_promo_audit"
            aria-label="See an audit example"
          >
            See Audit Example
          </Link>
        </m.div>
      </m.div>
    </section>
  );
}


