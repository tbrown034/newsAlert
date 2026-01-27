# Pulse (news-alert)

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
│   │   ├── news/route.ts       # Main feed - RSS/Bluesky/Telegram/Reddit/YouTube
│   │   ├── summary/route.ts    # AI briefing generation (Claude)
│   │   ├── seismic/route.ts    # USGS earthquake data
│   │   ├── weather/route.ts    # NOAA/EONET/GDACS alerts
│   │   ├── fires/route.ts      # NASA FIRMS wildfire data
│   │   ├── outages/route.ts    # Internet outage tracking
│   │   ├── travel/route.ts     # State Dept advisories
│   │   └── briefing-followup/  # AI follow-up Q&A
│   ├── layout.tsx
│   └── page.tsx
├── components/                  # 15 React components (maps, feeds, cards)
├── lib/
│   ├── sources-clean.ts        # MAIN SOURCE FILE (580+ sources, tiered)
│   ├── rss.ts                  # Multi-platform fetcher (1300+ lines)
│   ├── regionDetection.ts      # Keyword-based geo classification
│   ├── activityDetection.ts    # Regional activity levels
│   ├── alertStatus.ts          # Breaking/confirmed detection
│   ├── aiSummary.ts            # Claude API integration
│   ├── newsCache.ts            # 5min TTL cache
│   ├── rateLimit.ts            # 60 req/min per IP
│   └── blocklist.ts            # Rejected sources registry
└── types/                       # TypeScript definitions
```

## Environment Variables
```env
ANTHROPIC_API_KEY=     # Required - AI features
NASA_FIRMS_API_KEY=    # Required - Wildfire data
BLUESKY_IDENTIFIER=    # Optional - Higher rate limits
BLUESKY_APP_PASSWORD=  # Optional
```

## Tech Stack
Next.js 15 | TypeScript | Tailwind CSS | react-simple-maps | Claude API | Heroicons

---

## Source System

### Source Tiers
| Tier | Count | Fetch Strategy | Examples |
|------|-------|----------------|----------|
| T1 | 84 | Always, immediate | Reuters, NOELREPORTS, BNO News |
| T2 | 200+ | Async background | Regional reporters, analysts |
| T3 | 100+ | On-demand only | Archive, low-activity sources |

### Source Types
- `official` - Government, military, institutional
- `news-org` - News organizations (AP, Reuters)
- `reporter` - Individual journalists
- `osint` - Open-source intelligence (Bellingcat, ISW)
- `aggregator` - News aggregators (BNO, War Monitor)
- `analyst` - Think tanks, experts
- `ground` - On-the-ground, local reporters
- `bot` - Automated feeds

### Platforms Supported
- **Bluesky** - RSS feeds via bsky.app/profile/{handle}/rss
- **RSS/Atom** - Native XML parsing
- **Telegram** - Web scrape t.me/s/{channel}
- **Reddit** - JSON API /r/{sub}/hot.json
- **YouTube** - Feed XML
- **Mastodon** - ActivityPub API

### What's ACTUALLY Used
| Feature | Defined | Used For |
|---------|---------|----------|
| sourceType | 7 types | Feed balancing (20% OSINT), verification badges |
| confidence | 1-100 | Verification status only |
| region | 6 regions | Content classification, filtering |
| fetchTier | T1/T2/T3 | Fetch priority |
| postsPerDay | baseline | Activity level calculation (count-based) |
| keywords | 3 sets | Region detection, alert status |

### What's NOT Used (Yet)
- **Priority scoring** based on keywords/severity
- **Source recommendations** based on provenance
- **Content filtering** based on breaking/analysis type
- **Per-source anomaly detection** (interfaces defined, not implemented)

---

## Source Discovery & Maintenance

### Finding New Sources

**Step 1: Search**
```bash
# Use existing scripts
npx tsx scripts/comprehensive-source-search.js "iran news"
npx tsx scripts/search-bluesky-accounts.js "osint ukraine"
```

**Step 2: Verify**
```bash
# Test the source works
npx tsx scripts/test-new-sources.ts
```

**Step 3: Add to sources-clean.ts**
```typescript
{
  id: 'unique-id',
  name: 'Display Name',
  handle: 'handle.bsky.social',  // for Bluesky
  platform: 'bluesky',
  sourceType: 'osint',
  confidence: 85,
  region: 'middle-east',
  fetchTier: 'T2',
  postsPerDay: 5,
  feedUrl: 'https://bsky.app/profile/handle.bsky.social/rss'
}
```

**Step 4: Audit periodically**
```bash
npx tsx scripts/audit-sources.ts
```

### Blocklist - Sources We've Rejected

**Location:** `src/lib/blocklist.ts`

Before searching for new sources, check this file to avoid re-evaluating rejected sources.

**Current blocked sources:**
- Kathmandu Post - Off-topic for regional feeds
- Dark Reading - Cybersecurity only
- Marginal Revolution - Economics blog
- Bleeping Computer - Tech news only
- socialistdogmom - Off-topic

**To add a rejected source:**
```typescript
// In src/lib/blocklist.ts
{
  id: 'source-id',
  name: 'Source Name',
  reason: 'Why rejected',
  dateBlocked: '2026-01-27',
}
```

### Sources We've Already Searched
Track searches to avoid duplicating effort:

| Date | Search Query | Platform | Sources Found | Added |
|------|-------------|----------|---------------|-------|
| 2026-01 | "iran osint" | Bluesky | 12 | 8 |
| 2026-01 | "ukraine war" | Bluesky | 20 | 15 |
| 2026-01 | Middle East RSS | RSS | 30 | 22 |

---

## Activity & Severity Detection

### Activity Levels (Frequency-Based)
```
Posts in last hour / Regional baseline = Multiplier

