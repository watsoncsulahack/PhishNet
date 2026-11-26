# PhishNet — Open-Source Visualization and UI Reference Catalog

**Review date:** 2026-11-25 (America/Los_Angeles). **Purpose:** Give a coding agent a ranked set of **real source repositories, demos and implementation patterns** for PhishNet's provenance-aware payment investigation experience. The entries below were checked against public GitHub repository metadata or license files. **Projects are examples, not dependencies already installed in PhishNet.** Verify the license at the pinned commit and check per-directory exceptions before copying any code.

**Source motivation:** [Six uploaded design/business readings](uploaded-source-notes.md) and [visualization strategy](visualization-design-strategy.md). Those readings support mobile-first, low-clutter, story-driven decision support, high-quality source data and in-workflow AI governance.

## What to build, not just what to display

The interaction PhishNet should prove first: select a suspicious vendor-recipient change → examine the original human mandate and exact proposed payment → open a chronological event → see the original claim and its source → follow only **observed** dependencies and separately marked **inferences** → inspect policy decision and authoritative evidence. A companion case should show a legitimate change backed by an independently verified **new mandate**. Use safe fixtures until real human authorization is implemented.

## A. Recommended implementation libraries — strong code-reuse candidates

| Rank | Project and source | License checked | Best PhishNet use | Why / limitation |
|---|---|---|---|---|
| **1** | **[React Flow / xyflow](https://github.com/xyflow/xyflow)** · [interactive examples](https://reactflow.dev/examples) | MIT | Read-only interactive provenance DAG, click-to-reveal evidence, highlighted source path; accessible keyboard navigation | Best React match for a *small-to-medium* contextual graph; start with fixed DAG layout and avoid implying users can edit recorded evidence |
| **2** | **[shadcn/ui](https://github.com/shadcn-ui/ui)** · [components](https://ui.shadcn.com/) | MIT | Mobile transaction review cards, alerts, dialogs, accordions, sheets, tabs, responsive controls | Useful composition primitives, not an investigation system or proof of security |
| **3** | **[TanStack Table](https://github.com/TanStack/table)** · [examples](https://tanstack.com/table/latest/docs/framework/react/examples) | MIT | Searchable case inbox, evidence/source tables, audit record tables, sorting and filtering | Headless; you provide safe data rendering, authorizations, and pagination |
| **4** | **[vis-timeline](https://github.com/visjs/vis-timeline)** · [examples](https://visjs.github.io/vis-timeline/examples/timeline/) | Apache-2.0 **OR** MIT | Zoomable chronological events, intervals, and agent/tool sequences | Consider as *optional* advanced desktop layer; a native stacked list is generally clearer on a narrow phone |
| **5** | **[Apache ECharts](https://github.com/apache/echarts)** · [examples](https://echarts.apache.org/examples/en/index.html) | Apache-2.0 | Compact comparison bars, time series, research confusion matrices, policy outcome trends | Don't put summary analytics on the transaction-approval first screen; validate aggregation denominators |
| **6** | **[Cytoscape.js](https://github.com/cytoscape/cytoscape.js)** · [demos](https://js.cytoscape.org/#demos) | MIT | More complex claim/evidence networks and graph traversal | Choose instead of React Flow only if evidence graph size/algorithms justify it |
| **7** | **[Sigma.js](https://github.com/jacomyal/sigma.js)** / **[React Sigma](https://github.com/sim51/react-sigma)** | MIT / MIT | Thousands of nodes for later analyst network exploration | Graph scale can hinder readability and mobile usage; not an MVP starting point |
| **8** | **[AntV G6](https://github.com/antvis/G6)** · [examples](https://g6.antv.antgroup.com/en/examples) | MIT | Advanced graph layout, grouping and aggregation | Alternative to Cytoscape/React Flow; evaluate maintenance and integration complexity |
| **9** | **[d3-sankey](https://github.com/d3/d3-sankey)** · [examples](https://observablehq.com/collection/@d3/d3-sankey) | BSD-3-Clause | Quantified *flow counts* from sources to decisions, once verified aggregate data exists | A Sankey implies conserved, meaningful quantities; **do not** use it to pretend causal confidence or unmeasured information flow is quantitatively known |

**Recommended default:** React Flow + shadcn/ui + TanStack Table; use a simple custom vertical event list for mobile. Add ECharts for evidence-based evaluation reports. Add vis-timeline, Cytoscape/Sigma, or Sankey **only after a documented use case and measured user need**. Mixing all graph libraries in one app adds cost without evidence of benefit.

## B. Complete open-source UI applications — inspect interaction patterns

| Project and source | License / reuse status | UI feature to study | Caveat |
|---|---|---|---|
| **[Timesketch](https://github.com/google/timesketch)** · [site](https://timesketch.org/) | Apache-2.0 | Investigative event timeline, search/filtering, tagging and case notes | Highly relevant source-driven investigation reference; larger backend than PhishNet needs |
| **[OpenCTI](https://github.com/OpenCTI-Platform/opencti)** · [site](https://filigran.io/solutions/opencti/) | Community Edition Apache-2.0; enterprise files use other license | Visual intelligence relationships, evidence drill-down and incident navigation | Adapt interface concepts; do not copy enterprise-only components |
| **[Langfuse](https://github.com/langfuse/langfuse)** · [docs](https://langfuse.com/docs) | MIT core; enterprise directories separately licensed | AI-agent trace hierarchy, individual tool calls, input/output inspection, model/run version | Agent operations are **not** proof of claim truth; protect private prompts and sensitive payloads |
| **[Jaeger UI](https://github.com/jaegertracing/jaeger-ui)** | Apache-2.0 | Parent-child trace waterfall and latency-focused drill-down | Execution span ancestry is not the same as evidence/citation dependency |
| **[Safe Wallet](https://github.com/safe-global/safe-wallet-monorepo)** · [Safe docs](https://docs.safe.global/) | GPL-3.0 | Human approval status, signer requirements, transaction detail review | Use as **interaction reference**, not casual code copy into a proprietary app; approval UX does not equal an independent verified signer |
| **[Otterscan](https://github.com/otterscan/otterscan)** | MIT | Transaction receipt/detail, internal transactions and token movements | Ethereum-oriented; PhishNet needs proper Arc/testnet identity and verified receipts |
| **[MITRE ATT&CK Navigator](https://github.com/mitre-attack/attack-navigator)** | Apache-2.0 | Heatmap/matrix of observed technique coverage | Research/security coverage only; don't map weak keyword flags to definitive attack techniques |
| **[Apache Superset](https://github.com/apache/superset)** | Apache-2.0 | Analyst reports and aggregate dashboards | Separate research/ops product; too heavy for core payment review |

## C. Specialized blockchain and fraud-flow visualizers — useful concrete inspirations

Small open-source apps can offer more directly reusable interaction code than a large enterprise platform, but may have limited maintainers, few tests or uncertain data-source reliability.

| Project | License status (checked) | Particularly relevant pattern | Recommendation |
|---|---|---|---|
| **[FlowLens](https://github.com/tobenwarrior/FlowLens)** | AGPL-3.0 | Source-preserving money-flow graph; exact raw amounts, tx hashes, time, source provenance, case export; detects lookalike addresses | **High-value conceptual reference**, potentially risky to embed without complying with AGPL; nascent project, validate implementation |
| **[WardGraph](https://github.com/WardAnalytics/WardGraph)** | Apache-2.0 | React Flow-based Ethereum wallet graph with analyst/compliance labeling | Good source for small graph UI ideas; old last update (2024), evaluate freshness and accuracy |
| **[Cashflow](https://github.com/rnbrady/cashflow)** | MIT | React Flow transaction DAG and parent/child traversal | Lightweight open-source code reference; Bitcoin Cash data model differs from EVM |
| **[TraceX](https://github.com/amitsinghbhadouriya/TraceX)** | MIT | Fraud investigation graph + case table + dashboard + AI copilot panel | Young, lightly validated project; borrow patterns, **not** fraud scores or claimed AI efficacy |
| **[ETH-Transaction-Graph](https://github.com/shawntabrizi/ETH-Transaction-Graph)** | MIT | Simple live address/transaction graph | Older architecture and network-specific assumptions; source readability matters |
| **[Sankeybuilder](https://github.com/eformx/sankeybuilder)** | MIT | Client-side editable flows, SVG/PNG export, CSV examples | Prefer as a reporting/export reference, not a representation of unmeasured causal claims |
| **[Block Trace](https://github.com/shakzaken/block-trace)** | MIT | Bitcoin wallet graph drill-down and address inspection | Limited project maturity; different blockchain topology |

## D. License/reuse watchlist — do not treat as freely reusable just because a GitHub repo is public

- **[Blockscout frontend](https://github.com/blockscout/frontend)**: A current `LICENSE` file (effective **2026-11-20**) uses a **custom LicenseRef-Blockscout** license. **Do not assume an OSI-approved open-source license**; treat as *visual reference only* unless reviewed and licensed for intended use.
- **[Arize Phoenix](https://github.com/Arize-ai/phoenix)**: Top-level license is **Elastic License 2.0**, which is source-available with restrictions rather than an OSI-approved open-source license. Useful observability reference, **not** a drop-in permissive component.
- **[Flowise](https://github.com/FlowiseAI/Flowise)**: Some files are Apache-2.0; enterprise paths have commercial terms. The inspected repository is **archived**. Do not select as core dependency without verifying successor project/maintenance.
- **[HexGraph](https://github.com/theigwe/hexgraph)** and **[Stargazer Crypto Navigator](https://github.com/ogalushkin/stargazer-crypto-navigator)**: Repository metadata did not establish a standard license on review. Do not copy code without a verified applicable license.
- **Safe Wallet:** GPL-3.0 has copyleft obligations. Use design patterns as inspiration, or undertake an explicit licensing review before code reuse.
- **OpenCTI, Langfuse:** Community/core is permissively licensed **but** enterprise folders have separate terms. Inspect actual file headers and paths before reuse.
- **React Flow:** Free core/examples are MIT; certain paid Pro example packages/content are separately offered. Stay with verifiably free repository examples.

## E. What each visualization should answer

| User question | Preferred visual | Data needed | Failure mode to avoid |
|---|---|---|---|
| "May this proposed payment happen?" | Exact-value transaction comparison and **signed approval status** | Canonical mandate + proposal + verified policy decision | Pie/gauge risk score masquerading as authority |
| "What changed from the original intent?" | Two-column redline comparison | Recipient, chain, token, amount, budget, purpose, expiry, nonce | Truncating addresses so two payees look identical; show full address on detail/copy |
| "What happened first, and what followed?" | Ordered vertical timeline; desktop zoomable timeline | UTC observed event timestamps, channel, actor and source IDs | Laying out events in a misleading order or inventing causal edges |
| "Where did this claim originate?" | Small linked graph / path highlighting | Claim mentions, evidence IDs, observed source relationships | Calling repeated claims "independent verification" |
| "What exactly was observed versus inferred?" | Tagged event/detail side panel | Observation type, verification method, explanation, uncertainty | Color alone implying a proof of fraud |
| "How often did policy stop a class of requests?" | Bar chart with denominators and baseline comparator | Executed labeled experiments, case-family counts | Fabricated percentages or training leakage |
| "How long do reviews take?" | Time series or distributions | Real observed start/end timestamps | Correlation asserted as causation |
| "What portion of claims have independent evidence?" | Bar/table of verified vs unknown counts | Verified evidence source classifications and method | Counting the same upstream source twice |
| "Did an on-chain transfer actually settle?" | Receipt/detail panel with verified explorer reference | Chain ID, tx hash, block receipt status, asset, recipient | Treating local simulation, unsigned data or unsupported blockchains as settlement |
| "Was the decision made under the correct model/policy?" | Governance history and approval checklist | Rule/model version, tests, approval signatures, immutable checkpoint | Assuming storing a hash guarantees that a claim was true |

## F. Selection gate for the coding agent

1. **Verify reuse legality:** Record license/SPDX and applicable file/folder exceptions and pin a commit before importing code.
2. **One canonical data model:** Both desktop and mobile consume the same event/claim/evidence/mandate/payment records.
3. **Limit default views:** 2–3 coordinated panels desktop; one decision-focused card plus vertical drill-down on phones. Avoid "dashboard proliferation" (D01).
4. **Explain links and counts:** Every edge is typed as observed/inferred, with evidence and uncertainty; metrics have denominator, definition and date.
5. **Touch-first controls:** Large tap targets, no hover-only critical evidence, screen reader labels, keyboard focus and reduced motion; choose responsive alternatives for force graphs.
6. **Safety:** All suspicious strings rendered as inert text; no secrets in graph payloads; no fake settlement statuses; no LLM-generated approval.
7. **Measured usefulness:** Pilot with authorized recipient switch and independently verified legitimate switch. Compare time-to-answer, correct authorization decision, incorrect certainty, and task completion with/without the graph.
8. **Gate expansion:** Scale to complex graphs and Sankey only after data quantity/quality, performance and user tests justify them.

## G. Concrete two-week illustration sprint (planning assumption, not a delivery promise)

- **Vertical slice 1:** Case inbox + transaction comparison + compact timeline on a **390px** viewport using existing synthetic fixtures. One source click reveals original event content and trust/verification state.
- **Vertical slice 2:** Same case on desktop with React Flow graph linked to selected timeline item. Distinguish observed from inferred edges in labels and line patterns; never use node color alone.
- **Vertical slice 3:** Legitimate recipient update and unauthorized substitution, with visibly different policy outcomes and independent verification/missing-approval explanations.
- **Vertical slice 4:** Basic aggregate evaluation chart only after fixture ground truth is documented. Add usability tests and accessibility checks before adding more charts.

**Metrics for pilot:** 90%+ completion of the specified *synthetic scenario* tasks (aspirational threshold to evaluate, not a benchmark result), median time to correct determination, incorrect approval rate, source-identification accuracy, mobile tap error rate, and qualitative comprehension of "unverified" versus "unauthorized."

**Do not** optimize for a larger, flashier graph until it helps a reviewer make a better decision.
