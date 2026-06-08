# Reliability & Offline-First — Task Breakdown (autonomous execution)

**Branch:** `feature/reliability-offline-first` (base: master + paywall fix)
**Started:** 2026-06-07 by Alva, autonomous during Erik's vacation
**Plan doc:** Google Doc `1ZtzAATMg0rw-XBlvDxrnShJKobL1QLQK1Sl4z1AUwGE`

## Rules of engagement
- NEVER merge to master. NEVER release to Play/App Store. Keep review-ready.
- Every feature task must be green in the simulation suite before moving on.
- Loop: implement → run sim/tests → fix all red → commit → next task.
- Transparency invariant is sacred: local cache/outbox must NOT bypass RLS or hide
  anything from Team Owner. Deleted messages still sync (deleted_at) and stay visible to Owner.
- Commit messages: `feat(reliability): ...`, `test(sim): ...`, etc. Co-author Alva.
- Update this file's checkboxes + the "Progress log" as work proceeds.

---

## PHASE A — Simulation/test harness (the engine for loop-test-correct)

### A1. Multi-agent bot framework (headless, supabase-js) — DONE (commit 85321ad)
- [x] `src/tests/sim/agent.ts` — Agent wraps an authenticated role; sendMessage/deleteMessage/
      visibleMessages/canSee/sendSos + waitForMessages (eventually-consistent poll). getSimWorld().
- [x] Role factories: getSimWorld() builds Owner/Super/Texter agents per team over the seeded world.
- [x] `npm run test.sim` + vitest.config.sim.ts wired.
- [ ] More actions later as needed: createChat, friendRequest, approveFriend, call-signal.

### A2. Scenario tests (replaces "two people chatting") — STARTED (commit 85321ad)
- [x] Owner+Texter/Super 1:1 conversation round-trip, ordering, oversight, cross-team isolation.
- [ ] Group chat with mixed roles
- [ ] Friend request requiring Owner approval flow
- [ ] Read receipts

### A3. Invariant / property-based tests (exhaustive safety) — STARTED (commit fa59561)
- [x] Owner ALWAYS sees Texter messages incl. deleted (deleted_at)
- [x] Super-only chats NEVER visible to Owner
- [x] SOS/Tillkalla can NEVER be blocked/disabled (even with all capabilities revoked)
- [ ] Randomized action-sequence generator asserting invariants hold

**Sim suite status: 7/7 green, stable across repeated runs.**

### A4. Network-chaos scaffolding
- [ ] Helper to simulate offline/flaky/reconnect at the client/data layer
- [ ] Baseline scenario proving current behavior (pre-outbox), documents the gap

### A5. UI E2E harness (Playwright vs LOCAL Supabase) — WORKING
Real-app UI automation ("computer does what a human does"). Runs the dev server
against LOCAL Supabase via `.env.local` (gitignored: VITE_SUPABASE_URL=127.0.0.1:54321
+ legacy anon JWT) — NEVER prod. Setup: `db reset` + seed (run any rls file once to
trigger globalSetup) → `npm run dev` → `npx playwright test --project=two-user <spec>`.
Auth: email login form works for any seeded user incl. texter1 (user-aaaa0003@test.local).
- [x] `two-user-offline-outbox.spec.ts` — offline send queued + delivered on reconnect (B1c). Green.
- [x] `two-user-tillkalla.spec.ts` — checklist #13 Tillkalla Vuxen (texter sees/triggers; owner doesn't). Green.

### A6. Automate the manual Verifieringschecklista (Erik's doc 1sH3ay...) as E2E
Erik wants the never-run manual checklist turned into automated tests. Status:
- [x] #13 Tillkalla Vuxen
- [ ] #3 reply/quote, #4 reactions, #5 emoji-picker, #6 friend requests, #7 push-toggle (UI),
      #8 call-log (UI presence), #11 invitations, #12 unfriend — each needs data-testid
      instrumentation + a spec; build incrementally.
