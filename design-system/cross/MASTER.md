# Cross — Night Session design system

Signature: ink and slate surfaces, gilt gold as the one accent, small architectural radii (cut-metal-plate corners, not soft pills), elevation over outlines, frosted-glass navigation, smooth `cubic-bezier(.4,0,.2,1)` motion. Lifted from the "Night Session" landing direction (`/preview/c`, `web/app/landing.css`'s `.pv-c` rules) and given a paper counterpart for light mode — the two are the same world (ink/gilt/bone) with the roles of background and text swapped, not two unrelated palettes.

Replaces the previous Apple/HIG blue-accent system, which itself replaced the original "Ballot / Ink editorial" system. The class *names* survive across all three systems (`.ink-stamp`, `.eyebrow`, `.tally`, `.ballot-rule`, `.nav-pen-mark`, `--pen`) and were redefined in place again — that is why no screen JSX needed rewriting for this pass either. Don't rename them; the ~70 consumers would all have to change for zero visual gain.

## Fonts — unchanged

| Role | Face | CSS var | Tailwind |
|---|---|---|---|
| Display | Zodiak → serif system fallback | `--font-display` | `font-display` |
| Body | Switzer → sans system fallback | `--font-body` | `font-sans` (default) |
| Data/mono | Azeret Mono → ui-monospace | `--font-data` | `font-data` / `font-mono` |

Loaded via Fontshare (Zodiak, Switzer) and Google Fonts (Azeret Mono) `<link>` tags in `web/app/layout.tsx`, app-wide. The Night Session redesign changed colors, radii, shadows, and a couple of utility classes' visual character — it deliberately did **not** touch the type program, so don't reach for Boska/Satoshi (the fonts `/preview/c` itself uses) here; Zodiak/Switzer/Azeret Mono are the app's typeface identity independent of which color system sits underneath.

Body carries `letter-spacing: -0.01em`, headings `-0.022em`, page titles `-0.03em` — unchanged from the prior system, still tuned close enough to Zodiak/Switzer's own spacing that it wasn't worth re-deriving.

## Color tokens (`web/app/globals.css`)

Semantic vars on `:root` (light), `:root.dark` (dark), and `:root.pink` (pink), plus an `@media (prefers-color-scheme: dark)` fallback for `:root:not(.light):not(.pink)` — the `:not(.pink)` matters: without it, that rule and `:root.pink` tie on specificity and an explicit "pink" pick could lose to the OS's dark preference depending on source order.

**Light ("paper" — same world as dark, roles swapped)**
```
--paper #f1ece1      --paper-raised #fbf9f4
--ink   #16161a      --ink-soft     #736b5c
--rule  rgba(20,18,14,.13)          --secondary  #e8e0d0
--pen   #84631a (gilt, darkened for AA on paper, 4.7:1)
--highlight #3f5872 (slate-blue)
--success #4c7a40    --destructive  #9c4a32
--on-pen #fbf9f4 (text drawn on a filled --pen surface)
```

**Dark ("Night Session" proper)**
```
--paper #08090c      --paper-raised #141922
--ink   #e8e4dc       --ink-soft    #a19c8f
--rule  rgba(232,228,220,.14)       --secondary  #1c222c
--pen   #c9a227 (gilt)
--highlight #8fa8c9 (slate-blue)
--success #7a9b5e     --destructive #c17a5f
--on-pen #14120a
```

**Pink** — a third, explicitly-chosen palette (never reached from "system"; there is no OS-level "prefers pink" media query). Same construction as light: blush paper, near-black-plum ink, a rose/berry `--pen` standing in for gilt. `--highlight`/`--success`/`--destructive` keep their light-theme hue families (cool slate-blue, moss, terracotta) rather than shifting toward pink too, so a severity tag or an error still reads as a distinct color next to the rose accent instead of blending into it.
```
--paper #fbeef0      --paper-raised #fffbfc
--ink   #2a1620      --ink-soft     #7a5762
--rule  rgba(42,22,32,.12)          --secondary  #f3dce1
--pen   #a13a6c (rose/berry, 5.6:1 on paper)
--highlight #4d6480  --success #436b3c  --destructive #9c4a32
--on-pen #fff7f9
```

Page background is warm paper / near-black ink; cards lift just above it (`--paper-raised`), and in dark mode specifically through `--surface-bg` (see `.surface` below), not a flat fill.

`--pen` is gilt gold and is the **only** accent used for interactive/emphasis color (nav active state, focus ring, links, eyebrows, primary buttons) — this is a deliberate constraint carried over from the landing direction's own thesis ("gilt as the only accent"). `--highlight` is a cooler slate-blue, reserved for the handful of call sites that need a *second*, clearly distinct tint next to gold-tagged content (an "optimal move" tag, a judge's "dislikes" trait, a "High" severity chip) — it is not a second brand color to reach for freely. `--success`/`--destructive` are muted moss-green and terracotta-brown rather than stock traffic-light green/red, so a delivery-trend chart or a ledger's negative row still reads as this system's ink, not a generic dashboard's; they stay semantic (see `dataviz` skill guidance) and are never used as decorative accents.

Shadow tokens: `--shadow-card`, `--shadow-lift`, `--shadow-glass`. `--shadow-lift` in both themes carries a whisper of `--pen` as a fourth layer (`0 0 0 1px color-mix(in srgb, var(--pen) 10-12%, transparent)`) — every `.lift`-hovered card gets a faint gilt rim, the one ambient "precious metal" signature that doesn't need a bespoke per-component rule.

