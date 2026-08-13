# Resolving the round-one UI review comments

**Date:** 2026-08-13
**Scope:** frontend only. No backend, database or API changes.

Six comments came back from the review:

1. Low sensory and high sensory was confusing
2. Website should be interactive
3. Remove Login
4. Get rid of unnecessary icons
5. Footer is too big, reduce it
6. Font/colour not visible

This document says what each one means in the code, and what we are changing. Two of them
turn out to be the same bug seen from different angles: the sensory badge is both the
confusing label *and* one of the contrast failures.

## Guiding constraint

HushWay is a product for sensory-sensitive and neurodivergent travellers. An accessibility
tool that fails WCAG contrast, or that shows controls which do nothing, undermines its own
claim. Where a comment could be resolved either by decorating the problem or removing it,
we remove it.

---

## 1. Low sensory and high sensory was confusing

### What is actually wrong

The route card renders a badge reading `Low Sensory` or `High Sensory`, and directly above
it the search panel offers a crowd preference of `Low` / `Mid` / `High`. **The word "Low"
appears twice on one screen carrying opposite meanings**: as a preference it means *I want
strictness*, as a badge it means *this route is good*. Nothing on screen distinguishes
them.

Compounding it, the supporting line reads `Peak 334 people/hr`. That number is unanchored —
a first-time viewer has no idea whether 334 is good or bad, and the threshold it is being
compared against (250 / 500 / 1000) is never shown anywhere.

### Decision

Keep the names `Low Sensory` and `High Sensory`. Explain them. Three changes:

**a. An info affordance on the badge.** A small `?` button beside the badge, rendered as a
new `InfoTip` component sitting next to `SensoryBadge`. It opens on hover, on focus and on
click (so it works for touch and keyboard), dismisses on `Escape` and on blur, and is wired
with `aria-describedby` so screen readers get the text without the popover. Copy, with the
threshold interpolated live from `useSensitivity` so it always names the user's real
setting rather than a hardcoded number:

| Level | Text |
| --- | --- |
| `low` | "At its busiest, this route stays below the crowd level you chose ({threshold} people/hr)." |
| `high` | "At its busiest, this route is at or above the crowd level you chose ({threshold} people/hr)." |
| `unavailable` | "Fewer than half of this route's streets have a pedestrian sensor, so we won't guess." |

**b. Anchor the peak figure.** `RouteCard` changes its detail line from

```
Peak 334 people/hr
```

to

```
334 people/hr at its busiest — under your 500 limit
```

(`over your 500 limit` for high). This is the single largest clarity gain in the whole
document and costs one template string. The comparison that the badge encodes silently
becomes literal text.

**c. Put the number on the preference pills.** The heading `CROWD DENSITY PREFERENCE`
becomes `HOW BUSY IS TOO BUSY?`, and each pill carries its threshold: `Low 250/hr`,
`Mid 500/hr`, `High 1000/hr`. The names stay as the reviewer's chosen option requires, but
the number breaks the collision — `Low 250/hr` and `Low Sensory` can no longer be read as
the same idea.

### Files

`components/SensoryBadge.tsx`, `SensoryBadge.css`, a new `components/InfoTip.tsx` +
`InfoTip.css`, `components/RouteCard.tsx`, `components/SearchPanel.tsx`,
`SearchPanel.css`, `hooks/useSensitivity.ts` (export the numeric threshold and a display
label alongside the existing density).

---

## 2. Website should be interactive

The reviewer did not say which sense of "interactive" they meant, so we address all three
readings. They are independent and can ship separately.

### 2a. Controls that do nothing

`SearchPanel` currently renders controls with no handler attached:

| Control | Current state |
| --- | --- |
| Back arrow | `<button>` with no `onClick` |
| Bookmark | `<button>` with no `onClick` |
| Drive / Transit / Accessible | Sets local `mode` state that nothing reads |

The back arrow and bookmark are deleted outright — there is no history to return to from
the panel, and there is nothing to bookmark to.

