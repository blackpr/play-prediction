## Epic 2: User Profile & Balance

**Goal:** User can see their profile and point balance.

### USER-1: Implement Users/Me Endpoint

**As an** authenticated user  
**I want** my profile with balance  
**So that** I know how many points I have

**Endpoint:** `GET /v1/users/me`

**Acceptance Criteria:**
- [x] Return same data as AUTH-4
- [x] Include formatted balance info

**References:** API_SPECIFICATION.md Section 4.2.1

---

### USER-2: Create Header Component with Balance

**As a** user  
**I want** to see my balance in the header  
**So that** I always know my points

**Acceptance Criteria:**
- [x] Create `src/components/layout/Header.tsx`
- [x] Show logo and navigation links
- [x] Markets link, Portfolio link (if authenticated)
- [x] Balance display with wallet icon
- [x] Format balance using `formatPoints()`
- [x] Sign In / Get Started buttons if not authenticated
- [x] Sign Out button if authenticated
- [x] Loading skeleton while auth loading

**References:** FRONTEND_COMPONENTS.md Section 3.1

---

### USER-3: Format MicroPoints Utility

**As a** frontend developer  
**I want** formatting utilities  
**So that** MicroPoints display correctly

**Acceptance Criteria:**
- [x] Create `src/lib/format.ts`
- [x] `formatPoints(microPoints)` - "1,000.00" format
- [x] `formatCompactPoints(microPoints)` - "10K", "1.5M" format
- [x] `parsePoints(string)` - convert to MicroPoints string
- [x] Handle BigInt serialization (strings in JSON)
- [x] Scale: 1 Point = 1,000,000 MicroPoints

**References:** FRONTEND_COMPONENTS.md Section 8.1

---

### USER-4: Implement Points History Endpoint

**As an** authenticated user  
**I want** to see my points history  
**So that** I can track grants and bonuses

**Endpoint:** `GET /v1/users/me/points-history`

**Query Params:**
- `page` (default: 1)
- `pageSize` (default: 20)

**Acceptance Criteria:**
- [x] Query `point_grants` table for user
- [x] Return paginated results
- [x] Include grant type, amount, balance after, reason, granted by, date



**References:** API_SPECIFICATION.md Section 4.2.2

---

### USER-5: Create Points History View

**As a** user  
**I want** to view my points history  
**So that** I can see bonuses and grants

**Acceptance Criteria:**
- [x] Create points history component/page
- [x] Display list of grants
- [x] Show type badge (Registration, Admin Grant, etc.)
- [x] Show amount and running balance
- [x] Pagination

---

### USER-6: Create Landing Page

**As a** visitor  
**I want** an engaging landing page  
**So that** I understand what the platform does

**Route:** `/`

**Acceptance Criteria:**
- [x] Create route at `src/routes/index.tsx`
- [x] Hero section with tagline and CTA
- [x] Featured/trending markets section
- [x] How it works section (3 steps)
- [x] Call to action for registration
- [x] Responsive design
- [x] Animated elements (subtle)

**Sections:**
1. Hero: "Predict the Future. Trade Your Knowledge."
2. Featured Markets: Top 3 active markets
3. How It Works: Register → Browse → Trade
4. CTA: Get Started button

---

### USER-7: Create Footer Component

**As a** user  
**I want** a footer on all pages  
**So that** I can access important links

**Acceptance Criteria:**
- [x] Create `src/components/layout/Footer.tsx`
- [x] Logo and tagline
- [x] Navigation links
- [x] Social links (placeholder)
- [x] Copyright notice
- [x] Responsive layout (stacked on mobile)

---

### USER-8: Create Toast Notification System

**As a** user  
**I want** toast notifications  
**So that** I get feedback on my actions

**Acceptance Criteria:**
- [x] Create `src/components/ui/Toast.tsx`
- [x] Create toast context/provider
- [x] Support variants: success, error, warning, info
- [x] Auto-dismiss after 5 seconds
- [x] Manual dismiss button
- [x] Stack multiple toasts
- [x] Position: bottom-right

**Usage:**
```typescript
const toast = useToast()
toast.success('Trade executed successfully!')
toast.error('Insufficient balance')
```

---

### USER-9: Create Loading Skeleton Components

**As a** user  
**I want** loading skeletons  
**So that** I see placeholder content while data loads

**Acceptance Criteria:**
- [x] Create `src/components/ui/Skeleton.tsx`
- [x] Create `src/components/market/MarketCardSkeleton.tsx`
- [x] Create `src/components/portfolio/PositionCardSkeleton.tsx`
- [x] Pulse animation
- [x] Match dimensions of real components

---

### USER-10: Create 404 Not Found Page

**As a** user  
**I want** a friendly 404 page  
**So that** I'm not confused when I hit a broken link

**Route:** Catch-all route

**Acceptance Criteria:**
- [x] Clear "Page Not Found" message
- [x] Link back to home
- [x] Link to markets
- [x] Consistent with site design

---

### USER-11: Create Mobile Navigation

**As a** mobile user  
**I want** a mobile-friendly navigation  
**So that** I can navigate on small screens

**Acceptance Criteria:**
- [x] Hamburger menu icon on mobile
- [x] Slide-out drawer or dropdown menu
- [x] All navigation links accessible
- [x] Balance displayed in mobile nav
- [x] Close on navigation
- [x] Close on outside click

---

### USER-12: Create Error Boundary Component

**As a** user  
**I want** graceful error handling  
**So that** the app doesn't crash completely on errors

**Acceptance Criteria:**
- [x] Create `src/components/ErrorBoundary.tsx`
- [x] Catch JavaScript errors in component tree
- [x] Display friendly error message
- [x] Provide "Try Again" / "Go Home" buttons
- [x] Log errors to monitoring service (optional)
- [x] Preserve navigation ability
- [x] Different styles for different error types

**References:** FRONTEND_STATE.md Section 8

---

### USER-13: Implement Accessibility (a11y) Standards

**As a** user with accessibility needs  
**I want** the application to be fully accessible  
**So that** I can use it with assistive technologies

**Acceptance Criteria:**
- [ ] All interactive elements keyboard navigable
- [ ] Proper focus management on modals
- [ ] ARIA labels on all buttons and inputs
- [ ] Color contrast meets WCAG AA standards
- [ ] Screen reader announcements for dynamic content
- [ ] Skip to main content link
- [ ] Form error announcements
- [ ] Trade confirmation announced to screen readers

---

### USER-14: Create Network Status Indicator

**As a** user  
**I want** to know when I'm offline or have connectivity issues  
**So that** I understand why actions might fail

**Acceptance Criteria:**
- [ ] Detect online/offline status
- [ ] Show banner when offline
- [ ] Queue actions while offline (optional)
- [ ] Show reconnection status
- [ ] Different indicator from WebSocket status

---