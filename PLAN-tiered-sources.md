# Tiered Source Architecture Plan

## Goals
1. Time-based fetching (not limit-based) - capture all posts in window
2. Tiered sources: T1 (immediate), T2 (async), T3 (on-demand)
3. Audit all 275+ sources - remove fake/dead, tier the rest
4. Progressive loading with animations

## Phase 1: Research
- [ ] Bluesky API capabilities (time filtering? rate limits?)
- [ ] Current source structure
- [ ] How many sources exist, what fields

## Phase 2: Source Audit
- [ ] Fetch each account's recent activity
- [ ] Identify: fake accounts, never posted, dormant (>30 days), inactive (>7 days), active
- [ ] Generate report of accounts to delete
- [ ] Tier remaining accounts based on activity + value

## Phase 3: Implement Tiered Fetching
- [ ] Modify source data structure to include tier
- [ ] T1 fetching (blocking, immediate display)
- [ ] T2 fetching (async, animate into feed)
- [ ] T3 fetching (on-demand or conditional)
- [ ] Time-based filtering (configurable window)

## Phase 4: UI Updates
- [ ] Animation for new posts sliding in
- [ ] Loading indicator for async tiers
- [ ] Option to manually trigger T3 fetch

## Time Window Recommendation
- **Breaking news mode**: 3 hours (captures rapid developments)
- **Normal mode**: 12 hours (full day coverage across timezones)
- **Deep dive mode**: 24 hours (historical context)

Default: 12 hours - balances freshness with coverage

## Tier Criteria (Draft)
- **T1 (Critical)**: Official sources, major OSINT accounts, high-frequency quality posters
- **T2 (Standard)**: Regular analysts, regional experts, semi-active accounts
- **T3 (Archive)**: Niche accounts, rarely post, but valuable when they do

---

## Progress Log

### Session 1: Jan 15, 2026

#### Research Phase - COMPLETE
- Bluesky API has NO native time filtering (must filter client-side)
- API limit: max 100 posts per request
- Source file: 275 accounts, 3588 lines

#### Audit Results - CRITICAL FINDINGS
**72% of sources should be deleted!**

| Tier | Count | Description |
|------|-------|-------------|
| T1 (Critical) | 6 | Very active (10+ posts/week) |
| T2 (Standard) | 50 | Semi-active (1-9 posts/week) |
| T3 (Archive) | 20 | Dormant 30-90 days |
| DELETE | 199 | Non-existent or dormant >90 days |

**Root cause**: Many accounts were fabricated or guessed:
- Major orgs (BBC, NYT, Reuters, etc.) are NOT on Bluesky
- Wrong handles for real accounts
- Accounts that never posted

#### T1 Accounts (fetch first, always)
1. International Crisis Group (@crisisgroup.org) - 23/week
2. Van Jackson (@vanjackson.bsky.social) - 25/week
3. Euan MacDonald (@euanmacdonald.bsky.social) - 30/week [Ukraine]
4. Andrew Revkin (@revkin.bsky.social) - 27/week
5. Helen Branswell (@helenbranswell.bsky.social) - 15/week
6. Casey Newton (@caseynewton.bsky.social) - 35/week

#### Completed Steps
- [x] Generate new sources.ts with only valid accounts → `sources-clean.ts`
- [x] Add `fetchTier: 'T1' | 'T2' | 'T3'` field
- [x] Add `postsPerDay` from audit data
- [x] Implement tiered fetching logic in `/api/news`
- [x] Search for MORE active OSINT accounts to add

### Session 2: Jan 15, 2026 (continued)

#### New OSINT Accounts Added
From BlueSky OSINT starter packs, verified 35+ accounts, added 17 high-quality sources:

**New T1 (7 accounts):**
- Eliot Higgins (Bellingcat founder) - 7.1/day
- WarTranslated (Dmitri) - 7.1/day
- H I Sutton (naval OSINT) - 7.1/day
- Jakub Janovsky - 3.4/day
- Evergreen Intel - 7.1/day
- Institute for Study of War - 7.1/day
- Intel Night OWL - 2.3/day

**New T2 (6 accounts):**
- Bellingcat - 1.3/day
- Tatarigami - 0.6/day
- GeoConfirmed - 1.0/day
- Malachy Browne (NYT) - 0.7/day
- Bosphorus Observer - 0.9/day
- All Source News - 1.3/day

**New T3 (4 accounts):**
- Ukraine Control Map
- Aric Toler (Bellingcat)
- Faytuks News
- Alison Killing

#### API Updates
New query parameters:
- `?tier=T1` or `?tier=T1,T2` or `?tier=T1,T2,T3`
- `?hours=12` (default 12, max 72)
- `?limit=200` (default 200, max 1000)

Test results:
- T1 only (24h): 95 items from 13 sources
- T1+T2 (12h): 72 items from 69 sources

#### Current Status
- **T1**: 13 sources (very active, ~35 posts/day combined)
- **T2**: 56 sources (semi-active)
- **T3**: 24 sources (occasionally active)
- **Total**: 93 verified sources (down from 275 fake/dead)

#### Completed
- [x] Progressive loading UI with animations
- [x] T2 async loading in frontend

### Session 3: Jan 15, 2026

#### Bluecrawler Top 1000 Review
Added high-value accounts from bluecrawler.com top 1000 list.

**New T1 Sources (8 accounts):**
- AP News (@apnews.com) - 30/day, 285k followers - major news wire
- Reuters (@reuters.com) - 30/day, 297k followers - major news wire
- Mother Jones (@motherjones.com) - 30/day, 350k followers - investigative
- Ron Filipkowski (@ronfilipkowski.bsky.social) - 14.9/day - extremism tracker
- Kate Starbird (@katestarbird.bsky.social) - 7.9/day - misinfo researcher
- Jim Acosta (@jimacosta.bsky.social) - 5.7/day - CNN journalist
- Jen Rubin (@jenrubin.bsky.social) - 3.8/day - WaPo columnist
- Jake Tapper (@jaketapper.bsky.social) - 2/day - CNN anchor

**New T2 Sources (1 account):**
- BBC Newsnight (@bbcnewsnight.bsky.social) - 0.9/day, 237k followers

**Skipped (dormant):**
- POLITICO, Washington Post (0 posts/day)

#### Updated Totals
- **T1**: 21 sources (13 + 8 new)
- **T2**: 57 sources (56 + 1 new)
- **T3**: 24 sources (unchanged)
- **Total**: 102 verified sources

### Implementation Complete

The tiered source architecture is now fully implemented:

1. **Sources audited**: 275 → 102 verified accounts (63% were fake/dormant)
2. **Tiered fetching**: T1 (21 sources), T2 (57 sources), T3 (24 sources)
3. **Time-based filtering**: Configurable 1-72 hour window (default 12h)
4. **Progressive loading**: T1 loads first, T2 animates in async
5. **New API params**: `?tier=T1,T2&hours=12&limit=100`

**Performance improvement**: Initial page load now fetches only 21 T1 sources instead of 275+, then T2 loads async with smooth animations for new items.

