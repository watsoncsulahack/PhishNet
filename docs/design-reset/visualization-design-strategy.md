# PhishNet — Mobile-First Visualization and Evidence-Review Strategy

**Status:** Design recommendation; not a claimed implemented feature. **Inputs:** six user-supplied readings summarized in [uploaded-source-notes.md](uploaded-source-notes.md), current [requirements.md](requirements.md), and audited PhishNet prototype. **Comparable projects:** [visualization-projects.md](visualization-projects.md).

## Decision: an investigation application, NOT an all-in-one chart wall

The core story is: **the human delegated a financial intent; a claim appeared; agents relayed or transformed it; an exact payment was proposed; independent policy either permitted, held or denied execution.** Visualizations exist to answer what changed, what evidence exists, and what authority actually permits an action.

The sources suggest that an on-the-go user wants an *immediate answer*, not to decode a complex chart. The desktop investigator needs contextual search, chronology, proof and replay. The financial signer needs a canonical, legible payment review. These are connected views of one underlying data model, not separate products or data stores.

### Research-to-design map

| Input | What it changes in this design |
|---|---|
| D01 Tableau Mobile | One canonical source of truth; mobile-first vertical layout, first-screen answer, touch targets, deliberate offline/redaction and secure sign-on |
| D02 Tableau Dashboards | Audience-focused 2–3 coordinated views; predictable cross-filtering, useful tooltips, fast load, iterative usability study |
| D03 Data Visualization and Storytelling slides | Explicit storyboard, readable labels, truthful chart choice, meaningful colors, avoid clutter/3D/ambiguous dual axes |
| D04 Nancy Duarte HBR | Translate complex base units, timing and scope into familiar accurate terms, without inflammatory or invented analogies |
| D05 Busbud HBS case | Data-source access and consistent formatting are foundational; validate one valuable real/consented data workflow before scaling charts or proposing a data marketplace |
| D06 FICO HBR | Interpretability, auditability and enforceability are in-flow user tasks; capture model/rule version, approvals, rejected work and externally verifiable commitments |

## Four screens (one shared record model)

### 1. Case inbox — "What should I examine now?"

**Desktop:** search; status, amount, recipient-change indicator, last activity time, evidence completeness and accessible list/table. **Mobile:** a card list with clear status text, amount, short case label, updated time and one primary action "Review case." No horizontal scrolling.

**Data:** case ID, status, reason codes, proposal ID, authorized vs proposed recipient, timestamp, evidence coverage classification. **Avoid:** presenting a risk percentage from unvalidated model scores.

**References:** Timesketch, TanStack Table, shadcn/ui.

### 2. Payment review — "Is this exactly what I authorized?"

**First screen on mobile (top-to-bottom):**
1. Status written in words: **DENIED / NEEDS VERIFIED APPROVAL / PERMITTED IN SIMULATION**; no risk color alone.
2. Expected vs proposed **recipient, amount, asset, chain, purpose**, with change indicators. Provide "see full address / copy address"; never approve based only on an ellipsized address.
3. Short explanation (e.g. "recipient differs from signed mandate"), link to origin evidence, next safe action.
4. Explicit mode and execution status: **SIMULATED**, **BROADCAST**, or **CONFIRMED (receipt independently checked)**.
5. "View interaction history" and "View source evidence" as secondary actions.

**Desktop:** transaction review at upper left or in a persistent side panel, with a linked timeline and optional provenance graph.

**Critical safety:** any real human approval must be bound to a canonical exact transaction and independently authenticated; the UI cannot make an LLM recommendation or a boolean client field into permission. No live-execution button before the signer gate actually exists.

**References:** Safe Wallet (visual reference, GPL licensing), shadcn/ui, Otterscan.

### 3. Evidence and interaction replay — "Where did this claim come from?"

**Default phone view:** chronological, vertically stacked events with actor, UTC timestamp, channel and a 1–2-line summary; select any event to see the exact source and evidence status. A single "Show claim lineage" control opens a focused path list or small pan/zoom graph.

