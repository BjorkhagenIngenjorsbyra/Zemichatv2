/**
 * AI Explorer — an autonomous "curious human" QA agent for ZemiChat.
 *
 * Drives the REAL app UI (Playwright, mobile viewport) against the LOCAL Supabase
 * stack, and uses Claude (vision) as the brain: each step it sees a screenshot +
 * the interactive elements on screen, decides ONE action like a first-time user,
 * and notes anything confusing or broken. At the end it writes a qualitative
 * UX/bug report — the closest thing to "a human experiencing the app".
 *
 * Run:
 *   1) local Supabase up + seeded (npm run test.rls once), dev server on :5173
 *      pointed at local (.env.local), then:
 *   2) ANTHROPIC_API_KEY=$(cat /c/Alva/config/anthropic_token.txt) \
 *        node tests/explore/ai-explorer.mjs
 *
 * NEVER point this at production — it clicks and types freely.
 */
import { chromium } from '@playwright/test';
import Anthropic from '@anthropic-ai/sdk';
import fs from 'fs';
import path from 'path';
import { execSync } from 'node:child_process';

const BASE_URL = 'http://localhost:5173';
const EMAIL = process.env.EXPLORE_EMAIL || 'user-aaaa0001@test.local'; // seeded owner
const PASSWORD = process.env.EXPLORE_PASSWORD || 'test-password-123!';
const MODEL = process.env.EXPLORE_MODEL || 'claude-opus-4-8';
const MAX_STEPS = Number(process.env.EXPLORE_STEPS || 12);
const OUT_DIR = path.resolve('tests/explore/runs');

const INTERACTIVE = [
  'button', 'a[href]', 'ion-button', '[role="button"]', 'ion-item[button]',
  'ion-tab-button', 'ion-toggle', 'input', 'textarea', 'ion-input', 'ion-searchbar',
  '[data-testid]',
].join(', ');

const ACTION_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    observation: { type: 'string', description: 'What you see and think as a first-time user.' },
    issues: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          severity: { type: 'string', enum: ['low', 'medium', 'high'] },
          text: { type: 'string' },
        },
        required: ['severity', 'text'],
      },
    },
    action: {
      type: 'object',
      additionalProperties: false,
      properties: {
        type: { type: 'string', enum: ['click', 'type', 'back', 'done'] },
        index: { type: 'integer', description: 'Index of the target element (for click/type).' },
        text: { type: 'string', description: 'Text to type (for type).' },
        reason: { type: 'string' },
      },
      required: ['type', 'reason'],
    },
  },
  required: ['observation', 'issues', 'action'],
};

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY || fs.readFileSync('C:/Alva/config/anthropic_token.txt', 'utf-8').trim(),
});

// Brain routing: the standalone Anthropic SDK uses the developer API key
// (pay-as-you-go). Routing through the Claude Code CLI instead uses the Max
// subscription auth — which includes Fable 5 — so set EXPLORE_BRAIN=claude-code
// (auto-on for fable models) to avoid burning API credits.
const USE_CLAUDE_CODE = process.env.EXPLORE_BRAIN === 'claude-code' || MODEL.startsWith('claude-fable');

// Call Claude Code headless with the prompt on stdin (no shell-quoting risk).
// Returns the model's final text. Allows the Read tool so it can view a
// screenshot referenced by path.
function claudeCode(prompt) {
  const cmd = `claude -p --model ${MODEL} --output-format json --max-turns 8 --allowedTools Read`;
  const raw = execSync(cmd, {
    input: prompt,
    encoding: 'utf-8',
    maxBuffer: 64 * 1024 * 1024,
    timeout: 180000,
  });
  const parsed = JSON.parse(raw);
  if (parsed.is_error) throw new Error(parsed.result || 'claude-code error');
  return parsed.result;
}

