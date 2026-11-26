# Investigation slice — actual verification results

Date: 2026-11-26. Environment: Linux, Node v22.23.0, @playwright/test 1.65.1, Chromium 159.0.8154.6 / revision 1255. All data synthetic. Remote main `91fffd1` merged without discarding local commits. Policy/fixtures: `80cedec`; disabled legacy fake-live adapter: `94a0712`; UI implementation: commit introducing this report (resolve with `git log -- apps/web/investigate.js`).

| Command | Actual result | Scope |
|---|---|---|
| `npm test` | PASS 15/15 | Actual API, client Boolean rejection, input examples, simulated receipt |
| `npm run test:unit` | PASS 4/4 | Actual shared policy / fixture verifier, tampered signature, wrong signer, changed nonce, canonical references |
| `npm run test:chain` | PASS 4 checks | Live adapter opt-in rejected with/without a key, simulated receipt, DENY refused |
| `npm run test:browser` | PASS 18/18 | Six tests × three viewports: 390×844 touch, 320×740 touch, 1440×1000 desktop |
| `node scripts/verify-design-docs.mjs` | PASS | Documentation structure only |
| Visual screenshot inspection | Performed, 390px and 1440px | Full-page screenshots locally in /tmp; no reviewer efficacy inference |
| `npm install` audit | 0 vulnerabilities in 4 packages | Development dependency scan, not application security review |

The initial sandbox API run failed with loopback EPERM, then passed outside the sandbox. Initial browser run failed 18/18 before any UI assertions because the required browser executable was absent. After `npx playwright install chromium`, all 18 executed and passed in 3.1 seconds. JSON execution details are generated in `test-results/browser-results.json`; traces are retained on failure. Screenshot review found no horizontal overflow; a minor mobile headline spacing and desktop status alignment adjustment followed, then the browser checks were rerun (see final verification below).

## Visualization acceptance

| Criterion | Executable evidence | Result / limit |
|---|---|---|
| VC-01 | Browser transaction test | PASS: status, amount/asset and change indicator visible on first screen without graph |
| VC-02 | Browser source/selection test | PASS: one event click reveals original actor/time/text/trust |
| VC-03 | Browser shared selection test | PASS: graph ↔ timeline selects identical canonical IDs |
| VC-04 | Browser convergence test | PASS: 1 source, 2 repetitions explicitly shown |
| VC-05 | Browser counterexample + fixture verifier tests | PASS for synthetic signed replay: substitution DENY, new signed mandate + exact-proposal approval ALLOW. Real authenticated human update NOT_IMPLEMENTED |
| VC-06 | Browser address/copy test | PASS: exact full addresses, including internal character difference; clipboard equals proposal |
| VC-07 | Browser simulation + API/adapter tests | PASS in tested paths: simulation labels, no explorer link, live adapter disabled |
| VC-08 | Browser relationship test | PASS: textual relation names, dashed inference vs solid observed path; explanation and qualitative confidence inspectable |
| VC-09 | Browser keyboard/touch test | PASS: Enter, source focus, touch targets, forced colors/reduced motion, inert HTML; no comprehensive screen-reader certification |
| VC-10 | Browser local task/export test | Infrastructure PASS; HUMAN STUDY NOT_RUN (0 reviewers). Incorrect answer, origin, confidence, elapsed time and input errors are recorded accurately by form. No efficacy claim |

No measured human task completion, decision accuracy, source attribution accuracy or confidence calibration is available. Automated form inputs are test data and are not reported as reviewer observations. Stage 2 remains partial until actual reviewer comparisons are conducted. Device tests emulate touch/viewport; no physical low-power device performance study, Safari/Firefox coverage or production authentication certification is claimed.

## Remaining financial gates

Stage 1 durable database/replay/concurrency, complete canonical schema validation, full policy scope, trusted identity enrollment, mandate/approval revocation, transaction-bound challenge/expiry verification, isolated signing, real protocol integration, independent audit commitments and independently checked network receipts remain open. The UI is read-only, the legacy APIs are in-memory simulation, and live adapter opt-in throws. Do not deploy a production financial service from these checks.

## Final verification

After the layout and keyboard return changes, the full browser suite passed again: **18/18 in 3.3 seconds**, with 0 failures/skips. See [committed execution summary and tested-source SHA-256 values](../../evaluation/investigation-browser-results.json). `npm run test:unit` again passed 4/4 and documentation verification passed. CI is configured for these checks; no hosted CI run is claimed.
