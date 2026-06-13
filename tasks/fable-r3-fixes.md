# Fable 5 kod-genomlysning r3 — åtgärdslogg

Källa: `tests/explore/runs/code-review-r3.md` (386 fynd: 37 hög / 172 medel / 177 låg).
Gren: `feature/fable-qa-round-3`. Varje åtgärd = egen/liten commit + rad i session-loggen.

Regler (CLAUDE.md): verifiera varje fynd mot nuvarande kod först (flera kan redan vara
fixade, t.ex. @mention i f00787b). Fixa äkta fynd. STOPPA-och-fråga vid barnsäkerhet/
betalning/datamodell-fundamentalt. Säkerhetsval = säkrare alternativet.

Status-nyckel: [x] fixad · [skip] redan fixad/falskt larm · [HOLD] eskalerad till Erik

## ⚠️ ESKALERAT — väntar Eriks beslut (autonomt-läge 2026-06-13)
- **PUSH:** Kan ej pusha grenen — GitHub-creds på Revit utgångna (token 401, gh-keyring ogiltig). Erik: färsk PAT (repo-scope) i `C:\Alva\config\github_token.txt` ELLER väck laptopen. 26+ commits ligger lokalt.
- **MFASetup retry-UX (#35 follow-up):** full retry-knapp vid enroll-fel kräver refaktor av enroll-effekten till en återanropbar funktion + auth-test. Minimal felvisning + deadend-skydd är gjort; full retry väntar. (Låg prio — skärmen är feature-flaggad AV.)
- (Övriga barnsäkerhet/betalning/datamodell-beslut hamnar här allt eftersom.)

## Hög allvarsgrad (37)

- [skip] PrivateRoute.tsx — FALSKT LARM. RRv5 <Switch> matchar på child.props.path (oavsett komponenttyp), så <PrivateRoute exact path="/create-team"> skuggar INTE /privacy/terms (egna <Route>, matchar rätt). Verifierat mot App.tsx. Render-prop-omskrivning = stilfix med IonRouterOutlet-regressionsrisk → rör ej.
- [x] ShareTargetHandler.tsx — stale-closure i share-handler — handlerRef + stabil wrapper, init-effekt tom dep
- [skip] TabLayout.tsx — wall-access fail-open — REDAN fail-closed (f6efc81, rad 47 `?? false`). Realtime-omkoll vid Owner-toggle ej gjord (mindre UX, ej säkerhet) — kvar som låg.
- [x] call/VideoGrid.tsx — remote video positionellt mappad (fel namn över fel stream) → agoraUidForUser() (speglar edge-fn:s UID-formel exakt, node-verifierat) → mappa varje deltagare till SIN ström. NB pre-existerande: user-left-filtret i CallContext jämför UUID mot Agora-uid (tar ej bort deltagare vid leave) — samma rotorsak, eget follow-up. KRÄVER live 2-användarsamtal-verifiering (Erik testar).
- [skip] chat/ChatInputToolbar.tsx — @mention \w bryter å/ä/ö — REDAN FIXAD (f00787b, rad 91 använder /@([\p{L}\p{N}_]*)$/u)
- [x] chat/EmojiGifPanel.tsx + GifPicker.tsx — duplicerad GIF-flik → GifPicker var DÖD KOD (bara i barrel, ej monterad) → raderad + ur index.ts. Fixade GIF-buggarna i live-komponenten EmojiGifPanel: stuck-spinner (try/finally), stale-response (requestSeq-guard), tom-sökning-klobbras-av-trending (hasLoadedGifs-gate), debounce-läcka vid unmount (cleanup).
- [x] chat/ImageMessage.tsx — tap-to-close kapade knappar (target.closest('button')-guard) + native spara via Filesystem+Share (galleri-direktspar → ISSUES L1)
- [x] chat/MessageBubble.tsx — 300-rad <style> per instans → extraherat till MessageBubble.css (importeras en gång) + React.memo. FÖLJD: ChatView bör skicka stabila callbacks/memoizerad galleryUrls för full memo-vinst (medel).
- [x] chat/PollMessage.tsx — icke-atomisk röstväxling → cast_poll_vote-RPC (migration 20260613110000, SECURITY INVOKER, advisory-lock per poll+user, single-choice clear+insert i en transaktion). Verifierat psql: switch→1, multi→2, re-vote idempotent→1. (N+1 poll-fetch = kvar, perf/medel — egen cache.)
- [x] chat/VoiceMessage.tsx — Infinity-duration (webm utan duration-header) — Number.isFinite-guard + metadata-prio
- [x] chat/VoiceRecorder.tsx — cancel skickar ändå + ingen unmount-cleanup (mic kvar på) — cancelledRef + streamRef + cleanup-effect
- [skip] friends/AddToChatPicker.tsx — 1:1→grupp-konvertering är AVSIKTLIG server-side (add_member_to_chat sätter is_group=true). Erik 2026-06-13: ingen varning behövs → inget att ändra (alt A).
- [x] friends/FriendSettingsModal.tsx — reset-effekt wipe:ar pågående redigering — init-key-ref (en gång per öppning/friend)
- [x] friends/ZemiNumberInput.tsx — går ej radera förbi prefix — robust formatZemiNumber (tom + partiell prefix), handleInput delegerar; 12 node-cases gröna
- [ ] subscription/MemberLimitDialog.tsx — gräns bara klientsidig (TROL. redan #2 4018c35)
- [x] subscription/Paywall.tsx — hårdkodat pris → store priceString (Erik godkände); storePriceFor() från currentOffering, fallback bara medan offerings laddar; mock priceString utan period (period läggs vid render)
- [x] tillkalla/TillkallaButton.tsx — tyst fel (BARNSÄKERHET, Erik godkände fixen) — danger-toast + behåll modal öppen för retry vid fel; success-toast; ny i18n `tillkalla.failed` ×5 språk
- [x] contexts/CallContext.tsx — callDuration i context → 1 re-render/s överallt → eget CallDurationContext + useCallDuration(); CallHeader+CallPiP migrerade; callDuration ur CallContextState. tsc/unit gröna.
- [x] contexts/CallContext.tsx — incoming-call-subscription rivs/återskapas per state-change → activeCallRef + sub en gång per profile (cleanupCall stabil [])
- [x] contexts/CallContext.tsx — ring-timeout uppdaterade ej call_log/push/signal/system-msg → DB-status-guard (MISSED) + cancel-push + deleteCallSignals + createCallMessage
- [x] hooks/usePresence.ts — N kanaler + N+1 fetch + 30s-tick per rad → central presenceStore (en kanal, batchad .in()-fetch, en delad tick) via useSyncExternalStore. tsc/lint/unit gröna; behöver live-verifiering av presence (2 användare).
### Resterande hög (rapportens #27–37)
- [x] #27 SubscriptionContext.tsx — RevenueCat-init beror på profile-objektref → keyat på profile?.id (lokal const + dep), undviker re-init/re-login vid varje profiländring
- [ ] #28 legal/privacy-sv.ts — inkonsekventa plannamn mellan legal-dokument (innehåll)
- [ ] #29 ChatInfo.tsx — varje SharedMediaThumb kör useSignedMediaUrl separat → N requests (perf)
- [ ] #30 ChatList.tsx — Virtuoso useWindowScroll inuti IonContent (scroll-mismatch) (perf)
- [ ] #31 ChatView.tsx — getGalleryUrls(messages) i Virtuoso itemContent → körs per rad (perf)
- [ ] #32 ChatView.tsx — loadChat utan paginering + reactions/read-receipts för ALLA (perf)
- [x] #33 Dashboard.tsx — loadMembers/loadApprovalsCount/loadTillkallaAlerts svalde fel → error-logg + behåll state vid fel (Tillkalla=barnsäkerhet, klobbra ej till tom)
- [x] #34 Friends.tsx — loadData utan felhantering (stuck spinner vid throw) → try/finally + per-result error-logg
- [x] #35 MFASetup.tsx — enrollMFA-fel → 'scan'-steg utan QR/fel → visar nu felet på scan-steget + Next blockerad utan factorId (deadend-skydd). Screen feature-flaggad AV. FÖLJD (eskalerat): full retry-knapp-UX kräver refaktor av enroll-effekten + auth-test.
- [x] #36 OwnerApprovals.tsx — handleDenyFuture ignorerade rejectTexterRequest-resultat → deny-future körs nu BARA om reject lyckades (annars logg), annars hade vi rapporterat "nekad" med levande pending-request
- [ ] #37 OwnerChatView.tsx — loadData utan paginering (perf)

## Medel (172) — efter hög

## Låg (177) — efter medel
