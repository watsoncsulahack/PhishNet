# PhishNet Primary Research References

Source review date: 2026-11-25. Follow the linked primary sources; statements in research-context.md are summaries and implications, not proof of PhishNet effectiveness.

| ID | Primary source | Appropriate use and limitation |
|---|---|---|
| R01 | [Trail of Bits: Prompt injection to RCE in AI agents (2025)](https://blog.trailofbits.com/2025/10/22/prompt-injection-to-rce-in-ai-agents/) | Unsafe agent tool execution and defenses, not a specific PhishNet exploit. |
| R02 | [I-HITL: Inalienable Human-in-the-Loop (2026)](https://arxiv.org/abs/2610.35835) | Independent authorization design; user understanding is a separate issue. |
| R03 | [Countersign Labs counter-sign](https://github.com/countersign-labs/counter-sign) | Approval signatures; not a universal financial compliance solution. |
| R04 | [FICO: How to Use Blockchain to Build Responsible AI (2024)](https://www.fico.com/blogs/how-use-blockchain-build-responsible-ai-award-winning-approach) | Model development/approval provenance; not proof of model correctness. |
| R05 | [EP3850557B1 patent](https://patents.google.com/patent/EP3850557B1/en) | Specific claims need legal review; no general ownership of all provenance workflows. |
| R06 | [New York Fed Staff Report 1198 (2026)](https://www.newyorkfed.org/medialibrary/media/research/staff_reports/sr1198.pdf) | LLM-assisted study of 3,984 historical bank runs; not a study of AI-agent-caused runs. |
| R07 | [NIST Phish Scale (2020)](https://csrc.nist.gov/pubs/journal/2020/09/categorizing-human-phishing-detection-difficulty-a/final) | Contextual phishing difficulty; not a keyword fraud rule. |
| R08 | [Microsoft ClickFix (2025)](https://www.microsoft.com/en-us/security/blog/2025/08/21/think-before-you-clickfix-analyzing-the-clickfix-social-engineering-technique/) | Real workflow-pretext social engineering; mechanisms for AI agents differ. |
| R09 | [AgentDojo (NeurIPS 2024)](https://proceedings.neurips.cc/paper_files/paper/2024/hash/97091a5177d8dc64b1da8bf3e1f6fb54-Abstract-Datasets_and_Benchmarks_Track.html) | 97 tasks, 629 security test cases; no PhishNet benchmark run reported. |
| R10 | [Google Agent Payments Protocol](https://ap2-protocol.org/) | Review latest relevant version before claiming AP2 compatibility. |
| R11 | [x402 documentation](https://docs.x402.org/) | Review version, actual payment verification and settlement. |
| R12 | [Circle Arc documentation](https://docs.arc.network/) | Testnet integration parameters must be verified at implementation time. |
| R13 | [OWASP Prompt Injection](https://genai.owasp.org/llm2026/llm012026-prompt-injection/) | Security taxonomy; detectors are not sufficient as enforcement. |
| R14 | [RFC 9162](https://www.rfc-editor.org/rfc/rfc9162.html) | Transparency proof details; custom Merkle code does not imply conformance. |

Use the original user-created fixtures as **synthetic development cases**, not real-world fraud prevalence. Real data requires provenance, consent, licensing, privacy controls, and family-disjoint evaluation.

## Additional user-provided visualization / AI governance readings (2026-11-25)

These six materials were supplied as reading inputs; [uploaded-source-notes.md](uploaded-source-notes.md) contains PhishNet-specific original summaries, citations and redistribution restrictions. **The PDFs and course slides themselves are not published to this public repo.**

| ID | Source / access | Design implication |
|---|---|---|
| D01 | [Ellie Fields, *7 Best Practices for Mobile Business Intelligence* (Tableau)](https://www.tableau.com/learn/whitepapers/7-best-practices-mobile-business-intelligence) | Author-once responsive BI; first-screen answers, progressive exploration, mobile security, constrained offline access |
| D02 | [*10 Best Practices for Building Effective Dashboards* (Tableau)](https://www.tableau.com/learn/whitepapers/building-effective-dashboards-it-user) | Audience-first, 2–3 coordinated views, focused interactivity and tooltips, usability testing |
| D03 | *Data Visualization and Storytelling* (user-supplied slides; no verified public source URL) | Storyboards, appropriate visual encoding, contextualized, low-clutter communication |
| D04 | [Nancy Duarte, *3 Ways to Help People Understand What Your Data Means* (HBR, 2019)](https://hbr.org/2019/08/3-ways-to-help-people-understand-what-your-data-means) | Human-understandable numerical scale and accurate analogies |
| D05 | [Datar, Croll, Bowler, *Busbud: Building a Data Company* (HBS 118-011, 2017/rev. 2018)](https://store.hbr.org/product/busbud-building-a-data-company/118011) | Data quality/access before interface complexity, narrow end-to-end pilot, measured conversion to decision |
| D06 | [Zoldi and Levine, *Using Blockchain to Build Customer Trust in AI* (HBR, Jan. 2025)](https://hbr.org/2025/01/using-blockchain-to-build-customer-trust-in-ai) | Interpretability, auditability, enforceability; standards before technology; seamless version/approval trace |

**Licensing:** D04–D06 uploaded copies display course/individual-use restrictions; do not redistribute originals, page images or substantive passages in GitHub. D03's distribution rights are unverified. All summaries here are original short notes rather than source reproductions.

## Open-source visualization examples

See the separately researched [visualization-projects.md](visualization-projects.md) for **ranked code libraries and complete UI references**, links, verified license caveats, and a warning about current custom Blockscout licensing. The companion [visualization-design-strategy.md](visualization-design-strategy.md) maps those references to PhishNet screens and usability tests.
