# Technical debt tracker

Last full audit: **2026-04-11** (commit `db4dcf9`).

## ✅ Fixed in the 2026-04-11 audit pass

### Bundle / build
- **Bundle splitting** (`db4dcf9`) — `vite.config.ts` now declares `manualChunks` for agora, emoji-picker, leaflet, supabase, react-vendor, ionic-vendor. Initial-load gzip dropped from ~1010 KB to ~278 KB. Agora and leaflet only load on demand.
- **ESLint stricter rules** (`db4dcf9`, `fc1e805`) — `no-explicit-any` (warn), `no-unused-vars` (warn, allow `_`-prefix), `no-console` (warn except warn/error), `no-fallthrough` (error). Android/iOS build artifacts ignored.

### Supabase queries
- **9 `.single()` → `.maybeSingle()`** (`db4dcf9`, `ce2d6fc`) — fixes 406 errors on optional rows. Affected: `services/call.ts:365,418`, `services/friend.ts:278,290,516,806,830`, `services/members.ts:93`, `services/chat.ts:306,329`, `services/poll.ts:70,116`, plus the earlier `services/subscription.ts` fix from polish round 17.

### Theming
- **Hardcoded greys removed** (`db4dcf9`) — `QuickMessageManager.tsx` and `QuietHoursManager.tsx` had `#e5e7eb`/`#d1d5db`/`#9ca3af` left over from an early dark-only theme. Replaced with `hsl(var(--foreground))` / `hsl(var(--muted-foreground))` so they follow the active theme.
- **`--ion-app-bg` alias system** (polish rounds 6, 10) — fixed CSS variable circular references in `theme/variables.css` that broke Ionic component theming. All ion-* selectors now use the parallel alias.

### Console noise
- **Removed console.log statements** (`db4dcf9`) — `audioRouting.ts` (no diagnostic value), `CallContext.tsx` Agora reconnect log wrapped in `import.meta.env.DEV`.
- **Removed eslint-disable comment** (`fc1e805`) on `services/supabase.ts` — `console.error` is now allowed by the new rule.

### Lint cleanup (`b82db15`)
- Removed 9 unused imports across `Calls.tsx`, `AddFriend.tsx`, `ChatList.tsx`, `FriendRequestCard.tsx`, `Paywall.tsx`, `QuietHoursManager.tsx`. Down from 62 to 53 lint warnings.

---

## ⏸ Deferred — write up so we don't forget

### Component splits (high effort, ~4 hours each)
- **`src/pages/Settings.tsx`** — 1291 lines, 23 hooks. Mixes profile, MFA, theme, subscription, account deletion, GDPR export. Should be split into:
  - `Settings/index.tsx` (router/shell)
  - `Settings/General.tsx` (theme picker, language)
  - `Settings/Profile.tsx` (avatar, name, Zemi number)
  - `Settings/Subscription.tsx` (current plan, upgrade, restore)
  - `Settings/Privacy.tsx` (MFA, account delete, data export)
  
  Risk of refactoring: medium — lots of inline state and callbacks. Should be done **before** the next big feature touches Settings.

- **`src/pages/ChatView.tsx`** — 1217 lines, 37 hooks. Handles message list, input, reactions, voice, polls, forwarding, search, typing. Should be split into:
  - `ChatView/index.tsx` (page shell + auth/load)
  - `ChatView/MessageList.tsx` (rendering, scroll-to-bottom, date dividers)
  - `ChatView/InputBar.tsx` (text input, attach, voice, send)
  - `ChatView/Modals.tsx` (reaction picker, context menu, search, forward)
  
  Risk: high — most-edited file in the project, easy to break realtime/reactions. Pair with explicit reactions/voice tests before refactoring.

- **`src/pages/ChatList.tsx`** — 973 lines. Less urgent but should add pagination/virtualization once a real user has 50+ chats.

### Tests (high effort, days of work)
14 tables used in services have **no RLS test file**:
- `call_signals` — risk: Owner might see Super-only call signals
- `friend_settings` — risk: Owner overrides on Super privacy
- `message_reactions` — risk: Private reactions exposed
- `message_read_receipts` — risk: Owner sees Super read state
- `poll_options`, `poll_votes` — risk: Owner sees Super votes
- `team_invitations` — risk: Super-only invitations exposed
- `wall_posts`, `wall_comments`, `wall_reactions` — risk: cross-team wall visibility
- `push_tokens`, `support_requests`

41 service files have **no unit tests**. Highest-risk gaps:
- `services/auth.ts` (MFA flow, password reset, deactivation)
- `services/subscription.ts` (RevenueCat integration, expiry calculation)
- `services/oversight.ts` (transparency rules — Owner can/cannot see Super-only)
- `services/member.ts` (disabled-texter access blocking)

**Recommendation:** Before launch, write at minimum:
1. RLS tests for the 9 wall/poll/reaction tables (~2 days)
2. Unit tests for `auth.ts` MFA + password reset (~1 day)
3. Unit test for `oversight.ts` transparency rules (~1 day)

### Type safety
- **27 files use `as unknown as X` casts** to bypass typing on Supabase results. This loses type safety on critical paths. Should migrate to typed `.from('table').select<TableType>()` syntax over time.
- **30 `any` types** scattered (mostly in test/legacy files). Catch new ones via the new ESLint rule.
- **8 exported service functions** have no explicit return type annotation — relies on inference. Add `: Promise<{ data: T, error: Error | null }>` to be defensive.

### CSS sprawl
- **65 components use inline `<style>` blocks**. Many define overlapping animations (`fade-in`, `slide-up`, `bounce`). Centralizing them in `theme/variables.css` would remove duplication but requires editing every component. Defer until after launch.

### Other observations
- **No TODO/FIXME comments in the codebase** ✅
- **i18n coverage is good** — sample of 10 components all use `t()` consistently ✅
- **No commented-out code blocks** ✅
- **Avatar color logic is centralized** in `utils/userDisplay.ts` (after polish round 2 fix) ✅

---

## Audit cadence

Run a fresh audit:
- Before each major release (next: 2026-05-31 launch)
- When `npm run lint` shows >100 warnings
- When bundle gzip exceeds 600 KB initial load