`--radius` is `.5rem`, and `radius-sm/md/lg/xl/2xl/3xl` are derived from it in `@theme inline` (`-.25 / -.125 / +0 / +.125 / +.25 / +.5rem`, i.e. 4/6/8/10/12/16px). **Changing that one value rescales every `rounded-*` class app-wide.** This scale is deliberately tighter than the old system's 6–25px range — Night Session's cards and buttons are cut rectangular plates, not soft pills; `rounded-full` chips (Pill, TallyBox, Toggle track) are untouched by this scale and keep their pill shape on purpose, chips are a different affordance than cards/buttons.

## Theme switching

Four values now: `web/lib/local-prefs.ts`'s `theme: 'light' | 'dark' | 'pink' | 'system'` under `cross.localPrefs`. `applyTheme()` toggles `.light`/`.dark`/`.pink` on `<html>` (removes all three, then adds back whichever one isn't `'system'`), and `noFlashScript` in `layout.tsx` mirrors that same explicit-vs-system branch before first paint (hence `suppressHydrationWarning` on `<html>`) — **both must stay in sync**: this pre-hydration script used to derive dark-vs-light from a single boolean, which is exactly the bug that would have made a "pink" pick flash as dark on a dark-mode OS; it's now an explicit if/else on the stored value, not a boolean. The full four-way choice lives in Settings → Appearance's radio group (`THEME_OPTIONS` in `settings-screen.tsx`); the quick toggle in `components/nav/theme-toggle.tsx` stays a simple light/dark binary by design (it always did, even back when only light/dark/system existed) — reaching pink (or system) is a Settings-only affordance, not a per-click cycle. The signed-in app keeps light and dark by design — a deliberate choice over committing to dark-only when Night Session shipped — and pink was added alongside them, not in place of either.

## Scope

The Night Session redesign covers the entire signed-in app (`home`, `prep`, `drill`, `insight`, `judges`, `coach`, `tournament`, `settings`, and the shared nav shell) — it does **not** touch the public landing page (`/`, still the "Vanishing Point" direction) or the `/preview*` reference routes, which keep their own bespoke `.pv-*` styling in `web/app/landing.css` regardless of what this file documents. Don't port landing-page classes into app screens or vice versa; they're deliberately independent systems that happen to share one of their three directions' color story now.

## Layout — unchanged

Max content width 1600px. Desktop rail is a floating frosted `.glass` panel (inset, rounded), not a flush sidebar. Mobile tab bar is the same floating glass treatment. Elevation is the depth cue — `.surface` cards are shadow-first with a barely-there hairline.

## Utility classes (`globals.css`, `@layer utilities`)

1. **`.nav-pen-mark`** — active nav state is a soft gilt pill behind the item (`::after`, `inset:0`, `z-index:-1`, `--pen` at 12%) plus gilt text. Used in `app-rail.tsx` / `mobile-nav.tsx`.
2. **`.ballot-rule`** — plain hairline above a section + `padding-top`. No pen tick. Used in `SettingsGroup`, judge profile/summary sections.
3. **`.tally`** / `TallyBox` — pill-shaped stat chip, `--secondary` fill, tabular numerals. Used in drill report win-probabilities.
4. **`.eyebrow`** — uppercase, gilt, `.06em` tracking. Used in `PageTitle` and section headers.
5. **`.ink-stamp`** / `InkButton` — a gilt-outlined plate (`border-radius: var(--radius-lg)`, not a pill), tinted gold fill at rest so it still reads as a button in a dense screen, solid gold fill + `--on-pen` text + gold glow on hover, `scale(.97)` on press. The same restrained "precious metal, not slathered on" move as the landing page's own `.pv-primary`, adapted with a resting tint for product-UI legibility rather than the landing hero's fully transparent default. Every primary action.
6. **`.glass`** — `blur(32px) saturate(180%)` over an 88% card tint. Nav and overlay chrome only.
7. **`.surface`** — card: `background: var(--surface-bg)` (flat paper in light mode; a faint slate-to-ink gradient in dark mode, lifted from `.pv-c-card`) + `--shadow-card` + hairline.
8. **`.lift`** — `translateY(-4px)` + `--shadow-lift` (now carrying the gilt rim, see above) on hover, 400ms.
9. **`.highlight-mark`** — soft slate-blue-tinted inline emphasis, rounded, `box-decoration-break: clone`.
10. **`.gradient-text`** — gold→slate-blue gradient clip for hero words.
11. **`.paper-grain`** — deliberate no-op, unrelated to this system's own paper tone; kept so its one consumer (`recommended-session.tsx`) needs no edit.

## Motion — unchanged

`framer-motion` (`MotionConfig reducedMotion` wired to both the OS media query and Settings → Accessibility → Reduce motion — see `app-shell.tsx`). Standard easing is `cubic-bezier(.4,0,.2,1)`; durations 150ms (micro) / 300ms (standard) / 500ms (entrance).

- Route transitions: `AnimatePresence mode="wait"` in `app-shell.tsx`, fade + 8px rise (220ms).
- Command palette + mobile "more" sheet: spring, stiffness 300 / damping 26–28.
- `.page-enter` 500ms, `.stagger` children 600ms at 60ms increments.
- Chat message enter 300ms; composer focus draws a 3px gilt focus ring.
- `:focus-visible` is a global 2px gilt outline at 2px offset.
- Reduced motion: `prefers-reduced-motion`, `.force-reduced-motion`, and `MotionConfig` all collapse to near-instant.

## Screens

`home`, `prep`, `drill`, `insight`, `judges`, `coach`, `tournament`, `settings` under `web/components/screens/` inherit the system entirely through tokens and the classes above — this redesign changed no screen file, only `globals.css` and `layout.tsx`'s theme-color meta. Shared primitives: `web/components/ui/primitives.tsx` (`Pill`, `Progress`, `TallyBox`, `HighlightMark`, `InkButton`, `SettingsGroup`, `Field`, `Toggle`, `PageTitle`).
