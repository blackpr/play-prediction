import { useEffect, useState } from 'react'
import { useForm } from '@tanstack/react-form'
import { useQueryClient } from '@tanstack/react-query'
import { useRouter } from '@tanstack/react-router'
import { toast } from 'sonner'
import { clsx } from 'clsx'
import { AlertCircle, Settings, TrendingDown, TrendingUp } from 'lucide-react'
import { useBuyShares, useMergeShares, useMintShares, useQuote, useSellShares } from '../../hooks/useTrading'
import { useAuth } from '../../hooks/useAuth'
import { usePosition } from '../../hooks/usePortfolio'
import { usePriceDirection, usePriceFlash } from '../../hooks/usePriceAnimation'
import { Button } from '../ui/Button'
import { Card, CardContent, CardHeader, CardTitle } from '../ui/Card'
import { formatPoints, parsePoints } from '../../lib/format'
import { Modal } from '../ui/Modal'
import type { Market, QuoteRequest, TradeSide } from '../../api/types'

interface TradeFormProps {
  market: Market
}

type TradeTab = 'buy' | 'sell' | 'mint' | 'merge'

// Helper to convert backend error messages to user-friendly text
function getUserFriendlyError(errorMessage: string): string {
  // Map backend MicroPoints errors to user-friendly Points messages
  // Example: "1000 MicroPoints ($0.001)" should become "0.001 points"
  if (errorMessage.includes('MicroPoints')) {
    const match = errorMessage.match(/(\d+)\s*MicroPoints/)
    if (match) {
      const microPoints = parseInt(match[1])
      const points = microPoints / 1_000_000 // Convert MicroPoints to Points
      return errorMessage.replace(
        /(\d+)\s*MicroPoints\s*\(\$[\d.]+\)/,
        `${points} points`
      )
    }
  }
  if (errorMessage.includes('INSUFFICIENT_BALANCE')) {
    return "You don't have enough points"
  }
  if (errorMessage.includes('INSUFFICIENT_SHARES')) {
    return "You don't have enough shares"
  }
  if (errorMessage.includes('SLIPPAGE_EXCEEDED')) {
    return 'Price moved too much. Try again with higher slippage'
  }
  if (errorMessage.includes('MARKET_NOT_ACTIVE') || errorMessage.includes('MARKET_CLOSED')) {
    return 'This market is not open for trading'
  }
  return errorMessage
}

