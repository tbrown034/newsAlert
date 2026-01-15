# Sentinel

Real-time OSINT dashboard for geopolitical situational awareness. Breaking news before it's news.

## Features

- **Real-time feed** from 285 OSINT sources (Bluesky accounts + RSS feeds)
- **AI situation briefings** - Claude-powered summaries with tension scoring (1-10)
- **Multi-layer maps**:
  - Hotspots - Conflict zones with activity indicators
  - Seismic - Real-time USGS earthquake data
  - Weather - NOAA/EONET/GDACS severe weather alerts
  - Fires - NASA FIRMS satellite wildfire detection
  - Outages - Internet/power disruption tracking
  - Travel - US State Dept travel advisories
- **Smart severity detection** - Keywords analyzed to flag CRITICAL, HIGH, MODERATE events
- **Activity anomalies** - Highlights when sources post above baseline
- **Region filtering** - Middle East, Ukraine, Taiwan, Venezuela, US
- **Source credibility** - Tiered badges (OFFICIAL, OSINT, REPORTER, GROUND)
- **Dark mode** - X/Twitter-inspired dark theme

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

- **Framework**: Next.js 15 + TypeScript
- **Styling**: Tailwind CSS (dark mode)
- **Maps**: react-simple-maps
- **AI**: Anthropic Claude API
- **Data Sources**:
  - Bluesky API (280 OSINT accounts)
  - RSS feeds (BBC, Al Jazeera, etc.)
  - USGS earthquake API
  - NOAA weather API
  - NASA FIRMS/EONET
  - GDACS disaster alerts
  - US State Dept travel advisories
- **Icons**: Heroicons

## Project Structure

```
src/
├── app/
│   ├── api/          # All data APIs (news, seismic, weather, fires, etc.)
│   └── page.tsx      # Main dashboard
├── components/       # React components (maps, feeds, cards)
├── lib/              # Utilities (sources, parsers, detection)
└── types/            # TypeScript definitions
```

## Environment Variables

Create `.env.local`:
```env
# Required
ANTHROPIC_API_KEY=your_key_here      # AI briefings
NASA_FIRMS_API_KEY=your_key_here     # Wildfire satellite data

# Optional: Bluesky auth for higher rate limits
BLUESKY_IDENTIFIER=your-handle.bsky.social
BLUESKY_APP_PASSWORD=your-app-password
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
