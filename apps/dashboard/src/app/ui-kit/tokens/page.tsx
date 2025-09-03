import { colors, typography, shadows, radius, motion, tokenClasses } from '@/lib/tokens';

export default function TokensPage() {
  return (
    <div className="min-h-screen bg-bg-secondary">
      {/* Container wrapper */}
      <div className="max-w-7xl mx-auto px-6 py-20 md:py-[80px]">
        
        {/* Header */}
        <div className="text-center mb-16">
          <h1 className="text-h1 text-ink-900 mb-4">Design Tokens</h1>
          <p className="text-body text-ink-600 max-w-2xl mx-auto">
            Our comprehensive design system tokens for consistent, professional UI components.
            All tokens are semantic and follow our single source of truth approach.
          </p>
        </div>

        {/* Color Palette */}
        <section className="mb-16">
          <h2 className="text-h2 text-ink-900 mb-8">Color Palette</h2>
          
          {/* Brand Colors */}
          <div className="mb-12">
            <h3 className="text-h3 text-ink-800 mb-6">Brand Colors</h3>
            <div className="grid grid-cols-2 md:grid-cols-5 lg:grid-cols-10 gap-4">
              {Object.entries(colors.brand).map(([shade, hex]) => (
                <div key={shade} className="text-center">
                  <div 
                    className="w-full h-16 rounded-xl mb-2 border border-borderColors-primary"
                    style={{ backgroundColor: hex }}
                  />
                  <div className="text-xs font-mono text-ink-600">
                    brand-{shade}
                  </div>
                  <div className="text-xs text-ink-500">{hex}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Ink Colors */}
          <div className="mb-12">
            <h3 className="text-h3 text-ink-800 mb-6">Ink Colors (Text)</h3>
            <div className="grid grid-cols-2 md:grid-cols-5 lg:grid-cols-10 gap-4">
              {Object.entries(colors.ink).map(([shade, hex]) => (
                <div key={shade} className="text-center">
                  <div 
                    className="w-full h-16 rounded-xl mb-2 border border-borderColors-primary"
                    style={{ backgroundColor: hex }}
                  />
                  <div className="text-xs font-mono text-ink-600">
                    ink-{shade}
                  </div>
                  <div className="text-xs text-ink-500">{hex}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Semantic Colors */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* Success */}
            <div>
              <h4 className="text-body font-semibold text-ink-800 mb-4">Success</h4>
              <div className="grid grid-cols-5 gap-2">
                {Object.entries(colors.success).slice(0, 5).map(([shade, hex]) => (
                  <div key={shade} className="text-center">
                    <div 
                      className="w-full h-12 rounded-lg mb-1 border border-borderColors-primary"
                      style={{ backgroundColor: hex }}
                    />
                    <div className="text-xs font-mono text-ink-600">success-{shade}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Warning */}
            <div>
              <h4 className="text-body font-semibold text-ink-800 mb-4">Warning</h4>
              <div className="grid grid-cols-5 gap-2">
                {Object.entries(colors.warn).slice(0, 5).map(([shade, hex]) => (
                  <div key={shade} className="text-center">
                    <div 
                      className="w-full h-12 rounded-lg mb-1 border border-borderColors-primary"
                      style={{ backgroundColor: hex }}
                    />
                    <div className="text-xs font-mono text-ink-600">warn-{shade}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Danger */}
            <div>
              <h4 className="text-body font-semibold text-ink-800 mb-4">Danger</h4>
              <div className="grid grid-cols-5 gap-2">
                {Object.entries(colors.danger).slice(0, 5).map(([shade, hex]) => (
                  <div key={shade} className="text-center">
                    <div 
                      className="w-full h-12 rounded-lg mb-1 border border-borderColors-primary"
                      style={{ backgroundColor: hex }}
                    />
                    <div className="text-xs font-mono text-ink-600">danger-{shade}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Typography */}
        <section className="mb-16">
          <h2 className="text-h2 text-ink-900 mb-8">Typography</h2>
          <div className="space-y-6">
            <div>
              <h1 className="text-h1 text-ink-900 mb-2">Heading 1 (text-h1)</h1>
              <p className="text-sm text-ink-500 font-mono">
                {tokenClasses.text.h1}
              </p>
            </div>
            
            <div>
              <h2 className="text-h2 text-ink-900 mb-2">Heading 2 (text-h2)</h2>
              <p className="text-sm text-ink-500 font-mono">
                {tokenClasses.text.h2}
              </p>
            </div>
            
            <div>
              <h3 className="text-h3 text-ink-900 mb-2">Heading 3 (text-h3)</h3>
              <p className="text-sm text-ink-500 font-mono">
                {tokenClasses.text.h3}
              </p>
            </div>
            
            <div>
              <p className="text-body text-ink-900 mb-2">
                Body text (text-body) - This is a sample paragraph demonstrating the body text style. 
                It should be readable and comfortable for extended reading.
              </p>
              <p className="text-sm text-ink-500 font-mono">
                {tokenClasses.text.body}
              </p>
            </div>
            
            <div>
              <p className="text-eyebrow text-ink-600 mb-2">EYEBROW TEXT (text-eyebrow)</p>
              <p className="text-sm text-ink-500 font-mono">
                {tokenClasses.text.eyebrow}
              </p>
            </div>
          </div>
        </section>

        {/* Shadows & Radius */}
        <section className="mb-16">
          <h2 className="text-h2 text-ink-900 mb-8">Shadows & Radius</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Shadows */}
            <div>
              <h3 className="text-h3 text-ink-800 mb-6">Shadows</h3>
              <div className="space-y-4">
                {Object.entries(shadows).map(([name, value]) => (
                  <div key={name} className="bg-bg-primary rounded-xl p-6 border border-borderColors-primary">
                    <div className={`w-full h-20 bg-bg-primary rounded-xl shadow-${name} mb-3`} />
                    <div className="text-sm font-semibold text-ink-800 mb-1">
                      shadow-{name}
                    </div>
                    <div className="text-xs text-ink-500 font-mono break-all">
                      {value}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Radius */}
            <div>
              <h3 className="text-h3 text-ink-800 mb-6">Border Radius</h3>
              <div className="space-y-4">
                {Object.entries(radius).map(([name, value]) => (
                  <div key={name} className="bg-bg-primary rounded-xl p-6 border border-borderColors-primary">
                    <div 
                      className="w-full h-20 bg-brand-100 border-2 border-brand-300 mb-3"
                      style={{ borderRadius: value }}
                    />
                    <div className="text-sm font-semibold text-ink-800 mb-1">
                      rounded-{name}
                    </div>
                    <div className="text-xs text-ink-500 font-mono">
                      {value}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Motion */}
        <section className="mb-16">
          <h2 className="text-h2 text-ink-900 mb-8">Motion</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Hover Lift */}
            <div>
              <h3 className="text-h3 text-ink-800 mb-6">Hover Lift</h3>
              <div className="space-y-4">
                <button className="px-6 py-3 bg-brand-600 text-white rounded-xl shadow-md hover:-translate-y-[1px] transition-transform duration-200 focus:ring-2 focus:ring-brand-600 focus:outline-none">
                  Hover to lift
                </button>
                <div className="text-sm text-ink-600">
                  <div className="font-semibold mb-1">Classes:</div>
                  <div className="font-mono text-xs bg-bg-tertiary p-2 rounded">
                    hover:-translate-y-[1px] transition-transform duration-200
                  </div>
                </div>
              </div>
            </div>

            {/* Focus Ring */}
            <div>
              <h3 className="text-h3 text-ink-800 mb-6">Focus Ring</h3>
              <div className="space-y-4">
                <button className="px-6 py-3 bg-bg-primary text-ink-900 border border-borderColors-primary rounded-xl shadow-sm focus:ring-2 focus:ring-brand-600 focus:outline-none">
                  Click to focus
                </button>
                <div className="text-sm text-ink-600">
                  <div className="font-semibold mb-1">Classes:</div>
                  <div className="font-mono text-xs bg-bg-tertiary p-2 rounded">
                    focus:ring-2 focus:ring-brand-600 focus:outline-none
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Spacing */}
        <section className="mb-16">
          <h2 className="text-h2 text-ink-900 mb-8">Spacing</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Section Y */}
            <div>
              <h3 className="text-h3 text-ink-800 mb-6">Section Y</h3>
              <div className="space-y-4">
                <div className="bg-bg-primary border border-borderColors-primary rounded-xl p-6">
                  <div className="text-sm font-semibold text-ink-800 mb-2">Desktop: 80px</div>
                  <div className="text-sm font-semibold text-ink-800 mb-2">Mobile: 56px</div>
                  <div className="text-xs text-ink-500 font-mono">
                    py-20 md:py-[80px]
                  </div>
                </div>
              </div>
            </div>

            {/* Grid Gap */}
            <div>
              <h3 className="text-h3 text-ink-800 mb-6">Grid Gap</h3>
              <div className="space-y-4">
                <div className="bg-bg-primary border border-borderColors-primary rounded-xl p-6">
                  <div className="text-sm font-semibold text-ink-800 mb-2">24px</div>
                  <div className="text-xs text-ink-500 font-mono">
                    gap-6
                  </div>
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
                <li>• Use semantic color names: <code className="bg-bg-tertiary px-1 rounded text-xs">bg-brand-600</code></li>
                <li>• Use typography tokens: <code className="bg-bg-tertiary px-1 rounded text-xs">text-h1</code></li>
                <li>• Use spacing tokens: <code className="bg-bg-tertiary px-1 rounded text-xs">py-sectionY</code></li>
                <li>• Use shadow tokens: <code className="bg-bg-tertiary px-1 rounded text-xs">shadow-lg</code></li>
                <li>• Use motion tokens: <code className="bg-bg-tertiary px-1 rounded text-xs">hover:hoverLift</code></li>
              </ul>
            </div>
            
            <div>
              <h3 className="text-h3 text-ink-800 mb-4">❌ Don't</h3>
              <ul className="space-y-2 text-body text-ink-700">
                <li>• Use raw hex codes: <code className="bg-bg-tertiary px-1 rounded text-xs">bg-[#6E56CF]</code></li>
                <li>• Use magic numbers: <code className="bg-bg-tertiary px-1 rounded text-xs">text-4xl</code></li>
                <li>• Use ad-hoc spacing: <code className="bg-bg-tertiary px-1 rounded text-xs">py-20</code></li>
                <li>• Use custom shadows: <code className="bg-bg-tertiary px-1 rounded text-xs">shadow-[0_10px_15px_-3px_rgba(0,0,0,0.1)]</code></li>
                <li>• Use inline styles: <code className="bg-bg-tertiary px-1 rounded text-xs">style=&#123;&#123;color: &apos;#111827&apos;&#125;&#125;</code></li>
              </ul>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
