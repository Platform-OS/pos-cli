---
id: TASK-49
title: deploy-dry-run allocates a release id per preview
status: To Do
assignee: []
created_date: '2026-09-22 06:46'
labels:
  - mcp
  - deploy
dependencies: []
references:
  - mcp-min/deploy/dry-run.js
  - lib/deploy/dryRunStrategy.js
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
- [ ] #1 It is established whether a dry-run release is meant to persist, and the finding is recorded here
- [ ] #2 If it is intended, the dry-run tool's description or docs say a preview leaves a release behind
- [ ] #3 If it is not, the behaviour is raised with the platform rather than worked around in pos-cli
<!-- AC:END -->