**Desktop:** 2–3 coordinated panes (timeline, central graph, detail/transaction panel). Clicking any graph node selects the corresponding timeline item and opens a source detail. Prefer **path highlighting** to all-node explosions. When a claim has two agent mentions backed by one original message, show **one source node and two repetitions**, not "two independent verifications."

**Edge semantics (visible in legend and accessible labels):**
- OBSERVED_REFERENCE: a recorded link to a source or parent event; solid connection.
- INFERRED_INFLUENCE: heuristic/model-generated hypothesis; dashed connection, confidence and why.
- VERIFIED_INDEPENDENCE: separately authenticated source with recorded verification method; special marker *plus text*.
- UNKNOWN: evidence of a causal relationship is not established.

**Data model suggestion:** stable source ID, claim ID, event ID, relationship kind, evidence references, verification method, decision source and model/rule version. A repeated text string is not itself proof of direct causal dependence.

**References:** React Flow; Timesketch; Langfuse and Jaeger for tool-span inspection; OpenCTI for evidence navigation.

### 4. Audit and research — "Can we prove how the decision was made, and does the system help?"

**Audit:** separate tabs/panels for policy decision/version, signed approval status, verified execution receipt, and event commitment/checkpoint proof. Never call a custom event hash "blockchain proven" without independent reference. Include failed, corrected, reversed and pending states.

**Research:** counts for *executed* controlled cases only; bar charts with denominators, class labels, and uncertainty; confusion matrix for comparison with baseline; elapsed-time distributions. Contrasting human-only, final-message-only, deterministic policy and provenance-enhanced reviewer workflows is an **experiment to run**, not a performance claim already demonstrated.

**Later governance:** model/rule version, training/evaluation dataset provenance, test runs, human review/rejection and signed release approvals can be a separate model governance trail, inspired by FICO—not confused with the transaction evidence graph.

**References:** Apache ECharts, Langfuse, OpenCTI, MITRE Navigator (technique heatmap only), Jaeger UI.

## Design and chart-selection rules

1. **Use the least complicated encoding that accurately answers the question.** Exact recipient and amount belong in text/table, not gauges. Use comparison bars, temporal lines, or matrices only when data warrant them.
2. **Default to 2–3 independent visual regions on desktop and one task per mobile section.** Let a click/tap reveal the next detail; keep same underlying event/evidence API.
3. **Never infer proof from appearance:** source claim, verified identity, independent evidence, permission and settlement are distinct. Labels must state the difference in words, not only colored borders.
4. **Every chart carries definitions:** numerator/denominator, date range, synthetic vs real data, known missing records, data source/method, and uncertainty when relevant.
5. **No causal Sankey without measured flows:** Sankey thickness implies a quantity. If only logical claims are known, use a typed DAG without quantitative edge width.
6. **No inflated "risk meter":** a gauge/donut percentage is not a substitute for enforceable ALLOW/HOLD/DENY and reasons. If risk scores are ever added, they need measured calibration and limitations.
7. **Avoid duplicate dashboards, overstuffed filters, hover-only disclosures and tiny nodes.** Support touch, keyboard and assistive technology.
8. **Plain-language explanations first:** define token units and timestamps in familiar terms; keep exact underlying technical data accessible.
9. **Do not export raw private source texts by default.** Default audit/report exports should be minimized and redacted, with user-controlled scope.
10. **Separate time axes from causal edges.** "After" does not prove "because of"; present inferred links separately.
11. **Retain correction history:** rejections, updated mandates, verification corrections and model versions are part of the audit story.
12. **Do not substitute an off-chain Merkle root for an independently trusted integrity witness.**

## Proposed interaction storyboard (replayable synthetic case)

