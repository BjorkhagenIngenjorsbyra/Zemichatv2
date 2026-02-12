# iOS Setup Guide — Zemichat

Complete guide for setting up iOS with push notifications, CallKit, and PushKit.

## Prerequisites

- macOS with Xcode 15+
- Apple Developer Account (paid — required for push notifications)
- Node.js & npm installed
- Zemichat project cloned and `npm install` completed

## 1. Add iOS Platform

```bash
npx cap add ios
npx cap sync ios
```

## 2. Install Native Plugin Files

Copy the CallKit plugin files into the Xcode project:

```bash
cp ios-callkit/CallKitService.swift ios/App/App/CallKitService.swift
cp ios-callkit/CallKitServiceBridge.m ios/App/App/CallKitServiceBridge.m
```

Open the Xcode project:

```bash
npx cap open ios
```

In Xcode, verify both files appear under `App/App/` in the project navigator. If not, drag them in and ensure **Target Membership** is checked for the `App` target.

## 3. Xcode Capabilities

Go to the App target → **Signing & Capabilities** tab:

### Add Push Notifications
Click **+ Capability** → **Push Notifications**

### Add Background Modes
Click **+ Capability** → **Background Modes**, then check:
- [x] Voice over IP
- [x] Remote notifications
- [x] Audio, AirPlay, and Picture in Picture

## 4. Add Frameworks

Go to App target → **Build Phases** → **Link Binary With Libraries**:

- Add `PushKit.framework`
- Add `CallKit.framework`

(These may already be auto-linked — verify they're present.)

## 5. Info.plist

Open `ios/App/App/Info.plist` and add (if not already present):

```xml
<key>UIBackgroundModes</key>
<array>
    <string>voip</string>
    <string>remote-notification</string>
    <string>audio</string>
</array>
<key>NSMicrophoneUsageDescription</key>
<string>Zemichat needs microphone access for voice and video calls.</string>
<key>NSCameraUsageDescription</key>
<string>Zemichat needs camera access for video calls.</string>
```

## 6. Apple Developer Console — APNs Key

1. Go to [Apple Developer → Keys](https://developer.apple.com/account/resources/authkeys/list)
2. Create a new key with **Apple Push Notifications service (APNs)** enabled
3. Download the `.p8` file — you only get ONE chance to download it
4. Note the **Key ID** (10-character string)
5. Note your **Team ID** (found in Membership Details)

## 7. Configure Supabase Secrets

### APNs Key (for VoIP/CallKit pushes)

Create a JSON secret with your APNs key:

```bash
# Format: {"keyId": "ABC123DEFG", "teamId": "TEAMID1234", "privateKey": "-----BEGIN PRIVATE KEY-----\nMIGH...\n-----END PRIVATE KEY-----"}

supabase secrets set APNS_KEY_JSON='{"keyId":"YOUR_KEY_ID","teamId":"YOUR_TEAM_ID","privateKey":"-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----"}'
```

**Important:** The `privateKey` must be the full PEM content of the `.p8` file with newlines replaced by `\n`.

### Deploy Updated Edge Functions

```bash
npx supabase functions deploy call-push
npx supabase functions deploy send-push
```

## 8. Firebase Configuration (for regular message push)

Regular message notifications use FCM, which proxies to APNs on iOS.

1. Go to [Firebase Console](https://console.firebase.google.com) → Project Settings → Cloud Messaging
2. Under **Apple app configuration**, upload the same APNs key (`.p8` file)
3. Enter the Key ID and Team ID
4. Download `GoogleService-Info.plist` from Firebase → General
5. Place it at `ios/App/App/GoogleService-Info.plist`
6. In Xcode, drag the file into the App group and check **Target Membership**

## 9. Database Migration

Push the migration that adds `token_type` to `push_tokens`:

```bash
npx supabase db push
```

This adds the `token_type` column (`'fcm'` or `'voip'`) so iOS devices can register both an FCM token (for message notifications) and a VoIP token (for incoming calls).

## 10. Build & Run

```bash
npx cap sync ios
npx cap open ios
```

In Xcode, select your device and run (Cmd+R).

## Architecture Overview

### Push Notification Flow

```
Message sent → DB trigger → send-push Edge Function
  → FCM (with apns payload) → Apple Push Notification service → iOS notification
```

### Incoming Call Flow

```
Caller initiates → call-push Edge Function
  → APNs VoIP push (via APNS_KEY_JSON) → PushKit → CallKitService.swift
  → CallKit shows native call screen
  → User answers → App opens → JS picks up via getPendingCallAction()
  → Agora connection established → reportCallConnected()
  → Call ends → reportCallEnded()
```

### Token Types

| Platform | Token Type | Used For | Delivery |
|----------|-----------|----------|----------|
| Android  | `fcm`     | Messages + Calls | FCM data-only messages |
| iOS      | `fcm`     | Messages | FCM → APNs proxy |
| iOS      | `voip`    | Incoming Calls | Direct APNs VoIP push |

## Troubleshooting

### VoIP push not received
- Ensure the APNs key is correctly configured in `APNS_KEY_JSON`
- Ensure the bundle ID matches (`com.zemichat.app`)
- VoIP pushes only work on physical devices, not simulators
- Check that Background Modes → Voice over IP is enabled

### CallKit not showing
- VoIP push handler **must** report a call to CallKit immediately
- If the app crashes on VoIP push, check Xcode console for errors
- Ensure PushKit and CallKit frameworks are linked

### FCM notifications not received on iOS
- Ensure `GoogleService-Info.plist` is in the correct location
- Ensure the APNs key is uploaded in Firebase Console
- Check that the `apns-topic` matches your bundle ID

### Token not saved
- Check Supabase logs for push_tokens upsert errors
- Ensure the migration has been applied (`token_type` column exists)
