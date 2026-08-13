# Round-One UI Review Fixes — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Resolve the six round-one review comments on the HushWay frontend, plus the unstyled-route-card defect found while planning them.

**Architecture:** Frontend-only. Colour decisions move into `tokens.css` as semantic tokens so a single automated test can assert every contrast requirement against the real stylesheet. Interactive behaviour (info tip, route selection) is covered by component tests. Nothing in `backend/`, `db/` or `scripts/` changes except one dependency check in `dev.sh`.

**Tech Stack:** React 18.3, TypeScript 5.9 (strict), Vite 5.4, react-leaflet 4.2, react-router-dom 6.30, lucide-react. Tests added in this plan: Vitest 2.x + @testing-library/react + jsdom.

**Spec:** `docs/2026-08-13-ui-feedback-design.md`

## Global Constraints

- **Frontend only.** No file under `backend/`, `db/` or `scripts/clean_data/` is modified. `scripts/dev.sh` gets one dependency-check change in Task 13 and nothing else.
- **Contrast floors, from the spec:** body text ≥ 4.5:1, large text (≥ 24px, or ≥ 19px bold) ≥ 3:1, non-text UI and focus indicators ≥ 3:1.
- **Verified colour values** — use these exact hex values, they are measured, do not substitute:
  `--badge-low-ink: #1E6B40` · `--badge-high-ink: #A81F32` · `--badge-na-ink: #595959` · `--route-quiet: #1E8A54` · `--route-direct: #C22A2A` · `--brand-ink: #1F2A26` · `--mute-2: #7A837F`
- **Sensory badge names are unchanged.** The strings `Low Sensory`, `High Sensory` and `Sensory information unavailable` stay exactly as they are. The review chose "keep the names, explain them" — renaming them is out of scope.
- **Reduced motion:** every animation added must be inert under `prefers-reduced-motion: reduce`. `tokens.css` already has a global guard that zeroes durations; content must never be left invisible when animation is suppressed.
- **`npx tsc --noEmit` must pass after every task.** `strict` is on.
- **Commit after every task.** Branch is `dev`.
- **Do not run `npm audit fix`.** The tree has 4 known advisories; changing dependency versions is not part of this work.

## File Structure

**Created**

| File | Responsibility |
| --- | --- |
| `frontend/src/styles/contrast.ts` | Pure colour maths — hex parsing, alpha compositing, WCAG relative luminance and contrast ratio. No DOM. |
| `frontend/src/styles/contrast.test.ts` | Unit tests for the maths above. |
| `frontend/src/styles/palette.test.ts` | Reads `tokens.css` from disk and asserts every contrast requirement in the spec. This is the regression guard for comment 6. |
| `frontend/src/components/InfoTip.tsx` / `.css` | Accessible explain-on-demand popover. Used by the sensory badge; deliberately generic. |
| `frontend/src/components/InfoTip.test.tsx` | Keyboard, focus and Escape behaviour. |
| `frontend/src/components/RouteCard.test.tsx` | Threshold copy and selection callback. |
| `frontend/src/components/MapRouteLayer.tsx` | Polylines + selection + bounds fitting, extracted so `MapView` does not also own map-instance side effects. |
| `frontend/src/pages/Home.sections.tsx` | "How it works" and entry-card sections, kept out of `Home.tsx` so the hero stays readable. |
| `frontend/src/hooks/useReveal.ts` | `IntersectionObserver` scroll-reveal, motion-safe. |
| `frontend/src/test/setup.ts` | jest-dom matchers, `matchMedia` and `IntersectionObserver` stubs. |

**Modified**

`tokens.css` · `SensoryBadge.tsx`/`.css` · `RouteCard.tsx`/`.css` · `SearchPanel.tsx`/`.css` · `Footer.tsx`/`.css` · `Header.tsx`/`.css` · `MapView.tsx`/`.css` · `RouteCompare.tsx` · `RefugeMap.tsx` · `Home.tsx`/`.css` · `router.tsx` · `useSensitivity.ts` · `vite.config.ts` · `tsconfig.json` · `package.json` · `scripts/dev.sh` · `README.md`

**Deleted**

`pages/SignIn.tsx` · `pages/SignIn.css` · `pages/SignUp.tsx` · `pages/SignUp.css`

---

## Task 1: Test infrastructure and the contrast utility

> ⚠️ **Scope note for the reviewer.** The frontend has no test runner today. This task adds one. The spec did not ask for it; it is added because Tasks 7 and 11 introduce keyboard and selection behaviour that regresses silently, and because Task 2's contrast requirements are only meaningful if something checks them. If you would rather not take on a test dependency, skip this task and Task 2's test step — every other task still stands, but comment 6 then has no regression guard.

**Files:**
- Modify: `frontend/package.json`, `frontend/vite.config.ts`, `frontend/tsconfig.json`
- Create: `frontend/src/test/setup.ts`, `frontend/src/styles/contrast.ts`, `frontend/src/styles/contrast.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `hexToRgb(hex: string): [number, number, number]`
  - `blend(fg: string, alpha: number, bg: string): [number, number, number]`
  - `relativeLuminance(rgb: [number, number, number]): number`
  - `contrastRatio(a: string | [number,number,number], b: string | [number,number,number]): number`
  - npm script `test` → `vitest run`, and `test:watch` → `vitest`

- [ ] **Step 1: Install the test dependencies**

```bash
cd frontend
npm install -D vitest@^2.1.9 jsdom@^25.0.1 @testing-library/react@^16.1.0 \
  @testing-library/jest-dom@^6.6.3 @testing-library/user-event@^14.5.2
```

- [ ] **Step 2: Add the test scripts to `frontend/package.json`**

In the `"scripts"` block, alongside the existing entries:

```json
    "test": "vitest run",
    "test:watch": "vitest"
```

- [ ] **Step 3: Configure Vitest in `frontend/vite.config.ts`**

Replace the whole file:

```ts
/// <reference types="vitest" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    open: true,
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    css: false,
  },
})
```

- [ ] **Step 4: Add the Vitest globals to `frontend/tsconfig.json`**

Add one line inside `compilerOptions`:

```json
    "types": ["vitest/globals", "@testing-library/jest-dom"],
```

- [ ] **Step 5: Create `frontend/src/test/setup.ts`**

`matchMedia` and `IntersectionObserver` do not exist in jsdom; Task 12 needs both.

```ts
import '@testing-library/jest-dom/vitest'

if (!window.matchMedia) {
  window.matchMedia = (query: string) =>
    ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    }) as unknown as MediaQueryList
}

if (!('IntersectionObserver' in window)) {
  class StubObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
    takeRecords() {
      return []
    }
    root = null
    rootMargin = ''
    thresholds = []
  }
  window.IntersectionObserver = StubObserver as unknown as typeof IntersectionObserver
}
```

- [ ] **Step 6: Write the failing test — `frontend/src/styles/contrast.test.ts`**

The reference values are from WCAG 2.1: black on white is exactly 21:1, any colour against itself is 1:1.

```ts
import { describe, it, expect } from 'vitest'
import { hexToRgb, blend, relativeLuminance, contrastRatio } from './contrast'

describe('hexToRgb', () => {
  it('parses a six-digit hex with a leading hash', () => {
    expect(hexToRgb('#1E6B40')).toEqual([30, 107, 64])
  })

  it('parses without a leading hash and is case-insensitive', () => {
    expect(hexToRgb('ffffff')).toEqual([255, 255, 255])
  })

  it('rejects malformed input rather than returning NaN', () => {
    expect(() => hexToRgb('#12345')).toThrow(/invalid hex/i)
  })
})

describe('relativeLuminance', () => {
  it('is 0 for black and 1 for white', () => {
    expect(relativeLuminance([0, 0, 0])).toBeCloseTo(0, 5)
    expect(relativeLuminance([255, 255, 255])).toBeCloseTo(1, 5)
  })
})

describe('contrastRatio', () => {
  it('is 21:1 for black on white', () => {
    expect(contrastRatio('#000000', '#FFFFFF')).toBeCloseTo(21, 2)
  })

  it('is 1:1 for a colour against itself', () => {
    expect(contrastRatio('#3E5148', '#3E5148')).toBeCloseTo(1, 5)
  })

  it('is symmetric — argument order does not matter', () => {
    expect(contrastRatio('#1E6B40', '#DDEDDF')).toBeCloseTo(
      contrastRatio('#DDEDDF', '#1E6B40'),
      5,
    )
  })
})

describe('blend', () => {
  it('returns the backdrop at alpha 0 and the source at alpha 1', () => {
    expect(blend('#000000', 0, '#FFFFFF')).toEqual([255, 255, 255])
    expect(blend('#000000', 1, '#FFFFFF')).toEqual([0, 0, 0])
  })

  it('composites a translucent tint over a backdrop', () => {
    // The low-sensory badge tint: rgba(94,227,156,.16) over the quiet card.
    const [r, g, b] = blend('#5EE39C', 0.16, '#DDEDDF')
    expect([Math.round(r), Math.round(g), Math.round(b)]).toEqual([201, 235, 212])
  })
})
```

- [ ] **Step 7: Run it and confirm it fails**

```bash
cd frontend && npx vitest run src/styles/contrast.test.ts
```

Expected: FAIL — `Failed to resolve import "./contrast"`.

- [ ] **Step 8: Implement `frontend/src/styles/contrast.ts`**

```ts
export type RGB = [number, number, number]

