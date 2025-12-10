## Epic 1: Authentication

**Goal:** Full auth flow - user can register, login, logout.

### AUTH-1: Create Supabase SSR Auth Middleware

**As a** backend developer  
**I want** auth middleware that validates Supabase sessions  
**So that** routes can be protected

**Acceptance Criteria:**
- [x] Create `createSupabaseClient(req, reply)` function using @supabase/ssr
- [x] Parse cookies from request headers
- [x] Set cookies on response headers
- [x] Always use `supabase.auth.getUser()` for validation (NEVER `getSession()`)
- [x] Create `authMiddleware` - populates `request.user` if authenticated
- [x] Create `requireAuth` - returns 401 if not authenticated
- [x] Create `requireAdmin` - returns 403 if not admin role
- [x] Attach user to request: `{ id, email, role }`

**Implementation Notes:**
```typescript
// CORRECT - validates JWT with Supabase server
const { data: { user }, error } = await supabase.auth.getUser();

// WRONG - doesn't validate signature
const { data: { session } } = await supabase.auth.getSession();
```

**References:** API_SPECIFICATION.md Section 2.5, EDGE_CASES.md Section 5.0

---

### AUTH-2: Implement Registration Endpoint

**As a** new user  
**I want** to register with email and password  
**So that** I can start trading

**Endpoint:** `POST /v1/auth/register`

**Request:**
```json
{
  "email": "user@example.com",
  "password": "SecurePassword123!"
}
```

**Acceptance Criteria:**
- [ ] Validate email format and password strength
- [ ] Create Supabase Auth user via `supabase.auth.signUp()`
- [ ] Create user profile in `users` table (Drizzle transaction)
- [ ] Grant welcome bonus (REGISTRATION_BONUS_AMOUNT from config)
- [ ] Log bonus to `point_grants` table
- [ ] Return user data (without password)
- [ ] Handle EMAIL_ALREADY_EXISTS error (409)
- [ ] Handle INVALID_EMAIL, WEAK_PASSWORD errors (400)

**Response (201):**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "uuid",
      "email": "user@example.com",
      "role": "user",
      "balance": "10000000",
      "createdAt": "2024-12-09T10:30:00Z"
    },
    "message": "Please check your email to confirm your account"
  }
}
```

**References:** API_SPECIFICATION.md Section 4.1, DATABASE_SCHEMA.md Section 3.1

---

### AUTH-3: Implement Login and Logout Endpoints

**As a** registered user  
**I want** to login and logout  
**So that** I can access my account

**Endpoints:**
- `POST /v1/auth/login`
- `POST /v1/auth/logout`

**Login Request:**
```json
{
  "email": "user@example.com",
  "password": "SecurePassword123!"
}
```

**Acceptance Criteria:**
- [ ] Login: Call `supabase.auth.signInWithPassword()`
- [ ] Session cookie set automatically via @supabase/ssr
- [ ] Return user profile from `users` table
- [ ] Handle INVALID_CREDENTIALS (401)
- [ ] Handle EMAIL_NOT_CONFIRMED (401)
- [ ] Handle ACCOUNT_DISABLED (403)
- [ ] Logout: Call `supabase.auth.signOut()`
- [ ] Clear session cookies

**References:** API_SPECIFICATION.md Sections 4.1.2, 4.1.3

---

### AUTH-4: Implement Get Current User Endpoint

**As an** authenticated user  
**I want** to get my profile  
**So that** I can see my balance and info

**Endpoint:** `GET /v1/auth/me`

**Acceptance Criteria:**
- [ ] Require authentication
- [ ] Return user from `users` table
- [ ] Include balance in MicroPoints (as string)
- [ ] Return 401 if not authenticated

**Response (200):**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "email": "user@example.com",
    "role": "user",
    "balance": "5000000",
    "isActive": true,
    "createdAt": "2024-12-09T10:30:00Z"
  }
}
```

**References:** API_SPECIFICATION.md Section 4.2.1

---

### AUTH-5: Create Frontend Login Page

**As a** user  
**I want** a login form  
**So that** I can sign into my account

**Route:** `/login`

**Acceptance Criteria:**
- [ ] Create route at `src/routes/login.tsx`
- [ ] Use TanStack Form for form state
- [ ] Email input with validation
- [ ] Password input
- [ ] Show error messages from API
- [ ] Redirect to ?redirect param or /markets on success
- [ ] Link to registration page
- [ ] Style with dark theme

**References:** FRONTEND_ARCHITECTURE.md Section 6.2

---

### AUTH-6: Create Frontend Registration Page

**As a** new user  
**I want** a registration form  
**So that** I can create an account

**Route:** `/register`

