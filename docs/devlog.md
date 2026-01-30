# Development Log

A chronological record of development sessions and significant changes.

---

## 2026-01-29 - New Posts Divider Feature

**Session Summary:**
- Added "new since you arrived" divider to the news feed
- Explored 4 UX approaches for indicating new posts when live updates are on
- User chose option 4: unread line marker showing where new content begins

**Key Decisions:**
- Used `initialSessionIds` state to capture items present at page load (frozen for session)
- Divider appears between new items and original items, showing count
- Per-tab tracking: switching regions resets the baseline so each tab has its own "arrival" state
- Chose subtle blue gradient line with centered count text - visible but not intrusive

**Notable Changes:**

*src/components/NewsFeed.tsx*
- Added `initialSessionIds` state to track items present when user first loaded page
- Added `newSinceArrivalCount` and `dividerIndex` memos to calculate divider position
- Renders divider line with count before first "old" item when new posts exist
- Reset `initialSessionIds` on tab change so each region gets fresh baseline

**Technical Notes:**
- Divider only renders when `dividerIndex > 0` (has new items) and `newSinceArrivalCount > 0`
- Feed is sorted newest-first, so new items always appear at top, divider marks the boundary
- Styling: `bg-gradient-to-r from-transparent via-blue-400/50 to-transparent` for fade-in effect

---

## 2026-01-29 - Favicon Redesign & RSS Date Fixes

**Session Summary:**
- Redesigned favicon using multi-agent approach (Gemini AI + hand-crafted SVGs)
- Generated 6 favicon options: Compass, Crosshair, Radar, Hexagon, Abstract Eye, EKG Pulse
- Selected Abstract Eye design - geometric "awareness" symbol with editorial weight
- Fixed RSS date parsing bug causing SIPRI/IAEA stories to always appear first
- Blocked broken RSS sources (Telegraph 403, MEMRI TV 404)

**Key Decisions:**
- Chose hand-crafted SVG over AI-generated PNGs for cleaner scaling
- Eye symbol chosen for: no text (rebrand-friendly), editorial weight like Bloomberg/Reuters
- Stroke-based design (not filled) maintains crispness at 16x16
- Installed librsvg via Homebrew for SVG→PNG conversion

**Notable Changes:**

