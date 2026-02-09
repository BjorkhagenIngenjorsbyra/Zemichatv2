# Privacy Policy – Zemichat

**Last updated:** 2026-02-09

---

## 1. Introduction

This privacy policy describes how Zemichat ("we", "us", "our") collects, uses, and protects your personal data when you use our app and services.

Zemichat is a family-friendly messaging app with a built-in transparency model that gives parents and guardians insight into their children's communication. We take your privacy seriously and process all data in accordance with the EU General Data Protection Regulation (GDPR).

**Data controller:**
Zemichat
Email: support@zemichat.com

If you have any questions about how we handle your personal data, please don't hesitate to contact us.

---

## 2. What data we collect

### 2.1 Account information

| Data | Description |
|------|-------------|
| Email address | Used for login and account communication (Owner and Super) |
| Display name | The name you choose to show in the app |
| Profile picture | Optional image displayed on your profile |
| Status message | Optional text shown to other users |
| Zemi number | Unique identification number (format: ZEMI-XXX-XXX) |
| Role | Your role in the team: Owner, Super, or Texter |

**Texters (children)** do not log in with an email address. Instead, they use a Zemi number and password created by the Team Owner.

### 2.2 Messages and media

| Data | Description |
|------|-------------|
| Text messages | The content of messages you send |
| Images and video | Media shared in chats |
| Voice messages | Recorded audio messages |
| Documents | Files shared in chats |
| Edit history | If you edit a message, the original content is preserved |
| Read receipts | Information about when a message has been read |
| Reactions | Emoji reactions on messages |

**Important:** When a user deletes a message, a "soft delete" is performed. The message is marked as deleted but remains in the database. This is part of the transparency model — Team Owner can still see that a message was sent and deleted.

### 2.3 Location data

We do **not** collect location data on an ongoing basis. Location data is stored **only** in the following cases:

- **SOS alerts:** If a Texter sends an SOS alert, their current position is included so the parent can quickly locate the child.
- **Location sharing in chat:** If a user actively chooses to share their location in a message (requires the feature to be enabled in Texter settings).

### 2.4 Device information

| Data | Description |
|------|-------------|
| Push token | A unique identifier that allows us to send push notifications to your device |
| Platform | The type of device you use (iOS, Android, Web) |
| Device name | The name of your device (shown in session management) |
| IP address | Recorded at login for session management |

### 2.5 Payment and subscription data

| Data | Description |
|------|-------------|
| Subscription plan | Which plan your team has (free, basic, family, premium) |
| Trial period | Start date and expiration date for the trial period |

We do **not** handle any credit card details or payment information directly. All payment processing is handled by RevenueCat and the respective app store (App Store/Google Play).

---

## 3. Why we collect data

We only collect data that is necessary for the app to function. Here is the purpose of each category:

| Data category | Purpose | Legal basis (GDPR) |
|---------------|---------|-------------------|
| Account information | Create and manage your account, identify you in the app | Contract (Art. 6.1b) |
| Messages and media | Deliver the chat functionality — sending and receiving messages | Contract (Art. 6.1b) |
| Edit history | Transparency — Team Owner can see changes to Texters' messages | Legitimate interest (Art. 6.1f) |
| Location data (SOS) | Child safety — help parents locate their child in an emergency | Legitimate interest (Art. 6.1f) |
| Device information | Send push notifications and manage active sessions | Consent (Art. 6.1a) |
| Texter settings | Parental controls — let Team Owner manage which features the child can access | Legitimate interest/Consent (Art. 6.1f/a) |
| Friend relationships | Social functionality — manage contacts and friend requests | Contract (Art. 6.1b) |
| Call logs | Call history — display previous calls | Contract (Art. 6.1b) |
| Subscription data | Manage your subscription and access to features | Contract (Art. 6.1b) |
| Reports | Safety and moderation — handle user reports | Legitimate interest (Art. 6.1f) |
| Anonymized deletion log | Legal traceability upon account deletion | Legitimate interest (Art. 6.1f) |

---

## 4. How we protect your data

### 4.1 Encryption

- All communication between your device and our servers uses **HTTPS/TLS** (encrypted in transit).
- The database uses encryption at rest.
- Passwords are stored as cryptographic hashes — we can never see your password in plain text.

### 4.2 Access control (Row Level Security)

We use **Row Level Security (RLS)** in the database. This means every database request is checked against strict rules that ensure:

- You can only see data that belongs to your team.
- Texters can only see their own chats and friends.
- Team Owner can see Texters' chats (the transparency model) but **cannot** see private chats between adults (Supers) where no Texter participates.
- No one can access data from other teams.

### 4.3 Secure storage

- All data is stored with **Supabase** on servers within the **EU** (European Union).
- Media files (images, video, documents) are stored in Supabase Storage with access controls.
- Temporary data (such as call signals) is automatically cleaned up after a short period.

### 4.4 Security features in the app

- Secure authentication flows via Supabase Auth.
- All sensitive database operations (account deletion, invitations) run as secure server functions (SECURITY DEFINER) that cannot be manipulated from the client side.
- Session management with the ability to view and terminate active sessions.

---

## 5. Third parties

We never share your data with third parties for marketing purposes. The following service providers are used for the app to function:

### 5.1 Supabase (database and infrastructure)

