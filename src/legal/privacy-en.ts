export default `
<p><em>Last updated: 2026-02-09</em></p>
<hr>
<h2>1. Introduction</h2>
<p>This privacy policy describes how Zemichat ("we", "us", "our") collects, uses, and protects your personal data when you use our app and services.</p>
<p>Zemichat is a family-friendly messaging app with a built-in transparency model that gives parents and guardians insight into their children's communication. We take your privacy seriously and process all data in accordance with the EU General Data Protection Regulation (GDPR).</p>
<p><strong>Data controller:</strong><br>Zemichat<br>Email: support@zemichat.com</p>
<p>If you have any questions about how we handle your personal data, please don't hesitate to contact us.</p>
<hr>
<h2>2. What data we collect</h2>
<h3>2.1 Account information</h3>
<table>
<thead><tr><th>Data</th><th>Description</th></tr></thead>
<tbody>
<tr><td>Email address</td><td>Used for login and account communication (Owner and Super)</td></tr>
<tr><td>Display name</td><td>The name you choose to show in the app</td></tr>
<tr><td>Profile picture</td><td>Optional image displayed on your profile</td></tr>
<tr><td>Status message</td><td>Optional text shown to other users</td></tr>
<tr><td>Zemi number</td><td>Unique identification number (format: ZEMI-XXX-XXX)</td></tr>
<tr><td>Role</td><td>Your role in the team: Owner, Super, or Texter</td></tr>
</tbody>
</table>
<p><strong>Texters (children)</strong> do not log in with an email address. Instead, they use a Zemi number and password created by the Team Owner.</p>
<h3>2.2 Messages and media</h3>
<table>
<thead><tr><th>Data</th><th>Description</th></tr></thead>
<tbody>
<tr><td>Text messages</td><td>The content of messages you send</td></tr>
<tr><td>Images and video</td><td>Media shared in chats</td></tr>
<tr><td>Voice messages</td><td>Recorded audio messages</td></tr>
<tr><td>Documents</td><td>Files shared in chats</td></tr>
<tr><td>Edit history</td><td>If you edit a message, the original content is preserved</td></tr>
<tr><td>Read receipts</td><td>Information about when a message has been read</td></tr>
<tr><td>Reactions</td><td>Emoji reactions on messages</td></tr>
</tbody>
</table>
<p><strong>Important:</strong> When a user deletes a message, a "soft delete" is performed. The message is marked as deleted but remains in the database. This is part of the transparency model &mdash; Team Owner can still see that a message was sent and deleted.</p>
<h3>2.3 Location data</h3>
<p>We do <strong>not</strong> collect location data on an ongoing basis. Location data is stored <strong>only</strong> in the following cases:</p>
<ul>
<li><strong>SOS alerts:</strong> If a Texter sends an SOS alert, their current position is included so the parent can quickly locate the child.</li>
<li><strong>Location sharing in chat:</strong> If a user actively chooses to share their location in a message (requires the feature to be enabled in Texter settings).</li>
</ul>
<h3>2.4 Device information</h3>
<table>
<thead><tr><th>Data</th><th>Description</th></tr></thead>
<tbody>
<tr><td>Push token</td><td>A unique identifier that allows us to send push notifications to your device</td></tr>
<tr><td>Platform</td><td>The type of device you use (iOS, Android, Web)</td></tr>
<tr><td>Device name</td><td>The name of your device (shown in session management)</td></tr>
<tr><td>IP address</td><td>Recorded at login for session management</td></tr>
</tbody>
</table>
<h3>2.5 Payment and subscription data</h3>
<table>
<thead><tr><th>Data</th><th>Description</th></tr></thead>
<tbody>
<tr><td>Subscription plan</td><td>Which plan your team has (free, basic, family, premium)</td></tr>
<tr><td>Trial period</td><td>Start date and expiration date for the trial period</td></tr>
</tbody>
</table>
<p>We do <strong>not</strong> handle any credit card details or payment information directly. All payment processing is handled by RevenueCat and the respective app store (App Store/Google Play).</p>
<hr>
<h2>3. Why we collect data</h2>
<p>We only collect data that is necessary for the app to function. Here is the purpose of each category:</p>
<table>
<thead><tr><th>Data category</th><th>Purpose</th><th>Legal basis (GDPR)</th></tr></thead>
<tbody>
<tr><td>Account information</td><td>Create and manage your account, identify you in the app</td><td>Contract (Art. 6.1b)</td></tr>
<tr><td>Messages and media</td><td>Deliver the chat functionality &mdash; sending and receiving messages</td><td>Contract (Art. 6.1b)</td></tr>
<tr><td>Edit history</td><td>Transparency &mdash; Team Owner can see changes to Texters' messages</td><td>Legitimate interest (Art. 6.1f)</td></tr>
<tr><td>Location data (SOS)</td><td>Child safety &mdash; help parents locate their child in an emergency</td><td>Legitimate interest (Art. 6.1f)</td></tr>
<tr><td>Device information</td><td>Send push notifications and manage active sessions</td><td>Consent (Art. 6.1a)</td></tr>
<tr><td>Texter settings</td><td>Parental controls &mdash; let Team Owner manage which features the child can access</td><td>Legitimate interest/Consent (Art. 6.1f/a)</td></tr>
<tr><td>Friend relationships</td><td>Social functionality &mdash; manage contacts and friend requests</td><td>Contract (Art. 6.1b)</td></tr>
<tr><td>Call logs</td><td>Call history &mdash; display previous calls</td><td>Contract (Art. 6.1b)</td></tr>
<tr><td>Subscription data</td><td>Manage your subscription and access to features</td><td>Contract (Art. 6.1b)</td></tr>
<tr><td>Reports</td><td>Safety and moderation &mdash; handle user reports</td><td>Legitimate interest (Art. 6.1f)</td></tr>
<tr><td>Anonymized deletion log</td><td>Legal traceability upon account deletion</td><td>Legitimate interest (Art. 6.1f)</td></tr>
</tbody>
</table>
<hr>
<h2>4. How we protect your data</h2>
<h3>4.1 Encryption</h3>
<ul>
<li>All communication between your device and our servers uses <strong>HTTPS/TLS</strong> (encrypted in transit).</li>
<li>The database uses encryption at rest.</li>
<li>Passwords are stored as cryptographic hashes &mdash; we can never see your password in plain text.</li>
</ul>
<h3>4.2 Access control (Row Level Security)</h3>
<p>We use <strong>Row Level Security (RLS)</strong> in the database. This means every database request is checked against strict rules that ensure:</p>
<ul>
<li>You can only see data that belongs to your team.</li>
<li>Texters can only see their own chats and friends.</li>
<li>Team Owner can see Texters' chats (the transparency model) but <strong>cannot</strong> see private chats between adults (Supers) where no Texter participates.</li>
<li>No one can access data from other teams.</li>
</ul>
<h3>4.3 Secure storage</h3>
<ul>
<li>All data is stored with <strong>Supabase</strong> on servers within the <strong>EU</strong> (European Union).</li>
<li>Media files (images, video, documents) are stored in Supabase Storage with access controls.</li>
<li>Temporary data (such as call signals) is automatically cleaned up after a short period.</li>
</ul>
<h3>4.4 Security features in the app</h3>
<ul>
<li>Secure authentication flows via Supabase Auth.</li>
<li>All sensitive database operations (account deletion, invitations) run as secure server functions (SECURITY DEFINER) that cannot be manipulated from the client side.</li>
<li>Session management with the ability to view and terminate active sessions.</li>
</ul>
<hr>
<h2>5. Third parties</h2>
<p>We never share your data with third parties for marketing purposes. The following service providers are used for the app to function:</p>
<h3>5.1 Supabase (database and infrastructure)</h3>
<ul>
<li><strong>What:</strong> All app data is stored with Supabase &mdash; database, file storage, and authentication.</li>
<li><strong>Where:</strong> EU-based servers.</li>
<li><strong>Data:</strong> All data described in this policy.</li>
<li><strong>Privacy policy:</strong> <a href="https://supabase.com/privacy" target="_blank" rel="noopener noreferrer">https://supabase.com/privacy</a></li>
</ul>
<h3>5.2 Agora (voice and video calls)</h3>
<ul>
<li><strong>What:</strong> Agora handles audio and video streams for calls in the app.</li>
<li><strong>Where:</strong> Globally distributed network.</li>
<li><strong>Data:</strong> Real-time audio and video streams. <strong>Calls are not recorded</strong> and no data is permanently stored by Agora.</li>
<li><strong>Privacy policy:</strong> <a href="https://www.agora.io/en/privacy-policy" target="_blank" rel="noopener noreferrer">https://www.agora.io/en/privacy-policy</a></li>
</ul>
<h3>5.3 RevenueCat (payments and subscriptions)</h3>
<ul>
<li><strong>What:</strong> RevenueCat handles subscriptions and purchases via the App Store and Google Play.</li>
<li><strong>Where:</strong> USA (Privacy Shield / Standard Contractual Clauses).</li>
<li><strong>Data:</strong> Anonymized purchase ID and subscription plan. RevenueCat has <strong>no</strong> access to your personal data, messages, or chat content.</li>
<li><strong>Privacy policy:</strong> <a href="https://www.revenuecat.com/privacy" target="_blank" rel="noopener noreferrer">https://www.revenuecat.com/privacy</a></li>
</ul>
<h3>5.4 Firebase Cloud Messaging (push notifications, Android)</h3>
<ul>
<li><strong>What:</strong> Sends push notifications to Android devices.</li>
<li><strong>Data:</strong> Push token and device ID.</li>
<li><strong>Privacy policy:</strong> <a href="https://firebase.google.com/support/privacy" target="_blank" rel="noopener noreferrer">https://firebase.google.com/support/privacy</a></li>
</ul>
<h3>5.5 Apple Push Notification Service (push notifications, iOS)</h3>
<ul>
<li><strong>What:</strong> Sends push notifications to Apple devices.</li>
<li><strong>Data:</strong> Push token and device ID.</li>
<li><strong>Privacy policy:</strong> <a href="https://www.apple.com/legal/privacy" target="_blank" rel="noopener noreferrer">https://www.apple.com/legal/privacy</a></li>
</ul>
<hr>
<h2>6. Children's privacy</h2>
<p>Zemichat is designed to be used by families, including children. We take children's privacy very seriously.</p>
<h3>6.1 How Zemichat works for children</h3>
<p>Children use the app with the <strong>Texter</strong> role. A Texter:</p>
<ul>
<li>Is created by a parent/guardian (Team Owner).</li>
<li>Logs in with a Zemi number and password &mdash; <strong>no email address required</strong>.</li>
<li>Has limited functionality controlled by the Team Owner.</li>
<li>Cannot approve friend requests on their own &mdash; this is done by the Team Owner.</li>
</ul>
<h3>6.2 Parental oversight (the transparency model)</h3>
<p>The Team Owner has full insight into Texters' communication. This means that:</p>
<ul>
<li>Team Owner can read all messages that Texters send and receive.</li>
<li>Team Owner can see deleted messages (marked as deleted but not removed).</li>
<li>Team Owner can see edit history.</li>
<li>Team Owner approves all friend requests.</li>
<li>Team Owner can disable specific features (images, video, calls, etc.) per Texter.</li>
</ul>
<p>This transparency is a fundamental part of the service and exists to protect children.</p>
<h3>6.3 Private chats between adults</h3>
<p>Chats between adult users (Supers) where <strong>no Texter participates</strong> are private and <strong>cannot</strong> be seen by the Team Owner. This separation is enforced technically via database security rules.</p>
<h3>6.4 Consent</h3>
<p>By creating a Texter profile for a child, the Team Owner confirms that they are the child's parent or legal guardian and have the right to provide consent for the child's use of the service, in accordance with GDPR Article 8.</p>
<hr>
<h2>7. Your rights</h2>
<p>Under the GDPR, you have the following rights:</p>
<h3>7.1 Right of access (Art. 15)</h3>
<p>You have the right to know what data we hold about you. In the app, you can export all your data via <strong>Settings &gt; Download my data</strong>. You will receive a structured JSON file containing all your personal data.</p>
<h3>7.2 Right to data portability (Art. 20)</h3>
<p>Your data is exported in a structured, machine-readable format (JSON) that you can take with you to another service.</p>
<h3>7.3 Right to erasure (Art. 17)</h3>
<p>You have the right to delete your account and all associated data:</p>
<ul>
<li><strong>Team Owner</strong> can delete the entire team (including all members and all data) via <strong>Settings &gt; Delete account</strong>.</li>
<li>Upon deletion, all data is removed: profiles, messages, media files, friend relationships, call logs, and all other personal data.</li>
<li>An anonymized log entry is kept for legal traceability. This contains no personal data &mdash; only a SHA-256 hash of the team name and the number of members.</li>
</ul>
<h3>7.4 Right to rectification (Art. 16)</h3>
<p>You can update your profile information (name, profile picture, status message) directly in the app via Settings.</p>
<h3>7.5 Right to lodge a complaint</h3>
<p>If you believe we are handling your personal data incorrectly, you have the right to lodge a complaint with:</p>
<p><strong>Swedish Authority for Privacy Protection (IMY)</strong><br>Box 8114, 104 20 Stockholm, Sweden<br>Email: imy@imy.se<br>Web: <a href="https://www.imy.se" target="_blank" rel="noopener noreferrer">https://www.imy.se</a></p>
<p>You may also contact the data protection authority in your own country.</p>
<hr>
<h2>8. Cookies and tracking</h2>
<p>Zemichat uses <strong>no cookies</strong> for tracking or marketing.</p>
<p>We use <strong>no</strong> analytics or tracking services (such as Google Analytics, Facebook Pixel, or similar).</p>
<p>The only local storage we use is:</p>
<ul>
<li><strong>Authentication token</strong> &mdash; to keep you logged in between sessions.</li>
<li><strong>Language setting</strong> &mdash; to remember your chosen language.</li>
<li><strong>Onboarding status</strong> &mdash; to know if you have completed the introduction guide.</li>
</ul>
<p>This data is stored locally on your device and is never sent to any third party.</p>
<hr>
<h2>9. Data retention</h2>
<table>
<thead><tr><th>Data</th><th>Retention period</th></tr></thead>
<tbody>
<tr><td>Account information</td><td>Until the account is deleted</td></tr>
<tr><td>Messages and media</td><td>Until the account is deleted</td></tr>
<tr><td>Call logs</td><td>Until the account is deleted</td></tr>
<tr><td>Call signals (ring/decline)</td><td>Short period &mdash; automatically cleaned up</td></tr>
<tr><td>Push tokens</td><td>Until the account is deleted or the token is unregistered</td></tr>
<tr><td>Sessions</td><td>Until the account is deleted</td></tr>
<tr><td>Anonymized deletion log</td><td>Permanent (contains no personal data)</td></tr>
</tbody>
</table>
<hr>
<h2>10. Changes to this policy</h2>
<p>We may update this privacy policy as needed, for example when introducing new features or in response to changes in legislation. For significant changes:</p>
<ul>
<li>We will notify you via the app or email.</li>
<li>We will update the "last updated" date at the top of this policy.</li>
<li>We may request renewed consent if the changes require it.</li>
</ul>
<p>We recommend that you review this policy periodically.</p>
<hr>
<h2>11. Contact</h2>
<p>Do you have questions about this privacy policy or how we handle your personal data? Contact us:</p>
<p><strong>Email:</strong> support@zemichat.com</p>
<p>We typically respond within 30 days to requests regarding your rights under the GDPR.</p>
<hr>
<p><em>This privacy policy is effective as of 2026-02-09.</em></p>
`;
