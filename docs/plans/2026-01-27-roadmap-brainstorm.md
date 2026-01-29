# News Pulse Roadmap Brainstorm

*Generated: January 27, 2026*

Ideas for future development, organized by category. Nothing here is committed—this is a thinking document.

---

## 1. New Features Beyond the News Feed

### Alerting & Notifications

| Idea | Description | Complexity | Priority |
|------|-------------|------------|----------|
| Push alerts | Browser/mobile notifications for breaking news | Medium | ? |
| Email digests | Daily/weekly AI-generated summaries | Low | ? |
| Threshold alerts | "Notify me if Middle East activity goes CRITICAL" | Medium | ? |
| Keyword watches | Custom alerts for specific topics (Iran, Taiwan, etc.) | Medium | ? |

### Historical & Archive

| Idea | Description | Complexity | Priority |
|------|-------------|------------|----------|
| Timeline view | Scroll back through past 24h/7d/30d | Medium | ? |
| Event reconstruction | "What happened with X?" - AI timeline | High | ? |
| Archive search | Full-text search across historical posts | High | ? |
| Trend charts | Activity levels over time per region | Low | ? |

### Personalization

| Idea | Description | Complexity | Priority |
|------|-------------|------------|----------|
| Saved sources | Follow specific sources | Low | ? |
| Custom regions | Create your own watchpoint | Medium | ? |
| Bookmark stories | Save posts for later | Low | ? |
| Reading history | "Continue where you left off" | Low | ? |

### Output & Integration

| Idea | Description | Complexity | Priority |
|------|-------------|------------|----------|
| RSS output | Let users subscribe to News Pulse feeds | Low | ? |
| API access | Public API for developers | Medium | ? |
| Embeddable widgets | "Breaking news" widget for other sites | Medium | ? |
| Slack/Discord bot | Post alerts to team channels | Medium | ? |

### Analysis Tools

| Idea | Description | Complexity | Priority |
|------|-------------|------------|----------|
| Source comparison | "What are different sources saying about X?" | High | ? |
| Narrative tracking | Follow how a story evolves over hours | High | ? |
| Sentiment gauge | Overall tone of coverage | Medium | ? |

---

## 2. Additional Data Sources & APIs

### Disaster & Crisis

| Source | What It Provides | API? | Notes |
|--------|-----------------|------|-------|
| GDACS | Global disaster alerts (floods, storms, quakes) | Yes, free | |
| ReliefWeb | UN humanitarian situation reports | Yes, free | |
| OCHA HDX | Humanitarian data exchange | Yes, free | |
| Pacific Disaster Center | Real-time hazard monitoring | Yes | |

### Conflict & Security

| Source | What It Provides | API? | Notes |
|--------|-----------------|------|-------|
| ACLED | Armed conflict events database | Yes, free tier | |
| LiveuaMap | Conflict mapping | No (scrape) | |
| SIPRI | Arms transfers, military spending | Data downloads | |
| UN Security Council | Resolutions, statements | RSS available | |

### Aviation & Maritime

| Source | What It Provides | API? | Notes |
|--------|-----------------|------|-------|
| FAA NOTAM | Airspace closures, restrictions | Yes, free | |
| ADS-B Exchange | Flight tracking (military included) | Yes, paid | |
| MarineTraffic | Ship positions, port activity | Yes, paid | |
| VesselFinder | Ship tracking | Yes, paid | |

### Cyber & Infrastructure

| Source | What It Provides | API? | Notes |
|--------|-----------------|------|-------|
| CISA Alerts | US cybersecurity advisories | RSS, free | |
| CVE/NVD | Vulnerability database | Yes, free | |
| Cloudflare Radar | Internet traffic anomalies | Yes, free | |
| Downdetector | Service outage reports | No (scrape) | |

### Government & Policy

| Source | What It Provides | API? | Notes |
|--------|-----------------|------|-------|
| Federal Register | US regulatory actions | Yes, free | |
| Congress.gov | Bills, votes, hearings | Yes, free | |
| OFAC | Sanctions updates | RSS, free | |
| State Dept | Press briefings, travel alerts | RSS, free | |

### Financial Signals

| Source | What It Provides | API? | Notes |
|--------|-----------------|------|-------|
| Fed Calendar | FOMC meetings, speeches | Scrape | |
| NYSE/NASDAQ | Circuit breaker halts | Real-time feeds | |

### Health & Disease

| Source | What It Provides | API? | Notes |
|--------|-----------------|------|-------|
| WHO DON | Disease outbreak news | RSS, free | |
| ProMED | Emerging disease reports | RSS, free | |
| CDC | US disease surveillance | Yes, free | |

### Nuclear & WMD

| Source | What It Provides | API? | Notes |
|--------|-----------------|------|-------|
| IAEA | Nuclear facility reports | RSS | |
| CTBTO | Nuclear test detection | Limited | |

---

## 3. Source Classification System

**This is the next project phase.**

### Current State

- 478 sources with basic metadata
- sourceType: official, news-org, reporter, osint, aggregator, analyst, ground, bot
- fetchTier: T1 (always), T2 (background), T3 (on-demand)

### What's Missing

Current system tells you *what* a source is, not *how good* it is or *what it covers*.

### Proposed Classification Dimensions

**Quality Metrics (Manual)**
| Dimension | What It Measures |
|-----------|-----------------|
| Accuracy | Track record of correct reporting |
| Speed | How fast they break news |
| Verification | Do they verify before posting? |
| Corrections | Do they issue corrections? |

**Coverage Profile (Auto + Manual)**
| Dimension | What It Measures |
|-----------|-----------------|
| Topics | Military, politics, economy, humanitarian |
| Geographic depth | Country-level vs city-level |
| Coverage type | Original reporting vs aggregator |
| Languages | What languages do they post in? |

**Operational Metrics (Automated)**
| Dimension | What It Measures |
|-----------|-----------------|
| Active status | Still posting? |
| Post frequency | Posts per day/week |
| Response rate | How often their feed works |
| Peak hours | When do they post most? |

### Proposed Data Model Extension

```typescript
interface SourceMetadata {
  // Existing
  id: string;
  name: string;
  platform: Platform;
  sourceType: SourceType;
  region: WatchpointId;
  fetchTier: 'T1' | 'T2' | 'T3';

  // NEW: Quality (manual)
  accuracyRating?: 1 | 2 | 3 | 4 | 5;
  verificationPractices?: 'strong' | 'moderate' | 'weak' | 'unknown';

  // NEW: Coverage (auto + manual)
  topics?: ('military' | 'politics' | 'economy' | 'humanitarian' | 'tech' | 'energy')[];
  languages?: string[];
  coverageType?: 'original' | 'aggregator' | 'mixed';

  // NEW: Operational (automated)
  lastSeen?: Date;
  avgPostsPerDay?: number;
  fetchSuccessRate?: number;

  // NEW: Notes
  notes?: string;
  addedDate?: Date;
  lastReviewed?: Date;
}
```

### Implementation Approach: Hybrid

1. **Automate what you can**: frequency, last active, topic keywords, language detection
2. **Manual review for quality**: accuracy, verification practices
3. **Start with T1 sources** (84), expand to T2/T3
4. **Build source profile page** to visualize

---

## Next Steps

- [ ] Decide which category to tackle first
- [ ] For source classification: design the review workflow
- [ ] For new data sources: pick 2-3 to prototype
- [ ] For new features: prioritize based on user value

---

*This is a living document. Update as decisions are made.*