Multiplier >= 4.0 → CRITICAL (4x normal)
Multiplier >= 2.0 → ELEVATED (2x normal)
Multiplier <  2.0 → NORMAL
```

**Baselines:**
- US: 10 posts/hour
- LATAM: 6 posts/hour
- Middle East: 15 posts/hour
- Europe-Russia: 18 posts/hour
- Asia: 10 posts/hour

### Alert Status (Provenance + Recency)
```
OSINT/ground source + alert keywords + <30 min → "FIRST"
Official/reporter source + alert keywords → "CONFIRMED"
Otherwise → null
```

---

## Scripts Reference

### Active (Keep)
| Script | Purpose |
|--------|---------|
| `test-new-sources.ts` | Test newly added sources |
| `audit-sources.ts` | Validate all sources, find 404s/inactive |
| `generate-clean-sources.ts` | Generate tiered source file |
| `test-bluesky-accounts.ts` | Performance diagnostics |
| `testParser.ts` | Unit tests for parsing |

### Archive (One-time use)
| Script | Purpose |
|--------|---------|
| `comprehensive-source-search.js` | Bluesky account discovery |
| `search-bluesky-accounts.js` | Keyword search |
| `verify-*.js` | Source verification |
| `filter-bluecrawler.js` | Filter scraped accounts |

### Deprecated (Remove)
| Script | Reason |
|--------|--------|
| `telegram_auth*.ts` | Telegram API abandoned for scraping |
| `telegram_*.py` | Python scripts not used |

---

## Error Handling

### Bluesky
| Status | Handling |
|--------|----------|
| 400/404 | Cached 1 hour, silent after first log |
| 429 | Logged (rate limit), not cached |
| 401/403 | Logged - check credentials |
| 500-504 | Logged, not cached |

### All Platforms
- Timeout: 15s default, 8s for Telegram
- Invalid handles cached to prevent repeated failures
- Partial failures return available data
- Stale-while-revalidate: 15 min fallback

---

## Known Technical Debt

1. **Duplicate source files** - `sources.ts` (3,357 lines) mostly dead, only helper functions used
2. **Unused telegram code** - `telegram-reader.ts`, `telegram.ts` not used
3. **messageAnalysis.ts** - Sophisticated analysis built but not integrated
4. **Per-source anomaly detection** - Interfaces defined, not implemented

---

## Principles
- KISS - Keep It Simple
- Mobile-first, dark theme
- Work autonomously
- Frequency-based activity (no ML complexity)
- 20% OSINT feed balance (prevent wire service dominance)
