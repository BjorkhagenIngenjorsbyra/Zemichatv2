# Incoming Call Push Notifications — Setup Guide

This document covers the manual steps needed to make incoming call notifications work on Android and (later) iOS.

## How It Works

1. Caller taps **Ring** → `call_signal` created in DB + `call-push` Edge Function invoked
2. Edge Function sends **FCM data message** (high priority) to receiver's device
3. If app is in **foreground**: Supabase Realtime handles it (existing flow)
4. If app is in **background/killed**: `ZemichatMessagingService` receives it natively →
   shows full-screen notification with ringtone + vibration → shows `IncomingCallActivity`
5. Receiver taps **Answer** → main app opens → Agora call starts
6. Receiver taps **Decline** → notification dismissed → caller's 30s timeout marks as missed
7. When caller hangs up or times out → `call_cancelled` push sent → notification dismissed

---

## Android Setup

### 1. Firebase Console (already done for push)

The existing `google-services.json` in `android/app/` already enables FCM. No changes needed here.

### 2. Deploy the Edge Function

```bash
supabase functions deploy call-push
```

The function uses the same environment variables as `send-push`:
- `SUPABASE_URL` (auto-set by Supabase)
- `SUPABASE_SERVICE_ROLE_KEY` (auto-set by Supabase)
- `SUPABASE_ANON_KEY` (auto-set by Supabase)
- `FCM_SERVICE_ACCOUNT_JSON` (already configured for send-push)

### 3. Full-Screen Intent Permission (Android 14+)

Starting with Android 14 (API 34), `USE_FULL_SCREEN_INTENT` is a restricted permission for most apps. **Messaging and calling apps are exempt**, but you may need to:

1. Ensure the app targets a communication use case in Google Play
2. If the permission is denied, the notification will still show as a heads-up notification (still visible, just not full-screen)

For testing on Android 13 and below, no special steps are needed.

### 4. Build and Test

```bash
npm run build
npx cap sync android
# Open Android Studio and run on device/emulator
```

**Test procedure:**
1. Log in as User A on one device, User B on another
2. Kill the app on User B's device (swipe away)
3. User A calls User B
4. User B should see full-screen incoming call screen with ringtone
5. Tap Answer → app opens → Agora call connects
6. Test: Let it ring 30 seconds → should auto-dismiss
7. Test: Decline button → notification dismissed

---

## iOS Setup (Deferred — no ios/ directory yet)

When `npx cap add ios` is run, the following steps are needed:

### 1. Apple Developer Account

1. Go to [Apple Developer > Certificates](https://developer.apple.com/account/resources/certificates/list)
2. Create a **VoIP Services Certificate** for your App ID (`com.zemichat.app`)
3. Download and install the `.cer` file
4. Export as `.p12` from Keychain Access
5. Convert to PEM for server-side use:
   ```bash
   openssl pkcs12 -in voip_cert.p12 -out voip_cert.pem -nodes
   ```

### 2. Xcode Configuration

1. Open `ios/App/App.xcworkspace` in Xcode
2. Go to **Signing & Capabilities** → Add **Push Notifications** capability
3. Add **Background Modes** capability → Enable **Voice over IP** and **Remote notifications**

### 3. CallKit Plugin

Install a CallKit Capacitor plugin (e.g., `capacitor-callkit-voip`):
```bash
npm install capacitor-callkit-voip
npx cap sync ios
```

CallKit provides the native iOS call UI (same as regular phone calls).

### 4. APNs VoIP Push

The Edge Function needs to be updated to send APNs VoIP pushes for iOS tokens:
- Use the VoIP certificate (PEM) to authenticate with APNs
- Send to `https://api.push.apple.com/3/device/{token}`
- Topic: `com.zemichat.app.voip`
- This is separate from regular APNs — VoIP pushes wake the app even when killed

### 5. Share Extension (bonus)

The Share Target feature (already implemented for Android) needs a Share Extension on iOS:
- Create Share Extension target in Xcode
- Configure App Group `group.com.zemichat.app`
- Same web-layer ShareTargetHandler handles the rest

---

## Known Limitations (v1)

1. **Decline from native screen**: Dismisses notification but doesn't immediately tell the caller. The caller's 30-second timeout handles it as "missed call". A future version can add a proper decline push.

2. **Call type on native screen**: The native call screen shows "Voice call" or "Video call" based on what the caller initiated. The text is English-only. A future version can use Android string resources for i18n.

3. **Token refresh when app is killed**: If FCM refreshes the token while the app is killed, the new token won't be saved until the app is next opened. This is rare and acceptable.

4. **Messaging service override**: `ZemichatMessagingService` replaces Capacitor's default Firebase messaging service. Regular push notifications (new messages) are handled automatically by Android's notification display (since they include a `notification` field). Call pushes are data-only and handled by our service.

---

## Architecture Overview

```
android/app/src/main/java/com/zemichat/app/
├── ZemichatMessagingService.java  — Receives FCM data messages
├── IncomingCallActivity.java      — Full-screen call UI (ringtone + vibration)
├── CallNotificationPlugin.java    — Capacitor bridge (JS ↔ native)
├── CallDismissReceiver.java       — Broadcast receiver for Decline action

supabase/functions/call-push/
└── index.ts                       — Edge Function: sends FCM to call recipients

src/services/callPush.ts           — TS wrapper for Edge Function + native plugin
src/contexts/CallContext.tsx        — Modified: sends push on ring/cancel/end
```
