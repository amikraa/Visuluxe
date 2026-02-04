import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { GlobalNavbar } from '@/components/GlobalNavbar';
import { 
  Check, ChevronDown, ArrowRight, Info, Lock, Shield, Cloud, Gavel,
  Image as ImageIcon, Sparkles, Zap, Diamond
} from 'lucide-react';

export default function Pricing() {
  const { user } = useAuth();
  const [isYearly, setIsYearly] = useState(true);

  const plans = [
    {
      name: 'Free',
      description: 'For hobbyists and testing',
      price: 0,
      features: [
        '50 daily credits',
        'Standard speed',
        'Public gallery',
        'Basic SDXL models',
      ],
      buttonText: 'Get Started',
      buttonStyle: 'border border-border bg-surface hover:bg-surface-hover text-foreground',
      featured: false,
    },
    {
      name: 'Starter',
      description: 'For budding creators',
      price: 9,
      features: [
        '500 monthly credits',
        'Fast generation queue',
        'Private mode enabled',
        'No watermarks',
      ],
      buttonText: 'Subscribe',
      buttonStyle: 'bg-foreground text-background hover:bg-foreground/90',
      featured: false,
    },
    {
      name: 'Pro',
      description: 'Unleash full creativity with no limits.',
      price: 29,
      features: [
        '5,000 monthly credits',
        'Priority Queue (Turbo Mode)',
        'Advanced Models (SDXL, DALL-E)',
        'Full API Access',
        'Commercial License',
      ],
      buttonText: 'Upgrade to Pro',
      buttonStyle: 'bg-primary hover:bg-primary/90 text-primary-foreground shadow-[0_0_20px_hsl(var(--primary)/0.4)] hover:shadow-[0_0_30px_hsl(var(--primary)/0.6)]',
      featured: true,
    },
    {
      name: 'Enterprise',
      description: 'For large teams & scaling',
      price: null,
      features: [
        'Unlimited credits',
        'Dedicated GPU Cluster',
        'SSO & Team Management',
        'Custom Model Training',
        'Enterprise SLA',
      ],
      buttonText: 'Contact Sales',
      buttonStyle: 'border border-border bg-surface hover:bg-surface-hover text-foreground',
      featured: false,
    },
  ];

  const creditInfo = [
    { icon: ImageIcon, title: 'Standard Image', credits: '1 Credit', desc: '512x512 - 1024x1024', color: 'text-blue-400 bg-blue-500/10' },
    { icon: Sparkles, title: 'HD Upscale', credits: '0.5 Credits', desc: '4x Upscaling', color: 'text-purple-400 bg-purple-500/10' },
    { icon: Diamond, title: 'Fine-tune Model', credits: '100 Credits', desc: 'Per training run', color: 'text-green-400 bg-green-500/10' },
    { icon: Zap, title: 'Turbo Mode', credits: '2x Credits', desc: 'Priority Generation', color: 'text-orange-400 bg-orange-500/10' },
  ];

  const trustSignals = [
    { icon: Lock, title: 'Private by Default', desc: "We don't store your images unless you save them to gallery." },
    { icon: Shield, title: 'Secure Payments', desc: 'Processed securely via Stripe with 256-bit encryption.' },
    { icon: Cloud, title: 'Cloudflare Protected', desc: 'Enterprise-grade DDoS protection and reliability.' },
    { icon: Gavel, title: 'Abuse Prevention', desc: 'Advanced filters to prevent harmful content generation.' },
  ];

  const faqs = [
    { q: 'What happens if I exceed my credits?', a: 'Once you run out of monthly credits, you can purchase "top-up" packs that never expire. Alternatively, you can upgrade to a higher tier plan immediately, and the difference will be prorated.' },
    { q: 'Do unused credits roll over?', a: 'Monthly credits do not roll over. However, any top-up credits you purchase separately will never expire and can be used at any time.' },
    { q: 'Can I cancel anytime?', a: 'Yes! You can cancel your subscription at any time. Your access will continue until the end of your billing period.' },
    { q: 'Is there a free trial?', a: 'The Free tier is always available with 50 daily credits. For paid plans, we offer a 7-day money-back guarantee if you are not satisfied.' },
  ];

  return (
    <div className="relative min-h-screen w-full flex flex-col font-body bg-background text-foreground antialiased overflow-x-hidden">
      <GlobalNavbar />

      <main className="relative pt-24 pb-20">
        {/* Glow Effect */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-[1000px] h-[500px] bg-primary/10 rounded-full blur-[150px] pointer-events-none opacity-50"></div>

        {/* Header */}
        <div className="relative px-6 max-w-[1280px] mx-auto text-center mb-16">
          <h1 className="text-4xl md:text-6xl font-bold mb-6 tracking-tight bg-gradient-to-b from-foreground to-foreground/70 bg-clip-text text-transparent font-display">
            Simple, Transparent Pricing
          </h1>
          <p className="text-muted-foreground text-lg md:text-xl max-w-2xl mx-auto mb-10">
            Pay only for what you generate. No hidden costs. Upgrade, downgrade, or cancel at any time.
          </p>

          {/* Toggle */}
          <div className="flex items-center justify-center gap-4 mb-12">
            <span className="text-sm font-medium text-muted-foreground">Monthly</span>
            <button
              onClick={() => setIsYearly(!isYearly)}
              className="relative w-14 h-8 bg-surface border border-border rounded-full p-1 cursor-pointer transition-colors hover:bg-surface-hover"
            >
              <div className={`w-6 h-6 bg-primary rounded-full shadow-md transform transition-transform ${isYearly ? 'translate-x-6' : 'translate-x-0'}`}></div>
            </button>
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-foreground">Yearly</span>
              <span className="text-[10px] font-bold uppercase tracking-wider bg-primary/20 text-primary border border-primary/30 px-2 py-0.5 rounded-full">Save 20%</span>
            </div>
          </div>
        </div>

        {/* Anonymous User Banner */}
        {!user && (
          <div className="px-6 max-w-[1280px] mx-auto mb-10">
            <div className="bg-primary/10 border border-primary/20 rounded-xl p-4 flex flex-col sm:flex-row items-center justify-between gap-4 max-w-4xl mx-auto">
              <div className="flex items-center gap-3">
                <Info className="w-5 h-5 text-primary" />
                <p className="text-sm text-foreground">Anonymous users can generate up to 5 images daily without login.</p>
              </div>
              <Link className="text-xs font-bold text-primary hover:text-primary/80 whitespace-nowrap flex items-center gap-1" to="/signup">
                Sign up for more <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
        )}

        {/* Pricing Cards */}
        <div className="px-6 max-w-[1280px] mx-auto mb-24">
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6 items-start">
            {plans.map((plan) => (
              <div
                key={plan.name}
                className={`rounded-2xl p-6 flex flex-col relative transition-all duration-300 h-full
                  ${plan.featured 
                    ? 'bg-gradient-to-b from-primary/15 to-card/80 border border-primary/60 shadow-[0_0_40px_hsl(var(--primary)/0.15)] md:-translate-y-6 ring-1 ring-primary/40' 
                    : 'bg-card/60 backdrop-blur-xl border border-border hover:border-foreground/20 hover:bg-card/80'
                  }`}
              >
                {plan.featured && (
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-gradient-to-r from-primary to-accent text-primary-foreground text-xs font-bold px-4 py-1.5 rounded-full border border-primary/30 shadow-[0_0_15px_hsl(var(--primary)/0.5)] tracking-wide uppercase whitespace-nowrap flex items-center gap-1">
                    <Zap className="w-3 h-3" /> Best for Power Users
                  </div>
                )}

                <div className={`mb-6 ${plan.featured ? 'mt-4' : ''}`}>
                  <h3 className={`font-display text-lg font-bold text-foreground mb-2 ${plan.featured ? 'text-xl' : ''}`}>{plan.name}</h3>
                  <p className={`text-sm mb-4 ${plan.featured ? 'text-primary/80' : 'text-muted-foreground'}`}>{plan.description}</p>
                  <div className="flex items-baseline gap-1">
                    {plan.price !== null ? (
                      <>
                        <span className={`font-display font-bold text-foreground tracking-tight ${plan.featured ? 'text-5xl' : 'text-4xl'}`}>
                          ${isYearly ? Math.round(plan.price * 0.8) : plan.price}
                        </span>
                        <span className="text-muted-foreground">/mo</span>
                      </>
                    ) : (
                      <span className="font-display text-4xl font-bold text-foreground">Custom</span>
                    )}
                  </div>
                  {plan.featured && isYearly && (
                    <div className="mt-2 inline-flex self-start bg-green-500/10 text-green-400 border border-green-500/20 text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wide">
                      Save 20% yearly
                    </div>
                  )}
                </div>

                <button className={`w-full py-2.5 rounded-lg text-sm font-bold transition-all duration-200 mb-8 flex items-center justify-center gap-2 ${plan.buttonStyle}`}>
                  {plan.buttonText}
                  {plan.featured && <ArrowRight className="w-4 h-4" />}
                </button>

                <div className="space-y-4 flex-1">
                  {plan.features.map((feature, index) => (
                    <div key={index} className="flex items-start gap-3 text-sm text-muted-foreground">
                      <Check className={`w-5 h-5 shrink-0 ${plan.featured ? 'text-primary' : 'text-foreground'}`} />
                      <span className={plan.featured ? 'text-foreground font-medium' : ''}>{feature}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* How Credits Work */}
        <div className="px-6 max-w-[1280px] mx-auto mb-20">
          <div className="flex flex-col gap-8">
            <div className="text-center md:text-left">
              <h2 className="font-display text-3xl font-bold mb-3">How Credits Work</h2>
              <p className="text-muted-foreground max-w-2xl">Our flexible credit system ensures you only pay for successful generations. Credits reset monthly.</p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {creditInfo.map((item) => (
                <div key={item.title} className="bg-card border border-border p-5 rounded-xl flex items-start gap-4">
                  <div className={`p-2.5 rounded-lg ${item.color}`}>
                    <item.icon className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="font-bold text-foreground mb-1">{item.title}</h4>
                    <p className="text-sm text-muted-foreground">{item.credits}</p>
                    <p className="text-xs text-muted-foreground/60 mt-1">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Trust Signals */}
        <div className="px-6 max-w-[1280px] mx-auto mb-20 border-y border-border py-12">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {trustSignals.map((signal) => (
              <div key={signal.title} className="flex flex-col items-center text-center gap-3">
                <signal.icon className="w-8 h-8 text-muted-foreground" />
                <h5 className="text-sm font-bold text-foreground">{signal.title}</h5>
                <p className="text-xs text-muted-foreground">{signal.desc}</p>
              </div>
            ))}
          </div>
        </div>

        {/* FAQ */}
        <div className="px-6 max-w-[800px] mx-auto mb-24">
          <h2 className="font-display text-3xl font-bold mb-8 text-center">Frequently Asked Questions</h2>
          <div className="space-y-4">
            {faqs.map((faq, index) => (
              <details key={index} className="group bg-card border border-border rounded-lg">
                <summary className="flex items-center justify-between p-4 cursor-pointer font-medium text-foreground hover:text-primary transition-colors">
                  {faq.q}
                  <ChevronDown className="w-5 h-5 transition-transform group-open:rotate-180" />
                </summary>
                <div className="px-4 pb-4 text-muted-foreground text-sm leading-relaxed">
                  {faq.a}
                </div>
              </details>
            ))}
          </div>
        </div>

        {/* CTA */}
        <div className="px-6 max-w-[1280px] mx-auto text-center">
          <div className="bg-gradient-to-r from-primary/10 via-card to-primary/10 border border-border rounded-2xl p-12">
            <h2 className="font-display text-3xl font-bold mb-4">Ready to get started?</h2>
            <p className="text-muted-foreground mb-8 max-w-xl mx-auto">
              Join thousands of creators using our platform to bring their ideas to life.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link
                to="/signup"
                className="px-8 py-3 bg-primary hover:bg-primary/90 text-primary-foreground font-bold rounded-lg shadow-[0_0_20px_hsl(var(--primary)/0.4)] flex items-center gap-2"
              >
                Get Started Free <ArrowRight className="w-4 h-4" />
              </Link>
              <Link
                to="/docs"
                className="px-8 py-3 bg-surface hover:bg-surface-hover border border-border text-foreground font-medium rounded-lg"
              >
                View Documentation
              </Link>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-border bg-background py-12 px-6">
        <div className="max-w-[1280px] mx-auto flex flex-col md:flex-row justify-between items-center gap-4 text-sm text-muted-foreground">
          <p>© 2025 Visuluxe. All rights reserved.</p>
          <div className="flex gap-6">
            <a className="hover:text-foreground transition-colors" href="#">Privacy</a>
            <a className="hover:text-foreground transition-colors" href="#">Terms</a>
            <a className="hover:text-foreground transition-colors" href="#">Status</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
