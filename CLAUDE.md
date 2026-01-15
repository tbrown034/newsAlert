# Sentinel

Real-time OSINT dashboard for geopolitical situational awareness.

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
- **285 OSINT sources** (Bluesky + RSS)
- **AI briefings** with tension scoring (1-10)
- **Source tiers**: OFFICIAL, OSINT, REPORTER, GROUND
- **Severity detection**: CRITICAL, HIGH, MODERATE
- **Multi-layer maps**: Hotspots, Seismic, Weather, Fires, Outages, Travel

## Environment Variables
```env
ANTHROPIC_API_KEY=     # Required - AI features
NASA_FIRMS_API_KEY=    # Required - Wildfire data
BLUESKY_IDENTIFIER=    # Optional - Higher rate limits
BLUESKY_APP_PASSWORD=  # Optional
```

## Tech Stack
Next.js 15 • TypeScript • Tailwind CSS • react-simple-maps • Claude API • Heroicons

## Principles
- KISS - Keep It Simple
- Mobile-first, dark theme
- Work autonomously
