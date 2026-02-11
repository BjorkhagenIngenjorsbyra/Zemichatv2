# Firebase Setup for Push Notifications

## 1. Create Firebase Project

1. Go to [Firebase Console](https://console.firebase.google.com)
2. Click "Add project" and name it **Zemichat**
3. Disable Google Analytics (not needed) or enable if desired
4. Click "Create project"

## 2. Add Android App

1. In the Firebase project, click the Android icon to add an app
2. Package name: `com.zemichat.app`
3. App nickname: `Zemichat Android`
4. Skip the SHA-1 for now (add later for production)
5. Click "Register app"
6. Download `google-services.json`
7. Place it at `android/app/google-services.json`

The Android build.gradle already conditionally applies the Google Services plugin when this file is present.

## 3. Get FCM Service Account Key

1. In Firebase Console, go to **Project Settings** (gear icon)
2. Click **Service Accounts** tab
3. Click **Generate New Private Key**
4. Save the downloaded JSON file securely (do NOT commit it to git)

## 4. Configure Supabase Secrets

Set the service account JSON as a Supabase secret:

```bash
# Local development (set as a single-line JSON string)
supabase secrets set FCM_SERVICE_ACCOUNT_JSON='<paste entire JSON here>'

# Production
supabase secrets set --project-ref <your-project-ref> FCM_SERVICE_ACCOUNT_JSON='<paste entire JSON here>'
```

## 5. Database Trigger (Already Deployed)

The `notify_new_message()` trigger fires on every message INSERT and calls the Edge Function via `pg_net`. The production URL is hardcoded in the trigger function — no database settings needed.

For **local development**, override the URL after `supabase db reset`:

```sql
ALTER DATABASE postgres SET "app.settings.edge_function_url" = 'http://host.docker.internal:54321/functions/v1/send-push';
```

The Edge Function validates requests by checking that the referenced message exists and was created within the last 5 minutes (no Bearer token needed).

## 6. Verify Setup

### Local Development

```bash
# Reset DB to apply the trigger migration
supabase db reset

# Start Edge Functions
supabase functions serve send-push

# On Android device/emulator:
# 1. Login -> accept push permission -> check push_tokens table
# 2. Send a message from another user -> check Edge Function logs
```

### Checklist

- [ ] `google-services.json` placed at `android/app/google-services.json`
- [ ] FCM_SERVICE_ACCOUNT_JSON secret set in Supabase
- [ ] `supabase db reset` runs without errors
- [ ] `supabase functions serve send-push` starts successfully
- [ ] Push token appears in `push_tokens` table after login on Android
- [ ] Notification received when message sent from another user

## Notes

- **Quiet hours use UTC**: When an Owner sets quiet hours for a Texter, the times are in UTC. Consider adding a timezone column to teams in the future.
- **Token rotation**: FCM tokens can change over time. The app automatically handles this — the `registration` event fires whenever the token refreshes, and the upsert pattern deduplicates.
- **Invalid token cleanup**: The Edge Function automatically deletes push tokens that FCM reports as invalid (UNREGISTERED/404).
- **iOS**: When adding iOS support, add the iOS app in Firebase Console, download `GoogleService-Info.plist`, and place it in the iOS project. The Capacitor plugin handles both platforms.