export function TradeForm({ market }: TradeFormProps) {
  const [tab, setTab] = useState<TradeTab>('buy')
  const queryClient = useQueryClient()
  const [side, setSide] = useState<TradeSide>('YES')
  const [amount, setAmount] = useState('')
  const [debouncedAmount, setDebouncedAmount] = useState('')
  const router = useRouter()
  const { user, isAuthenticated } = useAuth()

  // Price animation hooks
  const yesPriceFlash = usePriceFlash(market.yesPrice)
  const noPriceFlash = usePriceFlash(market.noPrice)
  const yesPriceDirection = usePriceDirection(market.yesPrice)
  const noPriceDirection = usePriceDirection(market.noPrice)

  // Slippage State
  const [slippage, setSlippage] = useState<number>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('trade-slippage')
      return saved ? parseFloat(saved) : 0.5
    }
    return 0.5
  })
  const [showSettings, setShowSettings] = useState(false)


  // Confirmation State
  const [skipConfirmation, setSkipConfirmation] = useState(() => {
    if (typeof window !== 'undefined') {
      return sessionStorage.getItem('skip-trade-confirmation') === 'true'
    }
    return false
  })
  // Checkbox state for modal
  const [dontAskAgain, setDontAskAgain] = useState(false)
  // Save slippage preference
  useEffect(() => {
    localStorage.setItem('trade-slippage', slippage.toString())
  }, [slippage])

  const { data: position } = usePosition(market.id)
  const buyMutation = useBuyShares()
  const sellMutation = useSellShares()
  const mintMutation = useMintShares()
  const mergeMutation = useMergeShares()

  // Debounce amount for quote fetching
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedAmount(amount)
    }, 300)
    return () => clearTimeout(timer)
  }, [amount])

  // Prepare quote params
  const quoteParams: QuoteRequest | null =
    debouncedAmount && parseFloat(debouncedAmount) > 0
      ? {
        side,
        action: tab === 'buy' ? 'BUY' : 'SELL',
        amount: parsePoints(debouncedAmount).toString(),
      }
      : null

  const { data: quote, isLoading: isQuoteLoading } = useQuote(market.id, quoteParams)

  // Constants
  const CONFIRMATION_THRESHOLD = 100_000_000n // 100 points

  // Pending Trade State for Modal
  const [pendingTrade, setPendingTrade] = useState<{
    action: 'buy' | 'sell'
    amountMicro: bigint
    minOut: bigint
    estOut: bigint
    fee: bigint
    impact: string
  } | null>(null)

  // Confirmation State
  const [showConfirmation, setShowConfirmation] = useState(false)

  const executeTrade = async (trade: {
    action: 'buy' | 'sell' | 'mint' | 'merge'
    amountMicro: bigint
    minOut?: bigint
  }) => {
    switch (trade.action) {
      case 'buy': {
        const result = await buyMutation.mutateAsync({
          marketId: market.id,
          request: {
            side,
            amount: trade.amountMicro.toString(),
            minSharesOut: (trade.minOut ?? 0n).toString(),
          },
        })

        // Check if netting occurred (opposite position was cleared)
        const oppositeSide = side === 'YES' ? 'NO' : 'YES'
        const oppositeQtyBefore = oppositeSide === 'YES'
          ? BigInt(position?.yesQty ?? '0')
          : BigInt(position?.noQty ?? '0')

        if (oppositeQtyBefore > 0n) {
          toast.success(
            `Netting: Sold ${formatPoints(oppositeQtyBefore)} ${oppositeSide} shares (fee-free), then bought ${formatPoints(result.sharesOut)} ${side} shares`
          )
        } else {
          toast.success(`Bought ${formatPoints(result.sharesOut)} ${side} shares`)
        }

        queryClient.setQueryData(['portfolio', market.id], {
          ...result.newPosition,
          marketId: market.id,
        })
        break
      }
      case 'sell': {
        const result = await sellMutation.mutateAsync({
          marketId: market.id,
          request: {
            side,
            shares: trade.amountMicro.toString(),
            minAmountOut: (trade.minOut ?? 0n).toString(),
          },
        })
        toast.success(
          `Sold ${formatPoints(result.sharesIn)} ${side} shares for ${formatPoints(result.amountOut)} points`
        )
        queryClient.setQueryData(['portfolio', market.id], {
          ...result.newPosition,
          marketId: market.id,
        })
        break
      }
      case 'mint': {
        const result = await mintMutation.mutateAsync({
          marketId: market.id,
          request: {
            amount: trade.amountMicro.toString(),
          },
        })
        toast.success(`Minted ${formatPoints(result.yesOut)} YES and NO shares`)
        // Invalidate portfolio to refresh
        queryClient.invalidateQueries({ queryKey: ['portfolio', market.id] })
        break
      }
      case 'merge': {
        const result = await mergeMutation.mutateAsync({
          marketId: market.id,
          request: {
            amount: trade.amountMicro.toString(),
          },
        })
        toast.success(`Merged shares for ${formatPoints(result.amountOut)} points`)
        // Invalidate portfolio to refresh
        queryClient.invalidateQueries({ queryKey: ['portfolio', market.id] })
        break
      }
    }
  }

  const form = useForm({
    defaultValues: {
      amount: '',
    },
    onSubmit: async () => {
      // Use the amount state variable, not form value
      const amountMicro = parsePoints(amount)
      const amountBigInt = BigInt(amountMicro)

      // Guest Redirect Logic
      if (!isAuthenticated) {
        toast.info('Please log in to trade')
        await router.navigate({
          to: '/login',
          search: {
            redirect: window.location.pathname,
          },
        })
        return
      }

      try {
        if (tab === 'mint') {
          // Mint logic - no quote/slippage needed
          await executeTrade({
            action: 'mint',
            amountMicro: amountBigInt,
          })
          setAmount('')
          form.reset()
          return
        }

        if (tab === 'merge') {
          // Merge logic - no quote/slippage needed
          await executeTrade({
            action: 'merge',
            amountMicro: amountBigInt,
          })
          setAmount('')
          form.reset()
          return
        }

        if (tab === 'buy') {
          // Calculate minSharesOut with configured slippage tolerance
          const slippageBps = BigInt(Math.round(slippage * 100))
          const factor = 10000n - slippageBps

          const minSharesOut = quote?.estimatedSharesOut
            ? (BigInt(quote.estimatedSharesOut) * factor) / 10000n
            : 0n

          // Check threshold for confirmation (Amount > 100 or Impact > 10%)
          const impact = quote?.priceImpact ? parseFloat(quote.priceImpact) : 0
          if ((amountBigInt >= CONFIRMATION_THRESHOLD || impact > 0.1) && !skipConfirmation) {
            setPendingTrade({
              action: 'buy',
              amountMicro: amountBigInt,
              minOut: minSharesOut,
              estOut: quote?.estimatedSharesOut ? BigInt(quote.estimatedSharesOut) : 0n,
              fee: quote?.estimatedFee ? BigInt(quote.estimatedFee) : 0n,
              impact: quote?.priceImpact || '0',
            })
            setShowConfirmation(true)
            return
          }

          await executeTrade({
            action: 'buy',
            amountMicro: amountBigInt,
            minOut: minSharesOut,
          })

          setAmount('')
          form.reset()
        } else {
          // Calculate minAmountOut with configured slippage tolerance
          const slippageBps = BigInt(Math.round(slippage * 100))
          const factor = 10000n - slippageBps

          const minAmountOut = quote?.estimatedAmountOut
            ? (BigInt(quote.estimatedAmountOut) * factor) / 10000n
            : 0n

          // Check threshold (Estimated Output Value > Threshold)
          const estValue = quote?.estimatedAmountOut
            ? BigInt(quote.estimatedAmountOut)
            : 0n

          // Check threshold (Estimated Output Value > 100 or Impact > 10%)
          const impact = quote?.priceImpact ? parseFloat(quote.priceImpact) : 0
          if ((estValue >= CONFIRMATION_THRESHOLD || impact > 0.1) && !skipConfirmation) {
            setPendingTrade({
              action: 'sell',
              amountMicro: amountMicro,
              minOut: minAmountOut,
              estOut: quote?.estimatedAmountOut ? BigInt(quote.estimatedAmountOut) : 0n,
              fee: quote?.estimatedFee ? BigInt(quote.estimatedFee) : 0n,
              impact: quote?.priceImpact || '0',
            })
            setShowConfirmation(true)
            return
          }

          await executeTrade({
            action: 'sell',
            amountMicro,
            minOut: minAmountOut,
          })

          setAmount('')
          form.reset()
        }
      } catch (error) {
        // Error handling is done by mutation
        console.error('Trade failed:', error)
        toast.error('Trade failed. Please try again.')
      }
    },
  })

  const availableShares = (() => {
    if (tab === 'sell') {
      return side === 'YES'
        ? BigInt(position?.yesQty ?? '0')
        : BigInt(position?.noQty ?? '0')
    }
    if (tab === 'merge') {
      const yes = BigInt(position?.yesQty ?? '0')
      const no = BigInt(position?.noQty ?? '0')
      return yes < no ? yes : no
    }
    return 0n
  })()

  const isClosed = market.closesAt ? new Date(market.closesAt) < new Date() : false
  const isMarketActive = market.status === 'ACTIVE' && !isClosed

  const mutation = (() => {
    switch (tab) {
      case 'buy': return buyMutation
      case 'sell': return sellMutation
      case 'mint': return mintMutation
      case 'merge': return mergeMutation
    }
  })()

  // Validation
  const getValidationError = (): string | null => {
    if (!amount || parseFloat(amount) <= 0) return null

    const amountMicro = BigInt(parsePoints(amount))

    if (tab === 'buy' || tab === 'mint') {
      // Skip balance validation for guests
      if (isAuthenticated) {
        const balance = user?.balance ? BigInt(user.balance) : 0n
        if (amountMicro > balance) {
          return "You don't have enough points"
        }
      }
      if (amountMicro < 1000n) { // 0.001
        return 'Minimum trade size is 0.001'
      }
    } else {
      // Skip share validation for guests
      if (isAuthenticated) {
        if (amountMicro > availableShares) {
          return "You don't have enough shares"
        }
      }
      if (amountMicro < 1000n) {
        return 'Minimum size is 0.001'
      }
    }

    return null
  }

  const validationError = getValidationError()
  const canSubmit = !validationError && !!amount && parseFloat(amount) > 0 && isMarketActive

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
        <CardTitle>Trade</CardTitle>
        {(tab === 'buy' || tab === 'sell') && (
          <button
            onClick={() => setShowSettings(!showSettings)}
            className={clsx(
              "p-2 rounded-lg transition-colors",
              showSettings ? "bg-gray-800 text-white" : "text-gray-400 hover:text-white hover:bg-gray-800"
            )}
            type="button"
            aria-label="Settings"
          >
            <Settings className="w-5 h-5" />
          </button>
        )}
      </CardHeader>

      {showSettings && (tab === 'buy' || tab === 'sell') && (
        <div className="px-6 pb-6 border-b border-gray-800 mb-4 animate-in slide-in-from-top-2 duration-200">
          <label className="block text-xs font-medium text-gray-400 mb-3">
            Slippage Tolerance
          </label>
          <div className="flex flex-wrap gap-2">
            {[0.1, 0.5, 1.0].map((val) => (
              <button
                key={val}
                onClick={() => setSlippage(val)}
                className={clsx(
                  'px-3 py-1.5 text-sm font-medium rounded-md transition-colors',
                  slippage === val
                    ? 'bg-blue-600/20 text-blue-400 border border-blue-600/50'
                    : 'bg-gray-800 text-gray-400 border border-transparent hover:bg-gray-700'
                )}
                type="button"
              >
                {val}%
              </button>
            ))}
            <div className="relative flex items-center">
              <input
                type="number"
                value={slippage}
                onChange={(e) => {
                  const val = parseFloat(e.target.value)
                  if (!isNaN(val) && val >= 0) setSlippage(val)
                }}
                className="w-24 px-3 py-1.5 text-sm bg-gray-800 border border-gray-700 rounded-md focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 text-white placeholder-gray-500"
                step="0.1"
                min="0.1"
                placeholder="Custom"
              />
              <span className="absolute right-3 text-xs text-gray-500 pointer-events-none">%</span>
            </div>
          </div>
        </div>
      )}

      <CardContent className="space-y-4">
        {/* Market Status Warning */}
        {!isMarketActive && (
          <div className="flex items-start gap-2 p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
            <AlertCircle className="w-4 h-4 text-yellow-500 mt-0.5 flex-shrink-0" />
            <div className="text-sm text-yellow-200">
              This market is not open for trading
            </div>
          </div>
        )}

        {/* Trade Type Tabs */}
        <div className="flex gap-2">
          {([{ id: 'buy', label: 'Buy' }, { id: 'sell', label: 'Sell' }, { id: 'mint', label: 'Mint' }, { id: 'merge', label: 'Merge' }] as const).map(({ id, label }) => (
            <button
              key={id}
              onClick={() => {
                setTab(id)
                setAmount('')
              }}
              disabled={!isMarketActive}
              className={clsx(
                'flex-1 py-2 rounded-lg font-medium transition-colors text-sm',
                'disabled:opacity-50 disabled:cursor-not-allowed',
                tab === id
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-800 text-gray-400 hover:text-white'
              )}
            >
              {label}
            </button>
          ))}
        </div>

        {/* YES/NO Side Selection */}
        {(tab === 'buy' || tab === 'sell') && (
          <div className="flex gap-2">
            <button
              onClick={() => setSide('YES')}
              disabled={!isMarketActive}
              className={clsx(
                'flex-1 py-3 px-4 rounded-lg font-medium transition-all duration-200',
                'disabled:opacity-50 disabled:cursor-not-allowed',
                'flex flex-col items-center gap-1 relative',
                side === 'YES'
                  ? 'bg-green-600 text-white ring-2 ring-green-400'
                  : 'bg-gray-800 text-gray-400 hover:bg-green-600/20',
                yesPriceFlash && 'animate-pulse ring-2 ring-green-300'
              )}
            >
              <span className="text-lg">YES</span>
              <span className={clsx(
                "text-xs opacity-80 flex items-center gap-1 transition-all",
                yesPriceFlash && "font-bold scale-110"
              )}>
                {(() => {
                  const price = parseFloat(market.yesPrice)
                  return isNaN(price) ? '50.0¢' : `${(price * 100).toFixed(1)}¢`
                })()}
                {yesPriceDirection === 'up' && <TrendingUp className="w-3 h-3 text-green-300" />}
                {yesPriceDirection === 'down' && <TrendingDown className="w-3 h-3 text-red-300" />}
              </span>
            </button>
            <button
              onClick={() => setSide('NO')}
              disabled={!isMarketActive}
              className={clsx(
                'flex-1 py-3 px-4 rounded-lg font-medium transition-all duration-200',
                'disabled:opacity-50 disabled:cursor-not-allowed',
                'flex flex-col items-center gap-1 relative',
                side === 'NO'
                  ? 'bg-red-600 text-white ring-2 ring-red-400'
                  : 'bg-gray-800 text-gray-400 hover:bg-red-600/20',
                noPriceFlash && 'animate-pulse ring-2 ring-red-300'
              )}
            >
              <span className="text-lg">NO</span>
              <span className={clsx(
                "text-xs opacity-80 flex items-center gap-1 transition-all",
                noPriceFlash && "font-bold scale-110"
              )}>
                {(() => {
                  const price = parseFloat(market.noPrice)
                  return isNaN(price) ? '50.0¢' : `${(price * 100).toFixed(1)}¢`
                })()}
                {noPriceDirection === 'up' && <TrendingUp className="w-3 h-3 text-green-300" />}
                {noPriceDirection === 'down' && <TrendingDown className="w-3 h-3 text-red-300" />}
              </span>
            </button>
          </div>
        )}

        {/* Amount Input */}
        <form
          onSubmit={(e) => {
            e.preventDefault()
            form.handleSubmit()
          }}
          className="space-y-4"
        >
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-2">
              {tab === 'buy' || tab === 'mint' ? 'Amount (Points)' : tab === 'merge' ? 'Shares to Merge' : 'Shares to Sell'}
            </label>
            <div className="relative">
              <input
                type="text"
                inputMode="decimal"
                placeholder="0.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                disabled={!isMarketActive}
                className={clsx(
                  'w-full px-4 py-3 bg-gray-800 border rounded-lg',
                  'text-white text-lg font-mono',
                  'focus:outline-none focus:ring-2 focus:ring-blue-500',
                  'disabled:opacity-50 disabled:cursor-not-allowed',
                  validationError ? 'border-red-500' : 'border-gray-700'
                )}
              />
              {(tab === 'buy' || tab === 'mint') && isMarketActive && (
                <button
                  type="button"
                  onClick={() => {
                    const max = formatPoints(user?.balance ?? '0')
                    setAmount(max)
                  }}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-blue-400 hover:text-blue-300 font-medium"
                >
                  MAX
                </button>
              )}
              {(tab === 'sell' || tab === 'merge') && isMarketActive && (
                <button
                  type="button"
                  onClick={() => {
                    const max = formatPoints(availableShares.toString())
                    setAmount(max)
                  }}
                  disabled={availableShares === 0n}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-blue-400 hover:text-blue-300 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  MAX
                </button>
              )}
            </div>
            {validationError && (
              <p className="mt-1 text-sm text-red-400">{validationError}</p>
            )}
            {(tab === 'sell' || tab === 'merge') && (
              <p className="mt-1 text-xs text-gray-500">
                Available: {formatPoints(availableShares.toString())} {tab === 'merge' ? 'pairs' : `${side} shares`}
              </p>
            )}
          </div>

          {/* Netting Preview - Show when user holds opposite shares */}
          {tab === 'buy' && position && amount && parseFloat(amount) > 0 && (() => {
            const oppositeSide = side === 'YES' ? 'NO' : 'YES'
            const oppositeQty = oppositeSide === 'YES'
              ? BigInt(position.yesQty ?? '0')
              : BigInt(position.noQty ?? '0')

            if (oppositeQty > 0n) {
              // User holds opposite shares - netting will occur
              return (
                <div className="p-4 bg-blue-500/10 border border-blue-500/30 rounded-lg space-y-3">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 text-blue-400 mt-0.5 flex-shrink-0" />
                    <div className="flex-1">
                      <p className="text-sm font-medium text-blue-200">
                        Automatic Position Netting
                      </p>
                      <p className="text-xs text-blue-300/80 mt-1">
                        You hold {formatPoints(oppositeQty.toString())} {oppositeSide} shares.
                        These will be sold fee-free before buying {side}.
                      </p>
                    </div>
                  </div>

                  <div className="space-y-2 pt-2 border-t border-blue-500/20">
                    <div className="flex justify-between text-xs">
                      <span className="text-blue-300/70">Fee-free exit</span>
                      <span className="font-mono text-blue-200">
                        {formatPoints(oppositeQty.toString())} {oppositeSide} shares
                      </span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-blue-300/70">Your buy amount</span>
                      <span className="font-mono text-blue-200">
                        {amount} points
                      </span>
                    </div>
                    <div className="flex justify-between text-xs font-medium pt-1 border-t border-blue-500/20">
                      <span className="text-blue-200">Total buying power</span>
                      <span className="font-mono text-blue-100">
                        ~{amount} + exit proceeds
                      </span>
                    </div>
                  </div>
                </div>
              )
            }
            return null
          })()}

          {/* Estimated Output for Buy/Sell */}
          {quote && (tab === 'buy' || tab === 'sell') && amount && parseFloat(amount) > 0 && (
            <div className="p-4 bg-gray-800/50 rounded-lg space-y-3 border border-gray-700">
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">
                  {tab === 'buy' ? 'Estimated shares' : 'Estimated points'}
                </span>
                <span className="font-mono text-white">
                  {tab === 'buy'
                    ? formatPoints(quote.estimatedSharesOut ?? '0')
                    : formatPoints(quote.estimatedAmountOut ?? '0')}
                </span>
              </div>

              <div className="flex justify-between text-sm">
                <span className="text-gray-400">Avg. price</span>
                <span className="font-mono text-white">
                  {(() => {
                    const amountIn = parsePoints(amount)
                    const out = tab === 'buy'
                      ? BigInt(quote.estimatedSharesOut ?? '0')
                      : BigInt(quote.estimatedAmountOut ?? '0')

                    if (out === 0n) return '0.00¢'

                    // Implied price = Cost / Shares
                    const displayPrice = tab === 'buy'
                      ? Number(amountIn) / Number(out)
                      : Number(out) / Number(amountIn)

                    return `${(displayPrice * 100).toFixed(2)}¢`
                  })()}
                </span>
              </div>

              <div className="flex justify-between text-sm">
                <span className="text-gray-400">Fee</span>
                <span className="font-mono text-white">
                  {formatPoints(quote.estimatedFee)}
                </span>
              </div>

              <div className="flex justify-between text-sm">
                <span className="text-gray-400 flex items-center gap-1">
                  Price impact
                  {parseFloat(quote.priceImpact) > 1 && (
                    <AlertCircle className="w-3 h-3 text-yellow-500" />
                  )}
                </span>
                <span
                  className={clsx(
                    'font-mono flex items-center gap-1',
                    parseFloat(quote.priceImpact) > 5
                      ? 'text-red-400'
                      : parseFloat(quote.priceImpact) > 1
                        ? 'text-yellow-400'
                        : 'text-green-400'
                  )}
                >
                  {parseFloat(quote.priceImpact) > 0 ? (
                    <TrendingUp className="w-3 h-3" />
                  ) : (
                    <TrendingDown className="w-3 h-3" />
                  )}
                  {parseFloat(quote.priceImpact).toFixed(2)}%
                </span>
              </div>

              {parseFloat(quote.priceImpact) > 1 && (
                <div className="pt-2 border-t border-gray-700">
                  <p className="text-xs text-yellow-200">
                    ⚠️ High price impact. Consider a smaller trade size.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Simple Preview for Mint/Merge */}
          {(tab === 'mint' || tab === 'merge') && amount && parseFloat(amount) > 0 && (
            <div className="p-4 bg-gray-800/50 rounded-lg space-y-3 border border-gray-700">
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">
                  {tab === 'mint' ? 'You will receive' : 'You will receive'}
                </span>
                <span className="font-mono text-white text-right">
                  {tab === 'mint' ? (
                    <>
                      {formatPoints(parsePoints(amount).toString())} YES<br />
                      + {formatPoints(parsePoints(amount).toString())} NO
                    </>
                  ) : (
                    <>
                      {formatPoints(parsePoints(amount).toString())} Points
                    </>
                  )}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">Fee</span>
                <span className="font-mono text-white">0</span>
              </div>
            </div>
          )}

          {/* Loading state for quote */}
          {isQuoteLoading && (tab === 'buy' || tab === 'sell') && amount && parseFloat(amount) > 0 && (
            <div className="p-4 bg-gray-800/50 rounded-lg border border-gray-700">
              <div className="flex items-center justify-center gap-2 text-sm text-gray-400">
                <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                <span>Calculating...</span>
              </div>
            </div>
          )}

          {/* Error Display */}
          {mutation.error && (
            <div className="flex items-start gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
              <AlertCircle className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" />
              <div className="text-sm text-red-200">
                {getUserFriendlyError(mutation.error.message || 'Trade failed. Please try again.')}
              </div>
            </div>
          )}

          {/* Submit Button */}
          <Button
            type="submit"
            variant={tab === 'mint' || tab === 'merge' ? 'primary' : side === 'YES' ? 'yes' : 'no'}
            size="lg"
            className="w-full"
            isLoading={mutation.isPending}
            disabled={!canSubmit || mutation.isPending}
          >
            {tab === 'buy' ? `Buy ${side}` : tab === 'sell' ? `Sell ${side}` : tab === 'mint' ? 'Mint Shares' : 'Merge Shares'}
          </Button>
        </form>
      </CardContent>

      <Modal
        isOpen={showConfirmation}
        onClose={() => {
          setShowConfirmation(false)
          setPendingTrade(null)
        }}
        title="Confirm Trade"
      >
        {pendingTrade && (
          <div className="space-y-4">
            <div className="flex justify-between items-center pb-2 border-b border-gray-700/50">
              <span className="text-gray-400">Action</span>
              <span
                className={clsx(
                  'font-bold',
                  pendingTrade.action === 'buy' ? 'text-green-400' : 'text-red-400'
                )}
              >
                {pendingTrade.action === 'buy' ? 'Buy' : 'Sell'}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-400">Amount</span>
              <span className="font-mono text-white">
                {formatPoints(pendingTrade.amountMicro.toString())}
              </span>
            </div>
            {pendingTrade.action === 'buy' ? (
              <div className="flex justify-between items-center">
                <span className="text-gray-400">Min Shares Received</span>
                <span className="font-mono text-white">
                  {formatPoints(pendingTrade.minOut.toString())}
                </span>
              </div>
            ) : (
              <div className="flex justify-between items-center">
                <span className="text-gray-400">Min Points Received</span>
                <span className="font-mono text-white">
                  {formatPoints(pendingTrade.minOut.toString())}
                </span>
              </div>
            )}
            <div className="flex justify-between items-center">
              <span className="text-gray-400">Estimated Fee</span>
              <span className="font-mono text-white">
                {formatPoints(pendingTrade.fee.toString())}
              </span>
            </div>
            <div className="flex justify-between items-center pt-2 border-t border-gray-700/50">
              <span className="text-gray-400">Price Impact</span>
              <span
                className={clsx(
                  'font-mono',
                  parseFloat(pendingTrade.impact) > 5
                    ? 'text-red-400'
                    : parseFloat(pendingTrade.impact) > 1
                      ? 'text-yellow-400'
                      : 'text-green-400'
                )}
              >
                {pendingTrade.impact}%
              </span>
            </div>

            {(pendingTrade.amountMicro >= CONFIRMATION_THRESHOLD || parseFloat(pendingTrade.impact) > 5) && (
              <div className="p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
                <p className="text-xs text-yellow-200">
                  You are about to execute a large trade. Please confirm the details above.
                </p>
              </div>
            )}

            <div className="flex items-center gap-2 pt-2">
              <input
                type="checkbox"
                id="dont-ask-again"
                checked={dontAskAgain}
                onChange={(e) => setDontAskAgain(e.target.checked)}
                className="rounded border-gray-600 bg-gray-700 text-blue-600 focus:ring-blue-500"
              />
              <label htmlFor="dont-ask-again" className="text-sm text-gray-400 select-none cursor-pointer">
                Don't ask again for large trades
              </label>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button
                variant="secondary"
                onClick={() => {
                  setShowConfirmation(false)
                  setPendingTrade(null)
                }}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                onClick={async () => {
                  if (dontAskAgain) {
                    sessionStorage.setItem('skip-trade-confirmation', 'true')
                    setSkipConfirmation(true)
                  }

                  try {
                    await executeTrade({
                      action: pendingTrade.action,
                      amountMicro: pendingTrade.amountMicro,
                      minOut: pendingTrade.minOut,
                    })
                    setAmount('')
                    form.reset()
                    setShowConfirmation(false)
                    setPendingTrade(null)
                  } catch (error) {
                    console.error('Trade failed:', error)
                    toast.error('Trade failed. Please try again.')
                  }
                }}
              >
                Confirm Trade
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </Card>
  )
}