/** Parse `#RRGGBB` or `RRGGBB` into channel values. */
export function hexToRgb(hex: string): RGB {
  const clean = hex.trim().replace(/^#/, '')
  if (!/^[0-9a-fA-F]{6}$/.test(clean)) {
    throw new Error(`invalid hex colour: ${hex}`)
  }
  return [
    parseInt(clean.slice(0, 2), 16),
    parseInt(clean.slice(2, 4), 16),
    parseInt(clean.slice(4, 6), 16),
  ]
}

/** Composite `fg` at `alpha` over opaque `bg` — what the eye actually sees. */
export function blend(fg: string, alpha: number, bg: string): RGB {
  const f = hexToRgb(fg)
  const b = hexToRgb(bg)
  return [0, 1, 2].map((i) => alpha * f[i] + (1 - alpha) * b[i]) as RGB
}

/** WCAG 2.1 relative luminance. */
export function relativeLuminance([r, g, b]: RGB): number {
  const channel = (value: number) => {
    const s = value / 255
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4)
  }
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b)
}

/** WCAG 2.1 contrast ratio. Symmetric; result is between 1 and 21. */
export function contrastRatio(a: string | RGB, b: string | RGB): number {
  const la = relativeLuminance(typeof a === 'string' ? hexToRgb(a) : a)
  const lb = relativeLuminance(typeof b === 'string' ? hexToRgb(b) : b)
  const [hi, lo] = la > lb ? [la, lb] : [lb, la]
  return (hi + 0.05) / (lo + 0.05)
}
```

- [ ] **Step 9: Run the tests and confirm they pass**

```bash
cd frontend && npx vitest run src/styles/contrast.test.ts && npx tsc --noEmit
```

Expected: 9 tests pass, tsc clean.

- [ ] **Step 10: Commit**

```bash
git add frontend/package.json frontend/package-lock.json frontend/vite.config.ts \
        frontend/tsconfig.json frontend/src/test/setup.ts frontend/src/styles/contrast.ts \
        frontend/src/styles/contrast.test.ts
git commit -m "test: add Vitest and a WCAG contrast utility"
```

---

## Task 2: Semantic colour tokens, guarded by a palette test

Comment 6. The palette test is the deliverable here as much as the colours — it is what stops the next redesign from quietly reintroducing a 1.59:1 wordmark.

**Files:**
- Modify: `frontend/src/styles/tokens.css`
- Create: `frontend/src/styles/palette.test.ts`

**Interfaces:**
- Consumes: `contrastRatio`, `blend` from Task 1.
- Produces: CSS custom properties `--badge-low-ink`, `--badge-high-ink`, `--badge-na-ink`, `--route-quiet`, `--route-direct`, `--brand-ink`; `--mute-2` retuned. Tasks 3, 5, 8 and 11 consume these by name.

- [ ] **Step 1: Write the failing test — `frontend/src/styles/palette.test.ts`**

It reads the real stylesheet, so it fails if someone edits a colour without re-checking it.

```ts
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { contrastRatio, blend } from './contrast'

const css = readFileSync(resolve(__dirname, 'tokens.css'), 'utf8')

/** Read a hex-valued custom property out of tokens.css. */
function token(name: string): string {
  const match = css.match(new RegExp(`--${name}\\s*:\\s*(#[0-9a-fA-F]{6})`))
  if (!match) throw new Error(`token --${name} not found in tokens.css`)
  return match[1]
}

const WHITE = '#FFFFFF'

describe('surface and text tokens', () => {
  it('body text on the page background meets AA', () => {
    expect(contrastRatio(token('ink'), token('bg'))).toBeGreaterThanOrEqual(4.5)
  })

  it('secondary text on the page background meets AA', () => {
    expect(contrastRatio(token('mute'), token('bg'))).toBeGreaterThanOrEqual(4.5)
  })

  it('the dimmest grey meets the 3:1 non-text floor', () => {
    // Decorative today (the aria-hidden rail in SearchPanel), raised so the
    // token is safe the next time somebody reaches for it.
    expect(contrastRatio(token('mute-2'), token('bg'))).toBeGreaterThanOrEqual(3)
  })

  it('the wordmark is legible on both white and the page background', () => {
    expect(contrastRatio(token('brand-ink'), WHITE)).toBeGreaterThanOrEqual(4.5)
    expect(contrastRatio(token('brand-ink'), token('bg'))).toBeGreaterThanOrEqual(4.5)
  })
})

describe('sensory badge ink', () => {
  // Badges sit inside the coloured route cards, so each tint composites over
  // the card behind it, not over white. All three surfaces are checked.
  const surfaces: [string, string][] = [
    ['white', WHITE],
    ['the quiet card', token('quiet-bg')],
    ['the fast card', token('fast-bg')],
  ]

  for (const [label, surface] of surfaces) {
    it(`low-sensory ink meets AA on ${label}`, () => {
      const bg = blend('#5EE39C', 0.16, surface)
      expect(contrastRatio(token('badge-low-ink'), bg)).toBeGreaterThanOrEqual(4.5)
    })

    it(`high-sensory ink meets AA on ${label}`, () => {
      const bg = blend('#C22A2A', 0.14, surface)
      expect(contrastRatio(token('badge-high-ink'), bg)).toBeGreaterThanOrEqual(4.5)
    })

    it(`unavailable ink meets AA on ${label}`, () => {
      const bg = blend('#787878', 0.16, surface)
      expect(contrastRatio(token('badge-na-ink'), bg)).toBeGreaterThanOrEqual(4.5)
    })
  }
})

describe('route card surfaces', () => {
  it('quiet card text meets AA on the quiet card', () => {
    expect(contrastRatio(token('quiet-ink'), token('quiet-bg'))).toBeGreaterThanOrEqual(4.5)
  })

  it('fast card text meets AA on the fast card', () => {
    expect(contrastRatio(token('fast-ink'), token('fast-bg'))).toBeGreaterThanOrEqual(4.5)
  })
})

describe('map route lines', () => {
  // Non-text UI: 3:1 against the lightest OSM tile they cross.
  const LIGHT_TILE = '#EFECE4'

  it('the quiet route line is distinguishable from the map', () => {
    expect(contrastRatio(token('route-quiet'), LIGHT_TILE)).toBeGreaterThanOrEqual(3)
  })

  it('the direct route line is distinguishable from the map', () => {
    expect(contrastRatio(token('route-direct'), LIGHT_TILE)).toBeGreaterThanOrEqual(3)
  })

  it('the two route lines are distinguishable from each other', () => {
    expect(contrastRatio(token('route-quiet'), token('route-direct'))).toBeGreaterThanOrEqual(1.5)
  })
})
```

- [ ] **Step 2: Run it and confirm it fails**

```bash
cd frontend && npx vitest run src/styles/palette.test.ts
```

Expected: FAIL — `token --badge-low-ink not found in tokens.css`, plus a `--mute-2` failure at 2.50:1.

- [ ] **Step 3: Add the tokens to `frontend/src/styles/tokens.css`**

Change the existing `--mute-2` line to:

```css
  --mute-2: #7A837F;
```

Then add this block immediately after the closing of the `/* Warning */` group:

```css
  /* Accessible ink — every value measured, see docs/2026-08-13-ui-feedback-design.md.
     Changing any of these without re-running src/styles/palette.test.ts will
     silently break WCAG AA. */
  --brand-ink: #1F2A26;      /* wordmark; the old #F4C900 was 1.59:1 on white */
  --badge-low-ink: #1E6B40;  /* was #2f8f5b at 3.72:1 */
  --badge-high-ink: #A81F32; /* was #c22a2a at 4.60:1, too close to the line */
  --badge-na-ink: #595959;   /* was #6b6b6b at 4.41:1 */

  /* Route lines, ≥3:1 on light OSM tiles */
  --route-quiet: #1E8A54;    /* was #5EE39C at 1.37:1 — effectively invisible */
  --route-direct: #C22A2A;
```

- [ ] **Step 4: Run the tests and confirm they pass**

```bash
cd frontend && npx vitest run && npx tsc --noEmit
```

Expected: all palette assertions pass. Contrast tests from Task 1 still pass.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/styles/tokens.css frontend/src/styles/palette.test.ts
git commit -m "fix: raise palette to WCAG AA and lock it with a test

The wordmark sat at 1.59:1 on white and the quiet route line at 1.37:1
against the map. Both were effectively invisible."
```

---

## Task 3: Restore the route card's styling

The defect found while planning: `RouteCard.tsx` renders `route-card*` class names and `RouteCard.css` styles `.rc*`. They do not intersect, so the card renders as unstyled default text. This is almost certainly the "font/colour not visible" comment.

Do this before Task 8, which adds copy to the same component.

**Files:**
- Modify: `frontend/src/components/RouteCard.css` (full rewrite)

**Interfaces:**
- Consumes: `--quiet-bg`, `--quiet-ink`, `--fast-bg`, `--fast-ink`, `--radius-lg`, `--radius-pill` from `tokens.css`.
- Produces: styled classes `route-card`, `route-card--quiet`, `route-card--fast`, `route-card--recommended`, `route-card__head`, `route-card__title`, `route-card__flag`, `route-card__meta`, `route-card__detail`. Task 8 adds `route-card__explain`; Task 11 adds `route-card--selected`.

- [ ] **Step 1: Confirm the defect before fixing it**

```bash
cd frontend/src
grep -rn "route-card" --include="*.css" . ; echo "css matches: $?"
grep -c "route-card" components/RouteCard.tsx
```

Expected: zero CSS matches (grep exits 1), 6 matches in the component. If the CSS already has `route-card` rules, someone has fixed this — stop and re-read the file before continuing.

- [ ] **Step 2: Add the route-type modifier to `frontend/src/components/RouteCard.tsx`**

The stylesheet needs to know which route it is colouring. Change the opening `<article>` to:

```tsx
    <article
      className={[
        'route-card',
        `route-card--${route.type === 'quiet' ? 'quiet' : 'fast'}`,
        recommended ? 'route-card--recommended' : '',
      ]
        .filter(Boolean)
        .join(' ')}
    >
```

- [ ] **Step 3: Replace `frontend/src/components/RouteCard.css` entirely**

