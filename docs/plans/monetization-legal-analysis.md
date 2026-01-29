# Monetization Legal Analysis

**Date**: 2026-01-29
**Status**: Research / Planning
**Scenario**: $1/week Pro tier with Opus AI analysis + potential editorial features

---

## Disclaimer

This is not legal advice. Consult an attorney before launching paid features.

---

## 1. Anthropic API Usage (Low Risk)

Anthropic's API terms generally **allow commercial use** of outputs.

**Key considerations**:
- Reselling *your product* that uses Claude, not reselling Claude itself
- Adding value (curation, UI, source aggregation) on top of raw AI
- Review [Anthropic Usage Policy](https://www.anthropic.com/policies) for any restrictions

**Assessment**: Low risk — this is a standard SaaS model and what the API is designed for.

---

## 2. News Content Aggregation (Medium Risk)

This is the biggest legal gray area.

### What Pulse Does
- Pulls RSS feeds (generally acceptable — that's what RSS is for)
- Scrapes Telegram (likely violates their ToS)
- Aggregates content from 478 sources
- AI summarizes/synthesizes content for users

### Legal Doctrines

| Doctrine | Application |
|----------|-------------|
| **Fair Use** | Transformative (AI synthesis), but commercial purpose weighs against |
| **Hot News Doctrine** | Time-sensitive news has limited protection, but AP has sued aggregators |
| **Terms of Service** | Most news sites have ToS prohibiting commercial scraping |
| **Copyright** | Headlines have weak protection; full articles have strong protection |

### Relevant Cases
- *AP v. Meltwater* (2013) — News aggregator lost, but they copied significant portions
- *Google News* — Survives by linking out, not hosting content

### Mitigating Factors
- Showing headlines + links, not full articles
- AI creates transformative summaries
- Sources are cited

**Assessment**: Medium risk — Fine for small $1/week product. Major news orgs won't notice. At scale (thousands of users), AP/Reuters *could* send cease-and-desist. AI summary layer adds transformative value that helps the legal case.

---

## 3. Government Data Sources (Very Low Risk)

| Source | Status |
|--------|--------|
| USGS earthquake data | Public domain |
| NOAA weather alerts | Public domain |
| NASA FIRMS fire data | Public domain |
| State Dept advisories | Public information |

**Assessment**: Very low risk — US government data is explicitly free for commercial use.

---

## 4. Platform Terms of Service (Mixed Risk)

| Platform | Commercial Use | Risk Level |
|----------|----------------|------------|
| **Bluesky** | RSS is public, ToS allows reasonable use | Low |
| **Reddit** | Hostile to API use (killed 3rd party apps) | **High** |
| **Telegram** | Scraping likely violates ToS | Medium |
| **YouTube** | API ToS restricts commercial aggregation | Medium |
| **Mastodon** | Generally permissive | Low |

### Reddit Specifically
Reddit charges $0.24 per 1,000 API calls for commercial use. Current JSON scraping approach likely violates ToS.

**Recommendation**: Consider dropping Reddit or paying for official API access before monetizing.

---

## 5. Business Compliance Requirements

For a $1/week subscription:

| Requirement | Difficulty | Notes |
|-------------|------------|-------|
| Privacy Policy | Easy | Template available |
| Terms of Service | Easy | Template available |
| Payment processor (Stripe) | Easy | Standard integration |
| Business entity (LLC) | Recommended | ~$100, liability protection |
| GDPR compliance | Medium | Cookie consent, data handling (if EU users) |

---

## Risk Summary

| Risk Area | Level | Notes |
|-----------|-------|-------|
| Anthropic API | Low | Standard commercial use |
| News aggregation | Medium | Fine at small scale, risky at large scale |
| Government data | Very Low | Public domain |
| Platform ToS | Medium | Reddit is the weak point |
| Business setup | Low | Standard requirements |

---

## Recommended Actions Before Launch

1. **Drop Reddit or pay for official API access** — main legal weak point
2. **Add Terms of Service + Privacy Policy** — basic legal protection
3. **Ensure sources are clearly linked** — not just summarizing, linking to originals
4. **Consider forming an LLC** — ~$100, provides liability protection
5. **Review Anthropic's latest terms** — confirm commercial use is allowed

---

## Bottom Line

At $1/week with a few hundred users, legal risks are theoretical. News aggregators operate in a gray zone, but enforcement against small players is rare.

The bigger risks emerge at scale (10,000+ users) when news organizations might notice. At that point, consulting a media attorney would be worthwhile.

---

*Last updated: 2026-01-29*