| Step | What the user sees | What the application must be able to show |
|---|---|---|
| 1. Authorized intent | "Pay Vendor A, maximum 250 USDC" | Original human mandate plus its actual verification state |
| 2. Suspicious input | "Vendor payout wallet changed to B" | Original untrusted message, author/channel, timestamp, source identifier |
| 3. Agent propagation | Agent 1 then Agent 2 repeat the change | Claim mentions with one shared source (not two independent sources) |
| 4. Payment proposal | "Pay 250 USDC to B" | Precise B destination vs signed A; chain, asset, amount, purpose |
| 5. Policy decision | "DENY — recipient mismatch" | Actual non-LLM gate, reason, version and no payment execution |
| 6. Benign control | Independently checked change and a *new signed mandate* for B | Appropriate authorized simulated approval with clear evidence distinction |

Make steps individually navigable and intelligible to someone unfamiliar with blockchain.

## Mobile behavior and performance

- Design and test at **390 × 844 CSS px** as a reference target, plus a narrower 320px viewport; support phone landscape and desktop. These are **product design targets**, not specifications contained in the uploaded readings.
- Use large actionable tap areas (target ≥44px where possible), readable typography, tabular numerals and selectable/copyable exact addresses.
- Render an initial case summary from lightweight data; virtualize or paginate long traces; lazy-load graph layout and expensive calculations. Measure performance on a low-power mobile device; set budgets after baseline measurement.
- Provide deterministic focus and back navigation between inbox, event, claim, evidence and payment; no gesture-only controls.
- If offline access is needed, allow explicitly downloaded **redacted** read-only case snapshots; no approval/signing or fake live status offline.
- Never embed private signing keys in frontend state, browser cache or client-side graph serialization.

## Data prerequisites and quality gate (Busbud lesson)

A convincing visualization is downstream of reliable data rights and normalization:

1. Identify allowed data sources: synthetic fixtures, user-consented agent logs, agent tools with export permissions, public chain receipts.
2. Capture source channel, originating identity (asserted or authenticated), UTC timestamps, event content digest, source permissions, ingestion version and missing-data warnings.
3. Distinguish raw event from extracted claim, claim mention, inferred edge, independently authenticated evidence and transaction authorization.
4. Maintain reversible links to the underlying source; label provenance gaps UNKNOWN rather than invent a chain.
5. Build at least one end-to-end human-review study on a case with valid ground truth before asserting fraud-detection value.
6. Document permitted data use, retention, consent, licensing and limitations. Do not treat purchased/closed-case PDFs as a dataset.

## Acceptance criteria for the first visualization implementation

- **VC-01:** On 390px width, user can read the proposed asset, amount, recipient-change indicator and authorization status without opening a graph.
- **VC-02:** Selecting an event leads to its original source/actor/timestamp and verified-vs-asserted state in ≤2 deliberate actions.
- **VC-03:** Graph and timeline select the same source and reflect the same canonical event IDs.
- **VC-04:** Repeated-agent claim from a common origin is visibly identified as **one source**, not independent corroboration.
- **VC-05:** Legitimate signed vendor update is visibly distinguished from unauthorized substitution with correct non-LLM policy outcomes.
- **VC-06:** Exact addresses are retrievable/copyable; truncated labels cannot silently hide a changed address.
- **VC-07:** Simulated settlement is explicitly labeled and no fabricated explorer URL appears.
- **VC-08:** Observed and inferred graph edges have distinct textual names and accessible contrast/patterns.
- **VC-09:** Users can complete core investigation with keyboard and touch; critical details are not hover-only.
- **VC-10:** User-tested tasks record observed correct decisions, source attribution, time-to-answer, uncertainty calibration and errors without fabricated success metrics.

## Engineering handoff

Start by implementing the vendor-swap and legitimate-update storyboard using **one** canonical case and policy backend. Use React Flow, shadcn/ui and a mobile timeline with TanStack Table for the case inbox. Defer broad dashboard/analytics infrastructure until the evidence pipeline and tests are reliable. Evaluate ECharts for a research view only after genuine case-by-case results can be measured. Update [testing.md](testing.md) with VC-01…VC-10 traceability before declaring Stage 2 complete.
