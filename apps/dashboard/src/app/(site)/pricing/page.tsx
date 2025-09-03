export default function PricingPage() {
  return (
    <div className="py-sectionY">
      <div className="max-w-7xl mx-auto px-6">
        <div className="text-center">
          <h1 className="text-h1 text-ink-900 mb-6">
            Pricing
          </h1>
          <p className="text-body text-ink-600 max-w-2xl mx-auto mb-8">
            Choose the perfect plan for your AI agent deployment needs.
          </p>
          <div className="bg-bg-primary border border-borderColors-primary rounded-xl p-8">
            <p className="text-body text-ink-500">
              Pricing plans will be implemented here.
            </p>
            
            {/* Contact section for CTA testing */}
            <div id="contact" className="mt-8 pt-8 border-t border-borderColors-primary">
              <h2 className="text-h2 text-ink-900 mb-4">Contact Us</h2>
              <p className="text-body text-ink-600">
                Ready to get started? Contact our team for early access.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