The old `.rc__btn`, `.rc__desc`, `.rc__tag`, `.rc__duration` and `.rc__submeta` rules are deleted, not renamed — they style elements this component does not render, and keeping them would mean inventing UI the spec does not call for.

```css
/* Class names here must match RouteCard.tsx exactly. They did not until
   2026-08-13, which left the card rendering entirely unstyled. */

.route-card {
  position: relative;
  padding: 20px;
  border-radius: var(--radius-lg);
  display: flex;
  flex-direction: column;
  gap: 10px;
  border: 2px solid transparent;
  transition: border-color var(--dur-1) var(--ease), box-shadow var(--dur-1) var(--ease);
}

.route-card--quiet {
  background: var(--quiet-bg);
  color: var(--quiet-ink);
}

.route-card--fast {
  background: var(--fast-bg);
  color: var(--fast-ink);
}

.route-card__head {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  gap: 12px;
}

.route-card__title {
  margin: 0;
  font-size: 20px;
  font-weight: 700;
  letter-spacing: -0.4px;
  color: inherit;
}

.route-card__flag {
  flex-shrink: 0;
  padding: 4px 10px;
  border-radius: var(--radius-pill);
  background: rgba(255, 255, 255, 0.75);
  color: var(--quiet-btn);
  font-size: 10.5px;
  letter-spacing: 0.08em;
  font-weight: 700;
  text-transform: uppercase;
}

.route-card__meta {
  margin: 0;
  font-size: 15px;
  font-weight: 600;
}

.route-card__detail {
  margin: 0;
  font-size: 13px;
  line-height: 1.45;
}
```

- [ ] **Step 4: Verify the cards are actually styled**

```bash
cd frontend && npx tsc --noEmit && npm run build
```

Then with `./scripts/dev.sh` running, open <http://localhost:5173/explore>, choose Parliament Station → Federation Square, and confirm two cards render: one on a green field, one on a pink field, each with a rounded corner and padding. Before this task they were plain text on the page background.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/RouteCard.tsx frontend/src/components/RouteCard.css
git commit -m "fix: style the route card

RouteCard.tsx rendered .route-card* while RouteCard.css defined .rc*, so
the primary output of the product had no styling at all."
```

---

## Task 4: Remove login entirely

Comment 3.

**Files:**
- Delete: `frontend/src/pages/SignIn.tsx`, `SignIn.css`, `SignUp.tsx`, `SignUp.css`
- Modify: `frontend/src/router.tsx`, `frontend/src/components/Header.tsx`, `frontend/src/components/Header.css`

**Interfaces:**
- Consumes: nothing.
- Produces: `Header` takes only `{ variant?: 'overlay' | 'solid' }` — no auth state, no `localStorage`. Task 5 restyles the same component.

- [ ] **Step 1: Delete the four page files**

```bash
cd "$(git rev-parse --show-toplevel)"
git rm frontend/src/pages/SignIn.tsx frontend/src/pages/SignIn.css \
       frontend/src/pages/SignUp.tsx frontend/src/pages/SignUp.css
```

- [ ] **Step 2: Drop the routes from `frontend/src/router.tsx`**

Remove the two imports and the two `<Route>` lines, leaving:

```tsx
import { Routes, Route } from 'react-router-dom'
import Home from './pages/Home'
import RouteCompare from './pages/RouteCompare'
import RefugeMap from './pages/RefugeMap'
import Community from './pages/Community'
import Resources from './pages/Resources'
import Contact from './pages/Contact'

export function AppRouter() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/explore" element={<RouteCompare />} />
      <Route path="/quietplace" element={<RefugeMap />} />
      <Route path="/community" element={<Community />} />
      <Route path="/resources" element={<Resources />} />
      <Route path="/contact" element={<Contact />} />
      <Route path="*" element={<Home />} />
    </Routes>
  )
}
```

- [ ] **Step 3: Replace `frontend/src/components/Header.tsx` entirely**

Every trace of `useState`, `useNavigate`, `StoredUser`, `hushwayLoggedIn` and `hushwayUser` goes.

```tsx
import { NavLink, Link } from 'react-router-dom'
import { Flower2 } from 'lucide-react'
import './Header.css'

interface HeaderProps {
  variant?: 'overlay' | 'solid'
}

const links = [
  { to: '/', label: 'Home', end: true },
  { to: '/explore', label: 'Explore' },
  { to: '/quietplace', label: 'QuietPlace' },
  { to: '/community', label: 'Community' },
  { to: '/resources', label: 'Resources' },
  { to: '/contact', label: 'Contact' },
]

export default function Header({ variant = 'solid' }: HeaderProps) {
  return (
    <header className={`hw-header hw-header--${variant}`}>
      <Link to="/" className="hw-header__brand">
        <span className="hw-header__logo" aria-hidden>
          <Flower2 size={18} strokeWidth={2.4} />
        </span>
        <span>HushWay</span>
      </Link>

      <nav className="hw-header__nav" aria-label="Primary navigation">
        {links.map((link) => (
          <NavLink
            key={link.to}
            to={link.to}
            end={link.end}
            className={({ isActive }) =>
              `hw-header__link${isActive ? ' hw-header__link--active' : ''}`
            }
          >
            {link.label}
          </NavLink>
        ))}
      </nav>
    </header>
  )
}
```

- [ ] **Step 4: Remove the auth CSS from `frontend/src/components/Header.css`**

Delete these rule blocks and every `@media` override that mentions them: `.hw-header__auth`, `.hw-header__btn`, `.hw-header--solid .hw-header__btn`, `.hw-header--overlay .hw-header__btn`, `.hw-header__btn:hover`, `.hw-header__user`, `.hw-header__username`, `.hw-header--solid .hw-header__username`, `.hw-header--overlay .hw-header__username`, `.hw-header__username:hover`, `.hw-header__arrow`, `.hw-header__dropdown`, `.hw-header__signout`, `.hw-header__signout:hover`.

Then change the grid to two columns so the layout does not leave a hole:

```css
.hw-header {
  width: 100%;
  height: 112px;

  display: grid;
  grid-template-columns: auto 1fr;
  align-items: center;

  padding: 0 26px;
  box-sizing: border-box;
  position: relative;
  z-index: 100;
  font-family: inherit;
}
```

and make the nav sit on the right:

```css
.hw-header__nav {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 18px;
}
```

- [ ] **Step 5: Confirm nothing still references the removed code**

```bash
cd frontend/src
grep -rn "signin\|SignIn\|SignUp\|hushwayLoggedIn\|hushwayUser\|hw-header__auth\|hw-header__btn\|hw-header__user\|hw-header__dropdown\|hw-header__signout\|hw-header__arrow\|hw-header__username" . ; echo "remaining refs exit: $?"
```

Expected: no matches (grep exits 1).

- [ ] **Step 6: Verify**

```bash
cd frontend && npx tsc --noEmit && npm run build && npx vitest run
```

Then check `/signin` in a browser — it should fall through the `path="*"` catch-all to Home, not error.

- [ ] **Step 7: Commit**

```bash
git add -A frontend/src
git commit -m "feat: remove the presentational sign-in and registration

Nothing authenticated — SignUp wrote a user to localStorage and SignIn
compared against it in plain text, which is worse than no auth at all."
```

---

## Task 5: Legible wordmark and a hero scrim

Comment 6, the parts a token swap cannot fix.

**Files:**
- Modify: `frontend/src/components/Header.css`

**Interfaces:**
- Consumes: `--brand-ink`, `--yellow` from Task 2; the `.hw-header__logo` span added in Task 4.
- Produces: no new API.

- [ ] **Step 1: Make the wordmark legible**

Replace the `.hw-header__brand` and `.hw-header__logo-icon` rules. The brand yellow stays at full saturation on the chip; the text you actually have to read goes to ink.

```css
.hw-header__brand {
  justify-self: start;

  display: flex;
  align-items: center;
  gap: 9px;

  color: var(--brand-ink);

  font-size: 19px;
  font-weight: 700;
  letter-spacing: -0.2px;

  text-decoration: none;
  transition: opacity 0.2s ease;
}

.hw-header__brand:hover {
  opacity: 0.85;
}

/* Brand yellow survives as the chip; the glyph is knocked out in ink so
   both the mark and the word stay legible on white. The old gold-on-white
   wordmark measured 1.59:1. */
.hw-header__logo {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 30px;
  border-radius: 9px;
  background: var(--yellow);
  color: var(--brand-ink);
  flex-shrink: 0;
}
```

- [ ] **Step 2: Keep the overlay header readable on the photo**

On the home hero the brand and nav sit on a bright photograph. Add a scrim behind the header band, and set the overlay brand to white so it reads against it.

```css
.hw-header--overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;

  background: linear-gradient(
    180deg,
    rgba(18, 30, 26, 0.62) 0%,
    rgba(18, 30, 26, 0.34) 55%,
    rgba(18, 30, 26, 0) 100%
  );

  border-bottom: none;
}

.hw-header--overlay .hw-header__brand {
  color: #ffffff;
}
```

Then delete the `text-shadow` from `.hw-header--overlay .hw-header__link` — the scrim replaces it, and a shadow is not a substitute for contrast:

```css
.hw-header--overlay .hw-header__link {
  color: #ffffff;
}
```

- [ ] **Step 3: Verify the scrim actually does the work**

A scrim is a guess until measured. With the dev server running, screenshot the home page, then sample the **lightest** pixel of the scrimmed photo directly behind the nav text — lightest, because white text is worst off against it.

Create `frontend/src/styles/hero.test.ts` with the sampled value:

```ts
import { describe, it, expect } from 'vitest'
import { contrastRatio } from './contrast'

// Lightest pixel sampled from the scrimmed hero photo behind the nav band,
// measured 2026-08-13. Re-sample if the hero image or the scrim changes.
const LIGHTEST_BEHIND_NAV = '#000000' // <- replace with the sampled hex

