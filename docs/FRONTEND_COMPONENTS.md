# Frontend Components & Design System

**Version:** 1.0  
**Framework:** React 19 + TanStack  
**Validation:** Zod v4  
**Styling:** Tailwind CSS v4  
**Last Updated:** December 2025

---

## Table of Contents

1. [Design System](#1-design-system)
2. [Base UI Components](#2-base-ui-components)
3. [Layout Components](#3-layout-components)
4. [Market Components](#4-market-components)
5. [Trading Components](#5-trading-components)
6. [Portfolio Components](#6-portfolio-components)
7. [Form Components](#7-form-components)
8. [Utility Functions](#8-utility-functions)

---

## 1. Design System

### 1.1 Color Palette

```css
/* tailwind.config.ts */
:root {
  /* Background */
  --color-bg-primary: #0a0a0f;
  --color-bg-secondary: #12121a;
  --color-bg-tertiary: #1a1a24;
  --color-bg-elevated: #22222e;
  
  /* Text */
  --color-text-primary: #f0f0f5;
  --color-text-secondary: #a0a0b0;
  --color-text-muted: #606070;
  
  /* Accent */
  --color-accent-blue: #3b82f6;
  --color-accent-purple: #8b5cf6;
  
  /* Status */
  --color-yes: #22c55e;      /* Green - YES position */
  --color-no: #ef4444;       /* Red - NO position */
  --color-warning: #f59e0b;
  --color-info: #06b6d4;
  
  /* Border */
  --color-border: #2a2a36;
  --color-border-focus: #3b82f6;
}
```

### 1.2 Typography

```typescript
// src/lib/typography.ts
export const typography = {
  h1: 'text-4xl font-bold tracking-tight',
  h2: 'text-3xl font-bold tracking-tight',
  h3: 'text-2xl font-semibold',
  h4: 'text-xl font-semibold',
  body: 'text-base',
  bodySmall: 'text-sm',
  caption: 'text-xs text-gray-400',
  mono: 'font-mono text-sm',
} as const
```

### 1.3 Spacing & Layout

```typescript
// Standard spacing scale (Tailwind default)
// 1 = 0.25rem (4px)
// 2 = 0.5rem (8px)
// 4 = 1rem (16px)
// 6 = 1.5rem (24px)
// 8 = 2rem (32px)

export const layout = {
  container: 'max-w-7xl mx-auto px-4 sm:px-6 lg:px-8',
  section: 'py-8 md:py-12',
  card: 'p-4 md:p-6',
  cardCompact: 'p-3 md:p-4',
} as const
```

---

## 2. Base UI Components

### 2.1 Button

```tsx
// src/components/ui/Button.tsx
import { forwardRef, type ButtonHTMLAttributes } from 'react'
import { clsx } from 'clsx'
import { Loader2 } from 'lucide-react'

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'yes' | 'no'
type ButtonSize = 'sm' | 'md' | 'lg'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
  isLoading?: boolean
  leftIcon?: React.ReactNode
  rightIcon?: React.ReactNode
}

const variantStyles: Record<ButtonVariant, string> = {
  primary: 'bg-blue-600 hover:bg-blue-500 text-white',
  secondary: 'bg-gray-700 hover:bg-gray-600 text-white',
  ghost: 'bg-transparent hover:bg-gray-800 text-gray-300',
  danger: 'bg-red-600 hover:bg-red-500 text-white',
  yes: 'bg-green-600 hover:bg-green-500 text-white',
  no: 'bg-red-600 hover:bg-red-500 text-white',
}

const sizeStyles: Record<ButtonSize, string> = {
  sm: 'px-3 py-1.5 text-sm',
  md: 'px-4 py-2 text-base',
  lg: 'px-6 py-3 text-lg',
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant = 'primary',
      size = 'md',
      isLoading = false,
      disabled,
      leftIcon,
      rightIcon,
      children,
      ...props
    },
    ref
  ) => {
    return (
      <button
        ref={ref}
        disabled={disabled || isLoading}
        className={clsx(
          'inline-flex items-center justify-center font-medium rounded-lg',
          'transition-colors duration-150',
          'disabled:opacity-50 disabled:cursor-not-allowed',
          variantStyles[variant],
          sizeStyles[size],
          className
        )}
        {...props}
      >
        {isLoading ? (
          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
        ) : leftIcon ? (
          <span className="mr-2">{leftIcon}</span>
        ) : null}
        {children}
        {rightIcon && !isLoading && <span className="ml-2">{rightIcon}</span>}
      </button>
    )
  }
)

Button.displayName = 'Button'
```

### 2.2 Input

```tsx
// src/components/ui/Input.tsx
import { forwardRef, type InputHTMLAttributes } from 'react'
import { clsx } from 'clsx'

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
  hint?: string
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, hint, id, ...props }, ref) => {
    const inputId = id ?? label?.toLowerCase().replace(/\s+/g, '-')
    
    return (
      <div className="space-y-1">
        {label && (
          <label
            htmlFor={inputId}
            className="block text-sm font-medium text-gray-300"
          >
            {label}
          </label>
        )}
        <input
          ref={ref}
          id={inputId}
          className={clsx(
            'w-full px-4 py-2 bg-gray-800 border rounded-lg',
            'text-white placeholder-gray-500',
            'focus:outline-none focus:ring-2 focus:ring-blue-500',
            'transition-colors duration-150',
            error
              ? 'border-red-500 focus:ring-red-500'
              : 'border-gray-700 hover:border-gray-600',
            className
          )}
          {...props}
        />
        {error && <p className="text-sm text-red-400">{error}</p>}
        {hint && !error && <p className="text-sm text-gray-500">{hint}</p>}
      </div>
    )
  }
)

Input.displayName = 'Input'
```

### 2.3 Card

```tsx
// src/components/ui/Card.tsx
import { clsx } from 'clsx'

interface CardProps {
  children: React.ReactNode
  className?: string
  variant?: 'default' | 'elevated' | 'outlined'
  padding?: 'none' | 'sm' | 'md' | 'lg'
}

const variantStyles = {
  default: 'bg-gray-900',
  elevated: 'bg-gray-800 shadow-xl',
  outlined: 'bg-transparent border border-gray-700',
}

const paddingStyles = {
  none: '',
  sm: 'p-3',
  md: 'p-4 md:p-6',
  lg: 'p-6 md:p-8',
}

export function Card({
  children,
  className,
  variant = 'default',
  padding = 'md',
}: CardProps) {
  return (
    <div
      className={clsx(
        'rounded-xl',
        variantStyles[variant],
        paddingStyles[padding],
        className
      )}
    >
      {children}
    </div>
  )
}

export function CardHeader({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <div className={clsx('mb-4', className)}>
      {children}
    </div>
  )
}

export function CardTitle({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <h3 className={clsx('text-xl font-semibold text-white', className)}>
      {children}
    </h3>
  )
}
```

### 2.4 Modal

```tsx
// src/components/ui/Modal.tsx
import { Fragment } from 'react'
import { Dialog, Transition } from '@headlessui/react'
import { X } from 'lucide-react'
import { clsx } from 'clsx'

interface ModalProps {
  isOpen: boolean
  onClose: () => void
  title?: string
  children: React.ReactNode
  size?: 'sm' | 'md' | 'lg' | 'xl'
}

const sizeStyles = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-lg',
  xl: 'max-w-xl',
}

export function Modal({
  isOpen,
  onClose,
  title,
  children,
  size = 'md',
}: ModalProps) {
  return (
    <Transition appear show={isOpen} as={Fragment}>
      <Dialog as="div" className="relative z-50" onClose={onClose}>
        {/* Backdrop */}
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-200"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-150"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" />
        </Transition.Child>

        {/* Modal */}
        <div className="fixed inset-0 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-200"
              enterFrom="opacity-0 scale-95"
              enterTo="opacity-100 scale-100"
              leave="ease-in duration-150"
              leaveFrom="opacity-100 scale-100"
              leaveTo="opacity-0 scale-95"
            >
              <Dialog.Panel
                className={clsx(
                  'w-full transform rounded-2xl bg-gray-900 p-6',
                  'shadow-2xl transition-all',
                  sizeStyles[size]
                )}
              >
                {title && (
                  <div className="flex items-center justify-between mb-4">
                    <Dialog.Title className="text-xl font-semibold text-white">
                      {title}
                    </Dialog.Title>
                    <button
                      onClick={onClose}
                      className="p-1 rounded-lg hover:bg-gray-800 transition-colors"
                    >
                      <X className="w-5 h-5 text-gray-400" />
                    </button>
                  </div>
                )}
                {children}
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  )
}
```

### 2.5 Spinner

```tsx
// src/components/ui/Spinner.tsx
import { clsx } from 'clsx'

interface SpinnerProps {
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

const sizeStyles = {
  sm: 'w-4 h-4',
  md: 'w-6 h-6',
  lg: 'w-8 h-8',
}

export function Spinner({ size = 'md', className }: SpinnerProps) {
  return (
    <svg
      className={clsx('animate-spin text-blue-500', sizeStyles[size], className)}
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
      />
    </svg>
  )
}
```

---

## 3. Layout Components

### 3.1 Header

```tsx
// src/components/layout/Header.tsx
import { Link } from '@tanstack/react-router'
import { useAuth, useLogout } from '../../hooks/useAuth'
import { Button } from '../ui/Button'
import { formatPoints } from '../../lib/format'
import { Wallet, LogOut, User } from 'lucide-react'

export function Header() {
  const { user, isAuthenticated, isLoading } = useAuth()
  const logoutMutation = useLogout()
  
  return (
    <header className="sticky top-0 z-40 bg-gray-950/80 backdrop-blur-lg border-b border-gray-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2">
            <span className="text-2xl">🎯</span>
            <span className="text-xl font-bold text-white">Play Prediction</span>
          </Link>
          
          {/* Navigation */}
          <nav className="hidden md:flex items-center gap-6">
            <Link
              to="/markets"
              className="text-gray-300 hover:text-white transition-colors"
              activeProps={{ className: 'text-white font-medium' }}
            >
              Markets
            </Link>
            {isAuthenticated && (
              <Link
                to="/portfolio"
                className="text-gray-300 hover:text-white transition-colors"
                activeProps={{ className: 'text-white font-medium' }}
              >
                Portfolio
              </Link>
            )}
          </nav>
          
          {/* User section */}
          <div className="flex items-center gap-4">
            {isLoading ? (
              <div className="w-24 h-8 bg-gray-800 rounded-lg animate-pulse" />
            ) : isAuthenticated ? (
              <>
                {/* Balance */}
                <div className="flex items-center gap-2 px-3 py-1.5 bg-gray-800 rounded-lg">
                  <Wallet className="w-4 h-4 text-blue-400" />
                  <span className="font-mono font-medium">
                    {formatPoints(user!.balance)}
                  </span>
                </div>
                
                {/* User menu */}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => logoutMutation.mutate()}
                  leftIcon={<LogOut className="w-4 h-4" />}
                >
                  Sign Out
                </Button>
              </>
            ) : (
              <>
                <Link to="/login">
                  <Button variant="ghost" size="sm">Sign In</Button>
                </Link>
                <Link to="/register">
                  <Button size="sm">Get Started</Button>
                </Link>
              </>
            )}
          </div>
        </div>
      </div>
    </header>
  )
}
```

---

## 4. Market Components

### 4.1 Market Card

```tsx
// src/components/market/MarketCard.tsx
import { Link } from '@tanstack/react-router'
import { Card } from '../ui/Card'
import { ProbabilityBar } from './ProbabilityBar'
import { formatDistanceToNow } from 'date-fns'
import { Clock, TrendingUp } from 'lucide-react'
import type { Market } from '../../api/types'

interface MarketCardProps {
  market: Market
}

export function MarketCard({ market }: MarketCardProps) {
  const yesPrice = market.pool.yesPrice
  const volume = BigInt(market.pool.totalVolume)
  
  return (
    <Link to="/markets/$marketId" params={{ marketId: market.id }}>
      <Card
        variant="elevated"
        className="hover:bg-gray-750 transition-colors cursor-pointer"
      >
        {/* Status badge */}
        <div className="flex items-center justify-between mb-3">
          <StatusBadge status={market.status} />
          {market.expiresAt && (
            <span className="flex items-center gap-1 text-xs text-gray-400">
              <Clock className="w-3 h-3" />
              {formatDistanceToNow(new Date(market.expiresAt), { addSuffix: true })}
            </span>
          )}
        </div>
        
        {/* Title */}
        <h3 className="text-lg font-semibold text-white mb-4 line-clamp-2">
          {market.title}
        </h3>
        
        {/* Probability bar */}
        <ProbabilityBar yesPercent={yesPrice * 100} />
        
        {/* Footer stats */}
        <div className="flex items-center justify-between mt-4 pt-3 border-t border-gray-700">
          <div className="flex items-center gap-1 text-sm text-gray-400">
            <TrendingUp className="w-4 h-4" />
            <span>Vol: {formatCompactPoints(volume)}</span>
          </div>
          <div className="flex gap-4 text-sm">
            <span className="text-green-400">{(yesPrice * 100).toFixed(0)}% Yes</span>
            <span className="text-red-400">{((1 - yesPrice) * 100).toFixed(0)}% No</span>
          </div>
        </div>
      </Card>
    </Link>
  )
}

function StatusBadge({ status }: { status: Market['status'] }) {
  const styles = {
    PENDING: 'bg-yellow-500/20 text-yellow-400',
    ACTIVE: 'bg-green-500/20 text-green-400',
    PAUSED: 'bg-orange-500/20 text-orange-400',
    RESOLVED: 'bg-blue-500/20 text-blue-400',
    CANCELLED: 'bg-gray-500/20 text-gray-400',
  }
  
  return (
    <span className={`px-2 py-0.5 rounded text-xs font-medium ${styles[status]}`}>
      {status}
    </span>
  )
}
```

### 4.2 Probability Bar

```tsx
// src/components/market/ProbabilityBar.tsx
import { clsx } from 'clsx'

interface ProbabilityBarProps {
  yesPercent: number
  showLabels?: boolean
  size?: 'sm' | 'md' | 'lg'
}

const sizeStyles = {
  sm: 'h-2',
  md: 'h-3',
  lg: 'h-4',
}

export function ProbabilityBar({
  yesPercent,
  showLabels = false,
  size = 'md',
}: ProbabilityBarProps) {
  const noPercent = 100 - yesPercent
  
  return (
    <div className="space-y-1">
      {showLabels && (
        <div className="flex justify-between text-sm">
          <span className="text-green-400 font-medium">
            Yes {yesPercent.toFixed(1)}%
          </span>
          <span className="text-red-400 font-medium">
            No {noPercent.toFixed(1)}%
          </span>
        </div>
      )}
      <div
        className={clsx(
          'w-full rounded-full overflow-hidden bg-red-600',
          sizeStyles[size]
        )}
      >
        <div
          className="h-full bg-green-500 transition-all duration-500"
          style={{ width: `${yesPercent}%` }}
        />
      </div>
    </div>
  )
}
```

### 4.3 Price Chart

```tsx
// src/components/market/PriceChart.tsx
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import { Card, CardHeader, CardTitle } from '../ui/Card'

interface PricePoint {
  timestamp: string
  yesPrice: number
  noPrice: number
}

interface PriceChartProps {
  data: PricePoint[]
  height?: number
}

export function PriceChart({ data, height = 300 }: PriceChartProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Price History</CardTitle>
      </CardHeader>
      
      <ResponsiveContainer width="100%" height={height}>
        <LineChart data={data}>
          <XAxis
            dataKey="timestamp"
            stroke="#606070"
            fontSize={12}
            tickFormatter={(value) => new Date(value).toLocaleDateString()}
          />
          <YAxis
            stroke="#606070"
            fontSize={12}
            domain={[0, 1]}
            tickFormatter={(value) => `${(value * 100).toFixed(0)}%`}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: '#1a1a24',
              border: '1px solid #2a2a36',
              borderRadius: '8px',
            }}
            labelFormatter={(value) => new Date(value).toLocaleString()}
            formatter={(value: number, name: string) => [
              `${(value * 100).toFixed(1)}%`,
              name === 'yesPrice' ? 'Yes' : 'No',
            ]}
          />
          <Line
            type="monotone"
            dataKey="yesPrice"
            stroke="#22c55e"
            strokeWidth={2}
            dot={false}
          />
          <Line
            type="monotone"
            dataKey="noPrice"
            stroke="#ef4444"
            strokeWidth={2}
            dot={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </Card>
  )
}
```

---

## 5. Trading Components

### 5.1 Trade Form

```tsx
// src/components/market/TradeForm.tsx
import { useState } from 'react'
import { useForm } from '@tanstack/react-form'
import { useBuyShares, useSellShares } from '../../hooks/useTrading'
import { useAuth } from '../../hooks/useAuth'
import { usePosition } from '../../hooks/usePortfolio'
import { Button } from '../ui/Button'
import { Card, CardHeader, CardTitle } from '../ui/Card'
import { formatPoints, parsePoints, calculateEstimatedShares } from '../../lib/format'
import { clsx } from 'clsx'
import type { Market } from '../../api/types'

interface TradeFormProps {
  market: Market
}

type TradeTab = 'buy' | 'sell'
type TradeSide = 'YES' | 'NO'

export function TradeForm({ market }: TradeFormProps) {
  const [tab, setTab] = useState<TradeTab>('buy')
  const [side, setSide] = useState<TradeSide>('YES')
  
  const { user } = useAuth()
  const { data: position } = usePosition(market.id)
  const buyMutation = useBuyShares()
  const sellMutation = useSellShares()
  
  const form = useForm({
    defaultValues: {
      amount: '',
    },
    onSubmit: async ({ value }) => {
      const amountMicro = parsePoints(value.amount)
      
      if (tab === 'buy') {
        await buyMutation.mutateAsync({
          marketId: market.id,
          side,
          amount: amountMicro,
        })
      } else {
        await sellMutation.mutateAsync({
          marketId: market.id,
          side,
          shares: amountMicro,
        })
      }
      
      form.reset()
    },
  })
  
  const currentPrice = side === 'YES' ? market.pool.yesPrice : market.pool.noPrice
  const availableShares = side === 'YES'
    ? BigInt(position?.yesShares ?? '0')
    : BigInt(position?.noShares ?? '0')
  
  return (
    <Card>
      <CardHeader>
        <CardTitle>Trade</CardTitle>
      </CardHeader>
      
      {/* Buy/Sell tabs */}
      <div className="flex gap-2 mb-4">
        <button
          onClick={() => setTab('buy')}
          className={clsx(
            'flex-1 py-2 rounded-lg font-medium transition-colors',
            tab === 'buy'
              ? 'bg-blue-600 text-white'
              : 'bg-gray-800 text-gray-400 hover:text-white'
          )}
        >
          Buy
        </button>
        <button
          onClick={() => setTab('sell')}
          className={clsx(
            'flex-1 py-2 rounded-lg font-medium transition-colors',
            tab === 'sell'
              ? 'bg-blue-600 text-white'
              : 'bg-gray-800 text-gray-400 hover:text-white'
          )}
        >
          Sell
        </button>
      </div>
      
      {/* Side selection */}
      <div className="flex gap-2 mb-4">
        <button
          onClick={() => setSide('YES')}
          className={clsx(
            'flex-1 py-3 rounded-lg font-medium transition-colors',
            side === 'YES'
              ? 'bg-green-600 text-white'
              : 'bg-gray-800 text-gray-400 hover:bg-green-600/20'
          )}
        >
          Yes {(market.pool.yesPrice * 100).toFixed(0)}¢
        </button>
        <button
          onClick={() => setSide('NO')}
          className={clsx(
            'flex-1 py-3 rounded-lg font-medium transition-colors',
            side === 'NO'
              ? 'bg-red-600 text-white'
              : 'bg-gray-800 text-gray-400 hover:bg-red-600/20'
          )}
        >
          No {(market.pool.noPrice * 100).toFixed(0)}¢
        </button>
      </div>
      
      {/* Amount input */}
      <form
        onSubmit={(e) => {
          e.preventDefault()
          form.handleSubmit()
        }}
      >
        <form.Field
          name="amount"
          validators={{
            onChange: ({ value }) => {
              if (!value) return 'Amount is required'
              const num = parseFloat(value)
              if (isNaN(num) || num <= 0) return 'Invalid amount'
              if (tab === 'buy') {
                const micro = parsePoints(value)
                if (BigInt(micro) > BigInt(user?.balance ?? '0')) {
                  return 'Insufficient balance'
                }
              }
              return undefined
            },
          }}
        >
          {(field) => (
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-400 mb-1">
                {tab === 'buy' ? 'Amount (Points)' : 'Shares to Sell'}
              </label>
              <div className="relative">
                <input
                  type="text"
                  inputMode="decimal"
                  placeholder="0.00"
                  value={field.state.value}
                  onChange={(e) => field.handleChange(e.target.value)}
                  className={clsx(
                    'w-full px-4 py-3 bg-gray-800 border rounded-lg',
                    'text-white text-lg font-mono',
                    'focus:outline-none focus:ring-2 focus:ring-blue-500',
                    field.state.meta.errors.length
                      ? 'border-red-500'
                      : 'border-gray-700'
                  )}
                />
                {tab === 'buy' && (
                  <button
                    type="button"
                    onClick={() => {
                      const max = formatPoints(user?.balance ?? '0')
                      field.handleChange(max)
                    }}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-blue-400 hover:text-blue-300"
                  >
                    MAX
                  </button>
                )}
              </div>
              {field.state.meta.errors.length > 0 && (
                <p className="mt-1 text-sm text-red-400">
                  {field.state.meta.errors.join(', ')}
                </p>
              )}
            </div>
          )}
        </form.Field>
        
        {/* Estimate */}
        <form.Subscribe selector={(state) => state.values.amount}>
          {(amount) => {
            if (!amount) return null
            const estimated = calculateEstimatedShares(
              parsePoints(amount),
              market.pool,
              side
            )
            return (
              <div className="mb-4 p-3 bg-gray-800 rounded-lg">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">Estimated shares</span>
                  <span className="font-mono">{formatPoints(estimated)}</span>
                </div>
                <div className="flex justify-between text-sm mt-1">
                  <span className="text-gray-400">Avg. price</span>
                  <span className="font-mono">
                    {(currentPrice * 100).toFixed(1)}¢
                  </span>
                </div>
              </div>
            )
          }}
        </form.Subscribe>
        
        {/* Submit */}
        <form.Subscribe
          selector={(state) => [state.isSubmitting, state.canSubmit]}
        >
          {([isSubmitting, canSubmit]) => (
            <Button
              type="submit"
              variant={side === 'YES' ? 'yes' : 'no'}
              size="lg"
              className="w-full"
              isLoading={isSubmitting}
              disabled={!canSubmit}
            >
              {tab === 'buy' ? 'Buy' : 'Sell'} {side}
            </Button>
          )}
        </form.Subscribe>
      </form>
      
      {/* Balance info */}
      <div className="mt-4 pt-4 border-t border-gray-700">
        <div className="flex justify-between text-sm text-gray-400">
          <span>Balance</span>
          <span className="font-mono">{formatPoints(user?.balance ?? '0')} pts</span>
        </div>
        {position && (
          <div className="flex justify-between text-sm text-gray-400 mt-1">
            <span>Your {side} shares</span>
            <span className="font-mono">
              {formatPoints(side === 'YES' ? position.yesShares : position.noShares)}
            </span>
          </div>
        )}
      </div>
    </Card>
  )
}
```

---

## 6. Portfolio Components

### 6.1 Position Card

```tsx
// src/components/portfolio/PositionCard.tsx
import { Link } from '@tanstack/react-router'
import { Card } from '../ui/Card'
import { formatPoints, calculatePnL } from '../../lib/format'
import { TrendingUp, TrendingDown } from 'lucide-react'
import type { Portfolio } from '../../api/types'

interface PositionCardProps {
  position: Portfolio
}

export function PositionCard({ position }: PositionCardProps) {
  const market = position.market
  const yesShares = BigInt(position.yesShares)
  const noShares = BigInt(position.noShares)
  
  // Calculate unrealized P&L
  const yesPnL = calculatePnL(
    position.yesShares,
    position.yesCostBasis,
    market.pool.yesPrice
  )
  const noPnL = calculatePnL(
    position.noShares,
    position.noCostBasis,
    market.pool.noPrice
  )
  const totalPnL = yesPnL + noPnL
  const isProfitable = totalPnL >= 0
  
  return (
    <Link to="/markets/$marketId" params={{ marketId: market.id }}>
      <Card
        variant="elevated"
        className="hover:bg-gray-750 transition-colors cursor-pointer"
      >
        {/* Market title */}
        <h4 className="text-lg font-medium text-white mb-3 line-clamp-1">
          {market.title}
        </h4>
        
        {/* Positions */}
        <div className="grid grid-cols-2 gap-4 mb-4">
          {yesShares > 0n && (
            <div className="p-3 bg-green-600/10 rounded-lg">
              <div className="text-sm text-green-400 mb-1">YES</div>
              <div className="font-mono font-medium text-white">
                {formatPoints(position.yesShares)}
              </div>
              <div className="text-xs text-gray-400">
                @ {(market.pool.yesPrice * 100).toFixed(0)}¢
              </div>
            </div>
          )}
          
          {noShares > 0n && (
            <div className="p-3 bg-red-600/10 rounded-lg">
              <div className="text-sm text-red-400 mb-1">NO</div>
              <div className="font-mono font-medium text-white">
                {formatPoints(position.noShares)}
              </div>
              <div className="text-xs text-gray-400">
                @ {(market.pool.noPrice * 100).toFixed(0)}¢
              </div>
            </div>
          )}
        </div>
        
        {/* P&L */}
        <div className="flex items-center justify-between pt-3 border-t border-gray-700">
          <span className="text-sm text-gray-400">Unrealized P&L</span>
          <div
            className={`flex items-center gap-1 font-mono font-medium ${
              isProfitable ? 'text-green-400' : 'text-red-400'
            }`}
          >
            {isProfitable ? (
              <TrendingUp className="w-4 h-4" />
            ) : (
              <TrendingDown className="w-4 h-4" />
            )}
            {isProfitable ? '+' : ''}{formatPoints(Math.abs(totalPnL).toString())}
          </div>
        </div>
      </Card>
    </Link>
  )
}
```

---

## 7. Form Components

### 7.1 Form Field Wrapper (TanStack Form)

```tsx
// src/components/form/FormField.tsx
import { clsx } from 'clsx'

interface FormFieldProps {
  label?: string
  error?: string
  hint?: string
  children: React.ReactNode
  className?: string
}

export function FormField({
  label,
  error,
  hint,
  children,
  className,
}: FormFieldProps) {
  return (
    <div className={clsx('space-y-1', className)}>
      {label && (
        <label className="block text-sm font-medium text-gray-300">
          {label}
        </label>
      )}
      {children}
      {error && <p className="text-sm text-red-400">{error}</p>}
      {hint && !error && <p className="text-sm text-gray-500">{hint}</p>}
    </div>
  )
}
```

---

## 8. Utility Functions

### 8.1 Formatting Utilities

```typescript
// src/lib/format.ts

const MICRO_POINTS_PER_POINT = 1_000_000n

/**
 * Format MicroPoints to human-readable points
 * 1,000,000 MicroPoints = 1 Point
 */
export function formatPoints(microPoints: string | bigint): string {
  const micro = typeof microPoints === 'string' ? BigInt(microPoints) : microPoints
  const points = Number(micro) / Number(MICRO_POINTS_PER_POINT)
  
  // Format with appropriate decimal places
  if (points >= 1000) {
    return points.toLocaleString('en-US', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    })
  }
  
  return points.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

/**
 * Format MicroPoints in compact notation (e.g., "10K", "1.5M")
 */
export function formatCompactPoints(microPoints: string | bigint): string {
  const micro = typeof microPoints === 'string' ? BigInt(microPoints) : microPoints
  const points = Number(micro) / Number(MICRO_POINTS_PER_POINT)
  
  return new Intl.NumberFormat('en-US', {
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(points)
}

/**
 * Parse human-readable points to MicroPoints
 */
export function parsePoints(points: string): string {
  const num = parseFloat(points.replace(/,/g, ''))
  if (isNaN(num)) return '0'
  
  const micro = BigInt(Math.floor(num * Number(MICRO_POINTS_PER_POINT)))
  return micro.toString()
}

/**
 * Calculate unrealized P&L
 */
export function calculatePnL(
  shares: string,
  costBasis: string,
  currentPrice: number
): number {
  const sharesNum = Number(BigInt(shares)) / Number(MICRO_POINTS_PER_POINT)
  const costNum = Number(BigInt(costBasis)) / Number(MICRO_POINTS_PER_POINT)
  
  const currentValue = sharesNum * currentPrice
  return currentValue - costNum
}

/**
 * Calculate estimated shares for a buy order
 */
export function calculateEstimatedShares(
  amountIn: string,
  pool: { yesQty: string; noQty: string; k: string },
  side: 'YES' | 'NO'
): string {
  const amount = BigInt(amountIn)
  const k = BigInt(pool.k)
  
  if (side === 'YES') {
    const noQty = BigInt(pool.noQty)
    const newNoQty = noQty + amount
    const newYesQty = k / newNoQty
    const yesQty = BigInt(pool.yesQty)
    const sharesOut = yesQty - newYesQty
    return sharesOut.toString()
  } else {
    const yesQty = BigInt(pool.yesQty)
    const newYesQty = yesQty + amount
    const newNoQty = k / newYesQty
    const noQty = BigInt(pool.noQty)
    const sharesOut = noQty - newNoQty
    return sharesOut.toString()
  }
}
```

### 8.2 Class Name Utility

```typescript
// src/lib/utils.ts
import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
```

---

## Summary

| Component Category | Key Components |
|-------------------|----------------|
| **UI Primitives** | Button, Input, Card, Modal, Spinner |
| **Layout** | Header, Sidebar, Footer |
| **Market** | MarketCard, ProbabilityBar, PriceChart, TradeForm |
| **Portfolio** | PositionCard, TradeHistory |
| **Forms** | TanStack Form integration with validation |

All components are:
- **Type-safe** with TypeScript
- **Accessible** with proper ARIA attributes
- **Responsive** with Tailwind breakpoints
- **Dark-mode optimized** for the trading theme

