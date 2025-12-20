import {
  HeadContent,
  Outlet,
  Scripts,
  createRootRouteWithContext,
} from '@tanstack/react-router'
import { TanStackRouterDevtoolsPanel } from '@tanstack/react-router-devtools'
import { TanStackDevtools } from '@tanstack/react-devtools'
import { QueryClientProvider } from '@tanstack/react-query'

import { Header } from '../components/layout/Header'
import { Footer } from '../components/layout/Footer'
import { SessionManager } from '../components/SessionManager'

import appCss from '../styles.css?url'

import { queryClient } from '../lib/queryClient'
import type { QueryClient } from '@tanstack/react-query'

function NotFound() {
  return (
    <div className="p-4 text-center text-text">
      <h3 className="text-xl font-semibold">404 Not Found</h3>
      <p className="text-text-muted">
        The page you are looking for does not exist.
      </p>
    </div>
  )
}

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
  notFoundComponent: NotFound,
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
          <div className="flex flex-col min-h-screen">
            <Header />
            <SessionManager />
            <main className="flex-1">
              {children}
            </main>
            <Footer />
          </div>
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