// Lenient JSON extraction (model may wrap JSON in prose / code fences).
function extractJson(text) {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const body = fenced ? fenced[1] : text;
  const a = body.indexOf('{');
  const b = body.lastIndexOf('}');
  if (a === -1 || b === -1) throw new Error('no JSON in model output: ' + text.slice(0, 200));
  return JSON.parse(body.slice(a, b + 1));
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function login(page) {
  await page.goto(`${BASE_URL}/login`);
  await page.waitForLoadState('networkidle');
  const email = page.locator('form[data-testid="login-form"] ion-input[type="email"] input');
  await email.waitFor({ state: 'visible', timeout: 15000 });
  await email.fill(EMAIL);
  await page.locator('form[data-testid="login-form"] ion-input[type="password"] input').fill(PASSWORD);
  await page.locator('form[data-testid="login-form"] ion-button[type="submit"]').click();
  await page.waitForURL((u) => !u.pathname.includes('/login'), { timeout: 20000 });
  await page.waitForLoadState('networkidle');
}

async function collectElements(page) {
  const handles = await page.$$(INTERACTIVE);
  const out = [];
  for (const h of handles) {
    if (out.length >= 40) break;
    try {
      if (!(await h.isVisible())) continue;
      const info = await h.evaluate((el) => ({
        tag: el.tagName.toLowerCase(),
        text: (el.innerText || el.getAttribute('aria-label') || el.getAttribute('placeholder') || '').trim().slice(0, 60),
        testid: el.getAttribute('data-testid') || '',
      }));
      out.push({ handle: h, ...info });
    } catch {
      /* detached */
    }
  }
  return out;
}

function describeElements(els) {
  return els
    .map((e, i) => `[${i}] <${e.tag}> ${e.text || '(no text)'}${e.testid ? ` testid=${e.testid}` : ''}`)
    .join('\n');
}

const DECIDE_SYSTEM =
  'You are a curious, slightly impatient first-time user testing ZemiChat — a family chat app where a parent (Team Owner) oversees their children (Texters). ' +
  'Explore the app like a real person: open things, read labels, try features. Your job is to surface anything confusing, broken, mislabelled, empty-where-it-should-not-be, or that simply feels off. ' +
  'You are given a screenshot and a numbered list of the interactive elements currently on screen. Choose exactly ONE next action. ' +
  'Prefer exploring parts you have not seen. Use "type" only into text fields (give the element index + text). Use "back" to leave a dead end. Use "done" when you have seen enough of the app. ' +
  'Report issues you notice in the issues array (be specific; ok to be empty).';

async function decide(screenshotB64, screenshotPath, url, elementList, history) {
  const recent = history.slice(-6).map((h) => `- ${h.action.type}${h.action.index != null ? ` [${h.action.index}]` : ''}: ${h.action.reason}`).join('\n') || '(none yet)';
  // Breadth nudge: if the last 3 steps were on the same screen, push elsewhere.
  const lastUrls = history.slice(-3).map((h) => h.url);
  const stuck = lastUrls.length === 3 && lastUrls.every((u) => u === url);
  const breadthNote = stuck
    ? '\n\nNOTE: You have spent the last 3 steps on THIS screen. Do not repeat the same action again — navigate somewhere new (go back, or open a different section like the dashboard/oversight, friends, or settings) to explore more of the app.'
    : '';

  if (USE_CLAUDE_CODE) {
    const prompt =
      `${DECIDE_SYSTEM}\n\n` +
      `First, look at the screenshot using the Read tool: ${screenshotPath.replace(/\\/g, '/')}\n\n` +
      `Current URL: ${url}\n\nInteractive elements:\n${elementList}\n\nRecent actions:\n${recent}${breadthNote}\n\n` +
      `Decide your next single action and note any issues. Respond with ONLY a JSON object (no prose, no code fences) of the form: ` +
      `{"observation": string, "issues": [{"severity": "low"|"medium"|"high", "text": string}], "action": {"type": "click"|"type"|"back"|"done", "index": number, "text": string, "reason": string}}. ` +
      `Omit index/text when not needed.`;
    return extractJson(claudeCode(prompt));
  }

  const res = await client.messages.create({
    model: MODEL,
    max_tokens: 1500,
    output_config: { effort: 'low', format: { type: 'json_schema', schema: ACTION_SCHEMA } },
    system:
      'You are a curious, slightly impatient first-time user testing ZemiChat — a family chat app where a parent (Team Owner) oversees their children (Texters). ' +
      'Explore the app like a real person: open things, read labels, try features. Your job is to surface anything confusing, broken, mislabelled, empty-where-it-should-not-be, or that simply feels off. ' +
      'You are given a screenshot and a numbered list of the interactive elements currently on screen. Choose exactly ONE next action. ' +
      'Prefer exploring parts you have not seen. Use "type" only into text fields (give the element index + text). Use "back" to leave a dead end. Use "done" when you have seen enough of the app. ' +
      'Report issues you notice in the issues array (be specific; ok to be empty).',
    messages: [
      {
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: 'image/png', data: screenshotB64 } },
          {
            type: 'text',
            text: `Current URL: ${url}\n\nInteractive elements:\n${elementList}\n\nRecent actions:\n${recent}${breadthNote}\n\nDecide your next single action and note any issues.`,
          },
        ],
      },
    ],
  });
  const textBlock = res.content.find((b) => b.type === 'text');
  return JSON.parse(textBlock.text);
}

const SUMMARY_SYSTEM =
  'You are a senior product/QA reviewer. You just explored ZemiChat as a first-time user. ' +
  'Write a concise, honest UX report in Swedish markdown: (1) helhetsintryck, (2) vad som fungerade bra, ' +
  '(3) problem/förvirring (grupperat efter allvarsgrad, konkret), (4) topp-3 rekommendationer. Var saklig och nedtonad.';

