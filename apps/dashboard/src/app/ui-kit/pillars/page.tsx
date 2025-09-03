import { Pillars } from '@/components/sections/pillars';

export default function PillarsUIKitPage() {
  return (
    <div className="min-h-screen bg-bg-primary">
      {/* Page Header */}
      <div className="max-w-7xl mx-auto px-6 py-20">
        <div className="text-center mb-16">
          <h1 className="text-h1 text-ink-900 mb-4">Pillars Section</h1>
          <p className="text-body text-ink-600 max-w-2xl mx-auto">
            Core capabilities showcase with feature cards, icons, and CTAs. Each card demonstrates 4Runr's key pillars with interactive hover states and analytics tracking.
          </p>
        </div>
      </div>

      {/* Pillars Section */}
      <Pillars />

      {/* Documentation */}
      <div className="max-w-7xl mx-auto px-6 py-20">
        <div className="bg-bg-secondary border border-borderColors-primary rounded-xl p-8">
          <h2 className="text-h2 text-ink-900 mb-6">Implementation Details</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div>
              <h3 className="text-h3 text-ink-800 mb-4">Features</h3>
              <ul className="space-y-2 text-body text-ink-600">
                <li>• 4 feature cards with equal height</li>
                <li>• Lucide React icons in brand-colored circles</li>
                <li>• Micro-proof indicators with success styling</li>
                <li>• Interactive hover and focus states</li>
                <li>• Responsive grid (1 col mobile, 2 cols tablet, 4 cols desktop)</li>
                <li>• Analytics tracking on all CTAs</li>
              </ul>
            </div>
            
            <div>
              <h3 className="text-h3 text-ink-800 mb-4">Analytics IDs</h3>
              <ul className="space-y-2 text-body text-ink-600">
                <li>• <code className="bg-ink-100 px-1 rounded">pillar_policies</code></li>
                <li>• <code className="bg-ink-100 px-1 rounded">pillar_observability</code></li>
                <li>• <code className="bg-ink-100 px-1 rounded">pillar_composability</code></li>
                <li>• <code className="bg-ink-100 px-1 rounded">pillar_performance</code></li>
              </ul>
            </div>
          </div>
          
          <div className="mt-8 pt-6 border-t border-borderColors-primary">
            <h3 className="text-h3 text-ink-800 mb-4">Design Tokens Used</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
              <div>
                <h4 className="font-semibold text-ink-800 mb-2">Colors</h4>
                <ul className="space-y-1 text-ink-600">
                  <li>• bg-bg-primary</li>
                  <li>• bg-bg-secondary</li>
                  <li>• bg-brand-100</li>
                  <li>• bg-success-100</li>
                  <li>• text-brand-600</li>
                  <li>• text-ink-900</li>
                </ul>
              </div>
              <div>
                <h4 className="font-semibold text-ink-800 mb-2">Typography</h4>
                <ul className="space-y-1 text-ink-600">
                  <li>• text-eyebrow</li>
                  <li>• text-h2</li>
                  <li>• text-h3</li>
                  <li>• text-body</li>
                </ul>
              </div>
              <div>
                <h4 className="font-semibold text-ink-800 mb-2">Spacing</h4>
                <ul className="space-y-1 text-ink-600">
                  <li>• py-sectionY</li>
                  <li>• gap-8</li>
                  <li>• p-8</li>
                  <li>• mb-16</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
