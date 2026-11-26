# Influx design system

One system for the public site and the app. Tokens live in `src/app/globals.css`
(CSS variables) and are exposed to Tailwind in `tailwind.config.ts`. Reusable
classes are in the `@layer components` block of `globals.css`; reusable React
pieces are in `src/components/ui.tsx`.

## Principles

1. **Show the product, with real data.** Public pages render the same creator table
   the app uses, filled from the database. No sample names, no invented numbers. A
   figure on a page is either live or dated ("November 2026").
2. **Compact and functional.** Tables and hairline-divided rows before cards. A card
   is a surface for one object (a table, a form, a plan), not a layout device.
3. **One accent.** Indigo marks the primary action and the current selection.
   Green, amber and red are only for status.
4. **Plain words.** Sentence case everywhere. Buttons say what happens ("Draft
   outreach email"). No internal terms (quota, pipeline jobs, scraping) in the UI.

## Data rules

- **One definition of "listed":** passes the four checks, uploaded in the last 45
  days, has not asked to be removed. Totals come from `getLibraryCounts()`
  (`src/lib/library-counts.ts`) and list counts from `getSeoData()`; do not count
  creators anywhere else, or pages will disagree.
- **Default ranking is recent average views** (last five videos), in the library
  and on every public list. Subscribers are shown, never used to rank by default.
- **Independent creators by default.** Studios, networks, labels and brands
  (`channel_kind = organisation`) are kept out of public lists and behind the
  "Creator type" filter in the library.
- **Small creators:** channels under 50K subscribers in a known US/EU country also pass with
  1,500+ recent average views and 3%+ engagement (`passesMicroBar` in `quality-gate.ts`).
- Public data pages revalidate hourly.

## Tokens

### Colour

| Token | Value | Use |
| --- | --- | --- |
| `canvas` | `#FAF9F7` | Page background |
| `surface` | `#FFFFFF` | Tables, forms, cards, inputs |
| `subtle` | `#F3F1EE` | Row hover, neutral tags, skeletons |
| `line` | `#E6E3DE` | Default border and dividers |
| `line-strong` | `#D0CCC5` | Input and secondary-button borders |
| `fg` | `#1A1917` | Primary text |
| `muted` | `#63605A` | Secondary text (6.1:1 on canvas) |
| `faint` | `#8A867F` | Placeholders, disabled, empty-cell dashes only |
| `accent` | `#4338CA` | Primary buttons, links, selected state (7.4:1 on white) |
| `accent-hover` | `#3730A3` | Hover for the above |
| `accent-soft` | `#EEF0FF` | Selected rows, active filters |
| `success` / `-soft` | `#156F3D` / `#E7F5EC` | Passing, has email, replied |
| `warn` / `-soft` | `#9A5207` / `#FDF3E1` | Inactive, stale numbers |
| `danger` / `-soft` | `#B42318` / `#FDECEA` | Errors |

Do not use raw Tailwind palette colours (`slate-*`, `emerald-*`, hex values).
Every text/background pair above meets WCAG AA.

### Type

Inter only (`next/font`), with `tabular-nums` on every number in a table or stat.

| Class | Size / weight | Use |
| --- | --- | --- |
| `.h-display` | 32–44px / 600, -0.025em | Homepage headline only |
| `.h-page` | 20–24px / 600 | One per page |
| `.h-section` | 16px / 600 | Section and card titles |
| body | 14px / 400 | App default |
| `.text-body` | 15px / 400, muted | Long-form public copy |
| table, controls | 13px | Tables, filters, small buttons |
| caption | 12px | Table headers, helper text, tags |

Nothing below 12px. No uppercase labels, no monospace, no label sitting above a
heading.

### Space, radius, elevation

- Spacing is the Tailwind 4px scale. Common steps: 4, 8, 12, 16, 24, 32, 48.
- Radius: 4px (tags, inner segments), 6px (buttons, inputs), 8px (cards, tables).
  Nothing rounder except avatars (circle).
- No shadows on page content. `shadow-pop` is for modals only.
- No gradients, blurs, or decorative backgrounds.

### Icons

`lucide-react` only. 16px with `strokeWidth={1.75}` next to text and in nav;
15px inside buttons; 14px in small buttons and chevrons. Decorative icons get
`aria-hidden`; icon-only buttons use `<IconButton label="…">`.

## Components

| Component | Where | Notes |
| --- | --- | --- |
| `.btn-primary` `.btn-secondary` `.btn-ghost` | globals.css | 36px. Add `.btn-sm` (32px) in toolbars and tables, `.btn-lg` (44px) for the homepage hero. One primary button per view. |
| `.input-field`, `.field-label` | globals.css | 36px inputs with a visible label. Hover, focus, disabled styled. |
| `FilterSelect`, `FilterBar` | FilterBar.tsx | 32px selects whose default option names the field ("All niches"); active filters turn indigo. Scrolls sideways on phones. |
| `CreatorTable` | ui.tsx | The only way creators are listed in the app and on the homepage. Columns drop by breakpoint: phone shows creator + subscribers + actions. |
| `CreatorRankList` | seo/ | Public ranked lists; same row anatomy with a rank column. |
| `Avatar` | ui.tsx | Real channel thumbnail, falls back to an initial if missing or broken. |
| `StatusTag` | ui.tsx | Tones: neutral, accent, success, warn, danger. |
| `IconButton` | ui.tsx | 28px, needs a `label` (used for `aria-label` and tooltip). |
| `TableSkeleton`, `.skeleton` | ui.tsx | Loading state shaped like the content. |
| `EmptyState` | ui.tsx | Says what is empty and offers the next action. |
| `ErrorState` | ui.tsx | Says what failed, with "Try again". |
| `PlanCards` | PlanCards.tsx | The two plans. Shows no Pro price while payments are off. |
| `MarketingShell` | MarketingShell.tsx | Public header and footer. |

## States

Every data view handles five states: loading (skeleton), empty (`EmptyState`),
error (`ErrorState` with retry), partial (dash in the cell), and ready. Interactive
elements have hover, `:focus-visible` (2px indigo outline, set globally), disabled
and, where relevant, selected (`aria-pressed` / `aria-current`).

## Writing

- Sentence case. No exclamation marks, arrows or emoji in UI text.
- Name things as a marketer would: creators, campaign lists, outreach, replied.
- Errors say what happened and what to do next.
- Don't state a number, price or feature that the product can't back up today.
  Pro has no public price until payments are switched on.

## Adding a page

1. Start from `MarketingShell` (public) or the `(app)` layout.
2. One `.h-page`, a `.page-subtitle` if the page needs explaining, primary action top right.
3. List data in a table; use `card` only as the table's or form's surface.
4. Use tokens and the classes above. If something is missing, add it here first.
