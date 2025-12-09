## Epic 2: User Profile & Balance

**Goal:** User can see their profile and point balance.

### USER-1: Implement Users/Me Endpoint

**As an** authenticated user  
**I want** my profile with balance  
**So that** I know how many points I have

**Endpoint:** `GET /v1/users/me`

**Acceptance Criteria:**
- [ ] Return same data as AUTH-4
- [ ] Include formatted balance info

**References:** API_SPECIFICATION.md Section 4.2.1

---

### USER-2: Create Header Component with Balance

**As a** user  
**I want** to see my balance in the header  
**So that** I always know my points

**Acceptance Criteria:**
- [ ] Create `src/components/layout/Header.tsx`
- [ ] Show logo and navigation links
- [ ] Markets link, Portfolio link (if authenticated)
- [ ] Balance display with wallet icon
- [ ] Format balance using `formatPoints()`
- [ ] Sign In / Get Started buttons if not authenticated
- [ ] Sign Out button if authenticated
- [ ] Loading skeleton while auth loading

**References:** FRONTEND_COMPONENTS.md Section 3.1

---

### USER-3: Format MicroPoints Utility

**As a** frontend developer  
**I want** formatting utilities  
**So that** MicroPoints display correctly

**Acceptance Criteria:**
- [ ] Create `src/lib/format.ts`
- [ ] `formatPoints(microPoints)` - "1,000.00" format
- [ ] `formatCompactPoints(microPoints)` - "10K", "1.5M" format
- [ ] `parsePoints(string)` - convert to MicroPoints string
- [ ] Handle BigInt serialization (strings in JSON)
- [ ] Scale: 1 Point = 1,000,000 MicroPoints

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
- [ ] Query `point_grants` table for user
- [ ] Return paginated results
- [ ] Include grant type, amount, balance after, reason, granted by, date

**References:** API_SPECIFICATION.md Section 4.2.2

---

### USER-5: Create Points History View

**As a** user  
**I want** to view my points history  
**So that** I can see bonuses and grants

**Acceptance Criteria:**
- [ ] Create points history component/page
- [ ] Display list of grants
- [ ] Show type badge (Registration, Admin Grant, etc.)
- [ ] Show amount and running balance
- [ ] Pagination

---

### USER-6: Create Landing Page

**As a** visitor  
**I want** an engaging landing page  
**So that** I understand what the platform does

**Route:** `/`

**Acceptance Criteria:**
- [ ] Create route at `src/routes/index.tsx`
- [ ] Hero section with tagline and CTA
- [ ] Featured/trending markets section
- [ ] How it works section (3 steps)
- [ ] Call to action for registration
- [ ] Responsive design
- [ ] Animated elements (subtle)

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
- [ ] Create `src/components/layout/Footer.tsx`
- [ ] Logo and tagline
- [ ] Navigation links
- [ ] Social links (placeholder)
- [ ] Copyright notice
- [ ] Responsive layout (stacked on mobile)

---

### USER-8: Create Toast Notification System

**As a** user  
**I want** toast notifications  
**So that** I get feedback on my actions

**Acceptance Criteria:**
- [ ] Create `src/components/ui/Toast.tsx`
- [ ] Create toast context/provider
- [ ] Support variants: success, error, warning, info
- [ ] Auto-dismiss after 5 seconds
- [ ] Manual dismiss button
- [ ] Stack multiple toasts
- [ ] Position: bottom-right

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
- [ ] Create `src/components/ui/Skeleton.tsx`
- [ ] Create `src/components/market/MarketCardSkeleton.tsx`
- [ ] Create `src/components/portfolio/PositionCardSkeleton.tsx`
- [ ] Pulse animation
- [ ] Match dimensions of real components

---

### USER-10: Create 404 Not Found Page

**As a** user  
**I want** a friendly 404 page  
**So that** I'm not confused when I hit a broken link

**Route:** Catch-all route

**Acceptance Criteria:**
- [ ] Clear "Page Not Found" message
- [ ] Link back to home
- [ ] Link to markets
- [ ] Consistent with site design

---

### USER-11: Create Mobile Navigation

**As a** mobile user  
**I want** a mobile-friendly navigation  
**So that** I can navigate on small screens

**Acceptance Criteria:**
- [ ] Hamburger menu icon on mobile
- [ ] Slide-out drawer or dropdown menu
- [ ] All navigation links accessible
- [ ] Balance displayed in mobile nav
- [ ] Close on navigation
- [ ] Close on outside click

---

### USER-12: Create Error Boundary Component

**As a** user  
**I want** graceful error handling  
**So that** the app doesn't crash completely on errors

**Acceptance Criteria:**
- [ ] Create `src/components/ErrorBoundary.tsx`
- [ ] Catch JavaScript errors in component tree
- [ ] Display friendly error message
- [ ] Provide "Try Again" / "Go Home" buttons
- [ ] Log errors to monitoring service (optional)
- [ ] Preserve navigation ability
- [ ] Different styles for different error types

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