describe('home hero header', () => {
  it('white nav text stays legible against the scrimmed photo', () => {
    expect(contrastRatio('#FFFFFF', LIGHTEST_BEHIND_NAV)).toBeGreaterThanOrEqual(4.5)
  })
})
```

Run `npx vitest run src/styles/hero.test.ts`. If it fails, deepen the scrim's top stop (`rgba(18, 30, 26, 0.62)`) until it passes, re-sampling each time. Keep this test — it is the regression guard for the hero. Record the final value in the Task 13 audit table.

- [ ] **Step 4: Verify and commit**

```bash
cd frontend && npx tsc --noEmit && npm run build
```

```bash
git add frontend/src/components/Header.css
git commit -m "fix: make the wordmark and hero nav legible

The gold wordmark measured 1.59:1 on white. Brand yellow moves to the
logo chip; the text goes to ink."
```

---

## Task 6: Expose a display label for the crowd threshold

Small foundation task. `useSensitivity` already returns `threshold`, so this only adds the label that Tasks 8 and 9 render.

**Files:**
- Modify: `frontend/src/hooks/useSensitivity.ts`
- Create: `frontend/src/hooks/useSensitivity.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `DENSITY_LABELS: Record<Density, string>` mapping `low → 'Low'`, `mid → 'Mid'`, `high → 'High'`; `formatThreshold(n: number): string` returning e.g. `'500'` and `'1,000'`. `useSensitivity()` keeps returning `{ density, setDensity, threshold }` unchanged.

- [ ] **Step 1: Write the failing test — `frontend/src/hooks/useSensitivity.test.ts`**

```ts
import { describe, it, expect } from 'vitest'
import { DENSITY_THRESHOLDS, DENSITY_LABELS, formatThreshold } from './useSensitivity'

describe('DENSITY_LABELS', () => {
  it('names every density the app supports', () => {
    expect(Object.keys(DENSITY_LABELS).sort()).toEqual(['high', 'low', 'mid'])
  })

  it('keeps the review-approved names unchanged', () => {
    expect(DENSITY_LABELS.low).toBe('Low')
    expect(DENSITY_LABELS.mid).toBe('Mid')
    expect(DENSITY_LABELS.high).toBe('High')
  })
})

describe('formatThreshold', () => {
  it('groups thousands so 1000 reads as a crowd, not a code', () => {
    expect(formatThreshold(1000)).toBe('1,000')
  })

  it('leaves three-digit values alone', () => {
    expect(formatThreshold(250)).toBe('250')
    expect(formatThreshold(500)).toBe('500')
  })

  it('formats every threshold the app can produce', () => {
    for (const value of Object.values(DENSITY_THRESHOLDS)) {
      expect(formatThreshold(value)).toMatch(/^[\d,]+$/)
    }
  })
})
```

- [ ] **Step 2: Run it and confirm it fails**

```bash
cd frontend && npx vitest run src/hooks/useSensitivity.test.ts
```

Expected: FAIL — `DENSITY_LABELS` is not exported.

- [ ] **Step 3: Add the exports to `frontend/src/hooks/useSensitivity.ts`**

Insert after the existing `DENSITY_THRESHOLDS` declaration:

```ts
/** Display names for the crowd preference. The review kept these words. */
export const DENSITY_LABELS: Record<Density, string> = {
  low: 'Low',
  mid: 'Mid',
  high: 'High',
}

/** 1000 -> "1,000". Used wherever a threshold is shown to a person. */
export function formatThreshold(count: number): string {
  return count.toLocaleString('en-AU')
}
```

- [ ] **Step 4: Run the tests and confirm they pass**

```bash
cd frontend && npx vitest run && npx tsc --noEmit
```

- [ ] **Step 5: Commit**

```bash
git add frontend/src/hooks/useSensitivity.ts frontend/src/hooks/useSensitivity.test.ts
git commit -m "feat: expose density labels and threshold formatting"
```

---

## Task 7: The InfoTip component

Comment 1, the explain-on-demand affordance.

**Files:**
- Create: `frontend/src/components/InfoTip.tsx`, `InfoTip.css`, `InfoTip.test.tsx`

**Interfaces:**
- Consumes: nothing.
- Produces: `<InfoTip label={string} text={string} />`. Renders a `<button type="button">` with `aria-label={label}` and `aria-expanded`, and when open a `role="tooltip"` element containing `text`, wired via `aria-describedby`. Task 8 consumes it.

- [ ] **Step 1: Write the failing test — `frontend/src/components/InfoTip.test.tsx`**

```tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import InfoTip from './InfoTip'

const LABEL = 'What does Low Sensory mean?'
const TEXT = 'At its busiest, this route stays below the crowd level you chose (500 people/hr).'

describe('InfoTip', () => {
  it('hides the explanation until it is asked for', () => {
    render(<InfoTip label={LABEL} text={TEXT} />)
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: LABEL })).toHaveAttribute('aria-expanded', 'false')
  })

  it('opens on click', async () => {
    const user = userEvent.setup()
    render(<InfoTip label={LABEL} text={TEXT} />)

    await user.click(screen.getByRole('button', { name: LABEL }))

    expect(screen.getByRole('tooltip')).toHaveTextContent(TEXT)
    expect(screen.getByRole('button', { name: LABEL })).toHaveAttribute('aria-expanded', 'true')
  })

  it('opens on keyboard focus, so it is not mouse-only', async () => {
    const user = userEvent.setup()
    render(<InfoTip label={LABEL} text={TEXT} />)

    await user.tab()

    expect(screen.getByRole('button', { name: LABEL })).toHaveFocus()
    expect(screen.getByRole('tooltip')).toHaveTextContent(TEXT)
  })

  it('closes on Escape', async () => {
    const user = userEvent.setup()
    render(<InfoTip label={LABEL} text={TEXT} />)

    await user.click(screen.getByRole('button', { name: LABEL }))
    expect(screen.getByRole('tooltip')).toBeInTheDocument()

    await user.keyboard('{Escape}')
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument()
  })

  it('describes its own button for screen readers', async () => {
    const user = userEvent.setup()
    render(<InfoTip label={LABEL} text={TEXT} />)

    await user.click(screen.getByRole('button', { name: LABEL }))

    const button = screen.getByRole('button', { name: LABEL })
    const tooltip = screen.getByRole('tooltip')
    expect(button).toHaveAttribute('aria-describedby', tooltip.id)
  })

  it('does not submit the form it might sit inside', () => {
    render(<InfoTip label={LABEL} text={TEXT} />)
    expect(screen.getByRole('button', { name: LABEL })).toHaveAttribute('type', 'button')
  })
})
```

- [ ] **Step 2: Run it and confirm it fails**

```bash
cd frontend && npx vitest run src/components/InfoTip.test.tsx
```

Expected: FAIL — cannot resolve `./InfoTip`.

- [ ] **Step 3: Implement `frontend/src/components/InfoTip.tsx`**

```tsx
import { useId, useState } from 'react'
import './InfoTip.css'

interface InfoTipProps {
  /** Accessible name for the trigger, e.g. "What does Low Sensory mean?" */
  label: string
  /** The explanation itself. */
  text: string
}

/**
 * Explain-on-demand. Opens on hover, focus and click so it works for
 * pointer, keyboard and touch alike — a hover-only tooltip is unusable
 * on a phone and invisible to a keyboard.
 */
export default function InfoTip({ label, text }: InfoTipProps) {
  const [open, setOpen] = useState(false)
  const tooltipId = useId()

  return (
    <span
      className="infotip"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <button
        type="button"
        className="infotip__trigger"
        aria-label={label}
        aria-expanded={open}
        aria-describedby={open ? tooltipId : undefined}
        onClick={() => setOpen((wasOpen) => !wasOpen)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onKeyDown={(event) => {
          if (event.key === 'Escape' && open) {
            event.stopPropagation()
            setOpen(false)
          }
        }}
      >
        <span aria-hidden>?</span>
      </button>

      {open && (
        <span role="tooltip" id={tooltipId} className="infotip__bubble">
          {text}
        </span>
      )}
    </span>
  )
}
```

- [ ] **Step 4: Create `frontend/src/components/InfoTip.css`**

```css
.infotip {
  position: relative;
  display: inline-flex;
  align-items: center;
}

.infotip__trigger {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  border: 1.5px solid currentColor;
  font-size: 11px;
  font-weight: 700;
  line-height: 1;
  color: inherit;
  opacity: 0.75;
  cursor: help;
  transition: opacity var(--dur-1) var(--ease);
}

.infotip__trigger:hover,
.infotip__trigger:focus-visible {
  opacity: 1;
}

.infotip__bubble {
  position: absolute;
  bottom: calc(100% + 8px);
  left: 50%;
  transform: translateX(-50%);
  z-index: 20;

  width: max-content;
  max-width: 240px;
  padding: 9px 11px;

  background: var(--teal-d);
  color: #ffffff;
  border-radius: var(--radius-xs);
  box-shadow: var(--shadow);

  font-size: 12.5px;
  font-weight: 500;
  line-height: 1.45;
  text-align: left;
  white-space: normal;
}

/* Keep the bubble on screen inside the narrow sidebar. */
@media (max-width: 1024px) {
  .infotip__bubble {
    left: 0;
    transform: none;
  }
}
```

- [ ] **Step 5: Run the tests and confirm they pass**

```bash
cd frontend && npx vitest run src/components/InfoTip.test.tsx && npx tsc --noEmit
```

Expected: 6 tests pass.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/components/InfoTip.tsx frontend/src/components/InfoTip.css \
        frontend/src/components/InfoTip.test.tsx
