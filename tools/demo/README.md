# Hackathon video recorder

A reproducible, 2–3-minute browser demo based on the new 12-slide **PhishNet — Provenance-Aware Firewall for Financial AI Agents (2).pptx**. Stagehand records the actual running web prototype, with explicit simulation disclosures; ElevenLabs can generate narration. No impersonation/voice cloning, automatic subscription purchase, public video upload, or real payment occurs.

## Draft now

**Actions → Record hackathon demo → successful run → PhishNet-hackathon-demo** contains an MP4, scene screenshots, narration script, approximate SRT subtitles and response evidence. A push affecting this folder records a **silent, open-captioned final MP4**, without API keys or external AI calls. Use `PhishNet-hackathon-demo.mp4` (1920×1080, approximately 2m15s; measured runtime is checked against the official 2–3-minute requirement). The `captioned-draft` file is an intermediate; the final includes the full burned-in transcript and explicit editorial simulation-receipt labeling.

The recording shows title card → source lineage → recipient-mismatch denial → original-recipient allowance → scope/end card. It asserts real API responses rather than animating fake outcomes. Title cards are labeled, the web footage says simulation throughout, and no explorer link is clicked. Android is described in the closing narration, not represented by browser footage.

## ElevenLabs narration

1. Redeem the UBC offer yourself through the official organizer link; eligibility, subscription activation, API access and available credits must be confirmed in your account. A free web subscription may not imply API credits. No offer has been redeemed by this script.
2. In GitHub **Settings → Secrets and variables → Actions**, add `ELEVENLABS_API_KEY` (restricted to text-to-speech if supported) and `ELEVENLABS_VOICE_ID` for a stock or otherwise licensed voice. Do not commit keys or put them in issue/PR comments. Alternatively configure these variables locally.
3. Manually run **Record hackathon demo** with **narration = true** on the implementation branch. This calls ElevenLabs once per scene, consuming your available TTS credits. Missing credentials or API errors fail rather than silently substituting another voice/service. No paid plan or credits are purchased automatically.
4. Download `PhishNet-demo-narrated.mp4`. Review pronunciation, timing, captions and claims before submission. Subtitles are approximate, not forced-aligned.

## Local Linux/macOS

Requires Node 22, FFmpeg/ffprobe, and Chromium system dependencies:

```sh
cd tools/demo
npm ci
npx playwright install --with-deps chromium
npm run record
# For narration, configure ELEVENLABS_API_KEY and ELEVENLABS_VOICE_ID
# in your shell/secret manager, then run with REQUIRE_NARRATION=true.
```

The Android/Termux environment may not run the bundled desktop browser. GitHub's Ubuntu runner is the supported recording environment. Stagehand 2's deterministic Playwright interface is used deliberately: no LLM inference, Browserbase account, or extra model API key is required to reproduce this fixed shot list.

## Recorder dependency boundary

The isolated Stagehand 2 recorder currently has npm audit advisories in transitive AI SDK, Zod and diffing dependencies. Its AI inference, file-upload and diff-rendering paths are not used; it only opens the local synthetic demo. Do not use this tool as a production service or give it untrusted URLs/content. These dependencies are not included in the Android APK. Migration to a patched current Stagehand API remains follow-up work.

## Finish an existing capture without re-recording

```sh
node finalize.mjs /path/to/downloaded/artifact
```

This uses FFmpeg only. It adds open captions, replaces obsolete draft labels on title cards, covers the prototype's misleading receipt label with an explicit **SIMULATION ONLY** editorial disclosure (without changing ALLOW/DENY), and exports a silent H.264 1080p MP4. It does not generate speech or use ElevenLabs. Full original scene captures and response evidence remain available for inspection. On Android it uses the system Roboto font; on Linux it uses DejaVu Sans. Override with `DEMO_FONT` if needed.

Edit `scenes.json` to adjust narration and short on-screen captions. Total narration is capped at 5,000 characters before any TTS call. Runs regenerate audio and consume credits again; review the text before requesting narration.

## Submission review

- The supplied presentation is a concept pitch. Its economic statistics and forecasts were not independently verified here and are omitted from narration.
- Do not claim production owner-signature verification, general AI analysis, on-chain audit anchoring, real settlement, recovery, automated faucet funding, or autonomous earnings. These are not demonstrated.
- Synthetic scenario results do not establish real-world fraud-detection rates.
- Official rules and the detailed guide were checked on November 20, 2026: the uploaded video must be 2–3 minutes and accessible on YouTube or Google Drive. Audio is not generally mandated. Runtime validation is not proof of full track/submission compliance; see [compliance review](../../docs/hackathon-video-compliance.md).
- Have a teammate watch the final MP4 with sound, check that DENY/ALLOW are readable, attach the SRT if useful, and upload using an account you control. Confirm the final sharing link works while signed out.
