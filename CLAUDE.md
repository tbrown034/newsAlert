# newsAlert

## Overview
A real-time geopolitical and breaking news monitoring dashboard. Provides at-a-glance situational awareness through a feed-first interface with watchpoint filters, source confidence indicators, and activity level indicators.

## Core Concept
"One look" situational awareness for:
- **Constant Watchpoints**: Middle East (Iran priority), Ukraine-Russia, China-Taiwan, Venezuela, US Domestic
- **Emerging Events**: Earthquakes, mass shootings, protests, coups, etc.
- **Activity Indicators**: Color/visual cues showing more or less activity than usual per watchpoint

---

## Project Structure
```
newsAlert/
├── CLAUDE.md              # This file - project context, rules, quick reference
├── docs/
│   ├── planning.md        # Architecture decisions, MVP spec
│   ├── brainstorming.md   # Moat ideas, future features
│   ├── sources.md         # 100+ vetted sources with confidence scores
│   ├── todo.md            # Implementation tasks by phase
│   └── devjournal.md      # Development log (user asked → provided)
└── src/                   # Next.js app (to be created)
```

**Quick Links to Docs**:
- [Planning & MVP Spec](docs/planning.md)
- [Sources Database](docs/sources.md)
- [Todo List](docs/todo.md)
- [Dev Journal](docs/devjournal.md)
- [Brainstorming](docs/brainstorming.md)

---

## Tech Stack (Confirmed)
- **Frontend**: Next.js + React + TypeScript
- **Styling**: Tailwind CSS
- **Icons**: Heroicons ONLY
- **Database**: None for MVP (fetch and display only)
- **AI**: Anthropic Claude API (for future features)
- **Testing**: Chrome extension or Playwright for UI/UX testing
- **Deployment**: Local development first, Vercel later

---

## MVP Decisions (Pre-Build Q&A)

| Question | Decision |
|----------|----------|
| Map vs Feed | **Feed-first** with simple watchpoint graphic/filter |
| Sources | All constants, **Middle East/Iran priority** |
| Environment | **Local dev**, Chrome/Playwright for testing |
| Database | **None** - fetch and display only |
| Confidence scores | **Static from sources.md**, develop ranking system later |
| Sharing | **KISS** - copy to clipboard or native SMS link |
| Git | **Full authority** - commits, branches, all operations |
| Design | **Straight to code**, iterate |

---

## Guiding Principles

### KISS (Keep It Simple, Stupid)
Before implementing anything, ask:
- Are we overengineering this?
- Is there a more modern/standard way?
- What's the simplest thing that works?

### Git Authority
Claude has full git authority for this project:
- Initialize repos
- Make commits (with descriptive messages)
- Create branches
- All standard git operations

### Dev Journal Rule
**After each significant prompt**, update `docs/devjournal.md` with:
- **User Asked**: Brief summary of request
- **Provided**: What was delivered

Significant = feature requests, architecture decisions, major changes, research, debugging.
NOT = typo fixes, clarifications, simple confirmations.

---

## Primary User: Trevor

- **Location**: Bloomington, Indiana
- **Background**: 15+ years investigative journalist → web developer
- **Portfolio**: trevorthewebdeveloper.com
- **Bluesky**: [@trevthewebdev.bsky.social](https://bsky.app/profile/trevthewebdev.bsky.social)
- **Primary concerns**: United States + active war zones/conflicts

### Key Use Case
**"Is the US about to attack Iran?"**
- Warning signs of imminent action?
- What are key reporters/OSINT sources saying?
- What signals are emerging?

---

## User Stories (Summary)

1. **One-look discovery** - See emerging news at a glance
2. **Feel ahead** - Be ahead of normal news consumers
3. **Unusual detection** - Know when something is out of ordinary
4. **Real-time drill-down** - Incremental updates on developing stories
5. **Source confidence** - Help assessing source reliability
6. **Source deep-dive** - Learn more about any source
7. **Text sharing** - Share via SMS/messaging (KISS: copy to clipboard)
8. **Delight & intuition** - Mobile-first, tabs, NOT AI-generated looking

*Full stories in docs/planning.md*

---

## Design Requirements (Quick Reference)

### Must Have
- **Mobile-first** (375px → up)
- **Dark mode** - Blue-gray backgrounds (#1a1d29 range)
- **Heroicons ONLY** - No other icon libraries
- **Tab-based navigation**
- **NOT AI-generated looking**

### Colors
- **Blue** (blue-500/600) - Primary actions, links
- **Yellow/Amber** - Alerts, emphasis, "new"
- **Teal/Green** - Positive states, confirmations
- **Red/Orange** - Warnings, high activity

### Style
- Rounded corners (rounded-lg/xl)
- Card-based layouts
- Clean typography, bold headlines
- Generous whitespace

*Full design spec in docs/planning.md*

---

## Information Cascade (How News Breaks)

```
SPEED → CONFIDENCE

1. GROUND (seconds)        → Low confidence, high noise
2. OSINT (seconds-minutes) → Medium confidence
3. REPORTERS (minutes-hours) → High confidence
4. OFFICIAL (hours)        → Highest confidence
```

The feed should show:
- Source tier badge
- Verification status
- Activity level vs baseline

---

## Watchpoints

| Region | Priority | Color Indicator |
|--------|----------|-----------------|
| Middle East (Iran) | #1 | 🔴 Red when hot |
| Ukraine-Russia | #2 | Activity-based |
| China-Taiwan | #3 | Activity-based |
| Venezuela | #4 | Activity-based |
| US Domestic | #5 | Activity-based |

---

## API Notes

### Bluesky
- **Account**: trevthewebdev.bsky.social (can use authenticated API)
- **RSS**: Any profile has RSS at `bsky.app/profile/[handle]/rss`
- **Free API** with good rate limits

### No Twitter/X
- Too expensive ($5k+/month)
- Use Bluesky + RSS + manual curation instead

### Free Sources
- RSS feeds (Reuters, BBC, Al Jazeera)
- USGS Earthquake API
- Bluesky API
- GDELT (complex but free)

*Full source list in docs/sources.md*
