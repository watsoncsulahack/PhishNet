import { Stagehand } from '@browserbasehq/stagehand';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { spawn, execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import assert from 'node:assert/strict';

const output = resolve('output');
await mkdir(output, { recursive: true });
const scenes = JSON.parse(await readFile(new URL('./scenes.json', import.meta.url), 'utf8'));
const apiKey = process.env.ELEVENLABS_API_KEY;
const voice = process.env.ELEVENLABS_VOICE_ID;
const narrated = Boolean(apiKey && voice);
if (process.env.REQUIRE_NARRATION === 'true' && !narrated) {
  throw new Error('Configure ELEVENLABS_API_KEY and ELEVENLABS_VOICE_ID repository secrets before requesting narration.');
}
assert(scenes.reduce((sum, scene) => sum + scene.narration.length, 0) < 5000, 'Narration credit safety cap exceeded');
function run(command, args) { return execFileSync(command, args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }); }
function duration(file) { return Number(run('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', file]).trim()); }
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const escape = value => value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
const server = spawn(process.execPath, ['../../apps/api/src/server.js'], {
  env: { ...process.env, HOST: '127.0.0.1', PORT: '3317' }, stdio: ['ignore', 'pipe', 'pipe']
});
// Do not forward environment or request data to logs.
server.stdout.resume(); server.stderr.resume();
const base = 'http://127.0.0.1:3317';
let stagehand;
const evidence = [];
try {
  for (let i = 0; ; i++) {
    try { if ((await fetch(`${base}/v1/health`)).ok) break; } catch {}
    if (i > 40) throw new Error('Local demo server did not start');
    await sleep(250);
  }
  // Fresh fixture mandate: recording should work beyond the original fixed dates.
  const mandateResponse = await fetch(`${base}/v1/ap2/intent`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ allowedRecipient: '0x1111111111111111111111111111111111111111', recipientName: 'Demo vendor', amountMaxBaseUnits: '250000000', cumulativeBudgetBaseUnits: '500000000' })
  });
  assert.equal(mandateResponse.status, 201);
  for (const [index, scene] of scenes.entries()) {
    console.log(`Recording ${index + 1}/${scenes.length}: ${scene.id}`);
    const audio = resolve(output, `${scene.id}.mp3`);
    if (narrated) {
      const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voice)}?output_format=mp3_44100_128`, {
        method: 'POST', headers: { 'xi-api-key': apiKey, 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: scene.narration, model_id: 'eleven_multilingual_v2', voice_settings: { stability: 0.55, similarity_boost: 0.75 } }),
        signal: AbortSignal.timeout(90000)
      });
      if (!response.ok) throw new Error(`ElevenLabs returned HTTP ${response.status}. Check your subscription, voice permissions and credits. No automatic retry or purchase is performed.`);
      await writeFile(audio, Buffer.from(await response.arrayBuffer()));
    }
    const seconds = narrated ? duration(audio) + 1 : Math.max(16, scene.narration.split(/\s+/).length / 2.6);
    stagehand = new Stagehand({
      env: 'LOCAL', verbose: 0, enableCaching: false, disablePino: true,
      // Deterministic Playwright actions through Stagehand; no LLM calls, secrets, or model charges.
      modelName: 'gpt-4o', modelClientOptions: { apiKey: 'unused-no-inference-in-recording' },
      localBrowserLaunchOptions: { headless: true, viewport: { width: 1600, height: 1000 },
        recordVideo: { dir: resolve(output, 'raw'), size: { width: 1600, height: 1000 } } }
    });
    await stagehand.init();
    const page = stagehand.page;
    const video = page.video();
    assert(video, 'Stagehand video recording not initialized');
    if (scene.id === 'intro' || scene.id === 'outro') {
      await page.setContent(`<!doctype html><html lang="en"><head><meta charset="utf-8"><title>PhishNet demo title card</title></head><body style="margin:0;background:#102e29;color:#f6f8f3;font-family:Arial,sans-serif;padding:120px 100px;box-sizing:border-box"><p style="color:#bbf0d2;letter-spacing:4px;font-size:22px">PHISHNET · DATA OPERATORS · UBC 2026</p><h1 style="font-size:86px;max-width:1200px;line-height:1.08">${escape(scene.title)}</h1><p style="font-size:34px;max-width:1100px;line-height:1.5">${escape(scene.caption)}</p><p style="color:#bbf0d2;font-size:24px">${scene.id === 'intro' ? 'Provenance-aware security for agentic payments' : 'Prototype code: github.com/watsoncsulahack/PhishNet'}</p><p style="font-size:20px">${narrated ? 'AI narration: ElevenLabs' : 'CAPTIONED DRAFT · NARRATION NOT YET GENERATED'} · Title card, not app footage</p></body></html>`);
    } else {
      await page.goto(base, { waitUntil: 'networkidle' });
      await page.locator('#wallet-balance-usd').filter({ hasText: '$' }).waitFor();
      await page.addStyleTag({ content: `body {padding-top:136px !important;padding-bottom:165px !important} .top-app-bar {top:136px !important} .bottom-nav {bottom:135px !important} #receipt-link {display:none !important} main {max-width:1100px !important} #demo-label,#demo-caption {position:fixed;left:0;right:0;z-index:10000;padding:20px 50px;font-family:Arial,sans-serif;box-sizing:border-box} #demo-label {top:0;background:#102e29;color:#bbf0d2;min-height:120px} #demo-caption {bottom:0;background:#102e29;color:white;min-height:130px;font-size:27px;line-height:1.35}` });
      await page.evaluate(({ title, caption }) => {
        const top = document.createElement('div'); top.id = 'demo-label';
        const heading = document.createElement('strong'); heading.style.fontSize = '30px'; heading.textContent = title;
        const disclosure = document.createElement('p'); disclosure.style.fontSize = '19px'; disclosure.style.margin = '10px 0 0';
        disclosure.textContent = 'RESEARCH PROTOTYPE · SIMULATED BALANCES & PAYMENTS · LOCAL RULE-BASED ANALYSIS';
        top.append(heading, disclosure);
        const bottom = document.createElement('div'); bottom.id = 'demo-caption'; bottom.textContent = caption;
        document.body.append(top, bottom);
      }, scene);
      if (scene.id === 'lineage') {
        await page.locator('#nav-btn-inspector').click();
        await page.locator('#dag-svg').scrollIntoViewIfNeeded();
      } else {
        await page.locator('#gate-banner').scrollIntoViewIfNeeded();
      }
    }
    const started = Date.now();
    await sleep(2200);
    if (scene.id === 'blocked' || scene.id === 'allowed') {
      const malicious = scene.id === 'blocked';
      const responsePromise = page.waitForResponse(response => response.url().endsWith('/v1/ap2/authorize') && response.request().method() === 'POST');
      await page.locator(`button[onclick="triggerAp2Payment(${malicious})"]`).click();
      const response = await responsePromise;
      const result = await response.json();
      assert.equal(result.preflight.decision, malicious ? 'DENY' : 'ALLOW');
      if (malicious) assert(result.preflight.reasonCodes.includes('RECIPIENT_MISMATCH'));
      else assert.equal(result.receipt.status, 'SETTLED_SIMULATED');
      evidence.push({ scene: scene.id, httpStatus: response.status(), result });
      await page.locator('#gate-banner').scrollIntoViewIfNeeded();
      await page.locator('#gate-decision').filter({ hasText: malicious ? 'DENY' : 'ALLOW' }).waitFor();
    }
    await sleep(Math.max(0, seconds * 1000 - (Date.now() - started)));
    await page.screenshot({ path: resolve(output, `${scene.id}.png`) });
    await stagehand.close(); stagehand = undefined;
    const raw = await video.path();
    const start = Math.max(0, duration(raw) - seconds);
    const args = ['-y', '-ss', String(start), '-i', raw];
    if (narrated) args.push('-i', audio);
    args.push('-t', String(seconds), '-map', '0:v:0');
    if (narrated) args.push('-map', '1:a:0', '-af', 'apad', '-c:a', 'aac');
    else args.push('-an');
    args.push('-vf', 'scale=1600:1000,setsar=1', '-r', '30', '-c:v', 'libx264', '-preset', 'fast', '-crf', '20', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', resolve(output, `${scene.id}.mp4`));
    run('ffmpeg', args);
    scene.seconds = seconds;
  }
  await writeFile(resolve(output, 'concat.txt'), scenes.map(scene => `file '${scene.id}.mp4'`).join('\n'));
  const filename = narrated ? 'PhishNet-demo-narrated.mp4' : 'PhishNet-demo-captioned-draft.mp4';
  run('ffmpeg', ['-y', '-f', 'concat', '-safe', '0', '-i', resolve(output, 'concat.txt'), '-c', 'copy', '-movflags', '+faststart', resolve(output, filename)]);
  function stamp(seconds) {
    const ms = Math.round(seconds * 1000);
    return `${String(Math.floor(ms / 3600000)).padStart(2, '0')}:${String(Math.floor(ms / 60000) % 60).padStart(2, '0')}:${String(Math.floor(ms / 1000) % 60).padStart(2, '0')},${String(ms % 1000).padStart(3, '0')}`;
  }
  let offset = 0, cue = 0; const subtitles = [];
  for (const scene of scenes) {
    const words = scene.narration.split(/\s+/);
    for (let i = 0; i < words.length; i += 12) {
      subtitles.push(`${++cue}\n${stamp(offset + scene.seconds * i / words.length)} --> ${stamp(offset + scene.seconds * Math.min(i + 12, words.length) / words.length)}\n${words.slice(i, i + 12).join(' ')}\n`);
    }
    offset += scene.seconds;
  }
  await writeFile(resolve(output, 'narration.srt'), subtitles.join('\n'));
  await writeFile(resolve(output, 'narration.txt'), scenes.map(scene => `${scene.title}\n${scene.narration}\n`).join('\n'));
  await writeFile(resolve(output, 'evidence.json'), JSON.stringify({ narrated, seconds: offset, recording: 'Stagehand 2.5.9 local Chromium', sourceDeck: 'PhishNet — Provenance-Aware Firewall for Financial AI Agents (2).pptx', evidence }, null, 2));
  console.log(`Created ${filename} (${Math.round(offset)}s). Review all captions and footage before submission. SRT timings are approximate.`);
} finally {
  if (stagehand) await stagehand.close().catch(() => {});
  server.kill();
}
