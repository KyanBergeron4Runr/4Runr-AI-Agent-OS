'use client';

import Link from 'next/link';
import { ChevronRight, Shield, Eye, Layers, Zap } from 'lucide-react';
import { trackClick } from '@/lib/analytics';

// Pillar data
const pillars = [
  {
    id: 'policies',
    icon: Shield,
    title: 'Zero-Trust Policies',
    subtitle: 'Define granular security policies that validate every request, authenticate every agent, and log every action with cryptographic proof.',
    proof: 'Policy validation in <2ms',
    href: '/docs/policy-language',
    analyticsId: 'pillar_policies'
  },
  {
    id: 'observability',
    icon: Eye,
    title: 'Real-Time Observability',
    subtitle: 'Monitor agent performance, costs, and security in real-time with comprehensive metrics, alerting, and decision logging.',
    proof: '99.9% uptime SLA',
    href: '/demo',
    analyticsId: 'pillar_observability'
  },
  {
    id: 'composability',
    icon: Layers,
    title: 'Agent Composability',
    subtitle: 'Build complex workflows by composing simple agents. Deploy, schedule, and heal agents automatically with intelligent routing.',
    proof: 'Auto-healing in <30s',
    href: '/docs',
    analyticsId: 'pillar_composability'
  },
  {
    id: 'performance',
    icon: Zap,
    title: 'Lightning Performance',
    subtitle: 'Sub-millisecond request validation, intelligent caching, and optimized routing ensure your agents respond at lightning speed.',
    proof: '45ms avg response time',
    href: '/sandbox',
    analyticsId: 'pillar_performance'
  }
];

// Icon wrapper component
function IconWrapper({ icon: Icon }: { icon: any }) {
  return (
    <div className="w-12 h-12 bg-brand-100 rounded-xl flex items-center justify-center mb-6">
      <Icon className="w-6 h-6 text-brand-600" />
    </div>
  );
}

// Pillar card component
function PillarCard({ pillar }: { pillar: typeof pillars[0] }) {
  const Icon = pillar.icon;
  
  const handleCTAClick = () => {
    trackClick({
      id: pillar.analyticsId,
      category: 'pillar',
      action: 'pillar_cta_click',
      label: pillar.id,
    });
  };

  return (
    <div className="bg-bg-primary border border-borderColors-primary rounded-xl p-8 h-full flex flex-col hover:shadow-lg transition-all duration-200 hover:-translate-y-1 focus-within:shadow-lg focus-within:-translate-y-1">
      {/* Icon */}
      <IconWrapper icon={Icon} />
      
      {/* Content */}
      <div className="flex-1">
        <h3 className="text-h3 text-ink-900 mb-4">
          {pillar.title}
        </h3>
        <p className="text-body text-ink-600 mb-6">
          {pillar.subtitle}
        </p>
        
        {/* Micro-proof */}
        <div className="flex items-center gap-2 mb-8">
          <div className="w-4 h-4 bg-success-100 rounded-full flex items-center justify-center">
            <svg className="w-2.5 h-2.5 text-success-600" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
            </svg>
          </div>
          <span className="text-sm font-medium text-success-700">
            {pillar.proof}
          </span>
        </div>
      </div>
      
      {/* CTA */}
      <div className="mt-auto">
        <Link
          href={pillar.href}
          className="
            inline-flex items-center gap-2 text-sm font-medium text-brand-600 
            hover:text-brand-700 hover:bg-brand-50 px-3 py-2 rounded-lg
            focus:ring-2 focus:ring-brand-600 focus:outline-none
            transition-all duration-200
          "
          onClick={handleCTAClick}
          data-analytics-id={pillar.analyticsId}
        >
          Learn more
          <ChevronRight className="w-4 h-4" />
        </Link>
      </div>
    </div>
  );
}

export function Pillars() {
  return (
    <section id="pillars" className="py-sectionY bg-bg-secondary">
      <div className="max-w-7xl mx-auto px-6">
        {/* Section Header */}
        <div className="text-center mb-16">
          <div className="text-eyebrow text-brand-600 mb-4">
            Core Capabilities
          </div>
          <h2 className="text-h2 text-ink-900 mb-6">
            The 4Runr Pillars
          </h2>
          <p className="text-body text-ink-600 max-w-2xl mx-auto">
            Our core principles that make 4Runr Agent OS the most secure and reliable platform for AI agent deployment.
          </p>
        </div>
        
        {/* Pillars Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {pillars.map((pillar) => (
            <PillarCard key={pillar.id} pillar={pillar} />
          ))}
        </div>
      </div>
    </section>
  );
}