git commit -m "feat: add an accessible InfoTip component"
```

---

## Task 8: Explain the sensory badge

Comment 1, the substance. The badge names do not change; everything around them does.

**Files:**
- Modify: `frontend/src/components/SensoryBadge.tsx`, `SensoryBadge.css`, `frontend/src/components/RouteCard.tsx`, `RouteCard.css`, `frontend/src/pages/RouteCompare.tsx`
- Create: `frontend/src/components/RouteCard.test.tsx`

**Interfaces:**
- Consumes: `InfoTip` (Task 7); `formatThreshold` (Task 6); badge ink tokens (Task 2); `.route-card__*` styles (Task 3).
- Produces: `<SensoryBadge level={Sensory['level']} threshold={number} />` and `<RouteCard route={ApiRoute} recommended={boolean} threshold={number} />`. Task 11 adds `selected` and `onSelect` to `RouteCard`.

- [ ] **Step 1: Write the failing test — `frontend/src/components/RouteCard.test.tsx`**

```tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import RouteCard from './RouteCard'
import type { ApiRoute } from '../api/types'

function makeRoute(overrides: Partial<ApiRoute> = {}): ApiRoute {
  return {
    id: 'r1',
    type: 'quiet',
    path: [[-37.81, 144.96]],
    distance_m: 1500,
    duration_min: 19,
    sensory: { level: 'low', score: 0.3, peak_count: 334, coverage: 0.8 },
    congestion: { peak: 334, mean: 210 },
    ...overrides,
  }
}