The travel-mode row is deleted too, and replaced with a static `Walking` label. The
routing graph is built from pedestrian sensors and the planner only produces walking
routes; Drive, Transit and Accessible cannot be made to work without a different graph.
Rendering them disabled would still leave three controls on screen that do nothing, which
is the complaint. If travel modes return later they should return with a backend behind
them.

### 2b. The home page is static

`pages/Home.tsx` is a hero image, two buttons and a footer. Below the hero we add:

- **A "How it works" strip** — three steps (choose your two points → tell us how much
  crowding you can take → compare the calm route against the fast one), each with a short
  line of copy.
- **Three entry cards** — *Plan a calm route* → `/explore`, *Find a quiet place* →
  `/quietplace`, *What the badges mean* → `/resources`.
- **Scroll reveal** on both, via `IntersectionObserver`, wrapped in the existing
  `prefers-reduced-motion` guard in `tokens.css`. On a reduced-motion setting the content
  is simply present, never hidden.

No new API endpoints, and no re-implementation of the `/explore` planner on the home page.

### 2c. The map and the route cards ignore each other

Today `RouteCompare` renders `RouteCard`s in the sidebar and `MapView` draws polylines, and
neither knows the other exists. The only way to tell which line is which is to click a line
and read the popup.

We lift a `selectedRouteId: string | null` into `RouteCompare` and thread it down:

- Selecting a card (click, or keyboard focus) raises its polyline to `weight: 8` and drops
  the other to `opacity: 0.35`, and fits the map bounds to the selected path.
- Clicking a polyline selects the matching card and scrolls it into view.
- The selected card takes a visible selected state — a border, not colour alone.

`react-leaflet`'s `Polyline` accepts `eventHandlers` and re-renders on `pathOptions`
changes, so this needs no new dependency. Map bounds fitting uses the `useMap` hook from a
small child component inside `MapContainer`.

### Files

`components/SearchPanel.tsx` + `.css`, `pages/Home.tsx` + `Home.css`,
`pages/RouteCompare.tsx`, `components/RouteCard.tsx` + `.css`, `components/MapView.tsx` +
`.css`.

---

## 3. Remove Login

Removed entirely, not hidden. Nothing authenticates today — `SignUp` writes a user object
to `localStorage` and `SignIn` compares against it in plain text, which is worse than no
auth at all if anyone mistakes it for real.

Delete:

- `pages/SignIn.tsx`, `pages/SignIn.css`, `pages/SignUp.tsx`, `pages/SignUp.css`
- the `/signin` and `/register` routes and their imports in `router.tsx`
- the entire `hw-header__auth` block in `Header.tsx`, including `showUserMenu`,
  `isLoggedIn`, `handleSignOut`, the `StoredUser` interface, and every
  `hushwayLoggedIn` / `hushwayUser` `localStorage` call
- the corresponding `.hw-header__auth`, `__btn`, `__user`, `__username`, `__arrow`,
  `__dropdown`, `__signout` rules in `Header.css`, including their responsive variants

The header grid goes from `1fr auto 1fr` to a two-column layout — brand left, nav right —
so the removal does not leave a gap where the button was.

The README line "Sign-in and registration are presentational only — there is no
authentication yet" is removed with the feature.

---

## 4. Get rid of unnecessary icons

An icon earns its place if it carries meaning that the adjacent text does not. Audit:

