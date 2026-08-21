# Cloud Search Backend Evaluation

Use this reference when assessing a managed search API, cloud MCP, or vendor-provided search Skill for Hermes. It complements `local-search-backend-evaluation.md`.

## Evaluation sequence

1. **Read the user-provided source first.** For WeChat links, use the local WeChat article cache/fetch service before general search. Extract title, author, date, and full text; separate the author's claims from independently verified facts.
2. **Verify with first-party material.** Prefer the provider's API reference, pricing, quota/limit page, service terms, official Skill repository, and official MCP repository. Treat launch articles and community README claims as secondary.
3. **Classify deployment honestly.** Distinguish:
   - local/offline engine;
   - local client calling a cloud API;
   - hosted product with no automation API.
   A local MCP or Skill wrapper does not make the search service local.
4. **Map feature surfaces.** Record result count, snippets/full text, timestamps, images, domain allow/block filters, authority filters, query rewrite, ranking scores, structured cards, language/geography coverage, and version differences.
5. **Check privacy and license terms.** Determine what queries/results leave the host, whether inputs/outputs may be reviewed or used for training, data-region limits, content retention/archiving restrictions, resale restrictions, and obligations for public-facing use.
6. **Audit every integration route.** Compare first-party Skill, first-party MCP, direct API/native Hermes tool, and community MCP. Prefer first-party source with the smallest dependency surface. Inspect dependency bounds and perform a real MCP `tools/list` handshake rather than trusting config snippets.
7. **Test without exposing credentials.** A dummy-key request may verify DNS/TLS/endpoint reachability and error shape. Do not claim search quality without an authenticated query. Never ask the user to paste production keys into chat; place them in the Hermes secret environment through the user's preferred secure login flow.
8. **Compare against the live baseline.** Run `agent-reach doctor --json`; distinguish added coverage from duplication of Exa, GitHub, platform-specific channels, Jina Reader, Hermes Browser, and local knowledge search.
9. **Design routing, not replacement.** State which query classes should prefer the new backend and which must remain on specialized channels.
10. **Use a measured pilot.** Compare top-k official-source hit rate, freshness, duplicate rate, citation quality, latency, quota usage, and failure recovery on a fixed Chinese/English test set.

## Durable pitfalls

- A provider saying it performs well on public benchmarks is not reproducible evidence unless it publishes scores, dataset versions, prompts/models, parameters, and code.
- A single search API call is not “deep research.” Query decomposition, counter-evidence search, deduplication, and synthesis usually come from Hermes/Skill orchestration.
- “Authoritative source” labels describe source classes, not guaranteed truth of every sentence; open the original URL for consequential claims.
- Long snippets can reduce fetch calls but can also flood context. Cap output and preserve URL, publisher, publication time, and authority metadata before body text.
- If service terms restrict storing or archiving returned content, use the API for discovery, fetch original URLs separately under their own terms, and persist only allowed citation metadata plus the agent’s own analysis.
- Do not hard-code a transient upstream dependency failure as a permanent prohibition. Capture the reproducible pin/lock workaround and re-test current upstream before deployment.

## Provider case note: Volcengine Doubao Search (verified 2026-07-29)

This is dated evidence, not a permanent truth. Re-check official docs before installation.

### Product facts

- It is a **cloud API**; only the Skill/MCP client runs locally.
- Account-level free quota: 500 calls/month, shared across Global and Custom versions; default limit: 5 QPS per version.
- Pay-as-you-go price then published: CNY 0.020/call. Custom subscription packs then published: 1,000 calls for CNY 5.9 (50/day) or 2,000 for CNY 9.9 (100/day).
- Custom: up to 50 web results, image search, date range, domain allow/block, query rewrite, authority labels/filter, relevance score, text/Markdown content, finance/game/gov verticals.
- Global: up to 20 results, controllable snippets/images, `ContentCharCount`/`ContentTokenCount`, broader global coverage; no Custom authority filter.
- Best complement to Agent Reach: Chinese current affairs, policy, finance, domestic product/company research, and official-source filtering. It does not replace X/Reddit/Xiaohongshu/Bilibili/YouTube/WeChat platform-specific access or local Obsidian search.

### Terms and privacy

At the verified date, special terms said inputs/outputs would not train the base model without separate consent, but the provider could automatically or manually review use and content for compliance. The license was limited to mainland China and restricted copying, storing, archiving returned content, or creating a content database. Therefore do not bulk-persist API full text into Obsidian/cache. Use it to discover URLs, then fetch originals and save only permitted citation metadata and original analysis.

### Integration findings

- **Preferred:** adapt first-party `bytedance/agentkit-samples` skill `byted-web-search` for Hermes. It is small and supports Custom features. Patch OpenClaw-specific credential paths to Hermes secret handling; add shared 4-QPS queueing and output caps.
- **First-party MCP:** `volcengine/mcp-server/server/mcp_server_askecho_search_infinity` exposed one `web_search` tool. The documented unpinned `uvx --from git+...` path installed a newer incompatible `mcp` SDK and failed at `FastMCP` import during the verified session. Cloning the repository and running with its `uv.lock` via `uv run --locked` completed a real `tools/list` handshake. Re-test upstream; if still needed, pin commit + lock rather than following floating `main`.
- **Community MCP:** `alchaincyf/huashu-doubao-search` exposed Global/Custom selection and agent-oriented output, but is a young single-maintainer wrapper. Treat it as a reference or pilot option, not the default over first-party code; audit dependencies and issues again before use.

### Recommended routing

- Chinese news/policy/finance/domestic products: Doubao Custom; use authority level 1 for consequential claims, then open original URLs.
- English technical/global research: Exa + official sites/GitHub; optionally Doubao Global as a secondary source.
- Known URL: Jina Reader, WeChat single-article fetcher, or Hermes Browser; do not spend search quota.
- Platform content: keep Agent Reach’s specialized channel.
- Private/local knowledge: keep Obsidian, Hermes-Wiki, Feishu, and local caches; do not send sensitive corpus text as search queries.
