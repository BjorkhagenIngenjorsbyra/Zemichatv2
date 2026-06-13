# Fable 5 kod-genomlysning r3 — åtgärdslogg

Källa: `tests/explore/runs/code-review-r3.md` (386 fynd: 37 hög / 172 medel / 177 låg).
Gren: `feature/fable-qa-round-3`. Varje åtgärd = egen/liten commit + rad i session-loggen.

Regler (CLAUDE.md): verifiera varje fynd mot nuvarande kod först (flera kan redan vara
fixade, t.ex. @mention i f00787b). Fixa äkta fynd. STOPPA-och-fråga vid barnsäkerhet/
betalning/datamodell-fundamentalt. Säkerhetsval = säkrare alternativet.

Status-nyckel: [x] fixad · [skip] redan fixad/falskt larm · [HOLD] eskalerad till Erik

## Hög allvarsgrad (37)

- [ ] PrivateRoute.tsx — Redirect/Spinner istället för Route i Switch skuggar senare routes
- [ ] ShareTargetHandler.tsx — stale-closure i share-handler
- [ ] TabLayout.tsx — wall-access fail-open för Texter + ingen realtime
- [ ] call/VideoGrid.tsx — remote video positionellt mappad (fel namn över fel stream)
- [ ] chat/ChatInputToolbar.tsx — @mention \w bryter å/ä/ö (TROL. redan f00787b)
- [ ] chat/EmojiGifPanel.tsx + GifPicker.tsx — duplicerad GIF-flik (refaktor)
- [ ] chat/ImageMessage.tsx — spara till galleri funkar ej native + tap-to-close kapar knappar
- [ ] chat/MessageBubble.tsx — ej memoizerad + 300-rad <style> per instans
- [ ] chat/PollMessage.tsx — N+1 poll-fetch + icke-atomisk röstväxling
- [x] chat/VoiceMessage.tsx — Infinity-duration (webm utan duration-header) — Number.isFinite-guard + metadata-prio
- [x] chat/VoiceRecorder.tsx — cancel skickar ändå + ingen unmount-cleanup (mic kvar på) — cancelledRef + streamRef + cleanup-effect
- [ ] friends/AddToChatPicker.tsx — 1:1-chattar listas → injektion gör om till grupp
- [ ] friends/FriendSettingsModal.tsx — reset-effekt wipe:ar pågående redigering
- [ ] friends/ZemiNumberInput.tsx — går ej radera förbi prefix + caret hoppar
- [ ] subscription/MemberLimitDialog.tsx — gräns bara klientsidig (TROL. redan #2 4018c35)
- [ ] subscription/Paywall.tsx — hårdkodat pris istället för store-localized priceString
- [ ] tillkalla/TillkallaButton.tsx — tyst fel = barn tror hjälp kommer (BARNSÄKERHET)
- [ ] contexts/CallContext.tsx — callDuration i context → 1 re-render/s överallt
- [ ] contexts/CallContext.tsx — incoming-call-subscription rivs/återskapas per state-change
- [ ] contexts/CallContext.tsx — ring-timeout uppdaterar ej call_log/push/signal/system-msg
- [ ] hooks/usePresence.ts — N kanaler + N+1 fetch + 30s-tick per rad
- [ ] (resterande hög-fynd processas i ordning från rapporten)

## Medel (172) — efter hög

## Låg (177) — efter medel
