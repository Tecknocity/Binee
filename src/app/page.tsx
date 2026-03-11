import Link from 'next/link';
import { ArrowRight, Bot, BarChart3, Shield, Users, Zap, MessageSquare } from 'lucide-react';

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-[#1A1A2E] text-[#F0F0F0]">
      {/* Navigation */}
      <nav className="border-b border-[#2A2A4E] px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Bot className="text-[#FF6B35]" size={28} />
            <span className="text-xl font-bold">Binee</span>
          </div>
          <div className="flex items-center gap-4">
            <Link
              href="/login"
              className="text-[#A0A0B8] hover:text-[#F0F0F0] transition-colors px-4 py-2"
            >
              Sign In
            </Link>
            <Link
              href="/signup"
              className="bg-[#FF6B35] hover:bg-[#FF6B35]/90 text-white px-5 py-2 rounded-lg font-medium transition-colors"
            >
              Get Started Free
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="px-6 pt-20 pb-16">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-5xl md:text-6xl font-bold leading-tight">
            AI-Powered{' '}
            <span className="text-[#FF6B35]">Workspace Intelligence</span>
          </h1>
          <p className="text-xl text-[#A0A0B8] mt-6 max-w-2xl mx-auto">
            Binee helps your team get more value from ClickUp. AI workspace setup, health monitoring,
            custom dashboards, and a chat assistant that knows your projects inside and out.
          </p>
          <div className="flex items-center justify-center gap-4 mt-10">
            <Link
              href="/signup"
              className="bg-[#FF6B35] hover:bg-[#FF6B35]/90 text-white px-8 py-3.5 rounded-lg font-medium text-lg transition-colors flex items-center gap-2"
            >
              Start Free <ArrowRight size={20} />
            </Link>
            <Link
              href="/login"
              className="border border-[#2A2A4E] hover:border-[#FF6B35]/50 text-[#F0F0F0] px-8 py-3.5 rounded-lg font-medium text-lg transition-colors"
            >
              Sign In
            </Link>
          </div>
          <p className="text-sm text-[#6B6B80] mt-4">10 free credits. No credit card required.</p>
        </div>
      </section>

      {/* Features Grid */}
      <section className="px-6 py-20 border-t border-[#2A2A4E]">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-4">
            Everything your team needs to work smarter
          </h2>
          <p className="text-[#A0A0B8] text-center mb-16 max-w-2xl mx-auto">
            Connect ClickUp once, and Binee becomes your AI workspace assistant — setup, monitoring, dashboards, and team collaboration.
          </p>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            <FeatureCard
              icon={<Zap className="text-[#FF6B35]" size={24} />}
              title="AI Workspace Setup"
              description="Describe your business to Binee and get a full ClickUp workspace structure built in minutes, not hours."
            />
            <FeatureCard
              icon={<Shield className="text-[#FF6B35]" size={24} />}
              title="Health Monitoring"
              description="Binee continuously scans your workspace and surfaces overdue tasks, abandoned lists, and workload imbalances."
            />
            <FeatureCard
              icon={<BarChart3 className="text-[#FF6B35]" size={24} />}
              title="Custom Dashboards"
              description="Tell Binee what metrics you want to see. Get charts, tables, and summary cards built from your ClickUp data."
            />
            <FeatureCard
              icon={<MessageSquare className="text-[#FF6B35]" size={24} />}
              title="Chat Assistant"
              description="Ask questions, create tasks, update statuses, and get insights — all through natural conversation with Binee."
            />
            <FeatureCard
              icon={<Users className="text-[#FF6B35]" size={24} />}
              title="Team Workspaces"
              description="Invite your whole team. Everyone gets their own Binee login with shared dashboards and workspace data."
            />
            <FeatureCard
              icon={<Bot className="text-[#FF6B35]" size={24} />}
              title="Smart Credit System"
              description="Simple credit-based pricing. Free tier to get started, then scale as your team grows."
            />
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section className="px-6 py-20 border-t border-[#2A2A4E]">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-4">Simple, transparent pricing</h2>
          <p className="text-[#A0A0B8] text-center mb-16">
            Credits-based. Unlimited team members on every plan.
          </p>

          <div className="grid md:grid-cols-3 gap-8">
            <PricingCard
              name="Free"
              price="$0"
              credits="10 credits/month"
              features={['Try the AI assistant', '1 dashboard', 'Health monitoring']}
            />
            <PricingCard
              name="Starter"
              price="$19"
              credits="200 credits/month"
              features={['AI workspace setup', '5 dashboards', 'Health monitoring', 'Up to 5 members']}
              highlighted
            />
            <PricingCard
              name="Pro"
              price="$49"
              credits="600 credits/month"
              features={['Everything in Starter', 'Unlimited dashboards', 'Unlimited members', 'Priority support']}
            />
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="px-6 py-20 border-t border-[#2A2A4E]">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-3xl font-bold mb-4">Ready to power up your ClickUp?</h2>
          <p className="text-[#A0A0B8] mb-8">
            Connect ClickUp, describe your business, and let Binee handle the rest.
          </p>
          <Link
            href="/signup"
            className="bg-[#FF6B35] hover:bg-[#FF6B35]/90 text-white px-8 py-3.5 rounded-lg font-medium text-lg transition-colors inline-flex items-center gap-2"
          >
            Get Started Free <ArrowRight size={20} />
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-[#2A2A4E] px-6 py-8">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2 text-[#6B6B80]">
            <Bot size={20} />
            <span className="text-sm">Binee by Tecknocity</span>
          </div>
          <p className="text-sm text-[#6B6B80]">&copy; {new Date().getFullYear()} Tecknocity. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}

function FeatureCard({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="bg-[#1A1A2E]/60 border border-[#2A2A4E] rounded-xl p-6 hover:border-[#FF6B35]/30 transition-colors">
      <div className="mb-4">{icon}</div>
      <h3 className="text-lg font-semibold mb-2">{title}</h3>
      <p className="text-[#A0A0B8] text-sm leading-relaxed">{description}</p>
    </div>
  );
}

function PricingCard({
  name,
  price,
  credits,
  features,
  highlighted = false,
}: {
  name: string;
  price: string;
  credits: string;
  features: string[];
  highlighted?: boolean;
}) {
  return (
    <div
      className={`rounded-xl p-8 ${
        highlighted
          ? 'bg-[#FF6B35]/10 border-2 border-[#FF6B35]'
          : 'bg-[#1A1A2E]/60 border border-[#2A2A4E]'
      }`}
    >
      <h3 className="text-xl font-bold mb-1">{name}</h3>
      <div className="flex items-baseline gap-1 mb-1">
        <span className="text-3xl font-bold">{price}</span>
        {price !== '$0' && <span className="text-[#6B6B80]">/month</span>}
      </div>
      <p className="text-[#A0A0B8] text-sm mb-6">{credits}</p>
      <ul className="space-y-3">
        {features.map((feature) => (
          <li key={feature} className="flex items-center gap-2 text-sm text-[#A0A0B8]">
            <div className="w-1.5 h-1.5 rounded-full bg-[#FF6B35]" />
            {feature}
          </li>
        ))}
      </ul>
      <Link
        href="/signup"
        className={`mt-8 block text-center py-2.5 rounded-lg font-medium transition-colors ${
          highlighted
            ? 'bg-[#FF6B35] hover:bg-[#FF6B35]/90 text-white'
            : 'border border-[#2A2A4E] hover:border-[#FF6B35]/50 text-[#F0F0F0]'
        }`}
      >
        Get Started
      </Link>
    </div>
  );
}
