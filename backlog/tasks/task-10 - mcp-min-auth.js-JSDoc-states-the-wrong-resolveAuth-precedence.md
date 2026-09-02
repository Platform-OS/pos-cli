---
id: TASK-10
title: mcp-min/auth.js JSDoc states the wrong resolveAuth precedence
status: To Do
assignee: []
created_date: '2026-09-02 10:24'
labels:
  - docs
  - mcp
dependencies: []
references:
  - mcp-min/auth.js
priority: low
ordinal: 25000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Pre-existing on `master`. This is the source of the same error that reached CLAUDE.md via the Ajv validation branch (fixed there under TASK-3), so fixing it here stops it being copied again.

`mcp-min/auth.js:16-20` documents the fallback order as:

```
 *   1. Explicit params (url + email + token)
 *   2. MPKIT_* environment variables
 *   3. Named .pos environment (params.env)
 *   4. First environment in .pos config
```

The function body does something different, and its own inline comments say so: `params.env` is checked at `auth.js:39` **before** `MPKIT_*` at `auth.js:46`, labelled "Priority 2: Named .pos environment" and "Priority 3: MPKIT_*". The distinction matters — the code deliberately does not fall back to `MPKIT_*` when an env name was given ("the caller is being explicit"), which is the opposite of what the JSDoc implies.

Correct order: explicit `url`+`email`+`token` params -> named `.pos` environment -> `MPKIT_*` env vars -> first `.pos` entry.

Fix the JSDoc block to match, and while there, check for other copies of the wrong order in tool descriptions and README before they multiply.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 The JSDoc on resolveAuth lists the precedence the function actually implements
- [ ] #2 The repo is searched for other copies of the wrong order (tool descriptions, README, docs) and any found are corrected
<!-- AC:END -->
