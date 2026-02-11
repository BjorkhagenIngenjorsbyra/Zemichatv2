# Zemichat E2E Test Report

> Auto-updated by `scripts/generate-test-report.js`

## Summary

| Metric | Value |
|--------|-------|
| Total Tests | — |
| Passed | — |
| Failed | — |
| Skipped | — |
| Duration | — |
| Last Run | — |

## Test Files

| File | Tests | Status |
|------|-------|--------|
| `comprehensive.spec.ts` | 155 | — |
| `roles-interactions.spec.ts` | 55 | — |
| `chat-functions.spec.ts` | 55 | — |
| **Total** | **265** | — |

## Test Sections

### comprehensive.spec.ts (155 tests)
- **A. Autentisering** (15) — Login, signup, texter-login, route guards
- **B. Owner Dashboard** (20) — Chat list, new chat, dashboard, settings
- **C. Chat Functions** (20) — Send messages, UI layout, GIF/sticker buttons
- **D. Friends** (15) — Friend list, add friend, requests, team section
- **E. Navigation & Tabs** (10) — Route navigation, back button, legal pages
- **F. i18n** (15) — Raw key checks across 5 locales on multiple pages
- **G. UI & Dark Mode** (10) — Contrast, hydration, CSS, console errors
- **H. Texter View** (15) — Texter-specific UI (SOS, no dashboard, send messages)
- **I. Super View** (15) — Super-specific UI (delete account, no SOS)
- **J. Accessibility & Performance** (10) — Aria labels, load time, viewport

### roles-interactions.spec.ts (55 tests)
- **K. Owner → Texter** (15) — Oversight, approvals, texter detail, create texter
- **L. Owner → Super** (10) — Invite super, team management
- **M. Texter Restrictions** (15) — No dashboard, no oversight, support, friends
- **N. Super Restrictions** (10) — No dashboard, no oversight, delete account
- **O. Cross-Role Chat** (10) — Chat visibility across roles
- **P. Team Management** (5) — Dashboard members, roles, status

### chat-functions.spec.ts (55 tests)
- **Q. Add Friend Flow** (10) — Search, validation, status display
- **R. New Chat Flow** (10) — Contact list, search, start chat
- **S. Support & Help** (10) — FAQ, feedback form, contact section
- **T. Chat Message Features** (15) — Styling, multi-send, XSS safety, wrapping
- **U. Texter Chat Experience** (10) — Quick messages, send, GIF/sticker

## Test Roles

| Role | Auth File | Capabilities Tested |
|------|-----------|-------------------|
| Owner | `owner.json` | Full dashboard, oversight, approvals, team management |
| New Owner | `new-owner.json` | No team, redirected to create-team |
| Texter | `texter.json` | Restricted UI, SOS, quick messages, no dashboard |
| Super | `super.json` | No dashboard, delete account, no SOS |

## Seed Data

Created during setup in `auth.setup.ts`:
- 1 Owner with team
- 1 New Owner (no team)
- 2 Texters (with Zemi numbers)
- 1 Super
- Friendships between all seeded users
- 3 chats with seed messages (Owner↔Texter, Texter↔Texter2, Super↔Texter)

## Running Tests

```bash
# Full test suite
./scripts/run-full-tests.sh

# Single file
npx playwright test tests/e2e/comprehensive.spec.ts

# Specific section
npx playwright test -g "A. Autentisering"

# With UI
npx playwright test --headed

# Generate report
node scripts/generate-test-report.js
```
