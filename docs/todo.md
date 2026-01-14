# newsAlert - Todo List

> **Status**: Tech stack confirmed. Ready to begin implementation.

---

## Completed ✓

### Research Phase
- [x] Define MVP scope (Iran situational awareness)
- [x] Document information cascade model
- [x] Research comparable tools (Liveuamap, ACLED, etc.)
- [x] Curate sources list (100+ sources in sources.md)
- [x] Organize Iran sources by tier (Official → Reporter → OSINT → Ground)
- [x] Research Bluesky OSINT community (30+ accounts, 10 starter packs)
- [x] Analyze user's X following list for key accounts
- [x] Document moat/differentiation ideas (brainstorming.md)
- [x] Answer key planning questions (personal use, Iran first, no X API)
- [x] Document user stories (8 stories captured)
- [x] Review Trevor's design aesthetic (portfolio + projects)
- [x] Document design requirements (mobile-first, Heroicons, dark mode)

### Tech Stack (Confirmed ✓)
- [x] Frontend: Next.js + React + TypeScript
- [x] Styling: Tailwind CSS
- [x] Icons: Heroicons ONLY
- [x] Database: PostgreSQL (Neon or Prisma)
- [x] AI: Anthropic Claude API
- [x] Deployment: Vercel

---

## Backlog

### Phase 1 - MVP Core (User Stories 1, 2, 5, 8)
**Goal**: One-look discovery with source confidence

- [ ] Initialize Next.js project with TypeScript + Tailwind
- [ ] Set up Heroicons
- [ ] Create mobile-first layout with tab navigation
- [ ] Implement dark mode theme (blue-gray palette)
- [ ] Build homepage "at a glance" dashboard
- [ ] Implement map view (Iran/Middle East centered)
- [ ] Build RSS feed aggregator (Reuters, BBC, Al Jazeera)
- [ ] Implement Bluesky API integration
- [ ] Create tiered feed display with source badges
- [ ] Add confidence indicators (visual scoring)
- [ ] Add verification status badges
- [ ] Build basic severity color coding

### Phase 2 - Enhanced Features (User Stories 3, 4, 6)
**Goal**: Drill-down, unusual detection, source profiles

- [ ] Build source profile pages
- [ ] Add "Who reported first?" cascade timeline
- [ ] Implement "unusual" detection (baseline comparison)
- [ ] Create story detail view with incremental updates
- [ ] Integrate USGS earthquake overlay
- [ ] Add Reddit r/CredibleDefense integration
- [ ] Implement auto-refresh
- [ ] Build threat score display
- [ ] Add tier filtering

### Phase 3 - Sharing & Polish (User Story 7)
**Goal**: Text sharing, additional regions

- [ ] Implement "Share via text" feature
- [ ] Add additional watchpoints (Ukraine, Taiwan, Venezuela)
- [ ] Build notification system
- [ ] Add trend arrows
- [ ] Build "What Did I Miss?" feature

---

## Design Checklist
- [ ] Mobile-first (375px → up)
- [ ] Dark mode default
- [ ] Heroicons only
- [ ] Tab-based navigation
- [ ] Card-based layouts
- [ ] Rounded corners (rounded-lg/xl)
- [ ] Blue accent color
- [ ] Yellow/amber for alerts
- [ ] NOT AI-generated looking

---

*Last updated: January 2025*