async function summarize(history, issues) {
  const log = history.map((h, i) => `Step ${i + 1} @ ${h.url}\n  saw: ${h.observation}\n  did: ${h.action.type} ${h.action.reason}`).join('\n\n');
  const issueList = issues.map((x) => `- [${x.severity}] (step ${x.step}) ${x.text}`).join('\n') || '(none reported)';

  if (USE_CLAUDE_CODE) {
    const prompt = `${SUMMARY_SYSTEM}\n\nUtforskningslogg:\n\n${log}\n\nRapporterade problem:\n${issueList}\n\nSkriv rapporten.`;
    return claudeCode(prompt);
  }

  const res = await client.messages.create({
    model: MODEL,
    max_tokens: 4000,
    thinking: { type: 'adaptive' },
    output_config: { effort: 'high' },
    system:
      'You are a senior product/QA reviewer. You just explored ZemiChat as a first-time user. ' +
      'Write a concise, honest UX report in Swedish markdown: (1) helhetsintryck, (2) vad som fungerade bra, ' +
      '(3) problem/förvirring (grupperat efter allvarsgrad, konkret), (4) topp-3 rekommendationer. Var saklig och nedtonad.',
    messages: [
      { role: 'user', content: `Utforskningslogg:\n\n${log}\n\nRapporterade problem:\n${issueList}\n\nSkriv rapporten.` },
    ],
  });
  return res.content.filter((b) => b.type === 'text').map((b) => b.text).join('\n');
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const runId = String(Date.now());
  const shotsDir = path.join(OUT_DIR, runId);
  fs.mkdirSync(shotsDir, { recursive: true });

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 412, height: 915 }, hasTouch: true });
  const page = await context.newPage();
  const history = [];
  const allIssues = [];

  try {
    await login(page);
    console.log('Logged in. Exploring...');

    for (let step = 0; step < MAX_STEPS; step++) {
      await sleep(700);
      const shotBuf = await page.screenshot();
      const shotPath = path.join(shotsDir, `step-${String(step + 1).padStart(2, '0')}.png`);
      fs.writeFileSync(shotPath, shotBuf);
      const els = await collectElements(page);
      const url = page.url();

      let decision;
      try {
        decision = await decide(shotBuf.toString('base64'), shotPath, url, describeElements(els), history);
      } catch (e) {
        console.log(`  step ${step + 1}: brain error: ${e.message}`);
        break;
      }

      (decision.issues || []).forEach((x) => allIssues.push({ ...x, step: step + 1 }));
      history.push({ url, observation: decision.observation, action: decision.action });
      console.log(`  step ${step + 1} @ ${url}\n    obs: ${decision.observation.slice(0, 120)}\n    act: ${decision.action.type} — ${decision.action.reason}`);

      const a = decision.action;
      if (a.type === 'done') break;
      try {
        if (a.type === 'back') {
          await page.goBack({ timeout: 8000 });
        } else if (a.type === 'click' && els[a.index]) {
          const h = els[a.index].handle;
          await h.scrollIntoViewIfNeeded({ timeout: 4000 }).catch(() => {});
          await h.click({ timeout: 8000 });
        } else if (a.type === 'type' && els[a.index]) {
          const h = els[a.index].handle;
          // Ionic (ion-input/ion-searchbar/ion-textarea) wraps the real
          // <input>/<textarea> in shadow DOM — fill THAT so input events fire,
          // instead of clicking the host and hoping keystrokes land.
          const innerHandle = await h.evaluateHandle((el) => {
            if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') return el;
            return (
              el.querySelector('input, textarea') ||
              (el.shadowRoot && el.shadowRoot.querySelector('input, textarea')) ||
              el
            );
          });
          const innerEl = innerHandle.asElement();
          let filled = false;
          if (innerEl) {
            try {
              await innerEl.fill(a.text || '', { timeout: 5000 });
              filled = true;
            } catch {
              /* fall back below */
            }
          }
          if (!filled) {
            await h.click({ timeout: 8000 }).catch(() => {});
            await page.keyboard.type(a.text || '', { delay: 20 });
          }
        }
        await page.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => {});
      } catch (e) {
        console.log(`    action failed (${e.message.split('\n')[0]}) — continuing`);
      }
    }

    console.log('Writing report...');
    const report = await summarize(history, allIssues);
    const reportPath = path.join(OUT_DIR, `report-${runId}.md`);
    const header = `# ZemiChat — AI-utforskarrapport\n\nKörning: ${runId} · ${history.length} steg · ${allIssues.length} noterade problem · modell ${MODEL}\nSkärmdumpar: tests/explore/runs/${runId}/\n\n---\n\n`;
    fs.writeFileSync(reportPath, header + report);
    console.log(`\nReport: ${reportPath}`);
    console.log(`Issues: ${allIssues.length} | Steps: ${history.length}`);
  } finally {
    await context.close();
    await browser.close();
  }
}

main().catch((e) => {
  console.error('explorer failed:', e);
  process.exit(1);
});
