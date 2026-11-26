# PhishNet — Notes on Six User-Supplied Design and Business Sources

**Compiled:** 2026-11-25. **Source classification:** The first two items are publicly discoverable Tableau whitepapers; the remaining items are user-supplied educational/course materials or licensed articles/cases. This file is an **original summary and design interpretation**, not a replacement for the original files.

**Distribution restriction:** Do **not** commit the uploaded HBR articles or the Harvard Business School (HBS) case PDF, their page images, or long extracts to a public repository. The uploaded copies contain an individual/course-use notice. Preserve bibliographic citations and original short summaries only. The slide presentation's redistribution rights are not established. The coding agent should ask for separately authorized access to these materials if full content is required.

## D01 — Ellie Fields, "7 Best Practices for Mobile Business Intelligence" (Tableau)

- **Uploaded file:** `7_best_practices_for_mobile_business_intelligence_whitepaper_1.pdf`
- **Public catalog:** https://www.tableau.com/learn/whitepapers/7-best-practices-mobile-business-intelligence
- **Source outline (pp. 2–10):** Avoid dashboard proliferation; use visualization best practices; design for a hurried mobile audience; use device/context affordances; embrace mobile collaboration; secure integration; consider offline access.
- **Specific guidance:** Author once and adapt views by device rather than maintaining separate analytics pipelines; show 2–4 major views on a tablet; vertically stack phone views; prioritize a first-screen answer; expose search, constrained filters and drill-down. Think about secure connections, encryption, SSO, loss of device and offline snapshots.
- **PhishNet interpretation:** The phone's *first screen* should answer "What is the proposed action, is it authorized, and what should I do?" rather than opening with a network graph. The same canonical case/evidence data should drive desktop graph and mobile timeline. Full offline conversation archives are **not** justified by a general offline recommendation; if implemented, limit to user-authorized encrypted/redacted case summaries and wipe-on-signout behavior.
- **Caution:** This is dashboard design guidance, not empirical proof about agent payments or a requirement to collect phone location. Geolocation is likely unnecessary for PhishNet's primary use cases.

## D02 — "10 Best Practices for Building Effective Dashboards" (Tableau)

- **Uploaded file:** `10_best_practices_for_building_effective_dashboardswp-1.pdf`
- **Public publisher page:** https://www.tableau.com/learn/whitepapers/building-effective-dashboards-it-user
- **Direct publisher PDF:** https://origin-tableau-www.tableau.com/sites/default/files/whitepapers/10_best_practices_for_building_effective_dashboardswp.pdf
- **Source organization (pp. 2–15):** Thoughtful planning (know audience, display size, load performance); informed design (visual priority, few views/colors, interactive exploration, theme-to-detail formatting); refinement (helpful tooltips, less clutter, observed usability testing).
- **PhishNet interpretation:** Start case view with status and a factual reason; allow a highlighted transaction to filter timeline and provenance details; prefer 2–3 coordinated panels over seven separate dashboards. Tooltips or tap-to-open details should explain what a node/edge means, who produced it, and whether it is observed, inferred or verified. Build a documented quick usability task before polishing visuals.
- **Caution:** The whitepaper's examples are business dashboards, not validated PhishNet prototypes. Exact view count is a design heuristic, not a security requirement.

## D03 — "Data Visualization and Storytelling" (user-provided presentation)

- **Uploaded file:** `Data Visualization and Storytelling.pptx`
- **Public source URL:** Not established; slides appear to be instructional/course material and no redistribution rights have been verified.
- **Source themes:** Data sets underlie every visualization; tools do not invent a coherent narrative; know audience and purpose; storyboarding and limited-object story pages; perceptual pre-attentive cues; affordances, consistency, legibility and plain language; remove distractions; choose graph by question.
- **Chart guidance from slides:** Bar charts for categorical comparisons; line charts for time; scatterplots for relationships/outliers; heatmaps for two-dimensional patterns; tables for exact readings; text for a critical number; waterfall for changes from start to finish. The slides caution against 3D, clutter, dual axes, too many colors, pie/word-cloud comparisons and unnecessarily dark backgrounds.
- **PhishNet interpretation:** Use a simple statement or table for *exact payment terms* (never hide destination or amount in a chart), a timeline for messages, a relational graph for origins, a bar chart for policy decision counts and a heatmap for tested case families. Use a story sequence of "initial instruction → introduced claim → agent propagation → proposed payment → enforceable decision."
- **Caution:** Classroom design advice is not a universal ban on all dark UI. Prioritize tested contrast, comprehension, accessibility, and task performance over theme preference.

## D04 — Nancy Duarte, "3 Ways to Help People Understand What Your Data Means" (Harvard Business Review, August 26, 2019)

