---
id: TASK-49
title: deploy-dry-run allocates a release id per preview
status: Done
assignee: []
created_date: '2026-09-22 06:46'
updated_date: '2026-09-23 18:36'
labels:
  - mcp
  - deploy
dependencies: []
references:
  - mcp-min/deploy/dry-run.js
  - lib/deploy/dryRunStrategy.js
modified_files:
  - mcp-min/deploy/dry-run.js
  - docs/MCP_TOOLS.md
  - CHANGELOG.md
priority: low
ordinal: 89000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Noticed by an agent-perspective evaluation of the MCP server (2026-09-21), and confirmed while fixing the dry run's report on 2026-09-22: previewing burns release ids (23268, 23270, 23276, 23277, 23278 during one session) while reporting `applied: false`.

This is how `dry_run=true` works on the API — the release is recorded, validated and not applied — so it is the platform's behaviour rather than a defect in this tool, and `pos-cli deploy --dry-run` does the same. It is filed because nobody has said whether it is intended:

- An agent is told to run a dry run before every deploy, so previews will outnumber deploys.
- Release ids are the identifiers an operator reads in the instance's history; a history mostly made of previews is harder to read.
- Nothing cleans them up, and `deleted_at` exists on the record.

It may be entirely fine. The point is to decide and write it down, rather than leave the next person to rediscover it.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 It is established whether a dry-run release is meant to persist, and the finding is recorded here
- [x] #2 If it is intended, the dry-run tool's description or docs say a preview leaves a release behind
- [ ] #3 If it is not, the behaviour is raised with the platform rather than worked around in pos-cli
<!-- AC:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
**Decision: intended. Documented, not worked around.** AC #3 does not apply — nothing is raised with the platform.

## What was measured (fk-block, 2026-09-23)

Three consecutive previews of the same project:

```
dry run 1: releaseId=23327  applied=false  verdict=would_succeed
dry run 2: releaseId=23328  applied=false  verdict=would_succeed
dry run 3: releaseId=23329  applied=false  verdict=would_succeed
```

One id per preview, consecutive, confirming the report. The record each leaves:

```
status = "success"   deleted_at = null   created_at = "2026-09-23T18:34:10.538Z"
```

So it persists, it is not soft-deleted, and its `status` is the same word a real deploy gets.

## The finding that decides it

This task worried that *"a history mostly made of previews is harder to read"*. It is not, and the reason is decisive. Run against the same instance, a preview and a real deploy differ in the record:

| | `options.dry_run` | `status` |
| --- | --- | --- |
| Dry run (23330) | `"true"` | `"success"` |
| Real deploy (23331) | `null` | `"success"` |

**The platform stamps the flag itself.** A record you did not mean to keep is not one you mark. `status` alone cannot tell them apart — both say `success` — but `options.dry_run` can, and anything reading the history can filter on it.

That makes this the platform's intended behaviour rather than a leak, so pos-cli does not try to delete, hide or count these records. Two further facts support leaving it alone: `pos-cli deploy --dry-run` has always done the same, and nothing in this repo owns a release record — `job-status` already forwards them verbatim on principle.

## Also established

- **No GraphQL surface exposes releases at all.** `__schema.queryType` has no release, deploy or import field, so an operator's view of this history is the REST record or the instance's own UI. Nothing an agent can query, which is why none of this went into the tool description.
- The record carries 16 fields; `dry_run` is not one of them. It lives inside `options`, alongside `partial_deployment`, `force_mode` and `sync`.

## Where it is written down

- **`mcp-min/deploy/dry-run.js`** — the header already justified `destructiveHint: false` and NOT `readOnlyHint` with "the API records a release". It now also says the release is kept, one id per preview, and stamped `options.dry_run: "true"`, with the real-deploy comparison that proves the marker means something.
- **`docs/MCP_TOOLS.md`**, under `deploy-dry-run` — the operator-facing version: previews outnumber deploys because a dry run is the recommended step before every one, and `options.dry_run` is how the two are told apart.
- **Deliberately not in the tool description.** It is 200+ bytes on every request for every agent, and an agent cannot act on it: it cannot clean a release up, and it should not stop running dry runs. This is operator knowledge, not agent knowledge, and the repo's rule is that every byte in a description is paid on every call.

## Cleanup

The probe deployed one page to fk-block and ran five previews against it. The page was deleted; the instance is back to `total_entries: 0`. The five release records remain, which is the point of this task.
<!-- SECTION:FINAL_SUMMARY:END -->
