# Typography & Visual Cohesion Design System

**Project:** Pulse (news-alert)
**Date:** 2026-01-29
**Status:** Approved for implementation

---

## Design Goals

1. **Distinct brand identity** — Pulse should be instantly recognizable as a serious intelligence dashboard with editorial credibility
2. **Readability-first, mobile-first** — Designed for mobile, enhanced for tablet/desktop
3. **Semantic color usage** — Color conveys meaning, not decoration
4. **Visual breathing room** — Strategic spacing to reduce noise and aid scanning

---

## Typography System

### Font Pairing

| Role | Font | Character |
|------|------|-----------|
| **Headlines** | Source Serif 4 | Editorial authority, journalistic credibility |
| **UI/Body** | Geist | Clean, technical, highly readable |
| **Mono** | Geist Mono | Code, technical data |

**Brand signature:** Source Serif headlines with tight letter-spacing = Pulse's distinctive look.

### Type Scale (Mobile-First)

| Token | Mobile | Desktop | Line Height | Use Case |
|-------|--------|---------|-------------|----------|
| `--text-display` | 24px | 30px | 1.2 | Section headers (Live Wire, Seismic) |
| `--text-title` | 17px | 19px | 1.3 | News item headlines |
| `--text-body` | 15px | 16px | 1.5 | Content, summaries, descriptions |
| `--text-label` | 13px | 14px | 1.4 | Source names, tab labels |
| `--text-caption` | 12px | 12px | 1.4 | Timestamps, post counts |
| `--text-micro` | 11px | 11px | 1.3 | Badges, compact metadata |

**Minimum size:** 11px (no more 10px text straining eyes)

### Letter Spacing

| Context | Value | Rationale |
|---------|-------|-----------|
| Headlines (serif) | `-0.01em` | Tighter for editorial feel |
| Body text | `0` | Default for readability |
| Small text (caption/micro) | `0.01em` | Slightly open aids legibility |
| Uppercase labels | `0.08em` | Standard for caps |

---

## Weight & Color Hierarchy

### Three-Tier System

| Tier | Purpose | Font | Weight | Color Token |
|------|---------|------|--------|-------------|
| **Primary** | What you read | Source Serif 4 | 600 (semibold) | `--foreground` |
| **Secondary** | Context | Geist | 500 (medium) | `--foreground-muted` |
| **Tertiary** | Metadata | Geist | 400 (regular) | `--foreground-light` |

### Color Tokens

#### Light Mode
```css
--background: #f8f9fa;           /* Warm off-white */
--background-secondary: #f1f3f5; /* Subtle contrast */
--background-card: #ffffff;      /* Pure white cards */
--foreground: #1a1a2e;           /* Near-black, warm */
--foreground-muted: #495057;     /* Medium gray */
--foreground-light: #868e96;     /* Light gray */
--border: #dee2e6;               /* Subtle borders */
--border-light: #e9ecef;         /* Very subtle */
```

#### Dark Mode
```css
--background: #000000;           /* True black */
--background-secondary: #111111; /* Subtle lift */
--background-card: #161616;      /* Card surface */
--foreground: #f1f3f5;           /* Off-white, easy on eyes */
--foreground-muted: #adb5bd;     /* Medium gray */
--foreground-light: #6c757d;     /* Muted gray */
--border: #2a2a2a;               /* Subtle borders */
--border-light: #1f1f1f;         /* Very subtle */
```

### Semantic Colors (Only These)

| State | Light Mode | Dark Mode | Use Case |
|-------|------------|-----------|----------|
| **Critical** | `#dc2626` | `#ef4444` | Breaking news, critical alerts |
| **Elevated** | `#ea580c` | `#f97316` | Warnings, activity surges |
| **Success** | `#059669` | `#10b981` | Resolved, confirmed |
| **Info** | `#6c757d` | `#9ca3af` | Neutral information |

**No decorative accent colors.** Blue is removed from buttons/links. UI elements use neutral grays.

---

## Spacing System

### Scale (8px Base Unit)

| Token | Value | Use Case |
|-------|-------|----------|
| `--space-xs` | 4px | Inside badges, tight groupings |
| `--space-sm` | 8px | Between related items (icon + label) |
| `--space-md` | 12px | Card internal padding (mobile) |
| `--space-lg` | 16px | Card internal padding (desktop), between cards |
| `--space-xl` | 24px | Between sections |
| `--space-2xl` | 32px | Major section breaks |

### Section Breaks

Major sections (Map → Live Wire → Briefing) use:
- `32px` gap above section header
- Section label in Source Serif, uppercase, letter-spaced
- `16px` gap below header before content

```
┌─────────────────────────────┐
│         MAP SECTION         │
└─────────────────────────────┘
              ↓ 32px
┌─────────────────────────────┐
│  LIVE WIRE                  │  ← Section label
└─────────────────────────────┘
              ↓ 16px
┌─────────────────────────────┐
│      Feed items...          │
└─────────────────────────────┘
```

---

## Component Patterns

### Section Labels

```css
.section-label {
  font-family: var(--font-serif);
  font-size: 13px;
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--foreground-muted);
}
```

### News Card

```
┌────────────────────────────────────┐
│ [Source] · [Region Badge] · [Time] │  ← Tertiary (caption size)
│                                    │
│ Headline text in Source Serif      │  ← Primary (title size)
│ that can wrap to multiple lines    │
│                                    │
│ Body preview text in Geist that    │  ← Secondary (body size)
│ provides context...                │
└────────────────────────────────────┘
```

- Card padding: `12px` mobile, `16px` desktop
- Internal gap: `8px` between elements
- Border radius: `12px`
- Border: `1px solid var(--border-light)`

### Badges

```css
.badge {
  font-size: 11px;
  font-weight: 500;
  padding: 2px 8px;
  border-radius: 4px;
  letter-spacing: 0.01em;
}
```

Region badges use muted background tints, not bright colors.

### Buttons & Interactive Elements

- **Default:** Neutral gray background, medium weight text
- **Hover:** Slightly darker/lighter background
- **Active states:** Border highlight, not color fill
- **No blue accent** — interaction feedback through subtle contrast shifts

---

## Responsive Breakpoints

| Breakpoint | Width | Adjustments |
|------------|-------|-------------|
| **Mobile** | < 640px | Base sizes, tighter padding |
| **Tablet** | 640-1024px | +1px text sizes, standard padding |
| **Desktop** | > 1024px | Full scale, generous padding |

Typography scales smoothly via CSS clamp() where appropriate.

---

## Implementation Checklist

1. [ ] Update CSS custom properties in `globals.css`
2. [ ] Create utility classes for type scale
3. [ ] Update NewsCard with new hierarchy
4. [ ] Update NewsFeed section headers and spacing
5. [ ] Update InlineBriefing typography
6. [ ] Update EditorialCard for consistency
7. [ ] Audit and fix dark mode contrast
8. [ ] Audit and fix light mode contrast
9. [ ] Test across mobile/tablet/desktop
10. [ ] Visual review and iteration

---

## Success Criteria

- [ ] Headlines immediately stand out (Source Serif, proper size)
- [ ] Clear visual hierarchy without relying on color
- [ ] Map-to-feed transition feels clean, not cluttered
- [ ] Dark mode feels polished and professional
- [ ] Light mode equally refined
- [ ] Consistent look across all components
- [ ] Mobile experience is comfortable, not cramped
- [ ] Brand identity is distinct and recognizable