| Icon | Where | Decision |
| --- | --- | --- |
| Back arrow, Bookmark | `SearchPanel` | **Delete** — no handler, decoration that looks clickable (§2a) |
| Car, Bus, Footprints, Accessibility | `SearchPanel` | **Delete** with the travel-mode row (§2a) |
| `Cloud` + `15°` | `RouteCompare`, `RefugeMap` | **Delete.** Reads from `mockData.ts` — fabricated weather presented as live data. This is a correctness problem, not a clutter problem |
| `User` / `Users` / `Users` | `SearchPanel` density pills | **Delete.** `Mid` and `High` use the *same* `Users` glyph, so the icon actively fails to distinguish the options it decorates. The pills carry a label and now a number |
| X, Instagram, YouTube, LinkedIn | `Footer` | **Delete** — all `href="#"`, no accounts exist (§5) |
| `AlertTriangle` | `WarningBanner` | **Keep** — standard warning semantics |
| `MapPin`, `Navigation`, `Phone` | `SanctuaryCard` | **Keep** — each maps to a distinct action |
| `Flower2` | `Header`, `Footer` | **Keep** — brand mark (see §6 for its colour) |

The local `XIcon` SVG component in `Footer.tsx` is deleted with the socials.

---

## 5. Footer is too big, reduce it

Current: four columns, 25 links, **every single one `href="#"`**, roughly 400px tall on
desktop. It is the largest thing on the home page and none of it goes anywhere.

Replacement: one row, roughly 110px.

```
HushWay          Explore · QuietPlace · Resources · Contact
                 © 2026 HushWay. Built for Monash FIT5120 Studio
```

The four links are real `NavLink`s to routes that exist. The `columns` array and the
`XIcon` component are deleted from `Footer.tsx`; `Footer.css` collapses from a four-column
grid to a flex row that wraps to two lines under 560px.

Dead links are worse than absent ones here: a footer promising an Accessibility Statement
and a Privacy Policy that both resolve to `#` is a specific liability for this product.
Those links come back when the pages do.

---

## 6. Font/colour not visible

### The route card renders with no styling at all

Found while planning, and it is almost certainly what the comment is about.

`RouteCard.tsx` renders `route-card`, `route-card__head`, `route-card__title`,
`route-card__flag`, `route-card__meta` and `route-card__detail`. `RouteCard.css` defines
`.rc`, `.rc--quiet`, `.rc--fast`, `.rc__tag`, `.rc__header`, `.rc__title`, `.rc__meta`,
`.rc__duration`, `.rc__submeta`, `.rc__desc` and `.rc__btn`.

**The two sets do not intersect.** A sweep of all 226 rendered class names against all 247
CSS selectors in the frontend returns exactly one component whose classes are entirely
undefined, and it is this one. The route cards — the primary output of the entire product —
render as unstyled default text on the page background: no card, no padding, no green/red
colour coding, no visual separation between the quiet route and the fast one.

This also means the whole route-card colour system is dead code:

| Token | Reachable? |
| --- | --- |
| `--quiet-bg`, `--fast-bg`, `--fast-ink`, `--fast-btn` | No — only referenced under dead `.rc*` selectors |
| `--fast-tint` | No — zero references anywhere |
| `--quiet-ink`, `--quiet-btn` | Partly — also used by `SanctuaryCard.css`, which works |

The fix is to rewrite `RouteCard.css` against the class names the component actually
renders, restoring the quiet/fast colour coding from the existing tokens. We do **not**
resurrect the `.rc__btn`, `.rc__desc` and `.rc__tag` rules — those style elements the
current component does not render, and reinstating them would mean inventing UI the spec
does not call for. Rules for elements that no longer exist are deleted with the rename.

The contrast of the restored card colours must be verified as part of §6's audit, since
these pairings have never actually been on screen. `--quiet-ink #294F35` on `--quiet-bg
#DDEDDF` and `--fast-ink #831C2E` on `--fast-bg #FBDFE3` are both measured in the
implementation plan's first task and adjusted if they fall short.

### Measured contrast

Measured with the WCAG 2.1 relative-luminance formula. Current state:

