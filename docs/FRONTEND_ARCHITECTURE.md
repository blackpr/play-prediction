# Frontend Architecture

**Version:** 1.0  
**Framework:** TanStack Start (SPA Mode)  
**Language:** TypeScript + React 19  
**Validation:** Zod v4  
**Last Updated:** December 2025

> **Note:** This is a Single Page Application (SPA). We do NOT use SSR. All rendering happens client-side. The frontend communicates exclusively with our backend API - never directly with Supabase.

> **See Also:** [BACKEND_ARCHITECTURE.md](./BACKEND_ARCHITECTURE.md) for the domain-driven backend structure. The backend is framework-agnostic, so "Fastify" could be swapped for any other HTTP framework.

---

## Table of Contents

1. [Overview](#1-overview)
2. [Technology Stack](#2-technology-stack)
3. [Project Structure](#3-project-structure)
4. [TanStack Start Setup](#4-tanstack-start-setup)
5. [Routing](#5-routing)
6. [Authentication Flow](#6-authentication-flow)
7. [API Layer](#7-api-layer)
8. [Environment Configuration](#8-environment-configuration)

---

## 1. Overview

### 1.1 Architecture Principles

- **SPA Mode:** Client-side rendering only, no server-side rendering
- **Server-First Auth:** All authentication goes through our Fastify API (never Supabase directly)
- **Type Safety:** Full TypeScript with strict mode
- **File-Based Routing:** Using TanStack Router's file-based routing
- **Server State:** TanStack Query for all API data fetching
- **Real-Time:** WebSocket connection for live market data

### 1.2 Data Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                        React SPA (Browser)                       │
├─────────────────────────────────────────────────────────────────┤
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐  │
│  │ TanStack     │  │ TanStack     │  │ TanStack             │  │
│  │ Router       │  │ Query        │  │ Form                 │  │
│  │ (Navigation) │  │ (Data)       │  │ (Forms)              │  │
│  └──────┬───────┘  └──────┬───────┘  └──────────┬───────────┘  │
│         │                 │                      │              │
│  ┌──────┴─────────────────┴──────────────────────┴───────────┐  │
│  │                     API Client Layer                       │  │
│  │  - Fetch wrapper with credentials: 'include'               │  │
│  │  - Error handling & retry logic                            │  │
│  │  - Request/Response type definitions                       │  │
│  └─────────────────────────┬─────────────────────────────────┘  │
│                            │                                    │
│  ┌─────────────────────────┴─────────────────────────────────┐  │
│  │                  WebSocket Connection                      │  │
│  │  - Real-time market prices                                 │  │
│  │  - Trade notifications                                     │  │
│  │  - Balance updates                                         │  │
│  └───────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ HTTP/WS (Cookies sent automatically)
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Fastify API Server                           │
│  (Handles Supabase Auth + Database via @supabase/ssr)           │
└─────────────────────────────────────────────────────────────────┘
```

---

## 2. Technology Stack

| Category | Technology | Version | Purpose |
|----------|------------|---------|---------|
| **Framework** | TanStack Start | Latest | Full-stack React framework (SPA mode) |
| **Routing** | TanStack Router | Latest | Type-safe file-based routing |
| **Data Fetching** | TanStack Query | v5 | Server state management |
| **Forms** | TanStack Form | Latest | Type-safe form handling |
| **Validation** | Zod | v4 | Schema validation |
| **Build Tool** | Vite | v6 | Fast development & builds |
| **Language** | TypeScript | 5.7+ | Type safety |
| **Runtime** | React | 19 | UI library |
| **Styling** | Tailwind CSS | v4 | Utility-first CSS |
| **Icons** | Lucide React | Latest | Icon library |
| **Charts** | Recharts | Latest | Trading charts |
| **WebSocket** | Native WebSocket | - | Real-time data |

### 2.1 Project Initialization (TanStack Start CLI)

Generate the frontend using the **TanStack Start CLI**:

```bash
# Create new TanStack Start project (interactive setup)
pnpm create @tanstack/start@latest play-prediction-frontend

# When prompted, select:
# - Framework: React
# - Template: basic / default
# - TypeScript: Yes
# - Package manager: pnpm (recommended)
```

Then add additional dependencies:

```bash
cd play-prediction-frontend

# TanStack ecosystem
pnpm add @tanstack/react-query @tanstack/react-form

# Zod v4 for validation
pnpm add zod@latest

# UI dependencies
pnpm add recharts lucide-react clsx tailwind-merge

# Tailwind CSS v4
pnpm add -D tailwindcss@latest autoprefixer

# React Query DevTools (dev only)
pnpm add -D @tanstack/react-query-devtools
```

### 2.2 Package Dependencies

```json
{
  "name": "play-prediction-frontend",
  "type": "module",
  "scripts": {
    "dev": "vite dev",
    "build": "vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "@tanstack/react-start": "latest",
    "@tanstack/react-router": "latest",
    "@tanstack/react-query": "^5.60.0",
    "@tanstack/react-form": "latest",
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "recharts": "latest",
    "lucide-react": "latest",
    "zod": "^4.0.0",
    "clsx": "latest",
    "tailwind-merge": "latest"
  },
  "devDependencies": {
    "@types/react": "^19.0.0",
    "@types/react-dom": "^19.0.0",
    "@tanstack/react-query-devtools": "^5.60.0",
    "@vitejs/plugin-react": "latest",
    "typescript": "^5.7.0",
    "vite": "^6.0.0",
    "vite-tsconfig-paths": "latest",
    "tailwindcss": "^4.0.0",
    "autoprefixer": "latest"
  }
}
```

---

## 3. Project Structure

```
frontend/
├── src/
│   ├── routes/                    # File-based routes
│   │   ├── __root.tsx             # Root layout
│   │   ├── index.tsx              # Home page (/)
│   │   ├── login.tsx              # Login page (/login)
│   │   ├── register.tsx           # Register page (/register)
│   │   ├── markets/
│   │   │   ├── index.tsx          # Markets list (/markets)
│   │   │   └── $marketId.tsx      # Market detail (/markets/:marketId)
│   │   ├── portfolio/
│   │   │   └── index.tsx          # User portfolio (/portfolio)
│   │   └── admin/
│   │       ├── index.tsx          # Admin dashboard (/admin)
│   │       └── markets.tsx        # Market management (/admin/markets)
│   │
│   ├── components/                # Shared components
│   │   ├── ui/                    # Base UI components
│   │   │   ├── Button.tsx
│   │   │   ├── Input.tsx
│   │   │   ├── Card.tsx
│   │   │   ├── Modal.tsx
│   │   │   └── Spinner.tsx
│   │   ├── layout/                # Layout components
│   │   │   ├── Header.tsx
│   │   │   ├── Sidebar.tsx
│   │   │   └── Footer.tsx
│   │   ├── market/                # Market-specific components
│   │   │   ├── MarketCard.tsx
│   │   │   ├── PriceChart.tsx
│   │   │   ├── OrderBook.tsx
│   │   │   └── TradeForm.tsx
│   │   └── portfolio/             # Portfolio components
│   │       ├── PositionCard.tsx
│   │       └── TradeHistory.tsx
│   │
│   ├── api/                       # API client layer
│   │   ├── client.ts              # Base fetch client
│   │   ├── auth.ts                # Auth API calls
│   │   ├── markets.ts             # Markets API calls
│   │   ├── trading.ts             # Trading API calls
│   │   └── types.ts               # API type definitions
│   │
│   ├── hooks/                     # Custom React hooks
│   │   ├── useAuth.ts             # Auth state hook
│   │   ├── useMarkets.ts          # Markets query hooks
│   │   ├── useWebSocket.ts        # WebSocket connection
│   │   └── useTrading.ts          # Trading mutations
│   │
│   ├── lib/                       # Utilities
│   │   ├── utils.ts               # General utilities
│   │   ├── format.ts              # Formatting (MicroPoints, dates)
│   │   └── constants.ts           # App constants
│   │
│   ├── stores/                    # Client state (minimal)
│   │   └── websocket-store.ts     # WebSocket state
│   │
│   ├── client.tsx                 # Client entry point
│   ├── router.tsx                 # Router configuration
│   └── routeTree.gen.ts           # Generated route tree
│
├── public/                        # Static assets
├── index.html                     # HTML template
├── vite.config.ts                 # Vite configuration
├── tsconfig.json                  # TypeScript config
├── tailwind.config.ts             # Tailwind config
└── tsr.config.json                # TanStack Router config
```

---

## 4. TanStack Start Setup

### 4.1 Vite Configuration (SPA Mode)

```typescript
// vite.config.ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { tanstackStart } from '@tanstack/react-start/plugin/vite'

export default defineConfig({
  plugins: [
    tanstackStart({
      // Enable SPA mode - no SSR
      spa: {
        enabled: true,
      },
    }),
    react(),
  ],
  server: {
    port: 3000,
    proxy: {
      // Proxy API requests to Fastify server
      '/api': {
        target: 'http://localhost:4000',
        changeOrigin: true,
      },
      '/ws': {
        target: 'ws://localhost:4000',
        ws: true,
      },
    },
  },
})
```

### 4.2 Client Entry Point

```tsx
// src/client.tsx
import { StartClient } from '@tanstack/react-start/client'
import { StrictMode } from 'react'
import { hydrateRoot } from 'react-dom/client'

hydrateRoot(
  document,
  <StrictMode>
    <StartClient />
  </StrictMode>
)
```

### 4.3 Router Configuration

```tsx
// src/router.tsx
import { createRouter } from '@tanstack/react-router'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { routeTree } from './routeTree.gen'

// Create a QueryClient instance
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60, // 1 minute
      gcTime: 1000 * 60 * 5, // 5 minutes
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
})

// Create the router instance
export const router = createRouter({
  routeTree,
  context: {
    queryClient,
  },
  defaultPreload: 'intent',
  defaultPreloadStaleTime: 0,
  scrollRestoration: true,
})

// Type safety for the router
declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}
```

### 4.4 TanStack Router Config

```json
// tsr.config.json
{
  "routesDirectory": "./src/routes",
  "generatedRouteTree": "./src/routeTree.gen.ts",
  "routeFileIgnorePrefix": "-",
  "quoteStyle": "single"
}
```

---

## 5. Routing

### 5.1 Root Layout

```tsx
// src/routes/__root.tsx
import { createRootRouteWithContext, Link, Outlet } from '@tanstack/react-router'
import { QueryClient } from '@tanstack/react-query'
import { TanStackRouterDevtools } from '@tanstack/react-router-devtools'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import { Header } from '../components/layout/Header'

interface RouterContext {
  queryClient: QueryClient
}

export const Route = createRootRouteWithContext<RouterContext>()({
  component: RootComponent,
})

function RootComponent() {
  return (
    <html lang="en">
      <head>
        <meta charSet="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>Play Prediction</title>
        <link rel="stylesheet" href="/styles.css" />
      </head>
      <body className="min-h-screen bg-gray-950 text-gray-100">
        <Header />
        <main className="container mx-auto px-4 py-8">
          <Outlet />
        </main>
        
        {/* Dev tools - only in development */}
        {import.meta.env.DEV && (
          <>
            <TanStackRouterDevtools position="bottom-right" />
            <ReactQueryDevtools position="bottom" initialIsOpen={false} />
          </>
        )}
      </body>
    </html>
  )
}
```

### 5.2 Protected Route Pattern

```tsx
// src/routes/portfolio/index.tsx
import { createFileRoute, redirect } from '@tanstack/react-router'
import { getAuthStatus } from '../../api/auth'

export const Route = createFileRoute('/portfolio/')({
  // Check auth before loading
  beforeLoad: async ({ context }) => {
    const auth = await getAuthStatus()
    if (!auth.isAuthenticated) {
      throw redirect({
        to: '/login',
        search: {
          redirect: '/portfolio',
        },
      })
    }
  },
  component: PortfolioPage,
})

function PortfolioPage() {
  // ... component implementation
}
```

### 5.3 Route with Data Loading

```tsx
// src/routes/markets/$marketId.tsx
import { createFileRoute } from '@tanstack/react-router'
import { marketQueryOptions } from '../../hooks/useMarkets'

export const Route = createFileRoute('/markets/$marketId')({
  // Load data before rendering
  loader: async ({ context: { queryClient }, params: { marketId } }) => {
    // Prefetch market data
    await queryClient.ensureQueryData(marketQueryOptions(marketId))
    return { marketId }
  },
  component: MarketDetailPage,
})

function MarketDetailPage() {
  const { marketId } = Route.useParams()
  const { data: market } = useQuery(marketQueryOptions(marketId))
  
  // ... component implementation
}
```

### 5.4 Search Parameters (Type-Safe)

```tsx
// src/routes/markets/index.tsx
import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'

const marketsSearchSchema = z.object({
  status: z.enum(['all', 'active', 'resolved']).default('active'),
  page: z.number().int().positive().default(1),
  sort: z.enum(['newest', 'volume', 'ending']).default('newest'),
})

export const Route = createFileRoute('/markets/')({
  validateSearch: marketsSearchSchema,
  component: MarketsPage,
})

function MarketsPage() {
  const { status, page, sort } = Route.useSearch()
  const navigate = Route.useNavigate()
  
  // Type-safe search parameter updates
  const setStatus = (newStatus: 'all' | 'active' | 'resolved') => {
    navigate({
      search: (prev) => ({ ...prev, status: newStatus, page: 1 }),
    })
  }
  
  // ... component implementation
}
```

---

## 6. Authentication Flow

### 6.1 Auth Context & Hook

```tsx
// src/hooks/useAuth.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../api/client'

interface User {
  id: string
  email: string
  role: 'user' | 'admin'
  balance: string // BigInt as string
}

interface AuthState {
  user: User | null
  isAuthenticated: boolean
  isLoading: boolean
}

// Query for current auth status
export const authQueryOptions = {
  queryKey: ['auth', 'me'],
  queryFn: async (): Promise<User | null> => {
    try {
      const response = await api.get('/auth/me')
      return response.data.user
    } catch {
      return null
    }
  },
  staleTime: 1000 * 60 * 5, // 5 minutes
  retry: false,
}

export function useAuth(): AuthState {
  const { data: user, isLoading } = useQuery(authQueryOptions)
  
  return {
    user: user ?? null,
    isAuthenticated: !!user,
    isLoading,
  }
}

// Login mutation
export function useLogin() {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: async (credentials: { email: string; password: string }) => {
      const response = await api.post('/auth/login', credentials)
      return response.data.user
    },
    onSuccess: (user) => {
      // Update auth cache
      queryClient.setQueryData(['auth', 'me'], user)
      // Invalidate user-specific queries
      queryClient.invalidateQueries({ queryKey: ['portfolio'] })
    },
  })
}

// Logout mutation
export function useLogout() {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: async () => {
      await api.post('/auth/logout')
    },
    onSuccess: () => {
      // Clear all cached data
      queryClient.clear()
    },
  })
}

// Register mutation
export function useRegister() {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: async (data: { email: string; password: string }) => {
      const response = await api.post('/auth/register', data)
      return response.data
    },
    onSuccess: () => {
      // User needs to verify email, don't set auth
    },
  })
}
```

### 6.2 Login Page

```tsx
// src/routes/login.tsx
import { createFileRoute, redirect, useNavigate } from '@tanstack/react-router'
import { useForm } from '@tanstack/react-form'
import { useLogin } from '../hooks/useAuth'
import { z } from 'zod'

