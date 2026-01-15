# Sentinel - Status

## Completed

### Core MVP
- [x] Next.js 15 + TypeScript + Tailwind setup
- [x] Dark mode (X/Twitter-inspired theme)
- [x] RSS/Atom feed aggregation
- [x] Bluesky integration (280 sources)
- [x] Real-time feed with chronological sorting
- [x] Region filtering (tabs + map)
- [x] Interactive world map (react-simple-maps)
- [x] Source tier badges (OFFICIAL, OSINT, REPORTER, GROUND)
- [x] Platform icons (Bluesky, RSS)
- [x] Keyword-based severity detection (CRITICAL, HIGH, MODERATE)
- [x] Activity anomaly detection
- [x] Auto-refresh (2 min interval)
- [x] AI briefings with Claude
- [x] Inline AI summaries per region
- [x] Follow-up Q&A for briefings

### Multi-Layer Maps
- [x] Hotspots map (conflict zones)
- [x] Seismic map (USGS earthquakes)
- [x] Weather map (NOAA/EONET/GDACS)
- [x] Fires map (NASA FIRMS)
- [x] Outages map (internet disruptions)
- [x] Travel map (State Dept advisories)

### UI/UX
- [x] Clean card design
- [x] Custom favicon
- [x] Event type labels
- [x] Developing/Confirmed status indicators
- [x] Skeleton loaders
- [x] Error states
- [x] Data freshness indicator ("Updated X min ago")

## Backlog

### High Priority
- [ ] Error state for news API timeout (show user-friendly message)
- [ ] Add more RSS sources for diversity (reduce Bluesky dependency)
- [ ] Server-side caching to reduce API load times
- [ ] Push notifications for CRITICAL events

### Medium Priority
- [ ] "What Did I Miss?" feature (summary of last N hours)
- [ ] Story clustering (group related posts)
- [ ] Source profile pages (click to see source history)
- [ ] Light/dark mode toggle

### Low Priority
- [ ] Share to clipboard/SMS
- [ ] Additional regions (Africa, South Asia)
- [ ] Historical data visualization

## Unused Files (Can Delete)
- `src/components/WatchpointSelector.tsx` - Not used in UI
- `src/components/SourceAccessKey.tsx` - Not exported/used
- `scripts/*.ts` - Test scripts, not production

## Known Issues
- News API can timeout (45s+) when fetching 280 Bluesky sources
- Some Bluesky sources may be rate-limited

---
*Last updated: January 2026*
