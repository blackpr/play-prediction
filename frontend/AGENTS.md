# Frontend AGENTS.md

Frontend-specific instructions for AI agents. See also: [Root AGENTS.md](../AGENTS.md)

---

## 🚨 Critical: SSR & Hydration Stability

**IMPORTANT:** TanStack Start performs **Prerendering** during the build phase. This means your components actually "run" in a Node.js environment before the browser ever sees them.

### 1. No "Loading" states on Server (Prevents Build Hangs)

If a hook (like `useQuery`) reports `isLoading: true` during the build phase, the TanStack Start builder will **wait indefinitely** for that loading to finish.

- **RULE:** Hooks must explicitly report `isLoading: false` when `typeof window === 'undefined'`.
- **RULE:** Queries that depend on cookies/browser state must be `enabled: typeof window !== 'undefined'`.

### 2. No Conditional Hooks (Prevents Browser Crashes)

Never call hooks conditionally based on `isClient` (e.g., `const auth = isClient ? useAuth() : null`). This violates the **Rule of Hooks** and will cause the browser to crash with a "length" or "hydration mismatch" error because the client runs more hooks than the server did.

### 3. The "Component Guard" Pattern (The Solution)

If you need to use authenticated hooks or client-only logic in a layout (like the `Header`), move that logic into a **sub-component** that is conditionally rendered.

```tsx
// ✅ CORRECT PATTERN
export function Header() {
  const isClient = useIsClient()

  // 1. Return a skeleton on the server.
  // 2. The hooks inside AuthenticatedSection are NEVER seen by the server.
  // 3. The build completes instantly.
  if (!isClient) return <HeaderSkeleton />

  return <AuthenticatedSection />
}

function AuthenticatedSection() {
  // Hooks are called UNCONDITIONALLY here.
  // This is safe because this component only mounts in the browser.
  const { user } = useAuth()
  return <div>{user.name}</div>
}
```

**Without this:** The build will hang OR the browser will show a white/black screen with "Something went wrong".

---

## 🏗️ Stack

| Technology          | Purpose                         |
| ------------------- | ------------------------------- |
| **TanStack Start**  | React meta-framework (SPA mode) |
| **TanStack Router** | File-based routing              |
| **TanStack Query**  | Server state management         |
| **TanStack Form**   | Form handling                   |
| **Tailwind CSS v4** | Styling                         |
| **Zod**             | Runtime validation              |

---

## 📁 Directory Structure

```
frontend/
├── src/
│   ├── components/
│   │   ├── ui/                   # Base UI components
│   │   │   ├── Button.tsx
│   │   │   ├── Card.tsx
│   │   │   ├── Input.tsx
│   │   │   ├── Modal.tsx
│   │   │   └── Spinner.tsx
│   │   └── Header.tsx
│   ├── routes/                   # File-based routing
│   │   ├── __root.tsx            # Root layout
│   │   ├── index.tsx             # Home page
│   │   ├── login.tsx
│   │   ├── register.tsx
│   │   ├── markets/
│   │   │   ├── index.tsx         # /markets
│   │   │   └── $marketId.tsx     # /markets/:marketId
│   │   ├── portfolio/
│   │   │   └── index.tsx
│   │   └── admin/
│   │       ├── index.tsx
│   │       └── markets.tsx
│   ├── utils/
│   │   └── index.ts              # Utility functions
│   ├── router.tsx
│   ├── routeTree.gen.ts          # Auto-generated
│   └── styles.css
├── vite.config.ts
└── tsconfig.json
```

---

## 🎨 Design System

### Color Palette (Dark Theme)

```css
/* Backgrounds */
--bg-primary: #0a0a0f;
--bg-secondary: #12121a;
--bg-tertiary: #1a1a24;
--bg-elevated: #22222e;

/* Text */
--text-primary: #f0f0f5;
--text-secondary: #a0a0b0;
--text-muted: #606070;

/* Accent */
--accent-blue: #3b82f6;
--accent-purple: #8b5cf6;

/* Trading Colors */
--yes-color: #22c55e; /* Green */
--no-color: #ef4444; /* Red */
```

### UI Components

Located in `src/components/ui/`:

