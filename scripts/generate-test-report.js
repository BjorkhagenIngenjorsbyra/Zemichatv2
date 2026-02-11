#!/usr/bin/env node
/**
 * Generates docs/TEST_REPORT.md from Playwright JSON results.
 *
 * Usage:
 *   PLAYWRIGHT_JSON_OUTPUT_FILE=test-results/results.json npx playwright test --reporter=json
 *   node scripts/generate-test-report.js
 *
 * Or with inline results:
 *   npx playwright test --reporter=json 2>test-results/results.json
 *   node scripts/generate-test-report.js test-results/results.json
 */

const fs = require('fs');
const path = require('path');

const resultsPath =
  process.argv[2] ||
  process.env.PLAYWRIGHT_JSON_OUTPUT_FILE ||
  path.join(__dirname, '..', 'test-results', 'results.json');

const reportPath = path.join(__dirname, '..', 'docs', 'TEST_REPORT.md');

function main() {
  if (!fs.existsSync(resultsPath)) {
    console.log(`No results file found at ${resultsPath}`);
    console.log('Run tests with: PLAYWRIGHT_JSON_OUTPUT_FILE=test-results/results.json npx playwright test --reporter=json');
    process.exit(0);
  }

  let data;
  try {
    data = JSON.parse(fs.readFileSync(resultsPath, 'utf-8'));
  } catch (e) {
    console.error('Failed to parse results JSON:', e.message);
    process.exit(1);
  }

  const suites = data.suites || [];
  let total = 0;
  let passed = 0;
  let failed = 0;
  let skipped = 0;
  let durationMs = 0;

  const fileStats = {};
  const failedTests = [];

  function processSuite(suite, filePath) {
    const file = filePath || suite.file || 'unknown';

    for (const spec of suite.specs || []) {
      for (const test of spec.tests || []) {
        for (const result of test.results || []) {
          total++;
          durationMs += result.duration || 0;

          const shortFile = path.basename(file);
          if (!fileStats[shortFile]) {
            fileStats[shortFile] = { total: 0, passed: 0, failed: 0, skipped: 0 };
          }
          fileStats[shortFile].total++;

          if (result.status === 'passed' || result.status === 'expected') {
            passed++;
            fileStats[shortFile].passed++;
          } else if (result.status === 'skipped') {
            skipped++;
            fileStats[shortFile].skipped++;
          } else {
            failed++;
            fileStats[shortFile].failed++;
            failedTests.push({
              file: shortFile,
              title: spec.title,
              error: (result.error?.message || '').substring(0, 200),
            });
          }
        }
      }
    }

    for (const child of suite.suites || []) {
      processSuite(child, file);
    }
  }

  for (const suite of suites) {
    processSuite(suite);
  }

  const duration = (durationMs / 1000).toFixed(1) + 's';
  const now = new Date().toISOString().replace('T', ' ').substring(0, 19);

  let md = `# Zemichat E2E Test Report

> Auto-updated by \`scripts/generate-test-report.js\`

## Summary

| Metric | Value |
|--------|-------|
| Total Tests | ${total} |
| Passed | ${passed} |
| Failed | ${failed} |
| Skipped | ${skipped} |
| Duration | ${duration} |
| Last Run | ${now} |

## Test Files

| File | Total | Passed | Failed | Skipped |
|------|-------|--------|--------|---------|
`;

  for (const [file, stats] of Object.entries(fileStats)) {
    const status = stats.failed > 0 ? 'FAIL' : 'PASS';
    md += `| \`${file}\` | ${stats.total} | ${stats.passed} | ${stats.failed} | ${stats.skipped} |\n`;
  }

  md += `| **Total** | **${total}** | **${passed}** | **${failed}** | **${skipped}** |\n`;

  if (failedTests.length > 0) {
    md += `\n## Failed Tests\n\n`;
    for (const t of failedTests) {
      md += `### ${t.file}: ${t.title}\n\`\`\`\n${t.error}\n\`\`\`\n\n`;
    }
  }

  md += `\n## Test Sections

### comprehensive.spec.ts (155 tests)
- **A. Autentisering** (15) — Login, signup, texter-login, route guards
- **B. Owner Dashboard** (20) — Chat list, new chat, dashboard, settings
- **C. Chat Functions** (20) — Send messages, UI layout, GIF/sticker buttons
- **D. Friends** (15) — Friend list, add friend, requests, team section
- **E. Navigation & Tabs** (10) — Route navigation, back button, legal pages
- **F. i18n** (15) — Raw key checks across 5 locales on multiple pages
- **G. UI & Dark Mode** (10) — Contrast, hydration, CSS, console errors
- **H. Texter View** (15) — Texter-specific UI (SOS, no dashboard, send messages)
- **I. Super View** (15) — Super-specific UI (delete account, no SOS)
- **J. Accessibility & Performance** (10) — Aria labels, load time, viewport

### roles-interactions.spec.ts (55 tests)
- **K. Owner → Texter** (15) — Oversight, approvals, texter detail, create texter
- **L. Owner → Super** (10) — Invite super, team management
- **M. Texter Restrictions** (15) — No dashboard, no oversight, support, friends
- **N. Super Restrictions** (10) — No dashboard, no oversight, delete account
- **O. Cross-Role Chat** (10) — Chat visibility across roles
- **P. Team Management** (5) — Dashboard members, roles, status

### chat-functions.spec.ts (55 tests)
- **Q. Add Friend Flow** (10) — Search, validation, status display
- **R. New Chat Flow** (10) — Contact list, search, start chat
- **S. Support & Help** (10) — FAQ, feedback form, contact section
- **T. Chat Message Features** (15) — Styling, multi-send, XSS safety, wrapping
- **U. Texter Chat Experience** (10) — Quick messages, send, GIF/sticker

## Running Tests

\`\`\`bash
# Full test suite
./scripts/run-full-tests.sh

# Single file
npx playwright test tests/e2e/comprehensive.spec.ts

# Generate report
node scripts/generate-test-report.js
\`\`\`
`;

  fs.writeFileSync(reportPath, md);
  console.log(`Test report written to ${reportPath}`);
  console.log(`  Total: ${total} | Passed: ${passed} | Failed: ${failed} | Skipped: ${skipped}`);
}

main();