*public/* (Favicon files)
- `favicon.svg` - New abstract eye design (geometric arcs + concentric circles)
- `favicon-16x16.png` - Generated from SVG
- `favicon-32x32.png` - Generated from SVG
- `apple-touch-icon.png` - 180x180 for iOS
- `favicon-192x192.png` - PWA icon
- `favicon-512x512.png` - PWA splash

*src/lib/rss.ts*
- Added CDATA wrapper stripping in `parsePubDate()`
- Added IAEA date format parsing (`YY-MM-DD HH:MM`)
- Fixed timezone abbreviation matching (word boundaries, length-ordered)

*src/lib/blocklist.ts*
- Added Telegraph (HTTP 403 - blocks RSS requests)
- Added MEMRI TV (YouTube 404 - channel removed/changed)

*src/lib/sources-clean.ts*
- Removed Telegraph and MEMRI TV entries

**Technical Notes:**
- SVG favicon uses quadratic bezier curves (`Q`) for smooth eye arcs
- `stroke-linecap="round"` for refined line terminals
- Timezone regex uses `\b` word boundaries to prevent partial matches (WET in WEST)
- IAEA uses non-standard date format `26-01-29 13:30` (YY-MM-DD)

---

## 2026-01-29 - Monetization Analysis

**Session Summary:**
- Conducted legal analysis for monetizing Pulse with a $1/week Pro tier (Opus AI access)
- Evaluated business model options including subscriptions, grants, API licensing, and editorial products
- Documented all findings for future reference

**Key Decisions:**
- Anthropic API commercial use: Low risk (standard SaaS model)
- News aggregation: Medium risk at small scale, higher at scale (fair use + transformative AI summaries help)
- Reddit integration: High risk, recommend dropping or paying for official API before monetizing
- Government data (USGS, NOAA, NASA): Very low risk (public domain)
- Recommended initial stack: Ko-fi tip jar + $5/mo Pro tier + grant applications

**Notable Changes:**

*Files Created:*
- `docs/plans/monetization-legal-analysis.md` - Comprehensive legal risk assessment covering API terms, content aggregation, platform ToS, compliance requirements
- `docs/plans/monetization-business-model.md` - Market comparables, 3 pricing models, 10+ alternative revenue streams, comparison matrix, editorial product ideas

**Technical Notes:**
- Transformative use (AI synthesis) strengthens fair use argument for aggregation
- Journalism grants (Knight, Google News Initiative, Mozilla) are viable funding source given OSINT/public interest angle
- Editorial layer ("Trevor's Takes") increases willingness to pay from ~$4/mo (tool) to ~$12/mo (personality + tool)

---

## 2026-01-29 - Source Discovery & Expansion

**Session Summary:**
- Conducted comprehensive source discovery using 6 parallel research agents
- Analyzed existing 476 sources for gaps (found LATAM underrepresented at 2.3%)
- Searched Bluesky starter packs, Mastodon journalism instances, and competitor aggregators
- Tested 32 potential new sources, verified 29 working
- Added 8 new Bluesky accounts after deduplication analysis against existing RSS/Mastodon feeds

**Key Decisions:**
- Kept RSS versions of news orgs (more reliable) instead of adding duplicate Bluesky feeds
- Skipped 12 accounts that would duplicate existing content (bellingcat, foreignpolicy, etc.)
- Prioritized Middle East coverage as requested, but found most gaps in Europe-Russia OSINT
- Placed very active accounts in T1, less active (bglaser) in T2

**Notable Changes:**

*src/lib/sources-clean.ts*
- Added 8 new Bluesky sources (476 → 484 total)

*New Sources Added:*
| ID | Handle | Region | Type |
|----|--------|--------|------|
| ruth-michaelson | @ruthmichaelson.com | middle-east | reporter |
| vatniksoup | @vatniksoup.bsky.social | europe-russia | osint |
| chriso-wiki | @chriso-wiki.bsky.social | europe-russia | osint |
| shashank-joshi | @shashj.bsky.social | all | analyst |
| michael-colborne | @colborne.bsky.social | europe-russia | reporter |
| militarynewsua | @militarynewsua.bsky.social | europe-russia | news-org |
| occrp | @occrp.org | all | news-org |
| bonnie-glaser | @bglaser.bsky.social | asia | analyst |

*Files Created:*
- `docs/source-discovery-2026-01-29.md` - Full research report with 100+ potential future sources
- `docs/discovered-bluesky-accounts.md` - Network analysis of existing source connections
- `scripts/test-discovered-sources.ts` - Source verification script

**Technical Notes:**
- Bluesky RSS feeds: `https://bsky.app/profile/{handle}/rss`
- Mastodon RSS feeds: `https://{instance}/@{user}.rss`
- Many OSINT accounts (Intel Crab, OSINTtechnical) are stale on Bluesky but active on X

---

## 2026-01-29 - UI Consolidation & Bug Fixes

**Session Summary:**
- Consolidated map UI into a cohesive unit with integrated header, tabs, and status bar
- Stylized Live Wire header to match Global Monitor design language
- Fixed timezone parsing bug in RSS date handling
- Improved spacing and layout throughout the dashboard

**Key Decisions:**
- Moved map view tabs (Main/Seismic/Weather/etc.) into the map header instead of separate bar above
- Connected status bar flush to map bottom using split border-radius technique
- Adopted consistent header pattern: translucent bg, icon left, info/controls right

**Notable Changes:**

*src/lib/rss.ts*
- Fixed timezone abbreviation partial matching bug (WET was matching in WEST)
- Added word boundary regex and ordered longer abbreviations first
- Added IAEA date format parsing (YY-MM-DD HH:MM)

*src/components/WorldMap.tsx*
- Reduced map height (200→140px mobile, 260→180px desktop)
- Added stats bar below map showing post count and largest earthquake

*src/components/NewsFeed.tsx*
- Moved "Live updates" toggle into stats header (was separate section)
- Increased horizontal padding from px-2 to px-3/px-4 for better spacing

*src/components/InlineBriefing.tsx*
- Changed margin from `my-3` to `mt-4 mb-3` for better separation from filter bar

*src/app/HomeClient.tsx*
- Integrated view tabs into map header (title left, tabs right, hide button)
- Map container now `rounded-t-2xl`, status bar `rounded-b-2xl` with `-mt-[1px]`
- Simplified "Show Map" button when collapsed (shows current view name)
- Restyled Live Wire header to match Global Monitor (translucent bg, post count)
- Removed unused `xlDropdownRef`

**Technical Notes:**
- `-mt-[1px]` eliminates hairline gaps between adjacent elements
- `backdrop-blur-sm` with semi-transparent bg creates frosted glass effect
- Word boundary regex `\b` prevents partial matches in timezone parsing

---

## 2026-01-29 - Reply Filtering & Competitive Analysis

**Session Summary:**
- Fixed issue with contextless reply posts appearing in feed (e.g., "log is the least appetizing name" without the Pizza Logs context)
- Added `filter=posts_no_replies` to Bluesky API call - single line fix
- Conducted comprehensive competitive research on news aggregation space
- Created detailed competitive analysis dossier with 10 competitors

**Key Decisions:**
- Chose to filter ALL replies rather than just orphaned ones (no parent context) - cleaner for news dashboard
- Matches existing Mastodon behavior (`exclude_replies=true`)
- Native API filtering is better than client-side heuristics

**Notable Changes:**

*src/lib/rss.ts*
- Line ~1035: Added `&filter=posts_no_replies` to Bluesky `getAuthorFeed` API URL
- This filters replies at the API level, preventing contextless conversation posts

*docs/competitive-analysis.md* (NEW)
- 10 competitors analyzed: Feedly, Inoreader, Ground News, Flipboard, Techmeme, BNO News, LiveUAMap, Recorded Future, Maltego, Meltwater
- Comparison matrix with pricing, features, and differentiators
- Technical details on deduplication algorithms (Feedly's LSH finds 80% of articles are duplicates!)
- Why Artifact failed (Instagram founders' news app - identity crisis, low downloads)
- Positioning map showing where Pulse fits in the landscape
- Actionable opportunities: story clustering, better deduplication, source transparency

**Technical Notes:**
- Bluesky `getAuthorFeed` supports `filter` param: `posts_no_replies`, `posts_with_media`, `posts_and_author_threads`
- Feedly uses Locality Sensitive Hashing (LSH) at 80-85% similarity threshold
- Our current dedup (80-char title prefix) is primitive compared to LSH
- Story clustering (grouping related articles) identified as biggest UX opportunity

**Research Sources:**
- Feedly Engineering: https://feedly.com/engineering/posts/reducing-clustering-latency
- Ground News: https://ground.news/rating-system
- Techmeme 20 years: https://news.techmeme.com/250912/20-years
- Artifact post-mortem: https://techcrunch.com/2024/01/18/why-artifact-from-instagrams-founders-failed-shut-down/

---

## 2026-01-29 - Created Devlog Skill

**Session Summary:**
- Created a new `/devlog` skill for Claude Code
- Skill automatically manages `docs/devlog.md` files across projects
- Set up initial devlog for the news-alert project

**Notable Changes:**
- Added `~/.claude/skills/devlog/SKILL.md` - personal skill that works across all projects
- Skill triggers on `/devlog` command or after significant code changes
- Entry format includes date, summary, and notable technical details

**Files Created:**
- `~/.claude/skills/devlog/SKILL.md` - the skill definition
- `docs/devlog.md` - this file (project-specific log)

---

## 2026-01-29 - AI Summary Redesign

**Session Summary:**
- Completely redesigned the AI Summary component (InlineBriefing) from a card-based design to a full-width header section
- Fixed critical header visibility bug where the sticky filter bar was covering the AI Summary header
- Simplified the visual design to be less "AI feely" per user feedback
- Tested across mobile (375px), tablet (768px), and desktop (1280px) using Playwright

**Key Decisions:**
- Full-width design (no horizontal margins) to visually differentiate from news message cards
- Simple bullet points (•) instead of numbered circles with gradient backgrounds
- Moved InlineBriefing INSIDE the sticky header section rather than below it
- KISS approach: no gradients, no shadows, just clean borders and subtle backgrounds

**Notable Changes:**

*src/components/InlineBriefing.tsx*
- Removed `mx-3 sm:mx-4` margins - now spans full width of container
- Changed from rounded card (`rounded-2xl`) to border-bottom separator (`border-b`)
- Simplified header: lightning icon + "Summary" + model link + cache indicator + Hide button
- Replaced numbered bullets (`<span className="flex items-center justify-center w-5 h-5 rounded-full bg-gradient-to-br...">1</span>`) with simple bullet character (`• `)
- Background: `bg-slate-50 dark:bg-slate-900/50` with `border-slate-200 dark:border-slate-800`

*src/components/NewsFeed.tsx*
- **Critical fix**: Moved `<InlineBriefing>` from line ~725 (inside feed-panel div) to line ~670 (inside sticky header div)
- This ensures the AI Summary stays visible above messages and isn't hidden behind the z-30 sticky filter bar
- Component now renders as part of the sticky section, appearing between filter bar and scrollable feed

**Technical Notes:**
- The bug occurred because InlineBriefing was rendered AFTER the sticky header's closing `</div>`, so when users scrolled, the sticky filter bar (z-index: 30) would overlay the AI Summary header
- Fix was structural: placing the component INSIDE the sticky section means it's part of the same stacking context
- Tested with Playwright's `browser_resize` and `browser_take_screenshot` tools across 3 breakpoints
- Used `localStorage.removeItem('ai-summary-collapsed')` during testing to reset collapsed state

**Design Evolution:**
1. Started: Rounded card with margins, attached below filter bar
2. User feedback: "Too attached to filter bar, should be its own card"
3. Added spacing, rounded corners, gradients
4. User feedback: "Should take full width to differentiate"
5. Made full-width with border-b separator
6. User feedback: "Too AI feely, don't like numbered bullets"
7. Simplified to plain bullets, removed gradients
8. User feedback: "Header is hidden behind sticky bar"
9. Moved inside sticky section - final fix

---

## 2026-01-29 - Logo & Favicon Unification

**Session Summary:**
- Discovered header logo (globe with meridians) didn't match favicon (eye symbol) after earlier favicon redesign
- User rejected both designs - tried Option 4 (P with signal waves) but was too small/looked like "P with a hat"
- Settled on Option 6: Bold white P with cyan pulse/heartbeat line underneath
- Regenerated all favicon PNG sizes and removed redundant ICO file

**Key Decisions:**
- Chose Option 6 over Option 4 for better readability at small sizes
- Bold white P on black background with cyan (#22d3ee) EKG-style pulse line
- Removed `src/app/favicon.ico` - redundant since layout.tsx configures SVG/PNG icons
- Used rsvg-convert (librsvg) for SVG→PNG conversion at all required sizes

**Notable Changes:**

*public/favicon.svg*
- Replaced eye design with bold P + pulse line
- Black background (#0a0a0a), white P, cyan pulse path

*src/app/HomeClient.tsx* (lines 417-432)
- Updated header logo SVG to match new favicon design
- Changed container from gradient bg to solid `bg-black`
- Increased SVG size from `w-5 h-5 sm:w-6 sm:h-6` to `w-6 h-6 sm:w-7 sm:h-7`

*public/* (regenerated PNGs)
- favicon-16x16.png
- favicon-32x32.png
- favicon-192x192.png
- favicon-512x512.png
- apple-touch-icon.png (180x180)

*src/app/favicon.ico*
- Deleted - layout.tsx metadata already serves SVG/PNG versions

**Technical Notes:**
- Pulse line SVG path: `M4 26 L10 26 L12 23 L14 29 L16 24 L18 26 L28 26` (flat→spike→spike→flat)
- Font in SVG: `system-ui, -apple-system, sans-serif` for cross-platform consistency
- rsvg-convert command: `rsvg-convert -w {size} -h {size} favicon.svg -o favicon-{size}x{size}.png`

---

## 2026-01-29 - Hydration Mismatch Fix & useClock Hook

**Session Summary:**
- Diagnosed and fixed React hydration mismatch error caused by live clock displaying different times on server vs client
- Created reusable `useClock` custom hook following React best practices
- Educational session covering SSR hydration, the "You Might Not Need an Effect" article, and when Effects ARE appropriate

**Key Decisions:**
- Extracted clock logic into `src/hooks/useClock.ts` for reusability
- Initialize time as `null` during SSR, set real value only in `useEffect` (client-only)
- Display `"—"` placeholder during hydration to ensure server/client match
- Confirmed this is a valid useEffect use case (synchronizing with external system: browser timer)

**Notable Changes:**

*src/hooks/useClock.ts* (NEW)
- Custom hook returning `Date | null`
- Initializes to `null`, sets time in `useEffect` to avoid hydration mismatch
- Updates every second via `setInterval`
- Accepts optional `intervalMs` parameter (default: 1000)

*src/app/HomeClient.tsx*
- Added import for `useClock` hook
- Replaced inline `useState` + `useEffect` combo with single `const currentTime = useClock()`
- Reduced 8 lines to 1 line in the component

**Technical Notes:**
- Hydration mismatch occurs when `new Date()` runs on server (e.g., 22:45:49) then again on client (22:45:50)
- React compares server HTML to client virtual DOM; any difference forces full re-render
- `useEffect` never runs on server (no DOM), making it the escape hatch for client-only values
- This pattern passes the "You Might Not Need an Effect" test: timer subscriptions ARE valid Effect use cases

**The Pattern:**
```tsx
// Bad: new Date() runs on both server and client
const [time, setTime] = useState(new Date());

// Good: null on both, real value only on client
const [time, setTime] = useState<Date | null>(null);
useEffect(() => { setTime(new Date()); ... }, []);
```

---
