# iOS CallKit Plugin — Placement Instructions

These files implement the native iOS Capacitor plugin for PushKit (VoIP push) and CallKit (native incoming call screen).

## Setup

After running `npx cap add ios && npx cap sync ios` on a Mac:

### 1. Copy Plugin Files

Copy these files into the Xcode project:

```
ios-callkit/CallKitService.swift     →  ios/App/App/CallKitService.swift
ios-callkit/CallKitServiceBridge.m   →  ios/App/App/CallKitServiceBridge.m
```

Make sure they are added to the `App` target in Xcode (check "Target Membership" in the file inspector).

### 2. Add Required Frameworks

In Xcode, go to the App target → **Build Phases** → **Link Binary With Libraries** and add:

- `PushKit.framework`
- `CallKit.framework`

### 3. Enable Capabilities

In the App target → **Signing & Capabilities**, add:

- **Push Notifications**
- **Background Modes** with these checked:
  - Voice over IP
  - Remote notifications
  - Audio, AirPlay, and Picture in Picture

### 4. Info.plist

Add to `ios/App/App/Info.plist`:

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

## How It Works

1. **VoIP Push Registration**: When `registerVoipPush()` is called from JS, the plugin registers with PushKit. The VoIP device token is sent back to JS via the `voipTokenReceived` event, which saves it to `push_tokens` with `token_type = 'voip'`.

2. **Incoming Call**: When a VoIP push arrives (sent by the `call-push` Edge Function via APNs), the plugin **immediately** reports it to CallKit. This shows the native iOS incoming call screen (even when the app is killed). iOS requires this — if you receive a VoIP push and don't report a call, iOS will kill your app and revoke VoIP push privileges.

3. **Answer**: When the user taps "Answer" on the CallKit screen, the action is stored in a static field. The app is brought to the foreground, and JS polls `getPendingCallAction()` to detect and handle the answer.

4. **Decline**: When the user taps "Decline", CallKit ends the call. The plugin cleans up the call UUID.

5. **Connected/Ended**: JS calls `reportCallConnected()` and `reportCallEnded()` to keep CallKit in sync with the actual call state.
