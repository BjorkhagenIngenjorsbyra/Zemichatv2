/**
 * Upload screenshots to Google Play Console via Play Developer API.
 *
 * Requires:
 *   - C:/Alva/config/zemichat-service-account.json (with androidpublisher scope)
 *   - assets/store/screenshots/ipad-13/*.png and iphone-69/*.png
 *
 * Uploads phone screenshots from iphone-69 and 10-inch tablet from ipad-13
 * to the sv-SE listing of com.zemichat.app.
 */
import { readFileSync, readdirSync } from 'fs';
import { google } from 'googleapis';
import path from 'path';

const PACKAGE = 'com.zemichat.app';
const LANG = 'sv-SE';
const CRED_PATH = 'C:/Alva/config/zemichat-service-account.json';
const SCREENSHOTS_BASE = 'assets/store/screenshots';

const auth = new google.auth.GoogleAuth({
  keyFile: CRED_PATH,
  scopes: ['https://www.googleapis.com/auth/androidpublisher'],
});

const client = await auth.getClient();
const ap = google.androidpublisher({ version: 'v3', auth: client });

console.log('Creating edit...');
const edit = await ap.edits.insert({ packageName: PACKAGE });
const editId = edit.data.id;
console.log(`Edit ${editId} created`);

async function uploadFor(dir, imageType) {
  const files = readdirSync(path.join(SCREENSHOTS_BASE, dir))
    .filter((f) => f.endsWith('.png'))
    .sort();

  console.log(`\nDeleting existing ${imageType}...`);
  try {
    await ap.edits.images.deleteall({
      packageName: PACKAGE,
      editId,
      language: LANG,
      imageType,
    });
  } catch (e) {
    console.warn(`(deleteall ${imageType}: ${e.message})`);
  }

  console.log(`Uploading ${files.length} ${imageType}...`);
  for (const f of files) {
    const fullPath = path.join(SCREENSHOTS_BASE, dir, f);
    const data = readFileSync(fullPath);
    const res = await ap.edits.images.upload({
      packageName: PACKAGE,
      editId,
      language: LANG,
      imageType,
      media: {
        mimeType: 'image/png',
        body: (await import('stream')).Readable.from(data),
      },
    });
    console.log(`  ✓ ${f} → sha1=${res.data.image?.sha1}`);
  }
}

await uploadFor('iphone-69', 'phoneScreenshots');
await uploadFor('ipad-13', 'tenInchScreenshots');

console.log('\nCommitting edit...');
const commit = await ap.edits.commit({ packageName: PACKAGE, editId });
console.log(`✓ Committed. Edit id was: ${commit.data.id}`);
console.log('\nDone. Screenshots are now live in the Play Console for sv-SE.');
