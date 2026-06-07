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

### A1. Multi-agent bot framework (headless, supabase-js)
- [ ] `src/tests/sim/agent.ts` — a synthetic user that authenticates and acts via services/RLS
- [ ] Role factories: Owner / Super / Texter with correct setup (team, texter_settings)
- [ ] Actions: sendMessage, createChat, friendRequest, approveFriend, deleteMessage, call-signal
- [ ] Assertion helpers: messageArrived(order), visibleTo(role), notVisibleTo(role)
- [ ] `npm run test.sim` script wired in package.json

### A2. Scenario tests (replaces "two people chatting")
- [ ] Owner+Texter 1:1 conversation round-trip, ordering, read receipts
- [ ] Super-only chat exchange
- [ ] Group chat with mixed roles
- [ ] Friend request requiring Owner approval flow

### A3. Invariant / property-based tests (exhaustive safety)
- [ ] Owner ALWAYS sees Texter messages incl. deleted (deleted_at)
- [ ] Super-only chats NEVER visible to Owner
- [ ] SOS/Tillkalla can NEVER be blocked/disabled
- [ ] Randomized action-sequence generator asserting invariants hold

### A4. Network-chaos scaffolding
- [ ] Helper to simulate offline/flaky/reconnect at the client/data layer
- [ ] Baseline scenario proving current behavior (pre-outbox), documents the gap

### A5. (later/CI) Maestro UI flows + GitHub Actions
- [ ] Author Maestro YAML for core flows (login, send message, see in oversight)
- [ ] GitHub Actions workflow (emulator) — note: needs CI setup, flag to Erik before paid infra

---

## PHASE B — Reliability implementation (each verified by Phase A)

### B0. Instrumentation/metrics baseline
- [ ] Measure send-latency, send-success rate, reconnect gaps, cold start

### B1. Optimistic send + outbox
- [ ] Client-generated message UUID; idempotent insert (dedupe)
- [ ] Outbox store; status sending→sent→delivered→read
- [ ] Retry with exponential backoff; survive app restart
- [ ] Reconcile on server ack

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

## Execution model (IMPORTANT — discovered 2026-06-07)
- **No Docker on Alva's laptop** → local Supabase (RLS/sim integration tests) CANNOT run here.
- Local dev loop = what runs WITHOUT Docker: `npx tsc --noEmit`, `eslint`, `vitest` unit tests.
- Integration/sim loop runs in **GitHub Actions CI** (Linux runner with Docker + supabase CLI).
  Loop: implement locally → push branch → CI runs `test.rls` + new `test.sim` → read result via
  `gh`/API → fix red → repeat. (TODO A0 below: author the CI workflow first.)
- Autonomous cadence: a daily scheduled task (`C:\Alva\tools\zemichat_reliability_loop.py`) invokes
  Claude to advance ONE focused work-cycle, commit, trigger/read CI, update this file, and post a
  Telegram progress report. Guardrails: branch-only, never merge/release, stop+report if a loop
  isn't converging after N tries or if usage credits are near cap.

### A0. CI test workflow (do first)
- [ ] `.github/workflows/sim-tests.yml` — install supabase CLI, `supabase start`, run test.rls + test.sim on push to feature branch
- [ ] Verify green on a trivial push before building the harness

## Progress log
- 2026-06-07: Branch created, plan + breakdown written. Mapped existing RLS/e2e test infra
  (local Supabase via Docker, seeded Owner/Super/Texter in rls/helpers). Found Docker missing on
  laptop → switching self-test loop to GitHub Actions CI. Next: A0 (CI workflow), then A1.