- **Uploaded file:** `3-ways-help-understand-data-meaning-8b7d4175-0c1a-4700-af3e-c4c98f777874.pdf`
- **Publisher page:** https://hbr.org/2019/08/3-ways-to-help-people-understand-what-your-data-means
- **Three approaches in the article:** Connect a number to a familiar **size/distance**, **time**, or **thing**. Data must have understandable scale if it is to inform decisions.
- **PhishNet interpretation:** Explain unfamiliar token base units as familiar currency and explicit token/network facts (e.g., 20,000 base units at six decimals = 0.02 USDC, with asset decimals verified). Explain why a proposed amount differs from a normal authorization, and make elapsed time between suspicious message and action easy to understand. Prefer concrete comparison to sensational metaphors.
- **Caution:** The article explains communication, not fraud detection; it does not authorize invented comparisons or emotionally loaded risk language. Do not republish the article text or its illustrations.

## D05 — Datar, Croll and Bowler, "Busbud: Building a Data Company" (HBS case 118-011, published 2017, revised 2018)

- **Uploaded file:** `Busbud-1856746b-9878-4ff6-9823-649a4c4724a6.pdf`
- **Official product listing:** https://store.hbr.org/product/busbud-building-a-data-company/118011
- **Case themes:** An apparently simple travel search app depended on hard-to-acquire, inconsistent supplier data. The company faced a supply/demand chicken-and-egg problem; early hand-entered public schedules created a basic useful artifact; it later tested sales conversion on one narrow, commercially usable route. The case shows the role of data structuring, index/search, permissioned access, distribution channels and choosing metrics that reflect strategic objectives.
- **PhishNet interpretation:** A beautiful provenance graph is worthless without reliable **event source, identity, timestamp, claim and dependency evidence**. Begin with a narrow controlled pilot using real (consented) or openly licensed trace data and measured user decisions, rather than presenting synthetic records as a market-scale proprietary dataset. Track case coverage and **verification quality**, not merely graph size or page views. Build an ingest/standardize/annotate/provenance pipeline with field-level quality and licensing tags.
- **Caution:** Busbud is a business-strategy teaching case, not proof of demand for PhishNet or permission to scrape private content. The uploaded copy explicitly restricts reproduction and posting.

## D06 — Scott Zoldi and Jordan T. Levine, "Using Blockchain to Build Customer Trust in AI" (Harvard Business Review, January 20, 2025)

- **Uploaded file:** `using-blockchain-to-build-customer-trust-ai-eec4e7de-6f75-4599-a09b-aca9a11eb039.pdf`
- **Publisher page:** https://hbr.org/2025/01/using-blockchain-to-build-customer-trust-in-ai
- **Source framework:** Interpretability, auditability, and enforceability support trust. FICO describes using an analytic tracking document (ATD), standardized model-development requirements, approval gates and a private blockchain to record model/version/testing/approval artifacts. It stresses **standards first, technology second**, user-friendly workflow integration, quick wins, and durable links to large assets stored outside the chain.
- **Quantified source claim:** Authors state their FICO deployment reduced model support issues and recalls by **more than 90%**. This is **FICO's self-reported outcome in the article**, not an independently tested metric for PhishNet.
- **PhishNet interpretation:** Treat evidence lineage, policy decision, human approval and audit receipt as a single review path; show rejection/correction as well as successful approvals; later track the version, dataset, test and reviewer of PhishNet's risk analyzer in a separate **model-governance lineage** view. Anchor **hash commitments**, not private conversation content, and make governance usable without expecting users to understand blockchain internals.
- **Caution:** A blockchain commitment proves some integrity properties under assumptions; it does not guarantee input truth, completeness or correctness. This case concerns governance of FICO's analytic model development, not a ready-to-run phishing product.

## Cross-source design synthesis

| Decision for PhishNet | Sources | Design / implementation consequence |
|---|---|---|
| Actionable first-screen answer | D01, D02 | Mobile review shows proposed amount, verified recipient comparison, decision status, next safe action |
| Shared data, responsive layouts | D01 | One canonical investigation model; tailored presentations, not duplicate backends |
| Progressive evidence story | D02, D03, D04 | Start with a human-readable anomaly and reveal the exact sequence, supporting material and mechanism |
| Explicit exact-value and uncertainty labels | D03, D04 | Do not encode exact wallet addresses or 'independently verified' status only through color/graph size |
| Source/quality before graph scale | D05 | Build events, evidence citations, dependency confidence and normalization before large graph features |
| Governance embedded in workflow | D06 | Model version, policy, approval, corrections and audit evidence in ordinary case review |
| Privacy and safe mobile deployment | D01, D06 | Limit cached data, protect sensitive exports, separate permission from explanation |
| Learn from a narrow end-to-end pilot | D02, D05, D06 | Study a vendor recipient-swap case and its legitimate update counterexample before expanding domains |

## Rights and provenance policy

The uploaded materials are **input readings**, not public datasets or open-source code. GitHub stores only this citation index, original short summaries and design implications. If an authorized public URL is given, use that URL. For course-only slide material no verified public URL exists; do not fabricate one. Do not claim the original PDFs were uploaded or made public.
