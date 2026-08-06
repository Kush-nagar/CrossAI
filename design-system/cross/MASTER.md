# Cross — Apple-inspired design system

Signature: Apple HIG. Minimal chrome, generous whitespace, system blue as the only brand accent, elevation instead of outlines, frosted-glass navigation, smooth `cubic-bezier(.4,0,.2,1)` motion.

Replaces the previous "Ballot / Ink editorial" system. The class *names* from that system survive (`.ink-stamp`, `.eyebrow`, `.tally`, `.ballot-rule`, `.nav-pen-mark`, `--pen`) and were redefined in place with Apple semantics — that is why no screen JSX needed rewriting. Don't rename them; the ~70 consumers would all have to change for zero visual gain.

## Fonts

| Role | Face | CSS var | Tailwind |
|---|---|---|---|
| Display | SF Pro Display → system | `--font-display` | `font-display` |
| Body | SF Pro Text → system | `--font-body` | `font-sans` (default) |
| Data/mono | SF Mono → ui-monospace | `--font-data` | `font-data` / `font-mono` |

Defined as stacks in `web/app/globals.css` — **no `next/font/google` webfonts**. Real SF on Apple devices, Segoe/Roboto elsewhere, zero font requests.

Body carries `letter-spacing: -0.01em`, headings `-0.022em`, page titles `-0.03em` — the Apple optical-tightening rule.

## Color tokens (`web/app/globals.css`)

Semantic vars on `:root` (light) and `:root.dark` (dark), plus an `@media (prefers-color-scheme: dark)` fallback for `:root:not(.light)`.

**Light**
```
--paper #f5f5f7      --paper-raised #ffffff
--ink   #1d1d1f      --ink-soft     #86868b
--rule  #d2d2d7      --secondary    #ebebf0
--pen   #0071e3      --highlight    #ff9f0a
--success #30d158    --destructive  #ff3b30
```

**Dark**
```
--paper #000000      --paper-raised #1c1c1e
--ink   #f5f5f7      --ink-soft     #98989d
--rule  #38383a      --secondary    #2c2c2e
--pen   #0a84ff      --highlight    #ff9f0a
--success #30d158    --destructive  #ff453a
```

Page background is the *grouped* tint (`--paper`), cards are pure white/near-black above it (`--paper-raised`) — the Settings.app relationship, inverted from the old paper/ink one.

`--pen` is now system blue and is the primary accent (`text-pen` / `bg-pen` / `border-pen`). `--color-success` was added for switch tracks (Apple switches are green, not blue).

Shadow tokens: `--shadow-card`, `--shadow-lift`, `--shadow-glass` — layered, low-opacity, and swapped for heavier values in dark mode.

`--radius` is `.75rem`, and `radius-sm/md/lg/xl/2xl/3xl` are all derived from it in `@theme inline` (`-.35 / -.15 / +0 / +.3 / +.55 / +.8rem`). **Changing that one value rescales every `rounded-*` class app-wide.**

## Theme switching

Unchanged: `web/lib/local-prefs.ts` (`theme: 'light' | 'dark' | 'system'` under `cross.localPrefs`), `applyTheme()` toggles `.light`/`.dark` on `<html>`, `noFlashScript` in `layout.tsx` applies it before first paint (hence `suppressHydrationWarning` on `<html>`). Toggle UI in `components/nav/theme-toggle.tsx` and Settings → Appearance.

## Layout

Max content width 1600px. Desktop rail is a floating frosted `.glass` panel (inset, rounded), not a flush sidebar. Mobile tab bar is the same floating glass treatment. Elevation is the depth cue — `.surface` cards are shadow-first with a barely-there hairline.

## Utility classes (`globals.css`, `@layer utilities`)

1. **`.nav-pen-mark`** — active nav state is a soft blue pill behind the item (`::after`, `inset:0`, `z-index:-1`, blue at 12%) plus blue text. Used in `app-rail.tsx` / `mobile-nav.tsx`.
2. **`.ballot-rule`** — plain hairline above a section + `padding-top`. No pen tick. Used in `SettingsGroup`, judge profile/summary sections. (`PageTitle` no longer uses it — an Apple large title sits above its content, not under a rule.)
3. **`.tally`** / `TallyBox` — pill-shaped stat chip, `--secondary` fill, tabular numerals. Used in drill report win-probabilities.
4. **`.eyebrow`** — uppercase, blue, `.06em` tracking. Used in `PageTitle` and section headers.
5. **`.ink-stamp`** / `InkButton` — blue capsule (`border-radius: 999px`), white text, hover darkens + drops a blue glow, `scale(.97)` on press. Every primary action.
6. **`.glass`** — `blur(20px) saturate(180%)` over a 72% card tint. Nav and overlay chrome only.
7. **`.surface`** — card: raised background + `--shadow-card` + hairline.
8. **`.lift`** — `translateY(-4px)` + `--shadow-lift` on hover, 400ms.
9. **`.highlight-mark`** — soft orange-tinted inline emphasis, rounded, `box-decoration-break: clone`.
10. **`.gradient-text`** — blue→orange gradient clip for hero words.
11. **`.paper-grain`** — deliberate no-op. The grain texture retired with the ballot theme; the class is kept so its one consumer (`recommended-session.tsx`) needs no edit.

## Motion

`framer-motion` (`MotionConfig reducedMotion` wired to both the OS media query and Settings → Accessibility → Reduce motion — see `app-shell.tsx`). Standard easing is `cubic-bezier(.4,0,.2,1)`; durations 150ms (micro) / 300ms (standard) / 500ms (entrance).

- Route transitions: `AnimatePresence mode="wait"` in `app-shell.tsx`, fade + 8px rise (220ms).
- Command palette + mobile "more" sheet: spring, stiffness 300 / damping 26–28.
- `.page-enter` 500ms, `.stagger` children 600ms at 60ms increments.
- Chat message enter 300ms; composer focus draws a 3px blue focus ring.
- `:focus-visible` is a global 2px blue outline at 2px offset.
- Reduced motion: `prefers-reduced-motion`, `.force-reduced-motion`, and `MotionConfig` all collapse to near-instant.

## Screens

`home`, `prep`, `drill`, `judges`, `coach`, `tournament`, `settings` under `web/components/screens/` inherit the system entirely through tokens and the classes above — the Apple restyle changed no screen file. Shared primitives: `web/components/ui/primitives.tsx` (`Pill`, `Progress`, `TallyBox`, `HighlightMark`, `InkButton`, `SettingsGroup`, `Field`, `Toggle`, `PageTitle`).
