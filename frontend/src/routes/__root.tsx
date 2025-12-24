import {
  HeadContent,
  Outlet,
  Scripts,
  createRootRouteWithContext,
} from '@tanstack/react-router'
import { TanStackRouterDevtoolsPanel } from '@tanstack/react-router-devtools'
import { TanStackDevtools } from '@tanstack/react-devtools'
import { QueryClientProvider } from '@tanstack/react-query'

import { Toaster } from 'sonner'

import { Header } from '../components/layout/Header'
import { Footer } from '../components/layout/Footer'
import { NetworkStatus } from '../components/ui/NetworkStatus'
import { SessionManager } from '../components/SessionManager'
import { WebSocketProvider } from '../providers/websocket-provider'

import appCss from '../styles.css?url'

import { queryClient } from '../lib/queryClient'

import { NotFoundPage } from '../components/NotFoundPage'
import { ErrorBoundary } from '../components/ErrorBoundary'
import type { QueryClient } from '@tanstack/react-query'

export const Route = createRootRouteWithContext<{
  queryClient: QueryClient
}>()({
  head: () => ({
    meta: [
      {
        charSet: 'utf-8',
      },
      {
        name: 'viewport',
        content: 'width=device-width, initial-scale=1',
      },
      {
        title: 'TanStack Start Starter',
      },
    ],
    links: [
      {
        rel: 'stylesheet',
        href: appCss,
      },
    ],
  }),
  notFoundComponent: NotFoundPage,
  component: RootComponent,
})

function RootComponent() {
  return (
    <RootDocument>
      <Outlet />
    </RootDocument>
  )
}

function RootDocument({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <HeadContent />
      </head>
      <body>
        <QueryClientProvider client={queryClient}>
          <WebSocketProvider>
            <div className="flex flex-col min-h-screen">
              <a
                href="#main-content"
                className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:p-4 focus:bg-background focus:text-primary focus:font-bold focus:top-4 focus:left-4 focus:outline-none focus:ring-2 focus:ring-primary rounded-md shadow-lg"
              >
                Skip to main content
              </a>
              <NetworkStatus />
              <Header />
              <SessionManager />
              <main
                id="main-content"
                className="flex-1 focus:outline-none"
                tabIndex={-1}
              >
                <ErrorBoundary>
                  {children}
                </ErrorBoundary>
              </main>
              <Footer />
            </div>
            <Toaster richColors position="top-right" theme="dark" />
          </WebSocketProvider>
        </QueryClientProvider>
        <TanStackDevtools
          config={{
            position: 'bottom-right',
          }}
          plugins={[
            {
              name: 'Tanstack Router',
              render: <TanStackRouterDevtoolsPanel />,
            },
          ]}
        />
        <Scripts />
      </body>
    </html>
  )
}
