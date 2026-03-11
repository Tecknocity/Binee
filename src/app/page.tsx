import Link from 'next/link';
import {
  MessageSquare,
  HeartPulse,
  LayoutDashboard,
  Users,
  Check,
  ArrowRight,
  Zap,
  Shield,
  Wrench,
} from 'lucide-react';

const features = [
  {
    icon: Wrench,
    title: 'AI-Powered Setup',
    description:
      'Tell Binee what you need, and it builds your ClickUp spaces, folders, lists, and statuses automatically.',
  },
  {
    icon: HeartPulse,
    title: 'Health Monitoring',
    description:
      'Continuous analysis of your ClickUp workspace to find issues, optimize workflows, and prevent problems.',
  },
  {
    icon: LayoutDashboard,
    title: 'Custom Dashboards',
    description:
      'Build rich dashboards with drag-and-drop widgets that pull live data from your ClickUp workspace.',
  },
  {
    icon: Users,
    title: 'Team Workspace',
    description:
      'Collaborate with your team in shared workspaces with role-based access and credit management.',
  },
];

const plans = [
  {
    name: 'Free',
    price: 0,
    credits: 100,
    features: ['100 AI credits/month', '1 workspace', 'Basic health checks', 'Community support'],
  },
  {
    name: 'Starter',
    price: 19,
    credits: 1000,
    popular: true,
    features: [
      '1,000 AI credits/month',
      '3 workspaces',
      'Full health monitoring',
      'Custom dashboards',
      'Email support',
    ],
  },
  {
    name: 'Pro',
    price: 49,
    credits: 5000,
    features: [
      '5,000 AI credits/month',
      'Unlimited workspaces',
      'Advanced analytics',
      'AI-powered setup',
      'Priority support',
      'API access',
    ],
  },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-navy-base">
      {/* Header */}
      <header className="border-b border-border">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-accent flex items-center justify-center">
              <span className="text-white font-bold text-sm">B</span>
            </div>
            <span className="text-xl font-bold text-text-primary">Binee</span>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/login"
              className="px-4 py-2 text-sm font-medium text-text-secondary hover:text-text-primary transition-colors"
            >
              Sign in
            </Link>
            <Link
              href="/signup"
              className="px-4 py-2 bg-accent hover:bg-accent-hover text-white text-sm font-medium rounded-lg transition-colors"
            >
              Get started
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-accent/5 via-transparent to-transparent" />
        <div className="relative max-w-6xl mx-auto px-6 py-24 md:py-32 text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-accent/10 border border-accent/20 rounded-full text-accent text-sm font-medium mb-6">
            <Zap className="w-3.5 h-3.5" />
            AI-powered workspace intelligence
          </div>
          <h1 className="text-4xl md:text-6xl font-bold text-text-primary leading-tight max-w-3xl mx-auto">
            Power up your ClickUp{' '}
            <span className="text-accent">with AI</span>
          </h1>
          <p className="text-lg md:text-xl text-text-secondary mt-6 max-w-2xl mx-auto leading-relaxed">
            Binee analyzes your ClickUp workspace, sets up projects with AI, monitors workspace health,
            and gives your team actionable intelligence — all in one place.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mt-10">
            <Link
              href="/signup"
              className="flex items-center gap-2 px-6 py-3 bg-accent hover:bg-accent-hover text-white font-medium rounded-lg transition-colors text-base"
            >
              Start for free
              <ArrowRight className="w-4 h-4" />
            </Link>
            <Link
              href="/login"
              className="flex items-center gap-2 px-6 py-3 bg-surface hover:bg-surface-hover border border-border text-text-primary font-medium rounded-lg transition-colors text-base"
            >
              <MessageSquare className="w-4 h-4" />
              See it in action
            </Link>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="max-w-6xl mx-auto px-6 py-20">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold text-text-primary">
            Everything your workspace needs
          </h2>
          <p className="text-text-secondary mt-3 text-lg max-w-xl mx-auto">
            From setup to ongoing optimization, Binee handles the heavy lifting.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {features.map((feature) => {
            const Icon = feature.icon;
            return (
              <div
                key={feature.title}
                className="bg-surface border border-border rounded-xl p-6 hover:border-border-light transition-colors"
              >
                <div className="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center mb-4">
                  <Icon className="w-5 h-5 text-accent" />
                </div>
                <h3 className="text-lg font-semibold text-text-primary mb-2">{feature.title}</h3>
                <p className="text-text-secondary text-sm leading-relaxed">{feature.description}</p>
              </div>
            );
          })}
        </div>
      </section>

      {/* Trust bar */}
      <section className="border-y border-border">
        <div className="max-w-6xl mx-auto px-6 py-10 flex flex-col md:flex-row items-center justify-center gap-8 text-text-muted text-sm">
          <div className="flex items-center gap-2">
            <Shield className="w-4 h-4" />
            SOC 2 compliant
          </div>
          <div className="flex items-center gap-2">
            <Zap className="w-4 h-4" />
            99.9% uptime
          </div>
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4" />
            Trusted by 500+ teams
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section className="max-w-6xl mx-auto px-6 py-20">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold text-text-primary">
            Simple, transparent pricing
          </h2>
          <p className="text-text-secondary mt-3 text-lg">
            Start free. Upgrade when you need more power.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl mx-auto">
          {plans.map((plan) => (
            <div
              key={plan.name}
              className={`relative border rounded-xl p-6 ${
                plan.popular
                  ? 'bg-accent/5 border-accent/30'
                  : 'bg-surface border-border'
              }`}
            >
              {plan.popular && (
                <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 text-xs font-medium bg-accent text-white px-2.5 py-0.5 rounded-full">
                  Most popular
                </span>
              )}

              <h3 className="text-lg font-semibold text-text-primary">{plan.name}</h3>
              <div className="flex items-baseline gap-1 mt-3 mb-5">
                <span className="text-4xl font-bold text-text-primary">${plan.price}</span>
                <span className="text-text-muted">/mo</span>
              </div>

              <ul className="space-y-2.5 mb-6">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-2 text-sm text-text-secondary">
                    <Check className="w-4 h-4 text-success mt-0.5 shrink-0" />
                    {feature}
                  </li>
                ))}
              </ul>

              <Link
                href="/signup"
                className={`block w-full py-2.5 rounded-lg text-sm font-medium text-center transition-colors ${
                  plan.popular
                    ? 'bg-accent hover:bg-accent-hover text-white'
                    : 'bg-navy-base border border-border text-text-primary hover:bg-surface-hover'
                }`}
              >
                Get started
              </Link>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="border-t border-border">
        <div className="max-w-6xl mx-auto px-6 py-20 text-center">
          <h2 className="text-3xl font-bold text-text-primary mb-4">
            Ready to supercharge your ClickUp?
          </h2>
          <p className="text-text-secondary text-lg mb-8 max-w-xl mx-auto">
            Join hundreds of teams using Binee to get more out of their project management.
          </p>
          <Link
            href="/signup"
            className="inline-flex items-center gap-2 px-8 py-3 bg-accent hover:bg-accent-hover text-white font-medium rounded-lg transition-colors text-base"
          >
            Sign up for free
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border">
        <div className="max-w-6xl mx-auto px-6 py-8 flex flex-col md:flex-row items-center justify-between text-sm text-text-muted">
          <div className="flex items-center gap-2 mb-4 md:mb-0">
            <div className="w-6 h-6 rounded bg-accent flex items-center justify-center">
              <span className="text-white font-bold text-[10px]">B</span>
            </div>
            <span className="font-medium text-text-secondary">Binee</span>
          </div>
          <p>&copy; 2026 Binee. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
