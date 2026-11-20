# UBC 2026 video and submission compliance check

Checked against the live official sources on November 20, 2026:

- [Devpost overview / What to Submit](https://ubc-hackathon-2026.devpost.com/)
- [Official rules](https://ubc-hackathon-2026.devpost.com/rules)
- [Official detailed guide](https://docs.google.com/document/d/1QaySCo7u3VxMVNdk3C5Ab3ewc2E46AuLntti-Uzx5EY/edit) — successfully read via its public text export. Earlier handoff notes saying this guide was inaccessible are now outdated.

## Verdict

**Do not certify the submission as fully compliant yet.** The original finished video was only 109.533 seconds; the official requirement is **2–3 minutes**, not simply less than three minutes. The finalizer now retimes the complete silent presentation and captions to approximately **135 seconds (2:15)** and asserts a measured 120–180-second duration. This improves reading time without adding blank padding or changing demonstrated outcomes.

| Requirement | Current evidence / status |
|---|---|
| 2–3-minute video | Original FAIL (1:49.533); corrected export targets 2:15. Verify with FFprobe and `video-validation.json`. |
| Product shown in action | PASS for the web research prototype: recorded browser interactions, actual local API responses, recipient-mismatch DENY and allowed-recipient comparison. Android itself is described, not shown. |
| Judge-accessible YouTube or Google Drive link | NOT VERIFIED / outstanding. Local Downloads and GitHub Actions artifacts are not the specified submission link. Upload to YouTube/Drive and test while signed out. |
| Audio | No general audio/narration mandate found in the official overview or guide. Silent video has open captions. ElevenLabs bounty specifically requires audio and core product integration; do not enter it for this video. |
| Clear project explanation | Problem, claim lineage, independent policy checks, outcomes, limitations and next steps are covered. Team is identified as Data Operators; all individual names belong in the submission form. |
| Honest simulation disclosure | Payments/balances are labeled simulated; the final edit covers the old misleading prototype receipt text with an explicit simulation-only disclosure. No real settlement is claimed. |
| Agentic Payments and AI technical requirement | NOT ESTABLISHED by this video. Guide requires agents to execute onchain transactions **or read the blockchain**, plus documented decision loop and safety limits. A real transfer is not mandatory, but a local fixture-only policy demo is insufficient evidence. Native manual balance checks do not demonstrate an agent reading the chain. |
| Best use of Arc (optional) | NOT ESTABLISHED by this video. Requires core onchain functionality on Arc, README explanation and applicable contract addresses. No new contract deployment is required. Native balance reading exists in code, but this footage does not show it. Do not invent addresses or claim the simulation proves eligibility. |
| Other bounties | Not established. No core ElevenLabs, Grok Bot, QuickNode Streams or Gemini Prediction Markets integration is demonstrated. Using Stagehand to record is not one of those integrations. |

## Remaining steps before submission

1. Show an actual agent blockchain-read tool or transaction and document its decision loop and limits. A real, read-only chain query is allowed by the Agentic Payments guide; do not add unsafe signing just for the demo. If omitted, obtain organizer clarification rather than claiming track compliance.
2. For a strong Android product claim, record the real APK creating a test wallet and reading Arc Testnet, instead of relying only on closing-card descriptions. This is a product-quality recommendation, not a separately stated Android-video rule.
3. Upload the corrected MP4 to YouTube or Google Drive. Confirm playback and permissions signed out, and add the URL to Devpost.
4. Verify all non-video submission fields: one main track, at most one chain award, only qualifying bounties, all team members, written answers, technologies actually used, working app, public eligible repo, README architecture and applicable addresses.
5. Confirm team eligibility and in-person attendance. Official rules say 1–4 participants and attendance at final presentations for prizes. The overview and rules differ on some eligibility wording; ask organizers where ambiguous.
6. Observe the official submission deadline: **November 20, 2026, 12:00 PM CST (18:00 UTC)**. The live finalist pitch is separately **4 minutes + 2 minutes Q&A**; that is not the uploaded-video duration.

## Eligibility cautions outside video scope

The rules prohibit pre-event work (before November 13) and require work created during the event; the overview describes a November 12 kickoff. The repository creation date, full code provenance, team identities, registration and final submission confirmation have not been audited here. Do not treat a successful video export as proof of prize eligibility.
