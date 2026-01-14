# newsAlert - Development Journal

> **Purpose**: Log of significant prompts, decisions, and progress throughout development.

---

## Session 1 - January 2025

### Entry 1: Project Initialization
**User Asked**: Create a CLAUDE.md file for the project.

**Provided**: Created initial CLAUDE.md with project structure template.

---

### Entry 2: Core Concept & Planning
**User Asked**: Detailed vision for newsAlert - a real-time OSINT dashboard with:
- Globe/map visualization with volume/severity dots
- Constant watchpoints (Iran, Ukraine, Taiwan, Venezuela)
- Emerging breaking news detection
- Tiered notification levels
- Multi-source strategy (X, Bluesky, Telegram, Reddit, RSS)
- AI-assisted threat scoring
- Requested "ultrathink" analysis, comparable tools, questions, and creation of planning.md + todo.md

**Provided**:
- Comprehensive CLAUDE.md with project context
- planning.md with:
  - Comparable tools analysis (Liveuamap, ACLED, GDELT, Janes)
  - Gap analysis
  - Twitter/X API cost reality check ($5k+/month)
  - Technical architecture options (Simple vs Real-time)
  - Threat scoring algorithm design
  - MVP specification
  - Risk register
  - 12 questions to answer
- Empty todo.md awaiting plan approval

---

### Entry 3: Brainstorming & Sources Research
**User Asked**: Create brainstorming.md with ambitious moat ideas, then sources.md with curated sources for main flashpoints. Use websearch liberally. Include link, why selected, posting frequency, confidence level (1-100).

**Provided**:
- brainstorming.md with 23 moat ideas including:
  - "Verified First" system
  - Prediction market integration
  - Information asymmetry detection
  - Time Machine view
  - Counter-narrative detection
  - AI-powered features
  - Priority matrix
- sources.md with 100+ vetted sources across:
  - Iran/Middle East
  - Ukraine-Russia
  - China-Taiwan
  - Venezuela
  - Global/cross-cutting
  - Each with confidence scores, posting frequency, platform

---

### Entry 4: Bluesky Deep Dive
**User Asked**: Do another research run focused on Bluesky sources.

**Provided**:
- Expanded Bluesky section with 30+ accounts
- 10 starter packs for OSINT community
- Native RSS support documentation (profile.bsky.social/rss)

---

### Entry 5: Personal X Following Analysis
**User Asked**: Shared their X account (@opensecwatcher) for source analysis.

**Provided**:
- Used Chrome browser to navigate to X following list
- Extracted key accounts from their curated follows:
  - Venezuela journalists
  - Energy/oil analysts (Amena Bakr, Tracy Shuchart, TankerTrackers)
  - Ukraine/Russia experts (Rob Lee, Michael Kofman)
  - Pentagon reporters (Natasha Bertrand, Dan Lamothe)
- Incorporated into sources.md

---

### Entry 6: Information Cascade Insight
**User Asked**: Clarified this is primarily personal. Key use case: "Is the US about to attack Iran?" Described the information cascade they've observed (Ground → OSINT → Reporters → Official).

**Provided**:
- Reorganized Iran section in sources.md by cascade tiers:
  - 🔴 TIER 1: Official Alerts (IDF, Pentagon, State Dept)
  - 🟠 TIER 2: Key Reporters (Natasha Bertrand, Barak Ravid)
  - 🟡 TIER 3: OSINT Accounts (OSINTdefender, Aurora Intel)
  - 🟢 TIER 4: Iran Specialists (Farzin Nadimi, Jason Brodsky)
  - 🔵 TIER 5: Opposition & Ground (Iran International, NCRI)
- Updated CLAUDE.md with cascade model documentation

---

### Entry 7: Project-Wide Review
**User Asked**: Do a recursive project-wide review to ensure all .md files reflect current thinking.

**Provided**:
- Updated planning.md:
  - Questions marked as answered
  - MVP spec revised with cascade-based design
  - Research completed section added
  - Status updated to "PLANNING COMPLETE"
- Updated CLAUDE.md:
  - Project structure includes all files
  - Notes for Claude updated with current state
- Updated brainstorming.md:
  - Added Core Design Insight section
  - MVP Moat Features Selected
- Updated todo.md:
  - Research phase marked complete
  - Phased backlog created

---

### Entry 8: User Stories & Design Requirements
**User Asked**: Provided 8 detailed user stories from journalist perspective:
1. One-look discovery for emerging breaking news
2. Drill down into stories with real-time updates
3. Confidence level assessment
4. Feel ahead of normal news consumers
5. Expect noise/rumors, want help with confidence
6. Unusual/unexpected detection (not every earthquake)
7. Share via text message
8. UI/UX delight - mobile-first, tabs, NOT AI-generated looking

Also shared:
- Lives in Bloomington, IN
- Portfolio: trevorthewebdeveloper.com
- Heroicons only requirement
- Mobile-first design requirement

**Provided**:
- Visited trevorthewebdeveloper.com via Chrome
- Analyzed design aesthetic from portfolio + ReflectYr + Food Xpiry
- Updated CLAUDE.md with:
  - User stories section (all 8 documented)
  - Design requirements (mobile-first, dark mode, Heroicons, colors)
  - Personal context (location, background)
- Updated planning.md with:
  - Tech stack confirmed
  - User story alignment table in MVP spec
  - Mobile-first added to requirements
- Updated todo.md with:
  - Tech stack confirmed section
  - Implementation phases aligned to user stories
  - Design checklist

**Tech Stack Confirmed**:
- Next.js + React + TypeScript
- Tailwind CSS
- Heroicons ONLY
- PostgreSQL (Neon)
- Anthropic Claude API
- Vercel deployment

---

### Entry 9: Dev Journal Creation
**User Asked**: Create devjournal.md and add rule to CLAUDE.md to update it after significant prompts.

**Provided**:
- This devjournal.md file
- Rule added to CLAUDE.md

---

### Entry 10: Pre-Build Q&A
**User Asked**: "Before we start building, what questions do you have for me?"

**Questions Asked**:
1. Map vs Feed - which is primary?
2. Which specific sources first?
3. Local dev or deploy immediately?
4. Database needed for MVP?
5. Confidence scores - how should they work?
6. "Share via text" - what does this mean?
7. Git repo?
8. Bluesky account?
9. Design mockups first?

**User Answered**:
1. **Feed-first** with simple watchpoint graphic/filter showing activity indicators
2. **All constants**, Middle East/Iran priority
3. **Local dev**, use Chrome extension or Playwright for testing
4. **No DB** - just fetch and display
5. **Static from sources.md**, develop ranking system later
6. **KISS** - whatever is easy (copy to clipboard or native SMS)
7. **Yes, full git authority** including commits
8. **Yes**: trevthewebdev.bsky.social
9. **Straight to code**, iterate

---

### Entry 11: Documentation Reorganization
**User Asked**: After updating docs, should we put them in a folder? Does CLAUDE.md have appropriate pointers?

**Provided**:
- Created `/docs` folder
- Moved planning.md, brainstorming.md, sources.md, todo.md, devjournal.md to `/docs`
- Rewrote CLAUDE.md with:
  - Updated project structure
  - Quick links to all docs
  - MVP decisions table
  - KISS principle
  - Git authority note
  - Bluesky account info
  - Streamlined design requirements
  - Watchpoints table
- Initialized git repository with first commit

---

## Status
**Current Phase**: Build Phase 1
**Next Action**: Initialize Next.js project

---

*Last updated: January 2025*
