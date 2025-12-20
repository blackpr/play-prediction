import { Link, createFileRoute } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import {
  ArrowRight,
  BarChart3,
  Shield,
  TrendingUp,
  Users,
  Zap,
} from 'lucide-react'
import { api } from '../api/client'
import { formatCompactPoints } from '../lib/format'
import { Spinner } from '../components/ui/Spinner'
import { Button } from '../components/ui/Button'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card'
import type { Market } from '../api/types'

export const Route = createFileRoute('/')({
  component: LandingPage,
})

function LandingPage() {
  const { data: markets, isLoading } = useQuery({
    queryKey: ['featured-markets'],
    queryFn: async () => {
      const response = await api.get<{ items: Array<Market> }>('/markets', {
        params: {
          pageSize: 3,
          sort: 'volume24h',
          order: 'desc',
          status: 'ACTIVE',
        },
      })
      return response.data.items
    },
    // Only fetch on client to avoid hydration mismatches if server data differs
    enabled: typeof window !== 'undefined',
  })

  return (
    <div className="flex flex-col min-h-screen bg-black text-white selection:bg-blue-500/30">
      {/* Hero Section */}
      <section className="relative pt-32 pb-20 px-6 overflow-hidden">
        {/* Background Effects */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-blue-900/40 via-gray-900/0 to-gray-900/0" />
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[500px] bg-blue-500/10 blur-[100px] rounded-full pointer-events-none" />

        <div className="relative max-w-5xl mx-auto text-center space-y-8">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-sm font-medium animate-fade-in-up">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
            </span>
            Live Prediction Markets
          </div>

          <h1 className="text-5xl md:text-7xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-b from-white to-white/70">
            Predict the Future. <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-cyan-300">
              Trade Your Knowledge.
            </span>
          </h1>

          <p className="text-xl text-gray-400 max-w-2xl mx-auto leading-relaxed">
            Join the next generation of prediction markets. Trade on crypto,
            sports, and world events with zero counterparty risk.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
            <Link to="/register">
              <Button
                size="lg"
                className="bg-blue-600 hover:bg-blue-500 text-white min-w-[160px] h-12 text-lg shadow-lg shadow-blue-500/25 transition-all hover:scale-105"
              >
                Get Started
                <ArrowRight className="ml-2 w-5 h-5" />
              </Button>
            </Link>
            <Link to="/markets">
              <Button
                variant="ghost"
                size="lg"
                className="border border-gray-700 hover:bg-gray-800 text-gray-300 min-w-[160px] h-12 text-lg backdrop-blur-sm"
              >
                Browse Markets
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Featured Markets Section */}
      <section className="py-24 px-6 bg-gray-900/50 relative">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-between mb-12">
            <div>
              <h2 className="text-3xl font-bold text-white mb-2">
                Trending Markets
              </h2>
              <p className="text-gray-400">Top active markets by volume</p>
            </div>
            <Link
              to="/markets"
              className="text-blue-400 hover:text-blue-300 font-medium flex items-center gap-1 transition-colors"
            >
              View all markets <ArrowRight className="w-4 h-4" />
            </Link>
          </div>

          {isLoading ? (
            <div className="flex justify-center py-20">
              <Spinner className="w-8 h-8 text-blue-500" />
            </div>
          ) : markets && markets.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {markets.map((market) => (
                <Link
                  key={market.id}
                  to="/markets/$marketId"
                  params={{ marketId: market.id }}
                  className="group"
                >
                  <Card className="h-full bg-gray-800/50 border-gray-700 hover:border-blue-500/50 transition-all duration-300 hover:shadow-lg hover:shadow-blue-500/10 hover:-translate-y-1">
                    <CardHeader className="pb-3">
                      <div className="flex justify-between items-start gap-4">
                        <div className="bg-gray-800 rounded-lg p-2 group-hover:bg-gray-700 transition-colors">
                          <BarChart3 className="w-6 h-6 text-blue-400" />
                        </div>
                        {market.category && (
                          <span className="px-2.5 py-1 rounded-md bg-gray-700/50 text-xs font-medium text-gray-300 border border-gray-600">
                            {market.category}
                          </span>
                        )}
                      </div>
                      <CardTitle className="mt-4 text-xl leading-tight line-clamp-2 min-h-[3.5rem] group-hover:text-blue-400 transition-colors">
                        {market.title}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-400">Total Volume</span>
                        <div className="flex items-center gap-1.5 text-white font-medium">
                          <Zap className="w-4 h-4 text-amber-400 fill-amber-400/20" />
                          {formatCompactPoints(market.volume24h)}
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3 pt-2">
                        <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-lg p-3 text-center">
                          <div className="text-xs text-emerald-400 font-medium mb-1">
                            YES
                          </div>
                          <div className="text-lg font-bold text-emerald-300">
                            {market.pool.yesPrice || '0.50'}
                          </div>
                        </div>
                        <div className="bg-rose-500/10 border border-rose-500/20 rounded-lg p-3 text-center">
                          <div className="text-xs text-rose-400 font-medium mb-1">
                            NO
                          </div>
                          <div className="text-lg font-bold text-rose-300">
                            {market.pool.noPrice || '0.50'}
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          ) : (
            <div className="text-center py-20 bg-gray-800/30 rounded-2xl border border-gray-800 border-dashed">
              <div className="mx-auto w-16 h-16 bg-gray-800 rounded-full flex items-center justify-center mb-4">
                <TrendingUp className="w-8 h-8 text-gray-500" />
              </div>
              <h3 className="text-xl font-medium text-white mb-2">
                No Active Markets
              </h3>
              <p className="text-gray-400 mb-6">
                Be the first to create a prediction market!
              </p>
              <Link to="/admin/markets">
                <Button variant="ghost">Create Market</Button>
              </Link>
            </div>
          )}
        </div>
      </section>

      {/* How it Works Section */}
      <section className="py-24 px-6 bg-black relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-blue-900/20 via-black to-black opacity-50" />

        <div className="relative max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
              How it Works
            </h2>
            <p className="text-xl text-gray-400">
              Start trading in three simple steps
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
            {[
              {
                icon: <Users className="w-8 h-8 text-blue-400" />,
                title: 'Register & Get Points',
                desc: 'Create an account and receive 10 free Points to start trading immediately. No deposit required.',
              },
              {
                icon: <TrendingUp className="w-8 h-8 text-cyan-400" />,
                title: 'Choose a Market',
                desc: 'Browse trending markets in crypto, sports, and tech. Analyze the odds and make your pick.',
              },
              {
                icon: <Shield className="w-8 h-8 text-purple-400" />,
                title: 'Trade & Win',
                desc: "Buy Yes or No shares. If you're right, your shares settle at 1 Point each. Secure and transparent.",
              },
            ].map((step, i) => (
              <div
                key={i}
                className="relative flex flex-col items-center text-center group"
              >
                {i !== 2 && (
                  <div className="hidden md:block absolute top-8 left-[60%] w-[80%] h-[2px] bg-gradient-to-r from-blue-500/20 to-transparent pointer-events-none" />
                )}
                <div className="w-16 h-16 rounded-2xl bg-gray-900 border border-gray-800 flex items-center justify-center mb-6 group-hover:border-blue-500/50 group-hover:shadow-[0_0_30px_-10px_rgba(59,130,246,0.3)] transition-all duration-300">
                  {step.icon}
                </div>
                <h3 className="text-xl font-bold text-white mb-3">
                  {step.title}
                </h3>
                <p className="text-gray-400 leading-relaxed max-w-sm">
                  {step.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-6">
        <div className="max-w-5xl mx-auto bg-gradient-to-r from-blue-900/50 to-cyan-900/50 rounded-3xl p-8 md:p-16 text-center border border-blue-500/20 relative overflow-hidden">
          <div className="absolute inset-0 bg-[url('/grid-pattern.svg')] opacity-10"></div>
          <div className="relative z-10">
            <h2 className="text-3xl md:text-5xl font-bold text-white mb-6">
              Ready to start trading?
            </h2>
            <p className="text-xl text-gray-300 mb-8 max-w-2xl mx-auto">
              Join thousands of traders and put your knowledge to the test. Sign
              up now and get your welcome bonus.
            </p>
            <Link to="/register">
              <Button
                size="lg"
                className="bg-white text-blue-900 hover:bg-gray-100 font-bold min-w-[200px] h-14 text-lg shadow-xl shadow-blue-900/20"
              >
                Create Free Account
              </Button>
            </Link>
          </div>
        </div>
      </section>
    </div>
  )
}