describe('RouteCard', () => {
  it('keeps the badge wording the review chose', () => {
    render(<RouteCard route={makeRoute()} recommended threshold={500} />)
    expect(screen.getByText('Low Sensory')).toBeInTheDocument()
  })

  it('anchors the peak count against the threshold instead of leaving it bare', () => {
    render(<RouteCard route={makeRoute()} recommended threshold={500} />)
    expect(
      screen.getByText(/334 people\/hr at its busiest — under your 500 limit/),
    ).toBeInTheDocument()
  })

  it('says "over" when the route breaches the threshold', () => {
    const route = makeRoute({
      type: 'direct',
      sensory: { level: 'high', score: 0.9, peak_count: 2783, coverage: 0.8 },
      congestion: { peak: 2783, mean: 1400 },
    })
    render(<RouteCard route={route} recommended={false} threshold={500} />)
    expect(
      screen.getByText(/2,783 people\/hr at its busiest — over your 500 limit/),
    ).toBeInTheDocument()
  })

  it('shows no count at all when sensory data is unavailable', () => {
    const route = makeRoute({
      sensory: { level: 'unavailable', score: 0, peak_count: 0, coverage: 0.2 },
    })
    render(<RouteCard route={route} recommended threshold={500} />)
    expect(screen.getByText('Sensory information unavailable')).toBeInTheDocument()
    expect(screen.queryByText(/people\/hr at its busiest/)).not.toBeInTheDocument()
  })

  it('names the user’s real threshold in the explanation, not a hardcoded one', () => {
    render(<RouteCard route={makeRoute()} recommended threshold={250} />)
    expect(screen.getByRole('button', { name: /what does low sensory mean/i })).toBeInTheDocument()
    expect(screen.getByText(/under your 250 limit/)).toBeInTheDocument()
  })

  it('flags the recommended route', () => {
    render(<RouteCard route={makeRoute()} recommended threshold={500} />)
    expect(screen.getByText('Recommended')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run it and confirm it fails**

```bash
cd frontend && npx vitest run src/components/RouteCard.test.tsx
```

Expected: FAIL — `RouteCard` does not accept `threshold`, and the anchored copy does not exist.

- [ ] **Step 3: Rewrite `frontend/src/components/SensoryBadge.tsx`**

```tsx
import './SensoryBadge.css'
import InfoTip from './InfoTip'
import { formatThreshold } from '../hooks/useSensitivity'
import type { Sensory } from '../api/types'

const LABELS: Record<Sensory['level'], string> = {
  low: 'Low Sensory',
  high: 'High Sensory',
  unavailable: 'Sensory information unavailable',
}

/**
 * "Low" also names a crowd preference in the search panel, so the badge on
 * its own is ambiguous. The tip states the comparison the badge encodes,
 * using the threshold the user actually picked.
 */
function explain(level: Sensory['level'], threshold: number): string {
  const limit = formatThreshold(threshold)
  switch (level) {
    case 'low':
      return `At its busiest, this route stays below the crowd level you chose (${limit} people/hr).`
    case 'high':
      return `At its busiest, this route is at or above the crowd level you chose (${limit} people/hr).`
    case 'unavailable':
      return "Fewer than half of this route's streets have a pedestrian sensor, so we won't guess."
  }
}

export default function SensoryBadge({
  level,
  threshold,
}: {
  level: Sensory['level']
  threshold: number
}) {
  return (
    <span className="sensory-badge-group">
      <span className={`sensory-badge sensory-badge--${level}`}>{LABELS[level]}</span>
      <InfoTip label={`What does ${LABELS[level]} mean?`} text={explain(level, threshold)} />
    </span>
  )
}
```

- [ ] **Step 4: Update `frontend/src/components/SensoryBadge.css`**

Point the three colour rules at the tokens from Task 2 and add the grouping wrapper:

```css
.sensory-badge-group {
  display: inline-flex;
  align-items: center;
  gap: 7px;
}

.sensory-badge {
  display: inline-block;
  padding: 2px 10px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 600;
  line-height: 1.6;
}

.sensory-badge--low {
  background: rgba(94, 227, 156, 0.16);
  color: var(--badge-low-ink);
}

.sensory-badge--high {
  background: rgba(194, 42, 42, 0.14);
  color: var(--badge-high-ink);
}

.sensory-badge--unavailable {
  background: rgba(120, 120, 120, 0.16);
  color: var(--badge-na-ink);
}
```

- [ ] **Step 5: Rewrite `frontend/src/components/RouteCard.tsx`**

```tsx
import SensoryBadge from './SensoryBadge'
import { formatThreshold } from '../hooks/useSensitivity'
import type { ApiRoute } from '../api/types'
import './RouteCard.css'

const TITLES: Record<ApiRoute['type'], string> = {
  quiet: 'Quiet Route',
  direct: 'Fastest Route',
}

interface RouteCardProps {
  route: ApiRoute
  recommended: boolean
  /** The crowd level the user picked, in people/hr. */
  threshold: number
}

export default function RouteCard({ route, recommended, threshold }: RouteCardProps) {
  const km = (route.distance_m / 1000).toFixed(1)
  const known = route.sensory.level !== 'unavailable'
  const peak = Math.round(route.congestion.peak)
  const side = peak < threshold ? 'under' : 'over'

  return (
    <article
      className={[
        'route-card',
        `route-card--${route.type === 'quiet' ? 'quiet' : 'fast'}`,
        recommended ? 'route-card--recommended' : '',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <header className="route-card__head">
        <h3 className="route-card__title">{TITLES[route.type]}</h3>
        {recommended && <span className="route-card__flag">Recommended</span>}
      </header>

      <p className="route-card__meta">
        {route.duration_min} min · {km} km
      </p>

      <SensoryBadge level={route.sensory.level} threshold={threshold} />

      {known && (
        <p className="route-card__detail">
          {formatThreshold(peak)} people/hr at its busiest — {side} your{' '}
          {formatThreshold(threshold)} limit
        </p>
      )}
    </article>
  )
}
```

- [ ] **Step 6: Pass the threshold down in `frontend/src/pages/RouteCompare.tsx`**

`threshold` is already destructured from `useSensitivity()`. Change the map call:

```tsx
          {routes.map((r, i) => (
            <RouteCard key={r.id} route={r} recommended={i === 0} threshold={threshold} />
          ))}
```

- [ ] **Step 7: Run the tests and confirm they pass**

```bash
cd frontend && npx vitest run && npx tsc --noEmit && npm run build
```

Expected: all RouteCard and InfoTip tests pass.

- [ ] **Step 8: Commit**

```bash
git add frontend/src/components/SensoryBadge.tsx frontend/src/components/SensoryBadge.css \
        frontend/src/components/RouteCard.tsx frontend/src/components/RouteCard.test.tsx \
        frontend/src/pages/RouteCompare.tsx
git commit -m "feat: explain what Low and High Sensory mean

The badge said 'Low Sensory' while the control above it offered a 'Low'
crowd preference — the same word for opposite ideas. The peak count now
states the comparison the badge encodes."
```

---

## Task 9: Strip the dead controls from the search panel

Comments 2a and 4.

**Files:**
- Modify: `frontend/src/components/SearchPanel.tsx`, `SearchPanel.css`

**Interfaces:**
- Consumes: `DENSITY_LABELS`, `formatThreshold`, `DENSITY_THRESHOLDS` (Task 6).
- Produces: `SearchPanelProps` loses nothing and gains nothing — the props stay exactly as they are. Only the rendered controls change.

- [ ] **Step 1: Rewrite `frontend/src/components/SearchPanel.tsx`**

Gone: the `ArrowLeft` and `Bookmark` buttons (no handlers), the whole travel-mode row and its `useState` (the planner only routes walking), and the density icons (`Mid` and `High` used the same `Users` glyph, so the icon actively failed to distinguish the options it decorated).

```tsx
import type { Place } from '../api/types'
import type { Density } from '../hooks/useSensitivity'
import { DENSITY_LABELS, DENSITY_THRESHOLDS, formatThreshold } from '../hooks/useSensitivity'
import './SearchPanel.css'

const DENSITIES: Density[] = ['low', 'mid', 'high']

interface SearchPanelProps {
  places: Place[]
  originId: number | null
  destinationId: number | null
  density: Density
  onOriginChange: (id: number | null) => void
  onDestinationChange: (id: number | null) => void
  onDensityChange: (density: Density) => void
}

export default function SearchPanel({
  places,
  originId,
  destinationId,
  density,
  onOriginChange,
  onDestinationChange,
  onDensityChange,
}: SearchPanelProps) {
  return (
    <section className="sp" aria-label="Search and preferences">
      <div className="sp__search">
        <div className="sp__rail" aria-hidden>
          <span className="sp__rail-dot sp__rail-dot--o" />
          <span className="sp__rail-line" />
          <span className="sp__rail-dot sp__rail-dot--d" />
        </div>
        <div className="sp__inputs">
          <div className="sp__input">
            <select
              aria-label="Origin"
              value={originId ?? ''}
              onChange={(e) => onOriginChange(e.target.value ? Number(e.target.value) : null)}
            >
              <option value="">Choose a starting point</option>
              {places.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
          <div className="sp__input">
            <select
              aria-label="Destination"
              value={destinationId ?? ''}
              onChange={(e) => onDestinationChange(e.target.value ? Number(e.target.value) : null)}
            >
              <option value="">Choose a destination</option>
              {places.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* The routing graph is built from pedestrian sensors, so walking is the
          only mode the planner can produce. Stating it beats offering three
          buttons that cannot work. */}
      <p className="sp__mode-note">Walking routes</p>

      <div className="sp__group">
        <h4 className="sp__label">HOW BUSY IS TOO BUSY?</h4>
        <div className="sp__pill-row sp__pill-row--three" role="tablist" aria-label="Crowd level">
          {DENSITIES.map((id) => (
            <button
              key={id}
              role="tab"
              aria-selected={density === id}
              className={`sp__density${density === id ? ' sp__density--active' : ''}`}
              onClick={() => onDensityChange(id)}
            >
              <span className="sp__density-name">{DENSITY_LABELS[id]}</span>
              <span className="sp__density-rate">{formatThreshold(DENSITY_THRESHOLDS[id])}/hr</span>
            </button>
          ))}
        </div>
      </div>
    </section>
  )
}
```

- [ ] **Step 2: Update `frontend/src/components/SearchPanel.css`**

Delete the `.sp__top`, `.sp__icon-btn`, `.sp__icon-btn:hover` and `.sp__mode` rules (including `.sp__mode:hover` and any `.sp__mode--active`). Change `.sp__pill-row` off a four-column default, and restyle the density pill to stack its two lines:

```css
.sp__pill-row {
  background: var(--card-2);
  border-radius: var(--radius-pill);
  padding: 6px;
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 4px;
}

.sp__mode-note {
  margin: 0;
  font-size: 13px;
  font-weight: 600;
  color: var(--mute);
}

.sp__density {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1px;
  padding: 8px 6px;
  border-radius: var(--radius-pill);
  color: var(--mute);
  transition: all var(--dur-1) var(--ease);
}

.sp__density:hover {
  color: var(--ink);
}

.sp__density-name {
  font-size: 13px;
  font-weight: 600;
}

.sp__density-rate {
  font-size: 10.5px;
  font-weight: 500;
  opacity: 0.85;
}
```

Leave the existing `.sp__density--active` rule as it is.

- [ ] **Step 3: Confirm the dead controls are gone**

```bash
cd frontend/src
grep -rn "ArrowLeft\|Bookmark\|TravelMode\|sp__icon-btn\|sp__top\|sp__mode--active" . ; echo "exit: $?"
```

Expected: no matches. `.sp__mode-note` is a different class and will not match `sp__mode--active`.

- [ ] **Step 4: Verify and commit**

```bash
cd frontend && npx tsc --noEmit && npm run build && npx vitest run
```

```bash
git add frontend/src/components/SearchPanel.tsx frontend/src/components/SearchPanel.css
git commit -m "feat: remove the controls that never did anything

Back, bookmark and three of four travel modes had no handler at all.
The crowd pills now carry their threshold so 'Low' is unambiguous."
```

---

## Task 10: Cut the footer down

Comment 5.

**Files:**
- Modify: `frontend/src/components/Footer.tsx`, `Footer.css`

**Interfaces:**
- Consumes: `--brand-ink` (Task 2); the `.hw-header__logo` chip pattern from Task 5, mirrored here.
- Produces: `<Footer />`, unchanged signature.

- [ ] **Step 1: Replace `frontend/src/components/Footer.tsx` entirely**

25 links, all `href="#"`, become 4 real routes. The socials go — no accounts exist. The local `XIcon` SVG goes with them.

```tsx
import { Link } from 'react-router-dom'
import { Flower2 } from 'lucide-react'
import './Footer.css'

const links = [
  { to: '/explore', label: 'Explore' },
  { to: '/quietplace', label: 'QuietPlace' },
  { to: '/resources', label: 'Resources' },
  { to: '/contact', label: 'Contact' },
]

export default function Footer() {
  return (
    <footer className="hw-footer">
      <div className="hw-footer__inner">
        <Link to="/" className="hw-footer__brand">
          <span className="hw-footer__logo" aria-hidden>
            <Flower2 size={17} strokeWidth={2.4} />
          </span>
          <span>HushWay</span>
        </Link>

        <nav className="hw-footer__links" aria-label="Footer navigation">
          {links.map((link) => (
            <Link key={link.to} to={link.to}>
              {link.label}
            </Link>
          ))}
        </nav>
      </div>

      <p className="hw-footer__legal">© 2026 HushWay. Built for Monash FIT5120 Studio</p>
    </footer>
  )
}
```

- [ ] **Step 2: Replace `frontend/src/components/Footer.css` entirely**

```css
.hw-footer {
  background: var(--bg);
  border-top: 1px solid var(--line-2);
  padding: 24px 0 20px;
}

.hw-footer__inner {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 16px;

  max-width: 1200px;
  margin: 0 auto;
  padding: 0 40px;
}

.hw-footer__brand {
  display: inline-flex;
  align-items: center;
  gap: 9px;
  font-size: 18px;
  font-weight: 700;
  color: var(--brand-ink);
  letter-spacing: -0.3px;
}

.hw-footer__logo {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 27px;
  height: 27px;
  border-radius: 8px;
  background: var(--yellow);
  color: var(--brand-ink);
  flex-shrink: 0;
}

.hw-footer__links {
  display: flex;
  flex-wrap: wrap;
  gap: 22px;
}

.hw-footer__links a {
  color: var(--mute);
  font-size: 14px;
  transition: color var(--dur-1) var(--ease);
}

.hw-footer__links a:hover {
  color: var(--ink);
}

.hw-footer__legal {
  max-width: 1200px;
  margin: 14px auto 0;
  padding: 0 40px;
  color: var(--mute);
  font-size: 13px;
}

@media (max-width: 560px) {
  .hw-footer__inner {
    flex-direction: column;
    align-items: flex-start;
  }
}
```

- [ ] **Step 3: Verify the height actually came down**

```bash
cd frontend && npx tsc --noEmit && npm run build
```

With the dev server running, open the home page and measure the footer in devtools. Expected: roughly 110px, down from roughly 400px. Confirm no link resolves to `#`.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/Footer.tsx frontend/src/components/Footer.css
git commit -m "feat: cut the footer from 25 dead links to 4 real ones

Every link was href='#', including an Accessibility Statement and a
Privacy Policy. Those return when the pages do."
```

---

## Task 11: Link the map and the route cards

Comment 2c.

**Files:**
- Create: `frontend/src/components/MapRouteLayer.tsx`
- Modify: `frontend/src/components/MapView.tsx`, `frontend/src/components/RouteCard.tsx`, `RouteCard.css`, `frontend/src/pages/RouteCompare.tsx`, `frontend/src/components/RouteCard.test.tsx`

**Interfaces:**
- Consumes: `--route-quiet`, `--route-direct` (Task 2); `RouteCard` (Task 8).
- Produces:
  - `<MapRouteLayer routes={ApiRoute[]} selectedId={string | null} onSelect={(id: string) => void} />`
  - `<MapView routes={ApiRoute[]} center?={LatLng} selectedId={string | null} onSelect={(id: string) => void} />`
  - `RouteCard` gains `selected: boolean` and `onSelect: (id: string) => void`

- [ ] **Step 1: Add the failing selection tests to `frontend/src/components/RouteCard.test.tsx`**

Append these, and add `import { vi } from 'vitest'` plus `import userEvent from '@testing-library/user-event'` at the top:

```tsx
describe('RouteCard selection', () => {
  it('reports its id when clicked', async () => {
    const user = userEvent.setup()
    const onSelect = vi.fn()
    render(
      <RouteCard
        route={makeRoute()}
        recommended
        threshold={500}
        selected={false}
        onSelect={onSelect}
      />,
    )

    await user.click(screen.getByRole('button', { name: /quiet route/i }))

    expect(onSelect).toHaveBeenCalledWith('r1')
  })

  it('is reachable and operable by keyboard', async () => {
    const user = userEvent.setup()
    const onSelect = vi.fn()
    render(
      <RouteCard
        route={makeRoute()}
        recommended
        threshold={500}
        selected={false}
        onSelect={onSelect}
      />,
    )

    const card = screen.getByRole('button', { name: /quiet route/i })
    card.focus()
    await user.keyboard('{Enter}')

    expect(onSelect).toHaveBeenCalledWith('r1')
  })

  it('exposes its selected state to assistive tech, not by colour alone', () => {
    render(
      <RouteCard
        route={makeRoute()}
        recommended
        threshold={500}
        selected
        onSelect={() => {}}
      />,
    )
    expect(screen.getByRole('button', { name: /quiet route/i })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
  })
})
```

Update the six existing tests to pass `selected={false} onSelect={() => {}}`.

- [ ] **Step 2: Run and confirm it fails**

```bash
cd frontend && npx vitest run src/components/RouteCard.test.tsx
```

Expected: FAIL — `RouteCard` has no `selected`/`onSelect` props and renders no button.

- [ ] **Step 3: Make the card selectable — `frontend/src/components/RouteCard.tsx`**

Extend the props and wrap the `<article>` content in a button. Change the interface to:

```tsx
interface RouteCardProps {
  route: ApiRoute
  recommended: boolean
  /** The crowd level the user picked, in people/hr. */
  threshold: number
  selected: boolean
  onSelect: (id: string) => void
}
```

and the component body's return to:

```tsx
  return (
    <article
      className={[
        'route-card',
        `route-card--${route.type === 'quiet' ? 'quiet' : 'fast'}`,
        recommended ? 'route-card--recommended' : '',
        selected ? 'route-card--selected' : '',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <button
        type="button"
        className="route-card__select"
        aria-pressed={selected}
        onClick={() => onSelect(route.id)}
      >
        <span className="route-card__head">
          <span className="route-card__title">{TITLES[route.type]}</span>
          {recommended && <span className="route-card__flag">Recommended</span>}
        </span>

        <span className="route-card__meta">
          {route.duration_min} min · {km} km
        </span>
      </button>

      <SensoryBadge level={route.sensory.level} threshold={threshold} />

      {known && (
        <p className="route-card__detail">
          {formatThreshold(peak)} people/hr at its busiest — {side} your{' '}
          {formatThreshold(threshold)} limit
        </p>
      )}
    </article>
  )
```

The `<h3>` becomes a `<span>` because it now sits inside a button, where heading semantics are not allowed. The button's accessible name comes from its text content, which still starts with the route title.

- [ ] **Step 4: Add the selection styles to `frontend/src/components/RouteCard.css`**

```css
.route-card__select {
  display: flex;
  flex-direction: column;
  gap: 8px;
  width: 100%;
  text-align: left;
  color: inherit;
  cursor: pointer;
}

.route-card__head {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  gap: 12px;
}

.route-card__title {
  font-size: 20px;
  font-weight: 700;
  letter-spacing: -0.4px;
  color: inherit;
}

/* Selection is a border plus aria-pressed, never colour alone. */
.route-card--selected {
  border-color: currentColor;
  box-shadow: var(--shadow-sm);
}
```

Then delete the now-superseded `.route-card__head` and `.route-card__title` blocks that Task 3 added, so each class has exactly one rule. Confirm with:

```bash
cd frontend/src && grep -c "^\.route-card__head {" components/RouteCard.css && grep -c "^\.route-card__title {" components/RouteCard.css
```

Expected: `1` and `1`.

- [ ] **Step 5: Create `frontend/src/components/MapRouteLayer.tsx`**

Kept out of `MapView` because it needs `useMap`, which only works inside `MapContainer`.

```tsx
import { useEffect } from 'react'
import { Polyline, useMap } from 'react-leaflet'
import type { ApiRoute } from '../api/types'

// Leaflet paints onto a canvas and cannot read CSS custom properties, so
// these must repeat the values of --route-quiet and --route-direct.
// MapRouteLayer.test.ts asserts they have not drifted from tokens.css.
const COLORS: Record<ApiRoute['type'], string> = {
  quiet: '#1E8A54',
  direct: '#C22A2A',
}

interface MapRouteLayerProps {
  routes: ApiRoute[]
  selectedId: string | null
  onSelect: (id: string) => void
}

export default function MapRouteLayer({ routes, selectedId, onSelect }: MapRouteLayerProps) {
  const map = useMap()
  const selected = routes.find((route) => route.id === selectedId)

  useEffect(() => {
    if (selected && selected.path.length > 0) {
      map.fitBounds(selected.path, { padding: [40, 40] })
    }
  }, [map, selected])

  return (
    <>
      {routes.map((route) => {
        const isSelected = route.id === selectedId
        const dimmed = selectedId !== null && !isSelected
        return (
          <Polyline
            key={route.id}
            positions={route.path}
            pathOptions={{
              color: COLORS[route.type],
              weight: isSelected ? 8 : 5,
              opacity: dimmed ? 0.35 : 0.9,
            }}
            eventHandlers={{ click: () => onSelect(route.id) }}
          />
        )
      })}
    </>
  )
}
```

- [ ] **Step 5b: Stop the map colours drifting — `frontend/src/components/MapRouteLayer.test.ts`**

Two copies of a colour is two chances to change only one. Task 2 raised the quiet line from an invisible 1.37:1; this keeps it raised.

```ts
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const tokens = readFileSync(resolve(__dirname, '../styles/tokens.css'), 'utf8')
const layer = readFileSync(resolve(__dirname, 'MapRouteLayer.tsx'), 'utf8')

function token(name: string): string {
  const match = tokens.match(new RegExp(`--${name}\\s*:\\s*(#[0-9a-fA-F]{6})`))
  if (!match) throw new Error(`token --${name} not found`)
  return match[1].toUpperCase()
}

function literal(key: string): string {
  const match = layer.match(new RegExp(`${key}:\\s*'(#[0-9a-fA-F]{6})'`))
  if (!match) throw new Error(`colour literal for ${key} not found`)
  return match[1].toUpperCase()
}

describe('map route colours', () => {
  it('the quiet line matches --route-quiet', () => {
    expect(literal('quiet')).toBe(token('route-quiet'))
  })

  it('the direct line matches --route-direct', () => {
    expect(literal('direct')).toBe(token('route-direct'))
  })
})
```

Run `npx vitest run src/components/MapRouteLayer.test.ts` — both should pass.

- [ ] **Step 6: Simplify `frontend/src/components/MapView.tsx`**

```tsx
import { MapContainer, TileLayer } from 'react-leaflet'
import MapRouteLayer from './MapRouteLayer'
import type { ApiRoute, LatLng } from '../api/types'
import './MapView.css'

const MELBOURNE_CBD: LatLng = [-37.8136, 144.9631]

export default function MapView({
  routes = [],
  center = MELBOURNE_CBD,
  selectedId = null,
  onSelect = () => {},
}: {
  routes?: ApiRoute[]
  center?: LatLng
  selectedId?: string | null
  onSelect?: (id: string) => void
}) {
  return (
    <div className="hw-map">
      <MapContainer center={center} zoom={14} scrollWheelZoom className="hw-map__container">
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <MapRouteLayer routes={routes} selectedId={selectedId} onSelect={onSelect} />
      </MapContainer>
    </div>
  )
}
```

- [ ] **Step 7: Hold the selection in `frontend/src/pages/RouteCompare.tsx`**

Add to the existing `useState` block:

```tsx
  const [selectedRouteId, setSelectedRouteId] = useState<string | null>(null)
```

Clear it whenever a new plan arrives, so a stale id cannot dim both lines:

```tsx
  useEffect(() => {
    setSelectedRouteId(null)
  }, [originId, destinationId, threshold])
```

Then thread it through both consumers:

```tsx
          {routes.map((r, i) => (
            <RouteCard
              key={r.id}
              route={r}
              recommended={i === 0}
              threshold={threshold}
              selected={r.id === selectedRouteId}
              onSelect={setSelectedRouteId}
            />
          ))}
```

```tsx
          <MapView routes={routes} selectedId={selectedRouteId} onSelect={setSelectedRouteId} />
```

- [ ] **Step 8: Run the tests and confirm they pass**

```bash
cd frontend && npx vitest run && npx tsc --noEmit && npm run build
```

- [ ] **Step 9: Check it by hand**

With `./scripts/dev.sh` running, plan Parliament Station → Federation Square. Click the Quiet Route card: its line should thicken, the other should fade, and the map should zoom to fit. Click the red line on the map: the Fastest Route card should become the selected one. Tab to a card and press Enter — same behaviour.

- [ ] **Step 10: Commit**

```bash
git add frontend/src/components/MapRouteLayer.tsx frontend/src/components/MapView.tsx \
        frontend/src/components/RouteCard.tsx frontend/src/components/RouteCard.css \
        frontend/src/components/RouteCard.test.tsx frontend/src/pages/RouteCompare.tsx
git commit -m "feat: link route cards to their lines on the map"
```

---

## Task 12: Give the home page something to do

Comment 2b.

**Files:**
- Create: `frontend/src/hooks/useReveal.ts`, `frontend/src/pages/Home.sections.tsx`
- Modify: `frontend/src/pages/Home.tsx`, `Home.css`

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces: `useReveal<T extends HTMLElement>(): { ref: RefObject<T>, revealed: boolean }`; `<HowItWorks />` and `<EntryCards />` from `Home.sections.tsx`.

- [ ] **Step 1: Create `frontend/src/hooks/useReveal.ts`**

Defaults to revealed when `IntersectionObserver` is unavailable or motion is reduced — content must never be stuck invisible.

```ts
import { useEffect, useRef, useState } from 'react'

/** Reveal on first scroll into view. Inert under reduced motion. */
export function useReveal<T extends HTMLElement>() {
  const ref = useRef<T>(null)
  const [revealed, setRevealed] = useState(false)

  useEffect(() => {
    const node = ref.current
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

    // Never leave content hidden if we cannot observe it or must not animate.
    if (!node || reduced || typeof IntersectionObserver === 'undefined') {
      setRevealed(true)
      return
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setRevealed(true)
          observer.disconnect()
        }
      },
      { threshold: 0.15 },
    )

    observer.observe(node)
    return () => observer.disconnect()
  }, [])

  return { ref, revealed }
}
```

- [ ] **Step 2: Create `frontend/src/pages/Home.sections.tsx`**

```tsx
import { Link } from 'react-router-dom'
import { useReveal } from '../hooks/useReveal'

const STEPS = [
  {
    n: '1',
    title: 'Pick your two points',
    body: 'Choose a starting point and a destination anywhere in the Melbourne CBD.',
  },
  {
    n: '2',
    title: 'Say how much crowding you can take',
    body: 'Low, Mid or High — each one is a real pedestrian count per hour, not a vague setting.',
  },
  {
    n: '3',
    title: 'Compare calm against fast',
    body: 'Two routes, side by side, each labelled with how busy its worst stretch actually gets.',
  },
]

export function HowItWorks() {
  const { ref, revealed } = useReveal<HTMLElement>()

  return (
    <section
      ref={ref}
      className={`home-how${revealed ? ' home-how--in' : ''}`}
      aria-labelledby="home-how-title"
    >
      <h2 id="home-how-title" className="home-how__title">
        How it works
      </h2>
      <ol className="home-how__steps">
        {STEPS.map((step) => (
          <li key={step.n} className="home-how__step">
            <span className="home-how__num" aria-hidden>
              {step.n}
            </span>
            <h3 className="home-how__step-title">{step.title}</h3>
            <p className="home-how__step-body">{step.body}</p>
          </li>
        ))}
      </ol>
    </section>
  )
}

const ENTRIES = [
  { to: '/explore', title: 'Plan a calm route', body: 'Compare a quieter walk against the quickest one.' },
  { to: '/quietplace', title: 'Find a quiet place', body: 'Sanctuaries and low-stimulation spots around the CBD.' },
  { to: '/resources', title: 'What the badges mean', body: 'How crowd data becomes a Low or High Sensory label.' },
]

export function EntryCards() {
  const { ref, revealed } = useReveal<HTMLElement>()

  return (
    <section
      ref={ref}
      className={`home-entry${revealed ? ' home-entry--in' : ''}`}
      aria-label="Where to start"
    >
      {ENTRIES.map((entry) => (
        <Link key={entry.to} to={entry.to} className="home-entry__card">
          <h3 className="home-entry__title">{entry.title}</h3>
          <p className="home-entry__body">{entry.body}</p>
          <span className="home-entry__go" aria-hidden>
            →
          </span>
        </Link>
      ))}
    </section>
  )
}
```

- [ ] **Step 3: Mount them in `frontend/src/pages/Home.tsx`**

```tsx
import { Link } from 'react-router-dom'
import Header from '../components/Header'
import Footer from '../components/Footer'
import { HowItWorks, EntryCards } from './Home.sections'
import './Home.css'

export default function Home() {
  return (
    <div className="home">
      <section className="home__hero">
        <div className="home__hero-bg" aria-hidden />
        <div className="home__hero-tint" aria-hidden />
        <Header variant="overlay" />

        <div className="home__hero-content">
          <h1 className="home__title">HushWay</h1>
          <p className="home__subtitle">A Quiet Journey</p>
          <div className="home__ctas">
            <Link to="/explore" className="home__cta">Explore</Link>
            <Link to="/quietplace" className="home__cta home__cta--ghost">Quiet</Link>
          </div>
        </div>
      </section>

      <HowItWorks />
      <EntryCards />

      <Footer />
    </div>
  )
}
```

- [ ] **Step 4: Append the styles to `frontend/src/pages/Home.css`**

```css
/* ---------------------------------------------------------------- sections */

.home-how,
.home-entry {
  max-width: 1100px;
  margin: 0 auto;
  padding: 0 40px;

  opacity: 0;
  transform: translateY(18px);
  transition: opacity var(--dur-3) var(--ease), transform var(--dur-3) var(--ease);
}

.home-how--in,
.home-entry--in {
  opacity: 1;
  transform: none;
}

/* The global reduced-motion guard zeroes the duration; make sure the content
   is visible regardless of which class is on the element. */
@media (prefers-reduced-motion: reduce) {
  .home-how,
  .home-entry {
    opacity: 1;
    transform: none;
  }
}

.home-how {
  padding-top: 72px;
  padding-bottom: 8px;
}

.home-how__title {
  margin: 0 0 28px;
  font-size: 30px;
  font-weight: 700;
  letter-spacing: -0.6px;
  color: var(--ink);
}

.home-how__steps {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 28px;
}

.home-how__num {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 30px;
  margin-bottom: 12px;
  border-radius: 50%;
  background: var(--yellow);
  color: var(--brand-ink);
  font-size: 14px;
  font-weight: 700;
}

.home-how__step-title {
  margin: 0 0 6px;
  font-size: 16px;
  font-weight: 700;
  color: var(--ink);
}

.home-how__step-body {
  margin: 0;
  font-size: 14.5px;
  line-height: 1.5;
  color: var(--mute);
}

.home-entry {
  padding-top: 52px;
  padding-bottom: 76px;
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 20px;
}

.home-entry__card {
  position: relative;
  display: block;
  padding: 22px 20px 26px;
  background: var(--card);
  border: 1px solid var(--line);
  border-radius: var(--radius);
  box-shadow: var(--shadow-xs);
  transition: transform var(--dur-2) var(--ease), box-shadow var(--dur-2) var(--ease);
}

.home-entry__card:hover {
  transform: translateY(-3px);
  box-shadow: var(--shadow);
}

.home-entry__title {
  margin: 0 0 6px;
  font-size: 17px;
  font-weight: 700;
  color: var(--ink);
}

.home-entry__body {
  margin: 0;
  font-size: 14px;
  line-height: 1.5;
  color: var(--mute);
}

.home-entry__go {
  position: absolute;
  right: 20px;
  bottom: 16px;
  font-size: 17px;
  color: var(--teal);
}

@media (max-width: 860px) {
  .home-how__steps,
  .home-entry {
    grid-template-columns: 1fr;
  }
}
```

- [ ] **Step 5: Verify**

```bash
cd frontend && npx tsc --noEmit && npm run build && npx vitest run
```

Open the home page and scroll — the two sections should fade up as they enter view. Then set macOS System Settings → Accessibility → Display → Reduce Motion, reload, and confirm both sections are **visible immediately**, not stuck at `opacity: 0`.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/hooks/useReveal.ts frontend/src/pages/Home.sections.tsx \
        frontend/src/pages/Home.tsx frontend/src/pages/Home.css
git commit -m "feat: give the home page content below the hero"
```

---

## Task 13: Remove the fake weather, harden dev.sh, finish the audit

Comment 4's last item, plus the documentation the whole change set needs.

**Files:**
- Modify: `frontend/src/pages/RouteCompare.tsx`, `RouteCompare.css`, `frontend/src/pages/RefugeMap.tsx`, `RefugeMap.css`, `scripts/dev.sh`, `README.md`, `docs/2026-08-13-ui-feedback-design.md`

**Interfaces:**
- Consumes: everything above.
- Produces: nothing new.

- [ ] **Step 1: Remove the fabricated weather widget**

It reads `weather.temperatureC` from `mockData.ts` and presents an invented 15° as live data. In `frontend/src/pages/RouteCompare.tsx`, delete the `Cloud` import, the `weather` import, and this block:

```tsx
            <div className="rc-page__weather">
              <Cloud size={16} />
              <span>{weather.temperatureC}°</span>
            </div>
```

Do the same in `frontend/src/pages/RefugeMap.tsx` (it imports `Cloud` too). Then delete the `.rc-page__weather` rule from `RouteCompare.css` and its equivalent in `RefugeMap.css`.

- [ ] **Step 2: Confirm no fabricated weather survives**

```bash
cd frontend/src
grep -rn "weather\|temperatureC\|Cloud" . ; echo "exit: $?"
```

Expected: matches only inside `mockData.ts` itself (leave the fixture alone — other EPIC-2 pages may use it) and nothing in `RouteCompare` or `RefugeMap`.

- [ ] **Step 3: Make `scripts/dev.sh` detect a broken install, not just a missing one**

This is what cost an hour today: `node_modules/` existed but had been gutted, so the `-d` check passed and Vite failed later with an opaque "Cannot find package 'vite'". Replace the check at line 82:

```sh
if [ ! -x frontend/node_modules/.bin/vite ]; then
  echo "ERROR: frontend dependencies are missing or incomplete."
  echo "       cd frontend && npm ci"
  exit 1
fi
```

- [ ] **Step 4: Update `README.md`**

- Delete the bullet: "Sign-in and registration are presentational only — there is no authentication yet."
- In the **Tests** section, add the new frontend command:

```bash
cd frontend && npm test           # unit tests: contrast, palette, InfoTip, RouteCard
```

- In the walkthrough, the browser instructions say *Click the **High** crowd-density pill*. The pills now read `High 1,000/hr`. Update both mentions so the instructions match what is on screen.

- [ ] **Step 5: Append the audit table to the spec**

Walk `/`, `/explore`, `/quietplace`, `/community`, `/resources` and `/contact`. For every text and non-text UI element, record the measured ratio in a new "Audit results" section at the end of `docs/2026-08-13-ui-feedback-design.md`, including the sampled hero-scrim value from Task 5 Step 3. Any element under its floor gets fixed and re-measured before this task is done.

- [ ] **Step 6: Full verification**

```bash
cd frontend && npm test && npx tsc --noEmit && npm run build
cd ../backend && python -m pytest
```

Expected: frontend tests pass, tsc clean, build succeeds, and the backend's 45 unit + 18 integration tests still pass — no backend file was touched, so a failure here means something went wrong.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "chore: drop the fake weather, harden dev.sh, record the audit

The weather widget showed a hardcoded 15° from mockData as if it were
live. dev.sh only checked that node_modules existed, so a gutted install
failed later with an opaque Vite error."
```

---

## Traceability

| Review comment | Tasks |
| --- | --- |
| 1. Low/high sensory confusing | 6, 7, 8 (and 9 for the preference-pill collision) |
| 2. Website should be interactive | 9 (dead controls), 12 (static home), 11 (map ↔ cards) |
| 3. Remove Login | 4 |
| 4. Unnecessary icons | 9 (back, bookmark, modes, density icons), 10 (socials), 13 (weather) |
| 5. Footer too big | 10 |
| 6. Font/colour not visible | 2 (palette), 3 (unstyled route card), 5 (wordmark + scrim), 13 (audit) |
