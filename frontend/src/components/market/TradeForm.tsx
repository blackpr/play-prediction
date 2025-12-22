import { useState, useEffect } from 'react'
import { useForm } from '@tanstack/react-form'
import { useBuyShares, useSellShares, useQuote } from '../../hooks/useTrading'
import { useAuth } from '../../hooks/useAuth'
import { usePosition } from '../../hooks/usePortfolio'
import { Button } from '../ui/Button'
import { Card, CardHeader, CardTitle, CardContent } from '../ui/Card'
import { formatPoints, parsePoints } from '../../lib/format'
import { clsx } from 'clsx'
import type { Market, TradeSide, QuoteRequest } from '../../api/types'
import { AlertCircle, TrendingUp, TrendingDown } from 'lucide-react'

interface TradeFormProps {
  market: Market
}

type TradeTab = 'buy' | 'sell'

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
  const [side, setSide] = useState<TradeSide>('YES')
  const [amount, setAmount] = useState('')
  const [debouncedAmount, setDebouncedAmount] = useState('')

  const { user } = useAuth()
  const { data: position } = usePosition(market.id)
  const buyMutation = useBuyShares()
  const sellMutation = useSellShares()

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

  const form = useForm({
    defaultValues: {
      amount: '',
    },
    onSubmit: async () => {
      // Use the amount state variable, not form value
      const amountMicro = parsePoints(amount)

      try {
        if (tab === 'buy') {
          // Calculate minSharesOut with 0.5% slippage tolerance
          const minSharesOut = quote?.estimatedSharesOut
            ? (BigInt(quote.estimatedSharesOut) * 995n) / 1000n
            : 0n

          await buyMutation.mutateAsync({
            marketId: market.id,
            request: {
              side,
              amount: amountMicro.toString(),
              minSharesOut: minSharesOut.toString(),
            },
          })
        } else {
          // Calculate minAmountOut with 0.5% slippage tolerance
          const minAmountOut = quote?.estimatedAmountOut
            ? (BigInt(quote.estimatedAmountOut) * 995n) / 1000n
            : 0n

          await sellMutation.mutateAsync({
            marketId: market.id,
            request: {
              side,
              shares: amountMicro.toString(),
              minAmountOut: minAmountOut.toString(),
            },
          })
        }

        // Reset form on success
        setAmount('')
        form.reset()
      } catch (error) {
        // Error handling is done by mutation
        console.error('Trade failed:', error)
      }
    },
  })

  const availableShares =
    side === 'YES'
      ? BigInt(position?.yesQty ?? '0')
      : BigInt(position?.noQty ?? '0')

  const isMarketActive = market.status === 'ACTIVE'
  const mutation = tab === 'buy' ? buyMutation : sellMutation

  // Validation
  const getValidationError = (): string | null => {
    if (!amount || parseFloat(amount) <= 0) return null

    const amountMicro = BigInt(parsePoints(amount))

    if (tab === 'buy') {
      if (amountMicro > BigInt(user?.balance ?? '0')) {
        return "You don't have enough points"
      }
      if (amountMicro < 1000n) {
        return 'Minimum trade size is 0.001 points'
      }
    } else {
      if (amountMicro > availableShares) {
        return "You don't have enough shares"
      }
      if (amountMicro < 1000n) {
        return 'Minimum trade size is 0.001 shares'
      }
    }

    return null
  }

  const validationError = getValidationError()
  const canSubmit = !validationError && !!amount && parseFloat(amount) > 0 && isMarketActive

  return (
    <Card>
      <CardHeader>
        <CardTitle>Trade</CardTitle>
      </CardHeader>

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

        {/* Buy/Sell Tabs */}
        <div className="flex gap-2">
          <button
            onClick={() => {
              setTab('buy')
              setAmount('')
            }}
            disabled={!isMarketActive}
            className={clsx(
              'flex-1 py-2 rounded-lg font-medium transition-colors',
              'disabled:opacity-50 disabled:cursor-not-allowed',
              tab === 'buy'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-800 text-gray-400 hover:text-white'
            )}
          >
            Buy
          </button>
          <button
            onClick={() => {
              setTab('sell')
              setAmount('')
            }}
            disabled={!isMarketActive}
            className={clsx(
              'flex-1 py-2 rounded-lg font-medium transition-colors',
              'disabled:opacity-50 disabled:cursor-not-allowed',
              tab === 'sell'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-800 text-gray-400 hover:text-white'
            )}
          >
            Sell
          </button>
        </div>

        {/* YES/NO Side Selection */}
        <div className="flex gap-2">
          <button
            onClick={() => setSide('YES')}
            disabled={!isMarketActive}
            className={clsx(
              'flex-1 py-3 px-4 rounded-lg font-medium transition-all',
              'disabled:opacity-50 disabled:cursor-not-allowed',
              'flex flex-col items-center gap-1',
              side === 'YES'
                ? 'bg-green-600 text-white ring-2 ring-green-400'
                : 'bg-gray-800 text-gray-400 hover:bg-green-600/20'
            )}
          >
            <span className="text-lg">YES</span>
            <span className="text-xs opacity-80">
              {(() => {
                const price = parseFloat(market.pool?.yesPrice || '0')
                return isNaN(price) ? '50.0¢' : `${(price * 100).toFixed(1)}¢`
              })()}
            </span>
          </button>
          <button
            onClick={() => setSide('NO')}
            disabled={!isMarketActive}
            className={clsx(
              'flex-1 py-3 px-4 rounded-lg font-medium transition-all',
              'disabled:opacity-50 disabled:cursor-not-allowed',
              'flex flex-col items-center gap-1',
              side === 'NO'
                ? 'bg-red-600 text-white ring-2 ring-red-400'
                : 'bg-gray-800 text-gray-400 hover:bg-red-600/20'
            )}
          >
            <span className="text-lg">NO</span>
            <span className="text-xs opacity-80">
              {(() => {
                const price = parseFloat(market.pool?.noPrice || '0')
                return isNaN(price) ? '50.0¢' : `${(price * 100).toFixed(1)}¢`
              })()}
            </span>
          </button>
        </div>

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
              {tab === 'buy' ? 'Amount (Points)' : 'Shares to Sell'}
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
              {tab === 'buy' && isMarketActive && (
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
              {tab === 'sell' && isMarketActive && (
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
            {tab === 'sell' && (
              <p className="mt-1 text-xs text-gray-500">
                Available: {formatPoints(availableShares.toString())} {side} shares
              </p>
            )}
          </div>

          {/* Estimated Output */}
          {quote && amount && parseFloat(amount) > 0 && (
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
                  {(parseFloat(quote.avgExecutionPrice) * 100).toFixed(2)}¢
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

          {/* Loading state for quote */}
          {isQuoteLoading && amount && parseFloat(amount) > 0 && (
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
            variant={side === 'YES' ? 'yes' : 'no'}
            size="lg"
            className="w-full"
            isLoading={mutation.isPending}
            disabled={!canSubmit || mutation.isPending}
          >
            {tab === 'buy' ? 'Buy' : 'Sell'} {side}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