const searchSchema = z.object({
  redirect: z.string().optional(),
})

export const Route = createFileRoute('/login')({
  validateSearch: searchSchema,
  component: LoginPage,
})

function LoginPage() {
  const navigate = useNavigate()
  const { redirect: redirectTo } = Route.useSearch()
  const loginMutation = useLogin()
  
  const form = useForm({
    defaultValues: {
      email: '',
      password: '',
    },
    onSubmit: async ({ value }) => {
      await loginMutation.mutateAsync(value)
      navigate({ to: redirectTo ?? '/markets' })
    },
  })
  
  return (
    <div className="max-w-md mx-auto">
      <h1 className="text-3xl font-bold mb-8">Sign In</h1>
      
      <form
        onSubmit={(e) => {
          e.preventDefault()
          form.handleSubmit()
        }}
        className="space-y-4"
      >
        <form.Field
          name="email"
          validators={{
            onChange: ({ value }) =>
              !value.includes('@') ? 'Invalid email' : undefined,
          }}
        >
          {(field) => (
            <div>
              <label className="block text-sm font-medium mb-1">Email</label>
              <input
                type="email"
                value={field.state.value}
                onChange={(e) => field.handleChange(e.target.value)}
                className="w-full px-4 py-2 bg-gray-800 rounded-lg"
              />
              {field.state.meta.errors.length > 0 && (
                <p className="text-red-400 text-sm mt-1">
                  {field.state.meta.errors.join(', ')}
                </p>
              )}
            </div>
          )}
        </form.Field>
        
        <form.Field name="password">
          {(field) => (
            <div>
              <label className="block text-sm font-medium mb-1">Password</label>
              <input
                type="password"
                value={field.state.value}
                onChange={(e) => field.handleChange(e.target.value)}
                className="w-full px-4 py-2 bg-gray-800 rounded-lg"
              />
            </div>
          )}
        </form.Field>
        
        {loginMutation.isError && (
          <p className="text-red-400">
            {loginMutation.error?.message ?? 'Login failed'}
          </p>
        )}
        
        <form.Subscribe selector={(state) => state.isSubmitting}>
          {(isSubmitting) => (
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-3 bg-blue-600 hover:bg-blue-500 rounded-lg font-medium"
            >
              {isSubmitting ? 'Signing in...' : 'Sign In'}
            </button>
          )}
        </form.Subscribe>
      </form>
    </div>
  )
}
```

---

## 7. API Layer

### 7.1 Base API Client

```typescript
// src/api/client.ts

