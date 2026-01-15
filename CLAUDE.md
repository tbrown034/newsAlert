# Sentinel (newsAlert)

Real-time OSINT dashboard for geopolitical situational awareness.

## Quick Start
```bash
npm install
npm run dev        # http://localhost:3000
npm run build      # Production build
```

## Project Structure
```
src/
├── app/
│   ├── api/
│   │   ├── news/route.ts       # RSS/Bluesky aggregation
│   │   ├── summary/route.ts    # AI briefing generation
│   │   ├── seismic/route.ts    # USGS earthquake data
│   │   ├── weather/route.ts    # NOAA/EONET/GDACS weather
│   │   ├── fires/route.ts      # NASA FIRMS wildfire data
│   │   ├── outages/route.ts    # Internet outage tracking
│   │   ├── travel/route.ts     # State Dept advisories
│   │   └── briefing-followup/  # AI follow-up Q&A
│   ├── layout.tsx              # Root layout + metadata
│   └── page.tsx                # Main dashboard
├── components/
│   ├── NewsCard.tsx            # Individual news item
│   ├── NewsFeed.tsx            # Feed with region tabs
│   ├── WorldMap.tsx            # Interactive hotspot map
│   ├── SeismicMap.tsx          # Earthquake visualization
│   ├── WeatherMap.tsx          # Weather alerts map
│   ├── FiresMap.tsx            # Wildfire map
│   ├── OutagesMap.tsx          # Internet outages map
│   ├── TravelMap.tsx           # Travel advisories map
│   ├── InlineBriefing.tsx      # AI summary per region
│   ├── SituationBriefing.tsx   # Full AI briefing modal
│   └── PlatformIcon.tsx        # Platform SVG icons
├── lib/
│   ├── sources.ts              # 285 OSINT sources (280 Bluesky, 5 RSS)
│   ├── rss.ts                  # RSS/Atom + Bluesky feed parser
│   ├── aiSummary.ts            # Claude AI integration
│   ├── keywordDetection.ts     # Event severity detection
│   ├── activityDetection.ts    # Source activity anomalies
│   ├── regionDetection.ts      # Geographic classification
│   └── messageAnalysis.ts      # Content type analysis
└── types/
    └── index.ts                # TypeScript types
```

## Key Features
- **Multi-source aggregation**: 285 sources (Bluesky + RSS feeds)
- **AI briefings**: Claude-powered summaries with tension scoring (1-10)
- **Source tiers**: OFFICIAL, OSINT, REPORTER, GROUND
- **Severity detection**: CRITICAL, HIGH, MODERATE based on keywords
- **Activity anomalies**: Detects when sources post above baseline
- **Region filtering**: Middle East, Ukraine, Taiwan, Venezuela, US
- **Multi-layer maps**: Hotspots, Seismic, Weather, Fires, Outages, Travel

## Environment Variables
```env
ANTHROPIC_API_KEY=your_key    # Required for AI features
BLUESKY_IDENTIFIER=handle     # Optional: Bluesky auth
BLUESKY_PASSWORD=app-password # Optional: Higher rate limits
```

## Tech Stack
- Next.js 15 + TypeScript
- Tailwind CSS (dark mode)
- react-simple-maps
- Anthropic Claude API
- Heroicons

## Deployment
```bash
vercel            # Deploy to Vercel
```

## Working Style
- Work autonomously without checking in at every step
- KISS - Keep It Simple, Stupid
- Mobile-first, dark theme
