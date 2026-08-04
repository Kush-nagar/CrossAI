# Cross — Ballot / Ink Editorial design system

Signature: judge ballot + printed brief + fountain-pen underline. Ink-black type on paper surfaces, accent used like a pen mark or ballot highlighter — sparse, never neon.

## Fonts

| Role | Face | CSS var | Tailwind |
|---|---|---|---|
| Display | Fraunces (500/600/700) | `--font-display` | `font-display` |
| Body | Newsreader | `--font-body` | `font-sans` (default) |
| Data/mono | JetBrains Mono (500/600) | `--font-data` | `font-data` / `font-mono` |

Loaded via `next/font/google` in `web/app/layout.tsx`.

## Color tokens (`web/app/globals.css`)

Semantic vars set on `:root` (light) and `:root.dark` (dark), plus an `@media (prefers-color-scheme: dark)` fallback for `:root:not(.light)` before a user picks explicitly.

**Light**
```
--paper #e9e8e1      --paper-raised #f4f3ed
--ink   #1b1b18      --ink-soft     #4a4842
--rule  #c9c7bc      --secondary    #dedcd2
--pen   #8a2e1f      --highlight    #c98a2b
--destructive #a23325
```

**Dark**
```
--paper #17181a      --paper-raised #212226
--ink   #ece9e1      --ink-soft     #a7a499
--rule  #35362f      --secondary    #2a2b26
--pen   #c1543a      --highlight    #d98a3d
--destructive #e2604a
```

Mapped into Tailwind's `@theme inline` as the existing semantic scale (`background`/`foreground`/`card`/`primary`/`secondary`/`muted`/`accent`/`border`/`ring`) plus one addition, `--color-pen`, so `text-pen`/`border-pen`/`bg-pen` are directly usable. `primary` = ink-fill (stamp buttons), not a saturated brand color — this is the key departure from the old blue-primary system.

`--radius` dropped from `1rem` to `.4rem`; the derived `radius-xl/2xl/3xl` scale (`+.3/.55/.8rem`) shrinks with it, so most existing `rounded-3xl` card markup got crisper for free without per-file edits.

## Theme switching

`web/lib/local-prefs.ts` — `LocalPrefs.theme: 'light' | 'dark' | 'system'`, persisted under the existing `cross.localPrefs` localStorage key. `applyTheme()` toggles `.light`/`.dark` on `<html>`. An inline blocking script in `layout.tsx` (`noFlashScript`) applies the class before first paint. Toggle UI: `components/nav/theme-toggle.tsx` (shell top-bar + mobile "more" sheet) and a three-way Light/Dark/System control in Settings → Appearance.

## Layout

Max content width 1600px shell, left rail (desktop) separated from content by a hairline border, not a filled sidebar. One elevation step only (`.surface` = paper-raised + hairline border, no stacked shadows).

## Signature — 5 places (`.nav-pen-mark`, `.ballot-rule`, `.tally`, `.eyebrow`, `.ink-stamp` in `globals.css`)

1. **Nav active state** — `.nav-pen-mark[data-active="true"]::after`, a pen-stroke underline, not a filled pill. Used in `app-rail.tsx` / `mobile-nav.tsx`.
2. **Section dividers** — `.ballot-rule`, hairline + short pen-colored tick at the left margin. Used in `PageTitle`, `SettingsGroup`, judges paradigm section.
3. **Score/tally cells** — `.tally` / `TallyBox` primitive, mono numerals in a bordered cell with corner ticks. Used in drill report win-probabilities.
4. **Eyebrow labels** — `.eyebrow`, mono/uppercase/pen-colored, paired with a `.ballot-rule` divider. Used in `PageTitle` and section headers.
5. **Primary CTA** — `.ink-stamp` / `InkButton` primitive: solid ink fill, paper text, faint grain-texture bleed on hover, scale-down "thunk" on press. Used for every primary action (upload, generate, save, sign-in).

Supporting: `.highlight-mark` (ballot-highlighter text emphasis), `.paper-grain` (low-opacity noise texture on hero/CTA surfaces only).

## Motion

`framer-motion` (`MotionConfig reducedMotion` wired to both the OS media query and the manual Settings → Accessibility → Reduce motion toggle — see `app-shell.tsx`).

- Route transitions: `AnimatePresence mode="wait"` in `app-shell.tsx`, fade + 8px rise in (220ms), fade + -6px exit (140ms equivalent — single shared 220ms/ease curve, exit distance shorter).
- Command palette (`command-bar.tsx`): spring scale+fade, stiffness 300 / damping 26, paper-tint backdrop (no glass blur).
- Mobile "more" sheet: spring slide-up, same spring constants.
- Chat message enter (`.chat-message` in `globals.css`): fade + 6px rise, 160ms.
- Composer focus (`.chat-composer:focus-within`): pen-colored border + ring, no transform.
- Button press (`.press:active`, `.ink-stamp:active`): scale 0.97-0.975.
- Reduced motion: `prefers-reduced-motion`, `.force-reduced-motion` (manual toggle), and `MotionConfig reducedMotion="always"` all collapse transforms/springs to near-instant.

## Screens touched

`home`, `prep`, `drill`, `judges`, `coach`, `tournament`, `settings` under `web/components/screens/` — behavior/API calls unchanged, restyled to tokens + primitives + signature elements above. Shared primitives rebuilt in `web/components/ui/primitives.tsx` (`Pill`, `Progress`, `TallyBox`, `HighlightMark`, `InkButton`, `SettingsGroup`, `Field`, `Toggle`, `PageTitle`).
