NativeWind Migration Plan (Expo + Expo Router)

Goals
- Use `className` for layout/spacing/typography.
- Centralize tokens in `tailwind.config.js`.
- Use `style` only when Tailwind cannot express the style.
- Update `CLAUDE.md`; remove legacy style systems.

Steps
1) Audit current styling and tokens
2) Define migration scope and criteria
3) Create `feat/nativewind-migration` branch
4) Install deps: nativewind, tailwindcss, tailwindcss-react-native
5) Configure Babel: add `nativewind/babel`, keep reanimated last
6) Create `tailwind.config.js` with nativewind preset, RN plugin, content globs
7) Add TypeScript types: `nativewind/types`
8) Map tokens in `theme.extend` (colors, spacing, radii, fonts)
9) Decide dark mode strategy and use `dark:` variants where helpful
10) Pilot: migrate 1–2 screens + a shared component
11) Finalize `CLAUDE.md` styling rules + examples
12) Rollout: convert remaining screens + primitives
13) Verify on iOS, Android, Web
14) Cleanup legacy styles and uninstall deprecated packages
15) CI green, QA preview builds, merge and announce

Notes
- Prefer semantic tokens (bg-background, text-primary) over hex values.
- Keep class names as string literals; for conditionals, concatenate known classes.
- Consider `styled()` from NativeWind or a tiny `clsx` helper for variants.