**Acceptance Criteria:**
- [ ] Create route at `src/routes/register.tsx`
- [ ] Email input with validation
- [ ] Password input with strength requirements
- [ ] Confirm password field
- [ ] Show error messages from API
- [ ] Show success message about email confirmation
- [ ] Link to login page

---

### AUTH-7: Implement useAuth Hook

**As a** frontend developer  
**I want** auth state management  
**So that** components can access user info

**Acceptance Criteria:**
- [ ] Create `src/hooks/useAuth.ts`
- [ ] Create `authQueryOptions` for TanStack Query
- [ ] `useAuth()` returns `{ user, isAuthenticated, isLoading }`
- [ ] `useLogin()` mutation with cache update
- [ ] `useLogout()` mutation that clears all queries
- [ ] `useRegister()` mutation

**References:** FRONTEND_ARCHITECTURE.md Section 6.1, FRONTEND_STATE.md Section 3

---

### AUTH-8: Add Protected Route Middleware

**As a** frontend developer  
**I want** route protection  
**So that** certain pages require authentication

**Acceptance Criteria:**
- [ ] Use TanStack Router's `beforeLoad` for auth check
- [ ] Redirect to /login if not authenticated
- [ ] Pass redirect URL in search params
- [ ] Create reusable auth check pattern

**Example:**
```typescript
export const Route = createFileRoute('/portfolio/')({
  beforeLoad: async ({ context }) => {
    const auth = await getAuthStatus()
    if (!auth.isAuthenticated) {
      throw redirect({
        to: '/login',
        search: { redirect: '/portfolio' },
      })
    }
  },
})
```

**References:** FRONTEND_ARCHITECTURE.md Section 5.2

---

### AUTH-9: Implement OAuth Callback Endpoint

**As a** backend developer  
**I want** OAuth callback handling  
**So that** email verification and OAuth work

**Endpoint:** `GET /v1/auth/callback`

**Query Params:**
- `token_hash` - from email link
- `type` - email or signup

**Acceptance Criteria:**
- [ ] Verify OTP with Supabase
- [ ] Redirect to frontend on success
- [ ] Handle errors gracefully

**References:** API_SPECIFICATION.md Section 4.1.4

---

### AUTH-10: Implement Password Reset Flow

**As a** user  
**I want** to reset my password if I forget it  
**So that** I can regain access to my account

**Endpoints:**
- `POST /v1/auth/forgot-password` - Request reset email
- `POST /v1/auth/reset-password` - Set new password with token

**Acceptance Criteria:**
- [ ] Forgot Password: Call `supabase.auth.resetPasswordForEmail()`
- [ ] Send reset email with secure token link
- [ ] Reset Password: Validate token and update password
- [ ] Invalidate all existing sessions after password change
- [ ] Return appropriate error messages
- [ ] Rate limit: Max 3 reset requests per email per hour

**Frontend:**
- [ ] Create `/forgot-password` route
- [ ] Email input form with validation
- [ ] Success message: "Check your email for reset link"
- [ ] Create `/reset-password` route (with token in URL)
- [ ] New password + confirm password inputs
- [ ] Password strength requirements display
- [ ] Success message + redirect to login

**References:** EDGE_CASES.md Section 5

---

### AUTH-11: Handle Session Expiration

**As a** user  
**I want** graceful handling when my session expires  
**So that** I don't lose my work and can re-authenticate

**Acceptance Criteria:**
- [ ] Detect 401 responses from API
- [ ] Show session expiry modal/notification
- [ ] Preserve current URL for redirect after re-login
- [ ] Clear stale cache data
- [ ] Redirect to login with return URL
- [ ] On WebSocket: Handle SESSION_EXPIRED close code (4000)

**References:** WEBSOCKET_PROTOCOL.md Section 7.2, EDGE_CASES.md Section 5.0

---

### AUTH-12: Configure Email Templates

**As a** developer  
**I want** branded email templates for Supabase Auth  
**So that** users receive professional-looking emails

**Acceptance Criteria:**
- [ ] Configure Supabase email templates in project settings
- [ ] Design welcome/verification email template
- [ ] Design password reset email template
- [ ] Test email delivery with Inbucket locally
- [ ] Verify email links work correctly
- [ ] Include branding (logo, colors)
- [ ] Mobile-responsive email layout

**Email Templates to Configure:**
1. **Confirm Signup** - Sent after registration
2. **Reset Password** - Sent on forgot password
3. **Magic Link** - If implementing passwordless auth
4. **Email Change** - When user updates email

**Local Testing with Inbucket:**
- Access: http://localhost:54324
- View all emails sent during local development
- Test email content and links

**References:** EDGE_CASES.md Section 5.2, Supabase Auth Email Templates

---