- **What:** All app data is stored with Supabase — database, file storage, and authentication.
- **Where:** EU-based servers.
- **Data:** All data described in this policy.
- **Privacy policy:** [https://supabase.com/privacy](https://supabase.com/privacy)

### 5.2 Agora (voice and video calls)

- **What:** Agora handles audio and video streams for calls in the app.
- **Where:** Globally distributed network.
- **Data:** Real-time audio and video streams. **Calls are not recorded** and no data is permanently stored by Agora.
- **Privacy policy:** [https://www.agora.io/en/privacy-policy](https://www.agora.io/en/privacy-policy)

### 5.3 RevenueCat (payments and subscriptions)

- **What:** RevenueCat handles subscriptions and purchases via the App Store and Google Play.
- **Where:** USA (Privacy Shield / Standard Contractual Clauses).
- **Data:** Anonymized purchase ID and subscription plan. RevenueCat has **no** access to your personal data, messages, or chat content.
- **Privacy policy:** [https://www.revenuecat.com/privacy](https://www.revenuecat.com/privacy)

### 5.4 Firebase Cloud Messaging (push notifications, Android)

- **What:** Sends push notifications to Android devices.
- **Data:** Push token and device ID.
- **Privacy policy:** [https://firebase.google.com/support/privacy](https://firebase.google.com/support/privacy)

### 5.5 Apple Push Notification Service (push notifications, iOS)

- **What:** Sends push notifications to Apple devices.
- **Data:** Push token and device ID.
- **Privacy policy:** [https://www.apple.com/legal/privacy](https://www.apple.com/legal/privacy)

---

## 6. Children's privacy

Zemichat is designed to be used by families, including children. We take children's privacy very seriously.

### 6.1 How Zemichat works for children

Children use the app with the **Texter** role. A Texter:

- Is created by a parent/guardian (Team Owner).
- Logs in with a Zemi number and password — **no email address required**.
- Has limited functionality controlled by the Team Owner.
- Cannot approve friend requests on their own — this is done by the Team Owner.

### 6.2 Parental oversight (the transparency model)

The Team Owner has full insight into Texters' communication. This means that:

- Team Owner can read all messages that Texters send and receive.
- Team Owner can see deleted messages (marked as deleted but not removed).
- Team Owner can see edit history.
- Team Owner approves all friend requests.
- Team Owner can disable specific features (images, video, calls, etc.) per Texter.

This transparency is a fundamental part of the service and exists to protect children.

### 6.3 Private chats between adults

Chats between adult users (Supers) where **no Texter participates** are private and **cannot** be seen by the Team Owner. This separation is enforced technically via database security rules.

### 6.4 Consent

By creating a Texter profile for a child, the Team Owner confirms that they are the child's parent or legal guardian and have the right to provide consent for the child's use of the service, in accordance with GDPR Article 8.

---

## 7. Your rights

Under the GDPR, you have the following rights:

### 7.1 Right of access (Art. 15)

You have the right to know what data we hold about you. In the app, you can export all your data via **Settings > Download my data**. You will receive a structured JSON file containing all your personal data.

### 7.2 Right to data portability (Art. 20)

Your data is exported in a structured, machine-readable format (JSON) that you can take with you to another service.

### 7.3 Right to erasure (Art. 17)

You have the right to delete your account and all associated data:

- **Team Owner** can delete the entire team (including all members and all data) via **Settings > Delete account**.
- Upon deletion, all data is removed: profiles, messages, media files, friend relationships, call logs, and all other personal data.
- An anonymized log entry is kept for legal traceability. This contains no personal data — only a SHA-256 hash of the team name and the number of members.

### 7.4 Right to rectification (Art. 16)

You can update your profile information (name, profile picture, status message) directly in the app via Settings.

### 7.5 Right to lodge a complaint

If you believe we are handling your personal data incorrectly, you have the right to lodge a complaint with:

**Swedish Authority for Privacy Protection (IMY)**
Box 8114, 104 20 Stockholm, Sweden
Email: imy@imy.se
Web: [https://www.imy.se](https://www.imy.se)

You may also contact the data protection authority in your own country.

---

## 8. Cookies and tracking

Zemichat uses **no cookies** for tracking or marketing.

We use **no** analytics or tracking services (such as Google Analytics, Facebook Pixel, or similar).

The only local storage we use is:

- **Authentication token** — to keep you logged in between sessions.
- **Language setting** — to remember your chosen language.
- **Onboarding status** — to know if you have completed the introduction guide.

This data is stored locally on your device and is never sent to any third party.

---

## 9. Data retention

| Data | Retention period |
|------|-----------------|
| Account information | Until the account is deleted |
| Messages and media | Until the account is deleted |
| Call logs | Until the account is deleted |
| Call signals (ring/decline) | Short period — automatically cleaned up |
| Push tokens | Until the account is deleted or the token is unregistered |
| Sessions | Until the account is deleted |
| Anonymized deletion log | Permanent (contains no personal data) |

---

## 10. Changes to this policy

We may update this privacy policy as needed, for example when introducing new features or in response to changes in legislation. For significant changes:

- We will notify you via the app or email.
- We will update the "last updated" date at the top of this policy.
- We may request renewed consent if the changes require it.

We recommend that you review this policy periodically.

---

## 11. Contact

Do you have questions about this privacy policy or how we handle your personal data? Contact us:

**Email:** support@zemichat.com

We typically respond within 30 days to requests regarding your rights under the GDPR.

---

*This privacy policy is effective as of 2026-02-09.*