| Component | Variants                                   |
| --------- | ------------------------------------------ |
| `Button`  | primary, secondary, ghost, danger, yes, no |
| `Input`   | With label, error, hint                    |
| `Card`    | default, elevated, outlined                |
| `Modal`   | Dialog-based                               |
| `Spinner` | Loading indicator                          |

---

## 🔀 Routing

### File-Based Routes

```
routes/
├── __root.tsx          → Layout wrapper
├── index.tsx           → /
├── login.tsx           → /login
├── markets/
│   ├── index.tsx       → /markets
│   └── $marketId.tsx   → /markets/:marketId (dynamic)
```

### Creating Routes

```typescript
// routes/markets/index.tsx
import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/markets/')({
  component: MarketsPage,
});

function MarketsPage() {
  return <div>Markets List</div>;
}
```

### Dynamic Routes

```typescript
// routes/markets/$marketId.tsx
import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/markets/$marketId')({
  component: MarketDetailPage,
});

function MarketDetailPage() {
  const { marketId } = Route.useParams();
  return <div>Market: {marketId}</div>;
}
```

---

## 📡 API Calls

### Proxy Configuration

All `/api` requests proxy to the backend:

```typescript
// vite.config.ts
server: {
  proxy: {
    '/api': {
      target: 'http://localhost:4000',
      changeOrigin: true,
    },
    '/ws': {
      target: 'ws://localhost:4000',
      ws: true,
    },
  },
}
```

### Using TanStack Query

```typescript
import { useQuery, useMutation } from '@tanstack/react-query'

// Fetch data
const { data, isLoading } = useQuery({
  queryKey: ['markets'],
  queryFn: () => fetch('/api/markets').then((r) => r.json()),
})

// Mutations
const mutation = useMutation({
  mutationFn: (data) =>
    fetch('/api/trade', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ['portfolio'] })
  },
})
```

---

## 🚫 Critical Rules

### Never Use Supabase Client

The frontend **NEVER** directly calls Supabase. All requests go through the Fastify backend:

```typescript
// ❌ WRONG - Don't do this
import { createClient } from '@supabase/supabase-js';
const supabase = createClient(...);

// ✅ CORRECT - Call backend API
const response = await fetch('/api/auth/login', {
  method: 'POST',
  body: JSON.stringify({ email, password }),
});
```

### Authentication Flow

```
Frontend → POST /api/auth/login → Backend → Supabase Auth
                                         ↓
Frontend ← Set-Cookie ← Backend ← Session
```

Session cookies are HTTP-only and managed automatically.

---

## 💰 Formatting Utilities

Located in `src/utils/index.ts`:

```typescript
// Format MicroPoints to display
formatPoints(1000000n) // "1.00"
formatCompactPoints(1500000n) // "1.5"

// Parse string to MicroPoints
parsePoints('10.50') // 10500000n

// Class name utility
cn('base', condition && 'active') // Merges classes
```

---

## 📝 Component Patterns

### Button Example

```tsx
import { Button } from '../components/ui/Button';

<Button variant="primary">Submit</Button>
<Button variant="yes">Buy YES</Button>
<Button variant="no">Buy NO</Button>
<Button variant="ghost" disabled>Loading...</Button>
```

### Form with TanStack Form

```tsx
import { useForm } from '@tanstack/react-form'
import { z } from 'zod'

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
})

function LoginForm() {
  const form = useForm({
    defaultValues: { email: '', password: '' },
    onSubmit: async ({ value }) => {
      await fetch('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify(value),
      })
    },
  })

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        form.handleSubmit()
      }}
    >
      {/* form fields */}
    </form>
  )
}
```

---

## 🧪 Testing

```bash
npm test                    # Run tests
npm run test:coverage       # With coverage
```

---

## 📂 Adding New Features

### New Page

1. Create file in `src/routes/` following naming convention
2. Export route with `createFileRoute`
3. Route tree auto-generates

### New Component

1. Create in `src/components/`
2. UI primitives go in `src/components/ui/`
3. Feature components at `src/components/` root

### New Query

1. Define query function
2. Use `useQuery` with descriptive `queryKey`
3. Handle loading/error states

---

_See also: [Root AGENTS.md](../AGENTS.md) | [Frontend Architecture](../docs/FRONTEND_ARCHITECTURE.md) | [Frontend Components](../docs/FRONTEND_COMPONENTS.md)_
