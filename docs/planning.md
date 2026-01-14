# newsAlert - Planning Document

## Executive Summary
Building a personal OSINT (Open Source Intelligence) dashboard for real-time situational awareness. The core insight is valid: manual monitoring is exhausting and scattered across platforms. A unified interface with intelligent filtering could be genuinely useful.

---

## Comparable Tools & Market Analysis

### Direct Competitors

| Tool | Strengths | Weaknesses | Pricing |
|------|-----------|------------|---------|
| [Liveuamap](https://liveuamap.com/) | Excellent UX, established, multi-conflict | Delayed updates, limited customization | Free + $4.99/mo premium |
| [DeepStateMap](https://deepstatemap.live/) | Detailed Ukraine frontlines, Telegram integration | Ukraine-only focus | Free |
| [ACLED](https://acleddata.com/) | Academic rigor, historical data | Not real-time, research-focused | Free data, paid API |
| [GDELT Project](https://www.gdeltproject.org/) | Massive dataset, global | Complex, no consumer UI | Free |
| [Janes](https://www.janes.com/) | Defense-grade intelligence | Enterprise pricing ($$$) | $10k+/year |

### Adjacent Tools
- **Ground News** - Bias-aware news aggregation (not real-time)
- **Feedly** - RSS with AI filtering (not geo-focused)
- **Dataminr** - Enterprise real-time alerts (very expensive)
- **Bellingcat Toolkit** - OSINT methodology, not a product

### Gap Analysis
**What's missing in the market:**
1. Consumer-grade tool with Liveuamap's UX + social media integration
2. Customizable alert thresholds (everyone does one-size-fits-all)
3. Cross-source verification scoring (is this rumor or confirmed?)
4. Personal watchlist management with trend tracking

---

## Feedback on Your Concept

### Strengths
1. **Clear use case** - Iran monitoring is concrete, not abstract
2. **Source hierarchy insight** - Your X → YouTube → Reddit observation is accurate and valuable
3. **Tiered alerts** - Excellent idea; most tools spam you or stay silent
4. **Constant + emerging** - Smart to separate persistent watchpoints from breaking events

### Concerns

#### 1. Twitter/X API Reality Check
**Problem**: Twitter API is now extremely expensive and hostile to developers.
- Basic tier: $100/month, 10k tweets/month read (useless for real-time)
- Pro tier: $5,000/month, 1M tweets/month
- Enterprise: $42,000+/month

**Alternatives to explore:**
- Nitter instances (unreliable, being shut down)
- Curated RSS bridges (some exist)
- Manual list export + polling
- Focus on Bluesky (free API, growing OSINT community)
- Accept X as "manual fallback" not automated

#### 2. Signal vs Noise Challenge
This is the hardest problem. During the January 2024 Iran strikes:
- Thousands of tweets per minute
- 80%+ were speculation, reposts, or misinfo
- Key signal often buried

**Possible approaches:**
- Source reputation scoring (verified accounts, track record)
- Engagement velocity (sudden spike = signal)
- Cross-platform correlation (same claim on X + Telegram = higher confidence)
- AI classification (but needs training data)

#### 3. Threat Level Algorithm
How do you quantify "heating up"? This needs definition:

**Possible metrics:**
- Post volume (normalized by baseline)
- Keyword intensity (military terms, casualty reports)
- Source tier escalation (when Reuters picks up what OSINT accounts said)
- Geographic spread of reports
- Official government statements

**Risk**: False positives during viral rumors, false negatives during information blackouts

#### 4. Scope Creep Risk
You've described a lot:
- Globe visualization
- Multi-platform aggregation
- AI threat scoring
- Historical comparison
- User notifications
- Multiple watchpoints

**Recommendation**: Brutal MVP scoping. Start with ONE watchpoint (Iran), ONE source (Bluesky or RSS), basic map, manual threat scoring. Validate before expanding.

---

## Questions - Answered

### Technical
1. **What's your preferred tech stack?** → **CONFIRMED**: Next.js + React + TypeScript + Tailwind + PostgreSQL
2. **Do you have Twitter/X API access?** → **NO** - too expensive, use Bluesky + RSS + manual X curation
3. **Budget for APIs?** → Assume minimal, prioritize free APIs
4. **Deployment target?** → Vercel
5. **Mobile support needed?** → **MOBILE-FIRST** (changed from desktop-first)
6. **Icons?** → **Heroicons ONLY** - no other icon libraries

### Product
6. **Personal use only or multi-user?** → **PERSONAL USE FIRST** - Design for Trevor's workflow
7. **Notification delivery method?** → TBD
8. **Historical data retention?** → TBD
9. **Offline/fallback behavior?** → TBD

### Scope
10. **MVP definition** → **"Is the US about to attack Iran?"** - Real-time Iran situational awareness
11. **Timeline expectations?** → Not specified
12. **Which watchpoint first?** → **IRAN** - Then expand to other regions

---

## Technical Architecture Thoughts

### Option A: Simple & Cheap
```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   RSS/API   │────▶│   Node.js   │────▶│   Next.js   │
│   Sources   │     │   Backend   │     │   Frontend  │
└─────────────┘     └─────────────┘     └─────────────┘
                          │
                    ┌─────▼─────┐
                    │  SQLite   │
                    │    DB     │
                    └───────────┘
```
- Pros: Fast to build, cheap to host, simple
- Cons: Limited scale, no real-time, manual refresh

### Option B: Real-time Capable
```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│  Ingestors  │────▶│  Message    │────▶│   Workers   │
│  (per src)  │     │   Queue     │     │  (classify) │
└─────────────┘     └─────────────┘     └─────────────┘
                                              │
┌─────────────┐     ┌─────────────┐     ┌─────▼───────┐
│   Next.js   │◀────│  WebSocket  │◀────│  Postgres   │
│   Frontend  │     │   Server    │     │  + PostGIS  │
└─────────────┘     └─────────────┘     └─────────────┘
```
- Pros: True real-time, scalable, proper architecture
- Cons: More complex, higher hosting costs, longer to build

### Recommendation
**Start with Option A**, migrate to B when validated. Premature optimization is the enemy.

---

## Data Source Deep Dive

### Free & Accessible Now
| Source | Type | Update Freq | API Quality | Notes |
|--------|------|-------------|-------------|-------|
| USGS Earthquakes | Government | Real-time | Excellent | Free, reliable |
| Bluesky | Social | Real-time | Good | Free API, growing |
| Reddit | Social | Minutes | Decent | Free tier available |
| RSS (major news) | News | Minutes-hours | Excellent | Always free |
| GDELT | Aggregated | 15 min | Complex | Free but hard |

### Expensive/Difficult
| Source | Issue | Alternative |
|--------|-------|-------------|
| Twitter/X | $5k+/month | Bluesky, manual monitoring |
| Telegram | Requires phone number, gray area | Public channel RSS bridges |
| NewsAPI | Limited free tier | Direct RSS feeds |
| YouTube | No notification API | RSS of channel uploads |

### Build Order Suggestion
1. **Phase 1**: USGS + RSS feeds + Bluesky (all free)
2. **Phase 2**: Reddit API + manual X curation
3. **Phase 3**: Telegram if legal/feasible, GDELT integration

---

## Threat Scoring Algorithm - Initial Design

### Input Signals
```
score = weighted_sum([
    post_volume_vs_baseline,      # 0-100, weight: 0.2
    source_tier_distribution,     # 0-100, weight: 0.3
    keyword_severity,             # 0-100, weight: 0.2
    cross_platform_correlation,   # 0-100, weight: 0.2
    official_statement_detected,  # 0 or 50, weight: 0.1
])
```

### Output Levels
| Score | Level | Meaning |
|-------|-------|---------|
| 0-20 | Normal | Baseline activity |
| 21-40 | Heightened | Above average chatter |
| 41-60 | Emerging | Developing situation |
| 61-80 | Significant | Confirmed major event |
| 81-100 | Major | Crisis/war/mass casualty |

### Calibration Needed
- Requires historical data to set baselines
- Different watchpoints have different normal levels
- Ukraine baseline >> Venezuela baseline

---

## MVP Specification (Revised)

**Core Question MVP Must Answer**: "Is the US about to attack Iran?"

### User Story Alignment
| User Story | MVP Feature |
|------------|-------------|
| One-look discovery | Homepage dashboard with "at a glance" status |
| Feel ahead | Primary source integration (before mainstream news) |
| Unusual detection | Baseline comparison ("This is unusual because...") |
| Real-time drill-down | Story detail view with incremental updates |
| Source confidence | Confidence badges + tier indicators |
| Source deep-dive | Source profile pages |
| Text sharing | Share button with formatted summary |
| Delight + intuition | Mobile-first, dark mode, tab navigation |

### Must Have (Day 1)
- [ ] **Mobile-first responsive design** - Touch-friendly, dark mode
- [ ] **Tab-based navigation** - Intuitive switching between views
- [ ] Single map view with Iran/Middle East region centered
- [ ] **Tiered feed display** - Source tier badges (Official → Reporter → OSINT → Ground)
- [ ] **Confidence indicators** - Visual confidence scoring for each item
- [ ] RSS feed aggregation (Reuters, BBC, Al Jazeera Middle East)
- [ ] Bluesky integration (curated OSINT list from sources.md)
- [ ] Basic post list with source labels and tier indicators
- [ ] Manual refresh button
- [ ] Severity color coding (green/yellow/orange/red)
- [ ] **Verification status** - Unverified → Multiple Sources → Officially Confirmed

### Should Have (Week 2-3)
- [ ] **"Who reported first?" tracking** - Show cascade timeline
- [ ] **Source profile pages** - Drill down into any source
- [ ] **"Unusual" detection** - Flag events that deviate from baseline
- [ ] USGS earthquake overlay (for explosion disambiguation)
- [ ] Reddit r/CredibleDefense integration
- [ ] Auto-refresh on interval (configurable)
- [ ] Basic threat score display with historical comparison
- [ ] Filter by tier (show only Official, or only OSINT, etc.)
- [ ] **Share via text** - Formatted summary for SMS/messaging

### Could Have (Month 1)
- [ ] Additional watchpoints (Ukraine, Taiwan, Venezuela)
- [ ] Notification system (browser push)
- [ ] Trend arrows (up/down vs yesterday)
- [ ] "What Did I Miss?" summary feature
- [ ] Story drill-down with real-time updates

### Won't Have (MVP)
- Full globe visualization (start with regional map)
- AI classification (start with keyword rules)
- Multi-user auth
- Telegram integration
- Twitter/X automation (too expensive)
- Prediction market integration

---

## Risk Register

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Twitter API too expensive | High | Medium | Focus on Bluesky + RSS |
| Noise overwhelms signal | High | High | Start with curated sources only |
| Scope creep | High | High | Strict MVP definition |
| False threat scores | Medium | High | Keep human in the loop |
| Source goes offline | Medium | Low | Multi-source redundancy |
| Legal issues (scraping) | Low | High | Use only official APIs |

---

## Open Questions for Further Research
1. ~~What OSINT Bluesky accounts to seed the curated list?~~ → **DONE** - See sources.md
2. Best mapping library for this use case (Mapbox vs MapLibre vs Deck.gl)?
3. How does Liveuamap source their data? (Reverse engineer for learning)
4. Existing open-source OSINT dashboards to learn from?
5. Legal considerations for aggregating news content?

---

## Research Completed ✓
- **sources.md created** - 100+ vetted sources with confidence scores
- **Iran section organized by tier** - Matches information cascade model
- **Bluesky sources identified** - 30+ accounts, 10 starter packs
- **User's X following list analyzed** - Key accounts incorporated
- **Energy/oil monitoring sources added** - For sanctions/tanker tracking

---

## Next Steps
1. ✓ ~~Answer the questions above~~ → Key decisions made
2. ✓ ~~Agree on MVP scope~~ → Iran situational awareness
3. ✓ ~~Select tech stack~~ → Next.js + TypeScript + Tailwind + PostgreSQL
4. ✓ ~~Document user stories~~ → 8 stories captured in CLAUDE.md
5. ✓ ~~Document design requirements~~ → Mobile-first, Heroicons, dark mode
6. **BEGIN PHASE 1 BUILD** ← You are here

---

*Document created: January 2025*
*Last updated: January 2025*
*Status: READY TO BUILD*
