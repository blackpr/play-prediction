import { Link, createFileRoute } from '@tanstack/react-router'
import {
  Activity,
  ArrowRight,
  TrendingUp,
  Users,
  Zap,
} from 'lucide-react'
import { Button } from '../components/ui/Button'
import { GridPattern } from '../components/ui/GridPattern'
import { StatCard } from '../components/ui/StatCard'

export const Route = createFileRoute('/about')({
  component: AboutPage,
})

function AboutPage() {
  return (
    <div className="flex flex-col min-h-screen bg-background text-text">
      {/* Hero Section */}
      <section className="relative pt-24 pb-16 px-6 overflow-hidden">
        <GridPattern className="opacity-30" />

        <div className="absolute inset-0 bg-gradient-to-b from-accent-cyan/5 via-transparent to-transparent" />
        <div className="absolute top-20 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-accent-cyan/10 blur-[120px] rounded-full pointer-events-none" />

        <div className="relative max-w-5xl mx-auto text-center space-y-8">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-accent-cyan/30 bg-accent-cyan/5 text-accent-cyan text-sm font-mono font-medium">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent-cyan opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-accent-cyan"></span>
            </span>
            LIVE PREDICTION MARKETS
          </div>

          <h1 className="font-display text-5xl md:text-7xl font-bold tracking-tight">
            About{' '}
            <span className="text-gradient-cyan">
              Play-Prediction
            </span>
          </h1>

          <p className="text-xl text-text-muted max-w-2xl mx-auto leading-relaxed">
            A binary prediction market platform where you trade on real-world events
            using virtual Points. Powered by an Automated Market Maker for instant liquidity.
          </p>
        </div>
      </section>

      {/* What We Are Section */}
      <section className="py-20 px-6 bg-surface/50 relative">
        <div className="max-w-7xl mx-auto">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div className="space-y-6">
              <h2 className="font-display text-4xl font-bold text-text">
                What is Play-Prediction?
              </h2>
              <div className="space-y-4 text-text-muted text-lg leading-relaxed">
                <p>
                  Play-Prediction is a <strong className="text-text">binary prediction market platform</strong> built on a{' '}
                  <strong className="text-text">Constant Product Market Maker (CPMM)</strong> algorithm.
                </p>
                <p>
                  Users trade shares representing YES/NO outcomes on real-world events, with prices
                  determined algorithmically through an Automated Market Maker that provides continuous liquidity.
                </p>
                <p>
                  Think of it as a <strong className="text-text">stock market for predictions</strong> - where market
                  prices reflect collective beliefs about future events.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <StatCard
                label="Markets"
                value="24/7"
                icon={<Activity className="w-5 h-5" />}
              />
              <StatCard
                label="Liquidity"
                value="Always On"
                icon={<Zap className="w-5 h-5" />}
              />
              <StatCard
                label="Pricing"
                value="Algorithmic"
                icon={<TrendingUp className="w-5 h-5" />}
              />
              <StatCard
                label="Currency"
                value="Virtual Points"
                icon={<Users className="w-5 h-5" />}
              />
            </div>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-20 px-6 relative">
        <GridPattern className="opacity-20" size="lg" />

        <div className="relative max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="font-display text-4xl font-bold text-text mb-4">
              How It Works
            </h2>
            <p className="text-xl text-text-muted">
              Start trading in three simple steps
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              {
                step: '01',
                icon: <Users className="w-8 h-8" />,
                title: 'Register & Get Points',
                desc: 'Create an account and receive 100 free Points to start trading immediately. No deposit required.',
              },
              {
                step: '02',
                icon: <TrendingUp className="w-8 h-8" />,
                title: 'Choose a Market',
                desc: 'Browse markets in crypto, sports, and tech. Analyze the odds and make your prediction.',
              },
              {
                step: '03',
                icon: <Zap className="w-8 h-8" />,
                title: 'Trade & Win',
                desc: "Buy YES or NO shares. If you're right, your shares settle at 1 Point each. Secure and transparent.",
              },
            ].map((step, i) => (
              <div
                key={i}
                className="data-card rounded-xl p-8 group hover:border-accent-cyan/50 transition-all duration-300"
              >
                <div className="flex items-center gap-4 mb-6">
                  <div className="text-data text-5xl font-bold text-accent-cyan/30">
                    {step.step}
                  </div>
                  <div className="text-accent-cyan">
                    {step.icon}
                  </div>
                </div>
                <h3 className="font-display text-xl font-bold text-text mb-3">
                  {step.title}
                </h3>
                <p className="text-text-muted leading-relaxed">
                  {step.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Key Features */}
      <section className="py-20 px-6 bg-surface/50">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="font-display text-4xl font-bold text-text mb-4">
              Key Features
            </h2>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              {
                title: 'Virtual Points System',
                desc: 'No real money - trade with virtual Points that have no cash value',
              },
              {
                title: 'Always-On Liquidity',
                desc: 'Trade 24/7 without waiting for counterparties via AMM',
              },
              {
                title: 'Transparent Pricing',
                desc: 'Algorithmic price discovery based on supply and demand',
              },
              {
                title: 'Provable Solvency',
                desc: 'Mathematical guarantees ensure the system can always pay winners',
              },
              {
                title: 'Real-Time Updates',
                desc: 'WebSocket-based live price feeds and trade notifications',
              },
              {
                title: 'Production-Ready',
                desc: 'Comprehensive testing, monitoring, and admin tooling',
              },
            ].map((feature, i) => (
              <div
                key={i}
                className="border border-surface-highlight bg-surface-card rounded-lg p-6 hover:border-accent-cyan/30 transition-colors"
              >
                <h3 className="font-bold text-text mb-2">{feature.title}</h3>
                <p className="text-text-muted text-sm">{feature.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Technology Stack */}
      <section className="py-20 px-6 relative">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="font-display text-4xl font-bold text-text mb-4">
              Technology Stack
            </h2>
            <p className="text-text-muted">
              Built with modern, production-grade technologies
            </p>
          </div>

          <div className="data-card rounded-xl p-8">
            <div className="grid md:grid-cols-2 gap-8">
              <div>
                <h3 className="font-mono text-accent-cyan font-bold mb-4 uppercase text-sm tracking-wider">
                  Frontend
                </h3>
                <ul className="space-y-2 text-text-muted">
                  <li className="flex items-center gap-2">
                    <span className="text-accent-cyan">▸</span> React 19 + TanStack Start
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="text-accent-cyan">▸</span> TypeScript
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="text-accent-cyan">▸</span> TailwindCSS
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="text-accent-cyan">▸</span> WebSocket Real-time
                  </li>
                </ul>
              </div>
              <div>
                <h3 className="font-mono text-accent-cyan font-bold mb-4 uppercase text-sm tracking-wider">
                  Backend
                </h3>
                <ul className="space-y-2 text-text-muted">
                  <li className="flex items-center gap-2">
                    <span className="text-accent-cyan">▸</span> Fastify 4.x + TypeScript
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="text-accent-cyan">▸</span> Supabase (PostgreSQL + Auth)
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="text-accent-cyan">▸</span> Drizzle ORM
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="text-accent-cyan">▸</span> BullMQ + Redis
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-6 relative overflow-hidden">
        <GridPattern className="opacity-20" />

        <div className="relative max-w-4xl mx-auto text-center">
          <div className="data-card rounded-2xl p-12 border-accent-cyan/30">
            <h2 className="font-display text-4xl md:text-5xl font-bold text-text mb-6">
              Ready to start trading?
            </h2>
            <p className="text-xl text-text-muted mb-8 max-w-2xl mx-auto">
              Join the prediction market revolution. Sign up now and get your welcome bonus.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link to="/register">
                <Button
                  size="lg"
                  className="bg-accent-cyan hover:bg-accent-cyan/90 text-background font-bold min-w-[200px] h-14 text-lg glow-hover-cyan"
                >
                  Create Free Account
                  <ArrowRight className="ml-2 w-5 h-5" />
                </Button>
              </Link>
              <Link to="/" search={{ page: 1, pageSize: 20, sort: 'createdAt', order: 'desc' }}>
                <Button
                  variant="ghost"
                  size="lg"
                  className="border border-accent-cyan/30 hover:bg-accent-cyan/10 text-accent-cyan min-w-[200px] h-14 text-lg"
                >
                  Browse Markets
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
