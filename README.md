# newsAlert

Real-time OSINT dashboard for geopolitical situational awareness. Breaking news before it's news.

![newsAlert Dashboard](docs/screenshot.png)

## Features

- **Real-time feed** from 60+ OSINT analysts, journalists, and official sources
- **AI situation briefings** - Claude-powered summaries with tension scoring (1-10)
- **Seismic monitoring** - Real-time USGS earthquake data with magnitude visualization
- **Smart severity detection** - Keywords analyzed to flag CRITICAL, HIGH, MODERATE events
- **Activity anomalies** - Highlights when sources post above baseline
- **Interactive world map** - Visual overview with local times (e.g., "03:26 Tehran")
- **Region filtering** - Middle East, Ukraine, Taiwan, Venezuela, US
- **Source credibility** - Tiered badges (OFFICIAL, OSINT, REPORTER, GROUND)

## Quick Start

```bash
# Install dependencies
npm install

# Set up environment variables
cp .env.example .env.local
# Add your ANTHROPIC_API_KEY for AI features

# Start development server
npm run dev

# Open http://localhost:3000
```

## Tech Stack

- **Framework**: Next.js 16 + TypeScript
- **Styling**: Tailwind CSS
- **Maps**: react-simple-maps
- **AI**: Anthropic Claude API
- **Data**: RSS feeds + USGS API
- **Icons**: Heroicons + custom platform SVGs

## Project Structure

```
src/
├── app/
│   ├── api/
│   │   ├── news/          # RSS aggregation
│   │   ├── seismic/       # USGS earthquake data
│   │   └── summary/       # AI briefing generation
│   └── page.tsx           # Main dashboard
├── components/
│   ├── WorldMap.tsx       # Interactive hotspot map
│   ├── SeismicMap.tsx     # Earthquake visualization
│   ├── NewsFeed.tsx       # News feed with region tabs
│   └── InlineBriefing.tsx # AI summary component
└── lib/
    ├── sources.ts         # 60+ OSINT sources
    ├── rss.ts             # Feed parser with SHA-256 dedup
    ├── keywordDetection.ts # Severity analysis
    └── aiSummary.ts       # Claude integration
```

## Data Sources

60+ curated sources including:
- **Government**: US State Dept, DHS, USGS, WHO, EU EEAS
- **OSINT**: Bellingcat, ISW, CSIS, OSINTdefender
- **News**: Reuters, BBC, Al Jazeera, Haaretz
- **Analysts**: Intel Crab, Aurora Intel, Euromaidan Press

See [docs/sources.md](docs/sources.md) for full list.

## Environment Variables

Create `.env.local`:
```env
# Required for AI briefings
ANTHROPIC_API_KEY=your_key_here

# Optional: Bluesky auth for higher rate limits
BLUESKY_IDENTIFIER=your-handle.bsky.social
BLUESKY_PASSWORD=your-app-password
```

## Deployment

```bash
# Deploy to Vercel
vercel

# Or build for production
npm run build
npm start
```

## License

MIT