| Element | Ratio | Needs | Result |
| --- | --- | --- | --- |
| Wordmark `#F4C900` on the white header | **1.59:1** | 4.5 | **fail** |
| Wordmark `#F4C900` on `--bg` | **1.54:1** | 4.5 | **fail** |
| Sensory badge, low: `#2f8f5b` on its tint | **3.72:1** | 4.5 | **fail** |
| Sensory badge, unavailable: `#6b6b6b` on its tint | **4.41:1** | 4.5 | **fail** |
| Quiet route polyline `#5EE39C` on a light map tile | **1.37:1** | 3.0 | **fail** |
| `--mute-2 #9AA39F` on `--bg` | **2.50:1** | 3.0 | fail (decorative only, see below) |
| Sensory badge, high: `#c22a2a` on its tint | 4.60:1 | 4.5 | marginal pass |
| `--mute #6A7370` on `--bg` | 4.71:1 | 4.5 | marginal pass |
| `--ink #1F2A26` on `--bg` | 14.30:1 | 4.5 | pass |
| Nav link `#26362F` on white | 12.72:1 | 4.5 | pass |
| Active pill `#27332E` on `#FFD21F` | 9.06:1 | 4.5 | pass |

The yellow wordmark at **1.59:1** is the worst failure and it is on every page. It is most
visible on `/community`, where gold sits on plain white.

### Fixes

**Wordmark.** The text goes to `--ink`. The flower mark keeps brand yellow by inverting it
onto a chip — a yellow rounded square with the glyph knocked out in `--ink` — so the brand
colour stays prominent at full saturation while the thing you have to *read* passes. (A
logotype is technically exempt under WCAG 1.4.3, but "technically exempt" and "legible" are
different goals, and this is an accessibility product.)

**Home hero nav.** White nav links currently sit on a bright photograph held together only
by a `text-shadow`. Add a scrim: `linear-gradient(rgba(20,32,28,.55), transparent)` behind
the header band on the overlay variant. Verify white text reaches 4.5:1 against the
*darkest* pixel of the scrimmed photo beneath the nav, not the average.

**Token and component replacements**, all verified:

| Token / rule | From | To | New ratio |
| --- | --- | --- | --- |
| `.sensory-badge--low` colour | `#2f8f5b` | `#1E6B40` | 5.98:1 |
| `.sensory-badge--unavailable` colour | `#6b6b6b` | `#595959` | 5.79:1 |
| `.sensory-badge--high` colour | `#c22a2a` | `#A81F32` | 5.78:1 |
| `MapView` quiet polyline | `#5EE39C` | `#1E8A54` | 3.69:1 |
| `--mute-2` | `#9AA39F` | `#7A837F` | 3.77:1 |

`--mute-2` is currently used in exactly one place — the `aria-hidden` dashed rail in
`SearchPanel` — so it is decorative and exempt today. We raise it anyway so the token is
safe the next time someone reaches for it.

### Audit

After the fixes above, walk every route (`/`, `/explore`, `/quietplace`, `/community`,
`/resources`, `/contact`) and check remaining text and non-text UI. Record the measured
ratio for each element in a table appended to this document. Acceptance: body text ≥ 4.5:1,
large text (≥ 24px, or ≥ 19px bold) ≥ 3:1, non-text UI and focus indicators ≥ 3:1.

One colour is left sitting close to the line: `--mute` at 4.71:1, used for secondary body
text across the site. We are not changing it — it passes — but any future darkening of a
background pushes it under, so it is recorded here as known-tight rather than left to be
rediscovered.

---

## Out of scope

- Any backend, database, API or routing-graph change.
- Rebuilding `/community`, `/resources` and `/contact`, which still render from
  `src/mockData.ts`. We fix their contrast and their header and footer; their content is
  EPIC-2 work.
- Restoring travel modes, bookmarks or authentication. Each returns when it has something
  real behind it.

## Verification

- `cd frontend && npx tsc --noEmit` — clean.
- `cd frontend && npm run build` — succeeds.
- `cd backend && python -m pytest` — unchanged, still passing. No backend files are touched
  in this work, so a regression here means something went wrong.
- Every contrast figure in §6 recomputed against the shipped CSS, not against this
  document.
- Manual keyboard pass: tab through `/explore` and confirm the info tip opens on focus,
  closes on `Escape`, and that route selection is reachable without a mouse.
