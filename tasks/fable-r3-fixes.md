# Fable 5 kod-genomlysning r3 — åtgärdslogg

Källa: `tests/explore/runs/code-review-r3.md` (386 fynd: 37 hög / 172 medel / 177 låg).
Gren: `feature/fable-qa-round-3`. Varje åtgärd = egen/liten commit + rad i session-loggen.

Regler (CLAUDE.md): verifiera varje fynd mot nuvarande kod först (flera kan redan vara
fixade, t.ex. @mention i f00787b). Fixa äkta fynd. STOPPA-och-fråga vid barnsäkerhet/
betalning/datamodell-fundamentalt. Säkerhetsval = säkrare alternativet.

Status-nyckel: [x] fixad · [skip] redan fixad/falskt larm · [HOLD] eskalerad till Erik

## Hög allvarsgrad (37)

- [ ] PrivateRoute.tsx — Redirect/Spinner istället för Route i Switch skuggar senare routes
- [x] ShareTargetHandler.tsx — stale-closure i share-handler — handlerRef + stabil wrapper, init-effekt tom dep
- [skip] TabLayout.tsx — wall-access fail-open — REDAN fail-closed (f6efc81, rad 47 `?? false`). Realtime-omkoll vid Owner-toggle ej gjord (mindre UX, ej säkerhet) — kvar som låg.
- [ ] call/VideoGrid.tsx — remote video positionellt mappad (fel namn över fel stream)
- [skip] chat/ChatInputToolbar.tsx — @mention \w bryter å/ä/ö — REDAN FIXAD (f00787b, rad 91 använder /@([\p{L}\p{N}_]*)$/u)
- [ ] chat/EmojiGifPanel.tsx + GifPicker.tsx — duplicerad GIF-flik (refaktor)
- [x] chat/ImageMessage.tsx — tap-to-close kapade knappar (target.closest('button')-guard) + native spara via Filesystem+Share (galleri-direktspar → ISSUES L1)
- [ ] chat/MessageBubble.tsx — ej memoizerad + 300-rad <style> per instans
- [ ] chat/PollMessage.tsx — N+1 poll-fetch + icke-atomisk röstväxling
- [x] chat/VoiceMessage.tsx — Infinity-duration (webm utan duration-header) — Number.isFinite-guard + metadata-prio
- [x] chat/VoiceRecorder.tsx — cancel skickar ändå + ingen unmount-cleanup (mic kvar på) — cancelledRef + streamRef + cleanup-effect
- [skip] friends/AddToChatPicker.tsx — 1:1→grupp-konvertering är AVSIKTLIG server-side (add_member_to_chat sätter is_group=true). Erik 2026-06-13: ingen varning behövs → inget att ändra (alt A).
- [x] friends/FriendSettingsModal.tsx — reset-effekt wipe:ar pågående redigering — init-key-ref (en gång per öppning/friend)
- [x] friends/ZemiNumberInput.tsx — går ej radera förbi prefix — robust formatZemiNumber (tom + partiell prefix), handleInput delegerar; 12 node-cases gröna
- [ ] subscription/MemberLimitDialog.tsx — gräns bara klientsidig (TROL. redan #2 4018c35)
- [ ] subscription/Paywall.tsx — hårdkodat pris istället för store-localized priceString
- [x] tillkalla/TillkallaButton.tsx — tyst fel (BARNSÄKERHET, Erik godkände fixen) — danger-toast + behåll modal öppen för retry vid fel; success-toast; ny i18n `tillkalla.failed` ×5 språk
- [ ] contexts/CallContext.tsx — callDuration i context → 1 re-render/s överallt (PERF — tas i perf-batch)
- [x] contexts/CallContext.tsx — incoming-call-subscription rivs/återskapas per state-change → activeCallRef + sub en gång per profile (cleanupCall stabil [])
- [x] contexts/CallContext.tsx — ring-timeout uppdaterade ej call_log/push/signal/system-msg → DB-status-guard (MISSED) + cancel-push + deleteCallSignals + createCallMessage
- [ ] hooks/usePresence.ts — N kanaler + N+1 fetch + 30s-tick per rad
- [ ] (resterande hög-fynd processas i ordning från rapporten)

## Medel (172) — efter hög

## Låg (177) — efter medel