- N/A (manual/device, automation can't replace): #1/#2 push delivery on real phones,
      #9/#14 subjective performance, iOS via TestFlight.

### (later/CI) Maestro / GitHub Actions
- [ ] Optionally port E2E to CI (needs runner with local Supabase) — flag before paid infra.

---

## PHASE B — Reliability implementation (each verified by Phase A)

### B0. Instrumentation/metrics baseline
- [ ] Measure send-latency, send-success rate, reconnect gaps, cold start

### B1. Optimistic send + outbox
Current flow (src/services/message.ts `sendMessage`, ~L108): direct
`supabase.from('messages').insert({...}).select().single()` — no client id, no
optimism, no retry; UI awaits the round-trip and the realtime sub echoes it back.
Design for B1:
- Generate client UUID for `messages.id` (PostgREST accepts explicit id) → idempotent
  insert; the optimistic row and the realtime echo dedupe on the same id.
- Outbox store (Zustand/state + persisted): enqueue on send; status
  pending→sent→delivered→read; show immediately in UI as "sending".
- Retry with exponential backoff on network error; persist across app restart
  (so a queued message survives a kill). Reconcile/clear on server ack.
- subscribeToMessages must merge by id (skip if already present from optimistic insert).
- Verify with a new sim scenario: send returns a stable client id; duplicate insert of
  same id is a no-op/idempotent; message appears exactly once.
- [x] Client-generated message UUID; idempotent insert (dedupe) — sendMessage assigns id,
      23505-on-retry treated as success. Sim proof (outbox.sim.test). Commit 40e85a1.
- [x] Outbox store + retry with exponential backoff + survive app restart — services/outbox.ts,
      10 unit tests (no Docker). Commit c067ae6.
- [x] **B1c — resilient send wired** (commit ee1ceaa): messageOutbox.ts (buildSendFn, enqueueMessage,
      startMessageOutboxAutoFlush on `online`+heartbeat); ChatView send uses client id and queues on
      failure for idempotent auto-retry; App starts auto-flush per authenticated session. unit 13/13.
- [ ] **B1c-2 — optimistic in-UI rendering (NEEDS app-run verify):** instant local bubble with
      sending/failed status badge + tap-to-retry; reconcile via realtime echo (already dedupes by id).
      Requires the running app (web dev server + Playwright against a test DB, or Maestro on emulator).
- [x] Reconcile on server ack — realtime sub already dedupes by id; client-id send makes it idempotent.

### B2. Local cache layer
- [ ] Add `@capacitor-community/sqlite` (mobile) + Dexie/IndexedDB fallback (web)
- [ ] UI reads chat list + messages from local store
- [ ] Realtime syncs into local store in background
- [ ] Offline read works

### B3. Robust reconnect + backfill
- [ ] Connection-state in UI
- [ ] On reconnect: resubscribe + backfill since last cursor
- [ ] Fixes missed-call lifecycle (#15) + push gaps

### B4. Media & performance
- [ ] Thumbnails + compression, lazy media load
- [ ] Virtualized message list

### B5. Hardening
- [ ] Full sim suite incl. chaos + concurrent users green
- [ ] Enable Sentry (issue #16) — flag to Erik (currently off by design pre-launch)

---

## Execution model (UPDATED 2026-06-07 — Docker now installed)
- **Docker Desktop installed locally** (WSL2 backend) → local Supabase stack runs on the laptop.
  Full self-test loop runs locally: `npm run test.rls` (db reset → seed → vitest), unit, lint, tsc.
- Mode: **interactive** — Erik corresponds here while Alva works through tasks (autonomous daily
  task "Alva ZemiChat Reliability" is DISABLED; wrapper kept for future option).
- CI (GitHub Actions) optional later for PR gating (Maestro/UI), not required for dev loop.

### A0b. Establish a green baseline (IN PROGRESS — 2026-06-07)
- [x] Root-caused the 31 failures: stale test seed. `teams.referral_code` (NOT NULL, no default)
      added by a later migration but never added to global-setup.ts. With
      session_replication_role=replica disabling FK checks + psql w/o ON_ERROR_STOP, the teams
      insert failed silently while dependent rows still inserted → teams table empty → all
      Team-Owner oversight policies returned nothing. NOT an app bug.
- [x] Fixed seed (referral_code + ON_ERROR_STOP). Result: **31 failed → 5 failed (214 passed)**. Committed 314b659.
- [x] Fixed teams fixtures (referral_code) + per-file is_active reset (reset-state.ts). **31 → ~4.** Committed b445ad7.
- [x] **REAL BUG FOUND + FIXED:** stale `reports_check` constraint blocked chat-targeted reports
      (reportChat feature) in prod. Migration 20260608070000 drops it. Committed ccb73a4.
- [x] teams fixtures + per-file is_active & texter_settings reset (reset-state.ts). Clean runs hit **219/219 green.**
- [ ] **A0c — Residual read-after-write flake (LOW priority, NOT app bug, does NOT block harness).**
      A handful of call-logs/messages/reports state-toggle tests intermittently fail (~2-4, shifting):
      a write (is_active / texter_settings via execSQL or adminClient) occasionally isn't visible to
      the immediately following texter-client API read on the shared local stack. NOT concurrency
      (forcing maxConcurrency:1/singleFork did not help) and NOT an app bug (verified app RLS correct
      via direct DB sim; a clean run is fully green). Recommended fix: a small retry/poll wrapper on
      the state-dependent assertions (re-run the query a few times before failing). Deferred — pursue
      only if it actually impedes the feature loop.
- [ ] **Infra: `supabase db reset` flakiness** — intermittently fails on container restart
      (storage 502 / context deadline) on this laptop. Added a 3x retry wrapper for runs; consider
      raising Docker resources / a more robust reset. Affects loop stability.
- [ ] (historical) Triage remaining 5 (carefully, real-bug vs test-drift):
      - teams INSERT x2 (code 23502 not-null) — test inserts team w/o referral_code; likely test needs
        to use create_team_with_owner RPC or supply referral_code. CHECK if app relies on a missing
        default/trigger (could be real).
      - messages "Sender can soft-delete own message" (42501 RLS deny) — CHECK policy; could be real regression.
      - reports submit x2 (42501 RLS deny) — CHECK reports INSERT policy vs new extended fields.

Note: `git push` via credential-helper hangs here; use token-in-URL (works). git creds = github_token.txt.

## Progress log
- 2026-06-07: Branch created, plan + breakdown written. Mapped existing RLS/e2e test infra
  (local Supabase via Docker, seeded Owner/Super/Texter in rls/helpers). Found Docker missing on
  laptop → switching self-test loop to GitHub Actions CI. Next: A0 (CI workflow), then A1.