const API_BASE = '/api/v1'

interface ApiResponse<T> {
  success: boolean
  data: T
  error?: {
    code: string
    message: string
    details?: Record<string, unknown>
  }
  meta?: {
    requestId: string
    timestamp: string
  }
}

class ApiError extends Error {
  constructor(
    public code: string,
    message: string,
    public status: number,
    public details?: Record<string, unknown>
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

async function request<T>(
  method: string,
  path: string,
  options?: {
    body?: unknown
    headers?: Record<string, string>
  }
): Promise<ApiResponse<T>> {
  const url = `${API_BASE}${path}`
  
  const response = await fetch(url, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
    body: options?.body ? JSON.stringify(options.body) : undefined,
    credentials: 'include', // Important: include cookies for auth
  })
  
  const json = await response.json()
  
  if (!response.ok || !json.success) {
    throw new ApiError(
      json.error?.code ?? 'UNKNOWN_ERROR',
      json.error?.message ?? 'An error occurred',
      response.status,
      json.error?.details
    )
  }
  
  return json
}

export const api = {
  get: <T>(path: string) => request<T>('GET', path),
  post: <T>(path: string, body?: unknown) => request<T>('POST', path, { body }),
  put: <T>(path: string, body?: unknown) => request<T>('PUT', path, { body }),
  patch: <T>(path: string, body?: unknown) => request<T>('PATCH', path, { body }),
  delete: <T>(path: string) => request<T>('DELETE', path),
}

export { ApiError }
```

### 7.2 API Type Definitions

```typescript
// src/api/types.ts

// MicroPoints are transmitted as strings (BigInt serialization)
export type MicroPoints = string

export interface User {
  id: string
  email: string
  role: 'user' | 'admin' | 'treasury'
  balance: MicroPoints
  createdAt: string
}

export interface Market {
  id: string
  title: string
  description: string
  status: 'PENDING' | 'ACTIVE' | 'PAUSED' | 'RESOLVED' | 'CANCELLED'
  createdBy: string
  resolutionSource: string | null
  expiresAt: string | null
  resolvedAt: string | null
  outcome: boolean | null
  createdAt: string
  updatedAt: string
  pool: LiquidityPool
}

export interface LiquidityPool {
  marketId: string
  yesQty: MicroPoints
  noQty: MicroPoints
  k: MicroPoints
  yesPrice: number // Calculated: 0.0 - 1.0
  noPrice: number  // Calculated: 0.0 - 1.0
  totalVolume: MicroPoints
  versionId: number
}

export interface Portfolio {
  userId: string
  marketId: string
  yesShares: MicroPoints
  noShares: MicroPoints
  yesCostBasis: MicroPoints
  noCostBasis: MicroPoints
  market: Market
}

export interface Trade {
  id: string
  userId: string
  marketId: string
  type: 'BUY_YES' | 'BUY_NO' | 'SELL_YES' | 'SELL_NO' | 'MINT' | 'MERGE'
  amountIn: MicroPoints
  sharesOut: MicroPoints
  pricePerShare: MicroPoints
  feeAmount: MicroPoints
  balanceBefore: MicroPoints
  balanceAfter: MicroPoints
  createdAt: string
}

// Request/Response types
export interface BuyRequest {
  marketId: string
  side: 'YES' | 'NO'
  amount: MicroPoints
  minSharesOut?: MicroPoints // Slippage protection
}

export interface BuyResponse {
  trade: Trade
  sharesReceived: MicroPoints
  averagePrice: MicroPoints
  fee: MicroPoints
}

export interface SellRequest {
  marketId: string
  side: 'YES' | 'NO'
  shares: MicroPoints
  minAmountOut?: MicroPoints // Slippage protection
}

export interface PaginatedResponse<T> {
  items: T[]
  pagination: {
    page: number
    pageSize: number
    totalItems: number
    totalPages: number
    hasNext: boolean
    hasPrev: boolean
  }
}
```

---

## 8. Environment Configuration

### 8.1 Environment Variables

```bash
# .env
VITE_API_URL=http://localhost:4000
VITE_WS_URL=ws://localhost:4000
VITE_APP_NAME="Play Prediction"
```

### 8.2 Type-Safe Env Access

```typescript
// src/lib/env.ts

const env = {
  API_URL: import.meta.env.VITE_API_URL as string,
  WS_URL: import.meta.env.VITE_WS_URL as string,
  APP_NAME: import.meta.env.VITE_APP_NAME as string,
  DEV: import.meta.env.DEV,
  PROD: import.meta.env.PROD,
} as const

// Validate required env vars
if (!env.API_URL) {
  throw new Error('VITE_API_URL is required')
}

export { env }
```

---

## Next Steps

See the following companion documents:

- **[FRONTEND_COMPONENTS.md](./FRONTEND_COMPONENTS.md)** - UI component library and design system
- **[FRONTEND_STATE.md](./FRONTEND_STATE.md)** - State management with TanStack Query

