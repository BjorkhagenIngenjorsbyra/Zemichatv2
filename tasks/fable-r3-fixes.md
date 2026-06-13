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
- **Perf #30/#32/#37 (paginering + Virtuoso-scroll):** stora ändringar av core chat-/oversight-laddning och listscroll. Hög risk att regressa (meddelanden laddas ej, scroll hoppar, realtime tappar) om de byggs blint utan on-device-test. Görs bäst när stacken kan köras + verifieras manuellt. Ej gjorda autonomt.
- **#48 MediaPicker preventDefault i onTouchMove** — osäkert om React-lyssnaren är passiv; korrekt fix (native non-passive listener) kräver enhets-test av pinch-zoom. Ej gjort blint.
- **#49 MediaPicker fil-storlek/MIME-validering** — behöver beslut: maxstorlek (MB) + felmeddelande (i18n). accept-attribut begränsar redan MIME något. Server har troligen egen gräns.
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
- [x] #28 legal/privacy-*.ts — privacy listade planer "(free, basic, family, premium)" men riktiga planer (terms-docs + PLAN_FEATURES) är Free/Basic/Pro → rättat till "(free, basic, pro)" i alla 5 språk (faktakorrigering, ej legal-bedömning)
- [x] #29 ChatInfo.tsx — N useSignedMediaUrl-hooks → en batchad resolveMediaUrls() på liständring (deduped/cached), thumb tar resolved url som prop
- [HOLD] #30 ChatList.tsx — Virtuoso useWindowScroll inuti IonContent → ESKALERAT (ändrar scroll-beteende, kräver on-device-verifiering; blind risk för trasig listscroll)
- [x] #31 ChatView.tsx — getGalleryUrls(messages) per rad i itemContent → useMemo (commit f0e28be)
- [HOLD] #32 ChatView.tsx — loadChat utan paginering → ESKALERAT (stor ändring av core chat-laddning + realtime + scroll; hög regressionsrisk blint)
- [x] #33 Dashboard.tsx — loadMembers/loadApprovalsCount/loadTillkallaAlerts svalde fel → error-logg + behåll state vid fel (Tillkalla=barnsäkerhet, klobbra ej till tom)
- [x] #34 Friends.tsx — loadData utan felhantering (stuck spinner vid throw) → try/finally + per-result error-logg
- [x] #35 MFASetup.tsx — enrollMFA-fel → 'scan'-steg utan QR/fel → visar nu felet på scan-steget + Next blockerad utan factorId (deadend-skydd). Screen feature-flaggad AV. FÖLJD (eskalerat): full retry-knapp-UX kräver refaktor av enroll-effekten + auth-test.
- [x] #36 OwnerApprovals.tsx — handleDenyFuture ignorerade rejectTexterRequest-resultat → deny-future körs nu BARA om reject lyckades (annars logg), annars hade vi rapporterat "nekad" med levande pending-request
- [HOLD] #37 OwnerChatView.tsx — loadData utan paginering → ESKALERAT (samma som #32, core oversight-laddning; hög regressionsrisk blint)

