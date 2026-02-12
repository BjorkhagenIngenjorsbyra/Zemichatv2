# Technical Debt — Zemichat

Last updated: 2026-02-12

---

## 1. Hardcoded Timeout Values

Multiple components use hardcoded `setTimeout`/`setInterval` values. Consider extracting to a shared constants file.

| File | Line | Value | Purpose |
|------|------|-------|---------|
| `src/components/chat/ChatSearchModal.tsx` | 71, 85 | `300` | Search debounce + focus delay |
| `src/components/chat/GifPicker.tsx` | ~72 | `300` | GIF search debounce |
| `src/components/common/OfflineBanner.tsx` | 27, 41 | `2000` | Banner auto-hide |
| `src/components/chat/MessageBubble.tsx` | 81 | `600` | Heart animation duration |
| `src/components/chat/QuickMessageBar.tsx` | 40 | `300` | Send feedback delay |
| `src/components/owner/CreateTexterModal.tsx` | 123 | `2000` | Copy notification timeout |
| `src/components/common/OnboardingSlides.tsx` | 44 | `400` | Slide animation timing |
| `src/components/ShareTargetHandler.tsx` | 103 | `300` | Searchbar focus delay |
| `src/components/chat/InlineReactionBar.tsx` | ~30 | varies | Reaction bar timing |
| `src/components/chat/ForwardPicker.tsx` | ~50 | varies | Focus delay |

**Recommendation:** Create `src/constants/timings.ts` with named constants.

---

## 2. Inline CSS / Style Objects

Several components use inline `style={{}}` instead of CSS classes:

| File | Lines | Notes |
|------|-------|-------|
| `src/components/common/SkeletonLoader.tsx` | 16–110 | Extensive inline flex/spacing styles |
| `src/components/call/CallPiP.tsx` | 57 | Dynamic position (acceptable) |
| `src/components/common/ConfettiAnimation.tsx` | 72–80 | Dynamic particle styles (acceptable) |
| `src/pages/Signup.tsx` | 74 | Layout override |
| `src/components/common/EmptyStateIllustration.tsx` | 88 | Animation reference |
| `src/components/chat/PollMessage.tsx` | 84 | Dynamic width bar |

**Recommendation:** Extract static styles to CSS modules or Ionic utility classes. Dynamic values are acceptable inline.

---

## 3. `any` Type Usage

All current `any` usages are justified (Supabase RPC return types). No unnecessary `any` found.

| File | Context |
|------|---------|
| `src/services/chat.ts` | Supabase RPC response |
| `src/services/call.ts` | Supabase RPC response |
| `src/services/friends.ts` | Supabase RPC response |

**Recommendation:** When Supabase generates proper types for RPC functions, replace with generated types.

---

## 4. Dead Code

| File | Item | Status |
|------|------|--------|
| `src/components/call/CallLogMessage.tsx` | Component exported but never imported | Export removed from barrel; file kept for future use |

---

## 5. Placeholder / Production Blockers

| Item | Location | Priority |
|------|----------|----------|
| Production CORS origins | `supabase/functions/*/index.ts` | **HIGH** — add production domain before deploy |
| Input length validation | `create_team_with_owner`, `create_texter` SQL functions | Medium |
| MFA friendly name | `src/services/mfa.ts:104` — hardcoded `'Zemichat Authenticator'` | Low |

---

## 6. Missing Infrastructure

| Item | Notes |
|------|-------|
| iOS platform | No `ios/` directory yet; CallKit, APNs VoIP push, Share Extension all deferred |
| Production push certificates | APNs VoIP certificate needed for iOS calls |
| Rate limiting | No rate limiting on Edge Functions |
| Input sanitization | No HTML/XSS sanitization on message content (relies on React escaping) |

---

## 7. Dependencies

| Item | Status |
|------|--------|
| `emoji-mart` | **Removed** — was unused (emoji-picker-react used instead) |
| `@playwright/test` | Dev dependency — only used for E2E, consider if needed |
| `cypress` | Dev dependency — alternative E2E runner, consider consolidating |

---

## Summary — Top 10 Critical Items

1. **Add production domain to CORS whitelist** in Edge Functions
2. **iOS platform not added** — no push, calls, or share on iOS
3. **No rate limiting** on Edge Functions
4. **Extract hardcoded timeouts** to shared constants
5. **Refactor inline CSS** in SkeletonLoader and other components
6. **Input length validation** in SQL functions
7. **Consolidate E2E test frameworks** (Playwright vs Cypress)
8. **Replace `any` types** when Supabase generates RPC types
9. **Add APNs VoIP certificates** before iOS launch
