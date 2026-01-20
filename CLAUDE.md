# Pulse

Real-time global intelligence dashboard for monitoring breaking news, seismic activity, and geopolitical events.

## Quick Start
```bash
npm install
npm run dev        # http://localhost:3000
npm run build      # Production build
vercel             # Deploy
```

## Project Structure
```
src/
├── app/
│   ├── api/
│   │   ├── news/route.ts       # RSS/Bluesky aggregation
│   │   ├── summary/route.ts    # AI briefing generation
│   │   ├── seismic/route.ts    # USGS earthquake data
│   │   ├── weather/route.ts    # NOAA/EONET/GDACS alerts
│   │   ├── fires/route.ts      # NASA FIRMS wildfire data
│   │   ├── outages/route.ts    # Internet outage tracking
│   │   ├── travel/route.ts     # State Dept advisories
│   │   └── briefing-followup/  # AI follow-up Q&A
│   ├── layout.tsx
│   └── page.tsx
├── components/                  # UI components
├── lib/                         # Utilities (sources, parsers, detection)
└── types/
```

## Key Features
- **580+ OSINT sources** (437 RSS + 150+ Bluesky)
- **Source tiers**: OFFICIAL, OSINT, REPORTER, GROUND
- **Severity detection**: CRITICAL, HIGH, MODERATE
- **Multi-layer maps**: Main, Seismic, Weather, Fires, Outages, Travel
- **6.0+ earthquake overlay** on Main view

## Environment Variables
```env
ANTHROPIC_API_KEY=     # Required - AI features
NASA_FIRMS_API_KEY=    # Required - Wildfire data
BLUESKY_IDENTIFIER=    # Optional - Higher rate limits
BLUESKY_APP_PASSWORD=  # Optional
```

## Tech Stack
Next.js 15 • TypeScript • Tailwind CSS • react-simple-maps • Claude API • Heroicons

## Bluesky Error Handling

The app fetches from 150+ Bluesky accounts. Error handling in `src/lib/rss.ts`:

| Status | Type | Handling |
|--------|------|----------|
| 400/404 | Invalid handle | Cached 1 hour, silent after first log |
| 429 | Rate limited | Logged, not cached (transient) |
| 401/403 | Auth error | Logged - check API credentials |
| 500-504 | Server error | Logged, not cached (transient) |

**Cache**: Invalid handles are cached to avoid repeated API calls. Use `getInvalidHandleCacheSize()` and `clearInvalidHandleCache()` for diagnostics.

**Batching**: Bluesky sources fetched in batches of 10 with 500ms delays to avoid rate limits.

## Principles
- KISS - Keep It Simple
- Mobile-first, dark theme
- Work autonomously
- **Update dev log** (`docs/devjournal.md`) after every significant or long-running action