## Medel (172) — efter hög
### Felhantering-batch 1
- [x] #4 CreateTexterModal.copyCredentials — clipboard.writeText try/catch
- [x] #5 CreateTexterModal.handleSubmit — try/catch/finally runt createTexter (stuck-loading + tyst fel)
- [x] #7 ReportButton.submit — try/catch/finally (stuck submitting vid throw)
- [x] #30 ForwardPicker — getMyChats saknade .catch (unhandled rejection)
- [x] #56 QuickMessageBar — getMyQuickMessages-fel ignorerat → try/catch/finally + error-logg
### MediaPicker-batch
- [x] #46 MediaPicker — object-URL-läcka (revoke prev före ny preview + unmount-cleanup via ref)
- [x] #47 MediaPicker — upload-await utan catch (handleSendImage + handleDocumentChange → catch+logg)
- [HOLD] #48 MediaPicker — e.preventDefault() i onTouchMove (ev. passiv lyssnare) — osäkert + kräver enhets-test av pinch-zoom → eskalerat
- [HOLD] #49 MediaPicker — ingen klient-fil-storlek/MIME-validering → kräver beslut om maxgräns + i18n-meddelande → eskalerat
### ShareTargetHandler-batch
- [x] #8 ShareTargetHandler — delad caption sattes på VARJE bild → bara första bilden
- [x] #9 ShareTargetHandler — getMyChats picker-effekt saknade .catch → tillagd
- [skip] #10 ShareTargetHandler — post-login pending-share-effekt "körs på varje ändring": clearShareIntent() efter hantering gör omkörningar till no-ops → låg/ofarlig, lämnad
### Korrekthet-batch 2
- [x] #57 VoiceMessage — audio.play() promise ej fångad → .catch + setIsPlaying(false)
- [x] #44 MessageBubble.openEditHistory — getMessageEdits-fel ignorerat → error-guard
- [ ] #55 PollCreator — option-rader keyed by index (options är string[]); korrekt fix = {id,text}[]-refaktor (add/remove/submit) → NÄSTA (moderat)
### Övrigt medel
- [x] #43 MessageBubble.renderTextWithMentions — split(/(@\w+)/) missade å/ä/ö → /(@[\p{L}\p{N}_]+)/gu (render-sidans motsvarighet till input-fixen f00787b)
- [skip] EmojiGifPanel #27/#28/#29 (medel: try/catch, gifs.length-effekt, race) — REDAN fixade i d9de747 (GifPicker-dedupen).
- (Resten av medel ej påbörjade — teman: per-instans <style> (CallHistoryItem/VideoTile/ImageMessage/VoiceMessage/PollMessage), saknad felhantering (CreateTexterModal/ReportButton/ChatSearchModal/ForwardPicker/QuickMessageBar m.fl.), a11y (AttachmentSheet/MentionAutocomplete/MessageContextMenu), säkerhet (LinkPreview SSRF #37, LocationMessage-koordinater #38 — granska noga). Bearbeta i ordning nästa session.)

### Batch 3 — isolerade krasch/stale-state-fixar (commit a25371d)
- [x] ThemeContext — stored theme validerad mot THEMES + applyTheme fallback dark (obsolet localStorage-värde white-screen:ade boot)
- [x] OfflineBanner — "back online"-timeout i ref, clear vid status-byte+unmount (stale timeout dolde banner medan fortf. offline)
- [x] TrialBanner — registrera --ion-safe-area-top-cleanup BARA när satt (osynlig banner strippade ej override)
- [x] EmailConfirmed — history.replace ut ur setCountdown-updater → countdown===0-effekt (ren updater, StrictMode-säker)
- [skip] GroupAvatar tom members → krasch = FALSKT LARM (userDisplay-utils är null-säkra, ger 'U'+färg)

### Batch 4 — friends felhantering (commit aad8660)
- [x] errors.generic-nyckel tillagd i alla 5 locales (återanvänds nedan)
- [x] AddToChatPicker — .catch på getMyChats m. distinkt load-error-state + danger-toast på addMemberToChat-fel
- [x] Friends-sidan — feltoast på accept/reject/startChat/call (samma sväljda klass som #42 unfriend)
- [x] FriendRequestCard — isProcessing-guard avaktiverar accept/reject efter första tap + awaitar handlern (ingen dubbel service-call)
- [x] FriendSettingsModal — danger-toast + behåll modal öppen vid save-fel

### Batch 5 — sidor felhantering 1 (commit 08c7e6d)
- [x] Calls — try/catch/finally i loadCalls + monoton request-id-guard (out-of-order-svar kan ej skriva över aktiv flik; var: oändlig skeleton + fast pull-to-refresh)
- [x] NewChat — try/catch/finally i loadContacts m. feltoast; validera ?add=-preselect mot vänlistan; toast på createChat-fel
- [x] InviteSuper — visa delete-knapp även för utgångna inbjudningar (kunde aldrig tas bort)
- [HOLD perf] Calls opaginerad getCallHistory + derive missed klientsidigt — eskalerad perf (samma klass som #32)

### Batch 6 — owner/oversight (commit 17520ad)
- [x] OwnerApprovals — try/catch/finally i loadData; processRequest-helper (bokföring+listborttagning+danger-toast) → approve/reject/denyFuture-fel syns nu
- [x] OwnerChatView — try/catch/finally i loadData + distinkt error+retry-state (load-fel ≠ "inga meddelanden")
- [x] OwnerOversight — try/catch/finally + error+retry-state; filteredChats→useMemo; URL-texter-filter seedas EN gång via ref (manuell segment-växling överlever pull-to-refresh)
- [HOLD perf] OwnerChatView N+1 signed-urls (OversightImage) + getTexterChats opaginerad/N+1 messageCount — eskalerad perf (kräver batch-sign/aggregat-query)
- [skip-ish] getMessageTypeIcon-dubblett OwnerChatView/OwnerOversight — låg drift-risk, lämnad (ev. util-extraktion senare)

### Batch 7 — core sidor felhantering (commit 314acf1)
- [x] ChatList — try/finally i loadChats (ingen oändlig skeleton/fast refresher); memoiserade chatIds (typing-subs rivs ej per render); long-press suppr. trailing click (ingen navigate-under-popover), clear timer vid unmount, async preview-guard via token; openPreview-helper dedup:ar de två long-press-vägarna
- [x] ChatInfo — distinkt load-error-skärm (retry) vs affirmativ not-found (redirect); handleSaveName/handleLeave kollar resultat, muterar lokalt/navigerar bara vid success, toast vid fel
- [x] Login — try/catch/finally i handleSubmit (ingen permanent spinner); rensa pending-invite-token BARA efter lyckad claim
- [HOLD] ChatList realtime listuppdateringar — eskalerad (samma on-device-verify-risk som paginering #30/#32)

### Batch 8 — settings/owner-kontroller (commit 3cb0753)
- [x] ActiveSessions — try/catch/finally i load + error+retry; removingId-guard (ingen dubbel removeSession) + toast vid fel
- [x] TwoFactorSetting — .catch på isMFAEnabled (fallback disabled+toast ist.f. evig spinner); toast när disableMFA failar (var tyst). OBS: skärmen fortf. feature-flaggad AV
- [x] QuickMessageManager — try/catch/finally i loadMessages m. distinkt load-error+retry (fel ≠ "inga meddelanden", undviker default-återskapning ovanpå befintliga); feltoast på add/edit/delete/addDefaults; reorder rullar tillbaka optimistisk ordning + toast vid persist-fel

### Batch 9 — isolerade korrekthetsfixar (commit d550dea)
- [x] LegalPage — normalisera i18n.language till baskod (en-US→en) före content/title-lookup (regional locale föll tyst till sv)
- [x] MessageReactions — key emoji-span på emoji+count+hasReacted (ändras vid swap) så pop-animationen faktiskt re-mountar (#34 var no-op)
- [x] CallPiP — härled motpart via filter på current user-id (speglar CallView) ist.f. slice(1) som visade callee sitt eget namn/avatar
- [x] CallLogMessage — media_metadata = sanningskälla för typ/status/duration; content-substring bara legacy-fallback (bröt vid lokaliserad/omformulerad systemtext)

### Batch 10 — chat/call race/double-tap/key (commit 7fecbf5)
- [x] ChatSearchModal — monoton request-id-guard (stale-svar skriver ej över) + distinkt error+retry-state. #132 (unbounded) = redan LIMIT 50/100 serverside → skip
- [x] AddParticipantPicker — fetch på open/chat (ej på fresh currentParticipantIds-array varje render) + useMemo-filter; loading+error-state (fetch-in-flight/fel lästes som "call full")
- [x] IncomingCallModal — actionTaken-guard avaktiverar answer/decline efter första tap (ingen dubbel join/answer-race), reset per samtal
- [x] PollCreator — stabila per-option-ids (key på id, ej index) så borttagen mittenrad behåller fokus/IME; dedupe trimmade options före create + i validering

### Batch 11 — wall (commit 328769b)
- [x] NewPostModal — danger-toast på upload/createWallPost-fel, behåll modal för retry (inlägg "försvann" tyst)
- [x] WallComments — onCommentCountChange i ref (inline parent-callback re-skapar ej loadComments varje render → refetch-loop); toast på delete-fel
- [x] WallPost — kolla toggleWallReaction-resultat, toast vid fel ist.f. unhandled rejection

### Batch 12 — dashboard/voice (commit 86a9c2a)
- [x] Dashboard — try/finally så pull-to-refresh alltid slutförs; grinda owner Quick Actions på isOwner (Super/Texter såg owner-UI); #382 head:true-count = skip (kräver service-ändring)
- [x] VoiceRecorder — surfacing av getUserMedia-fel: dedikerat mic-permission-meddelande (ny voice.micDenied ×5 locales) vs generiskt; toast när sändning failar (båda var tysta)

### Batch 13 — i18n-hårdkodning + disabled-prop (commit a2ed3d8)
- [x] TillkallaAlertCard "Acknowledged" → tillkalla.acknowledged (×5)
- [x] TillkallaConfirmModal "Cancel in {n}s" → tillkalla.autoCancelIn (×5). Countdown-under-loading-BETEENDE = fortf. eskalerat (barnsäkerhet)
- [x] MessageContextMenu hardcoded "React with {emoji}" → a11y.reactWith (×5). menuRef ANVÄNDS faktiskt (ref={menuRef}) → den delen av fyndet falsk
- [x] ChatInputToolbar — wire:a faktiskt disabled-propen (textarea/emoji/attach/kamera/röst/send var fullt interaktiva för suspenderad Texter); normalisera kamera-MIME (jpg→jpeg) + toast på riktiga kamerafel

## ⚠️ ESKALERAT/HOLD — medel som EJ görs autonomt (kräver Erik/test/beslut)
- **Betalning (STOPPA-regel):** Paywall userCancelled-flagga (#244, toast på avbrott), Paywall handleRestore "inga köp"-feedback (#246), ChoosePlan/CreateTeam startTrial-felhantering, MemberLimitDialog (subscription) — alla rör betalflöde → Erik.
- **Auth/MFA (säkerhet):** TwoFactorSetting flagg-flip (Erik: vänta på e-poståterställning), Login MFA AAL2-check (#400), MFASetup double-invoke+recovery-koder (#402/#404), MFAVerify fail-open (#406), useAuth TOKEN_REFRESHED-churn (#292).
- **Barnsäkerhet (STOPPA-regel):** QuietHoursManager felåterkoppling (tysta restriktioner — additiv men rör barnsäkerhetskontroll → Erik), TillkallaConfirmModal countdown-under-loading + onCancel-ref (panik-flöde — beteendeändring). Cosmetiska i18n-fixar i samma område (TillkallaAlertCard "Acknowledged", TillkallaConfirmModal "in 4s") = säkra, görs i kommande i18n-batch.
- **RLS/server-verifiering (säkerhet):** LinkPreview SSRF (#158), LocationMessage klartext-koordinater (#160), AddFriend zemi-uppräkning rate-limit (#328), WallComments/WallPost raderat innehåll redaktion (#262/#270), NewPostModal can_send_images server-enforcement (#258), ChatInfo add-member RLS (#338), ChatView texter-gates RLS (#366) — kräver RLS/edge-granskning, ej blind klientfix.
- **Datamodell/atomicitet (STOPPA-regel):** ChatView handlePollCreate atomisk (orphan poll-msg, kräver RPC/transaktion #358), PollMessage poll_votes-realtime (#186).
- **Paginering/perf (on-device-verify):** Calls/ChatList realtime+paginering, OwnerChatView N+1 signed-urls, OwnerOversight opaginerad+N+1, LinkPreview promise-cache, legal lazy-load, MessageBubble/ChatView swipe-perf — eskalerade perf.
- **Legal (compliance):** Privacy Shield→DPF-faktafix (#310-315), komplaint-myndighet-inkonsistens (#302), DPF-källor — RÖR EJ privacy/terms-dokument utan Eriks ok (compliance-känsligt).

### Batch 14 — CSS-extraktion-svep (commits 2904f8b, d8cd6d8, 7b6dab9, 82e9f1f, 8074c84)
- [x] Per-instans `<style>` → co-located .css importerad en gång: CallHistoryItem, VideoTile, VoiceMessage, QuotedMessage, **PollMessage** (isOwn-interpolation → `.poll-message.own`-klass), FriendCard, FriendRequestCard, CreateTeam (två block, delad m. ChoosePlan kvar inline), ImageMessage, WallPost (scopat under `.wall-post-card` + `wall-fullscreen-*` för att ej krocka m. ImageMessage/MessageReactions), ChatView (scopat under `.chat-content`/`.chat-footer`, bare `ion-footer` borttagen). MessageBubble var redan klar.
- **Verifierat med full `vite build` (✓ grön).** Ingen visuell förändring.
- KVAR (CSS): ChoosePlan delar onboarding-CSS m. CreateTeam (kunde extraheras till delad onboarding.css — låg prio).

### Batch 15 — a11y-svep (commits 7054159, f3f1088)
- [x] AttachmentSheet — role=dialog/aria-modal/aria-label, fokus första option, Escape, backdrop aria-hidden
- [x] StickerPicker — role=dialog+aria-label, close-aria-label, pack-tab accessible names (aria-label+aria-pressed), Escape, backdrop-dismiss
- [x] MessageContextMenu — role=dialog/aria-modal/aria-label, initialfokus, Escape (menuRef ANVÄNDS redan)
- [x] ChatInfo — gruppnamn-edit nu riktig button (role=button/tabIndex/Enter+Space/aria-label) ist.f. onClick på h2
- [x] MentionAutocomplete — role=listbox + role=option/aria-selected (full pil-navigation kräver parent-input-wiring → FÖLJD)
- [x] FriendSettingsModal — role=dialog/aria-modal/Escape + show-real-name-toggeln nu `<button role="switch" aria-checked>` (button-defaults nollställda i CSS)

### Batch 16-18 — sista säkra felhantering/korrekthet (commits 87ffbc1, 9fb1225, fdafac5)
- [x] useSignedMediaUrl — path-tracking-ref: rensa stale URL vid äkta path-byte (recycled/virtualized rad), .catch (#298)
- [x] useTypingList — äkta inkrementell diff, unsub+prune borttagna, teardown bara vid unmount, order-insensitiv key (#286)
- [x] CreateTeam — referral-validerings request-id-guard + feltoast på submitReferral/startTrial (#372/#374)
- [x] NotificationContext — app-resume refreshCounts (appStateChange+visibility) + re-sync på (re)subscribe-status (#296)
- [x] main.tsx — rensa #root före createRoot, appMounted-grind på global-error-fallback, Sentry.captureException i alla swallowed paths (#324/#326)
- [x] App.tsx — AuthCallbackHandler hanterar type=recovery → /reset-password (behåller hash för supabase) (#90)
- [skip] EmojiGifPanel #27/#28/#29 — REDAN fixade i d9de747 (requestSeq+try/finally+hasLoadedGifs), verifierat

## Batch 19-25 — HINK A + B (Eriks go "gör klart allt i hög+medel")
Erik godkände: hink A allt, hink B RLS=implementera+verifiera-lokalt-EJ-deploya, perf/scroll=implementera-nu-enhetstesta-senare.
### Hink A (KLART, commits e0e5ae5, 6f47d0d, 6e27a95, dbee932)
- [x] Betalning: Paywall cancel-aware purchase (#244) + restore-feedback/restoreNoPurchases (#246) + ChoosePlan startTrial-fel (#370)
- [x] Auth: MFAVerify fail-closed+retry (#406), enrollMFA stale-cleanup + MFASetup double-invoke-guard (#402), Login AAL2-gate (#400)
- [x] Barnsäkerhet: QuietHoursManager revert+toast på save-fel (#230), TillkallaConfirmModal countdown-frys-under-loading + onCancel-ref + cancel-ur-updater (#250/#252)
- [x] Datamodell: ChatView poll-create orphan-cleanup (#358), PollMessage poll_votes-realtime (#186), NewChat 1:1-dedup (#412)
### Hink B RLS (commit 0030064 + verifieringar)
- [skip-VERIFIED] #366 texter-gates: `messages` INSERT har `texter_can_send_type()` — REDAN enforced (psql-verifierat)
- [skip-VERIFIED] #258 wall can_send_images: `wall_posts` INSERT har `can_post_wall_images()` — REDAN enforced
- [skip-VERIFIED] #158 SSRF: fetch-link-preview edge fn fullt härdad (audit #21) — http(s)-only, DNS privat-IP-block, per-hop redirect-omvalidering, storleksgräns, rate-limit
- [x] #160 LocationMessage onError-fallback (funktionell) + #158 LinkPreview https-guard (klient)
- [HOLD-Erik] #160 privacy: barns koordinater i klartext till staticmap.openstreetmap.de — privacy-korrekt fix byter thumbnail-rendering = VISUELL ändring → Eriks designbeslut (lokal Leaflet vs egen edge-proxy vs lokalt pin-kort)
- [HOLD-risk] #338 add-member friend-check: `chat_members_insert_creator` tillåter creator lägga GODTYCKLIG user_id (ej bara vänner). Äkta lucka MEN tightening kan bryta legitima flöden (team-interna chattar/owner-add-texter om de ej går via friendships) → kräver domänbekräftelse + fler-rolls-RLS-test innan migration
- [HOLD-risk] #262/#270 raderat innehåll redaktion: wall_posts/wall_comments SELECT skickar `content` för raderade rader till icke-owners (bara klient-dolt). Kräver kolumn-redaktion via vy/SECURITY DEFINER — arkitektonisk, regressionsbenägen
- [HOLD] #328 AddFriend zemi-uppräkning rate-limit: söket är direkt PostgREST-query (ej edge fn); rate-limit-infra finns för edge-fns men kräver flytta sök till edge fn

### Hink B perf/scroll (Erik: bygg nu/enhetstesta sen)
- [x] SÄKRA perf (commit 472beda): MessageBubble signed-url-gating video/doc/gif (#168), LinkPreview promise-cache (#156), ChatView läskvitto-dedup via ref (#352)
- [x] #88 tab-array-route (commit 304d9c2) — TabLayout mountas en gång; build-verifierat, enhetstesta tab-transitions
- [INVESTIGERAT — nyans] #32 ChatView: initial-laddning REDAN capad (getChatMessages limit=50) → "unbounded" överdrivet. Kvar = scroll-ladda-äldre (Virtuoso firstItemIndex-prepend) = enhancement, hög blind-risk → dev-server-pass.
- [INVESTIGERAT — transparenskonflikt] #37 OwnerChatView: getOversightMessages OBEGRÄNSAT, men att capa döljer gammalt innehåll för föräldern (krockar med transparensmodellen) → kan ej capas blint; kräver paginera-med-ladda-äldre + Eriks designbeslut.
- [HOLD device] #30 ChatList Virtuoso useWindowScroll i IonContent → scroll-config, enhetstest.

## ✅ ALLA SÄKRA MEDEL + HINK A + SÄKER PERF + #88 KLARA
Kvar = djup-RLS (#338/#262/#270/#328, eget pass) + perf-scroll-enhancements (#32/#37/#30, dev-server/designbeslut) + Hink C produktbeslut (2FA-flagga, legal-myndighet, #160-privacy-visual).
Se "⚠️ ESKALERAT/HOLD"-sektionen ovan. Sammanfattning av vad som ÄR KVAR av de 172 medel:
- **Betalning:** Paywall userCancelled/restore-feedback, ChoosePlan/MemberLimit (STOPPA-regel).
- **Auth/MFA:** TwoFactorSetting flagg-flip, Login AAL2, MFASetup/MFAVerify (feature-flaggat AV + säkerhet).
- **Barnsäkerhet:** QuietHoursManager-logik, TillkallaConfirmModal countdown-under-loading-BETEENDE (STOPPA-regel).
- **RLS/server-verifiering:** SSRF #158, LocationMessage-koordinater #160, AddFriend-uppräkning #328, raderat-innehåll #262/#270, can_send_images server #258, add-member RLS #338, texter-gates #366.
- **Datamodell:** ChatView atomisk poll-create #358, PollMessage poll_votes-realtime #186, NewChat 1:1-dedup #412.
- **Paginering/perf (on-device-verify):** #30 ChatList Virtuoso, #32 ChatView, #37 OwnerChatView, App.tsx #88 tab-array-route, LinkPreview promise-cache, legal lazy-load, swipe-perf.
- **Legal (compliance):** Privacy Shield→DPF #310-315, komplaint-myndighet #302.
- **a11y FÖLJD:** MentionAutocomplete full pil-navigation, full focus-trap i sheets.
- **CSS FÖLJD:** ChoosePlan onboarding-CSS.

Nästa pass: LÅG-listan (177) — eller eskalerade medel när Erik kan enhetstesta/besluta.

## Låg (177) — PÅGÅR (Erik: "kör låg-listan under tiden")
Långt svans-arbete, betas av i batchar. Klart hittills:
- **Batch L1 correctness (commit 177343f):** SkeletonLoader Math.random→deterministisk (flimmer), GroupAvatar React-import, QuietHoursManager numerisk sort + död state, MentionAutocomplete filtrera undefined user, QuotedMessage gif/poll-cases + onKeyDown(Enter/Space), ChatView selectionStart `??` (cursor-pos 0-bug), FriendSettingsModal show_real_name-reset, ChoosePlan hoppa startTrial för FREE, ForgotPassword/InviteSuper email-trim/normalisering.
- **Batch L2 timers (commit 3976fc8):** CreateTexterModal + AddFriend copied-timer i ref + cleanup på unmount/reset.
- KVAR (~165): stora teman = CSS-extraktion-svep forts. (OnboardingSlides/ConfettiAnimation/ReportButton/ChoosePlan/Dashboard/NewChat/Friends/ChatList/OwnerChatView/OwnerApprovals/TillkallaAlertCard/WallComments/MFAVerify/MFASetup), a11y aria-labels + i18n-hårdkodning (många, svep), kvarvarande timeout-läckor (OnboardingSlides/ShareTargetHandler/ForwardPicker/MessageBubble-heart), derived-state→useMemo (NewChat/Friends/OwnerApprovals totalCount/LegalPage), shared <UserAvatar>-komponent (4+ dubbletter), legal-typos/Privacy-Shield/entities (= Hink C, Erik), småperf (optimistic updates, getOptimizedAvatarUrl i GroupAvatar). Inga av dessa är blockerande; betas av löpande.

## (referens) Låg-rubrik
