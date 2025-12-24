# Price Chart Architecture

## Design Principles

### 1. Data Density Optimization
- Target: **50-200 data points** per chart
- Rationale: Balance detail vs. performance and readability
- Too few points: Missing trends
- Too many points: UI lag, cluttered display

### 2. Interval Selection Strategy

| Time Range | Candle Interval | Expected Points | Rationale |
|------------|----------------|-----------------|-----------|
| **1H** | 1m | 60 | High detail for short-term traders |
| **24H** | 15m | 96 | Balance of detail and clarity |
| **7D** | 1h | 168 | Smooth trends, capture daily patterns |
| **30D** | 4h | 180 | Weekly patterns visible |
| **All** | Dynamic | ~150-200 | Scales with market age |

### 3. All-Time Interval Logic

```typescript
if (ageInDays <= 1) → '15m'  // Very new market
else if (ageInDays <= 7) → '1h'   // Week-old market
else if (ageInDays <= 30) → '4h'  // Month-old market
else if (ageInDays <= 90) → '1d'  // Quarter-old market
else → '1d'  // Long-running market
```

### 4. X-Axis Formatting Strategy

| Interval | Format | Example |
|----------|--------|---------|
| 1m, 5m, 15m | `HH:MM` | "14:30" |
| 1h | `MMM DD, HH:MM` (if >1 day range) | "Dec 20, 14:00" |
| 4h | `MMM DD` | "Dec 20" |
| 1d | `MMM DD` | "Dec 20" |

### 5. Tooltip Strategy
Always show full context: `MMM DD, YYYY HH:MM` + percentage

## Performance Considerations

### Query Caching
- Cache key includes: `[marketId, interval, fromISO, toISO]`
- `useMemo` prevents unnecessary recalculations
- React Query handles automatic cache invalidation

### API Efficiency
- Backend aggregates OHLC data at database level
- No client-side aggregation needed
- Time-based pagination for historical data

## Edge Cases Handled

1. **New Markets (<1 hour old)**
   - "1H" might have sparse data → Show what's available
   - Disable longer intervals until sufficient data exists

2. **Very Old Markets (>1 year)**
   - "All" uses daily candles to avoid fetching thousands of points
   - Still allows zooming into shorter ranges for detail

3. **Low Activity Markets**
   - Chart gracefully handles gaps in data
   - Shows "No price history available" if truly empty

4. **Market at boundaries**
   - "All" respects actual creation time
   - "30D" falls back to "All" if market is younger

## UX Improvements

### Loading States
- Skeleton loader during initial fetch
- Smooth transition between intervals
- Previous data stays visible during refetch

### Visual Consistency
- YES line: Green (#22c55e)
- NO line: Red (#ef4444)
- Grid: Subtle gray (#606070)
- Background: Dark theme (#0a0a0f)

### Accessibility
- Tooltip provides detailed context
- Keyboard navigation support (future)
- ARIA labels on interactive elements (future)

## Technical Implementation

### Component Hierarchy
```
MarketDetailPage
├── IntervalSelector (UI controls)
├── PriceChart
│   ├── ResponsiveContainer
│   ├── LineChart (Recharts)
│   │   ├── XAxis (smart formatting)
│   │   ├── YAxis (percentage)
│   │   ├── Tooltip (detailed)
│   │   └── Line × 2 (YES, NO)
│   └── LoadingOverlay
└── RecentTrades
```

### Data Flow
```
User clicks "7D"
  ↓
selectedInterval state updates
  ↓
useMemo recalculates intervalParams (only if changed)
  ↓
useQuery triggers with new params
  ↓
API fetches 1h candles for last 7 days
  ↓
Transform candles to chart data
  ↓
Recharts renders with smart X-axis formatting
```

## Future Enhancements

### Phase 2
- [ ] Candlestick chart option (show OHLC)
- [ ] Volume overlay
- [ ] Multiple market comparison
- [ ] Custom date range picker

### Phase 3
- [ ] Technical indicators (MA, RSI)
- [ ] Drawing tools (trendlines)
- [ ] Export data to CSV
- [ ] Real-time updates via WebSocket

## Testing Strategy

### Unit Tests
- `getIntervalParams()` returns correct intervals
- X-axis formatter handles all cases
- Edge cases (new/old markets)

### Integration Tests
- API returns correct number of candles
- Chart renders without errors
- Interval switching works smoothly

### E2E Tests
- User can switch between all intervals
- Loading states appear correctly
- Tooltip displays accurate data

## Monitoring & Metrics

### Performance Metrics
- Time to render chart: <500ms
- API response time: <200ms
- Memory usage: <50MB per chart

### User Metrics
- Most used intervals (analytics)
- Error rates per interval
- User engagement (time spent viewing)

---

*Last Updated: December 2025*

