---
id: TASK-10
title: mcp-min/auth.js JSDoc states the wrong resolveAuth precedence
status: Done
assignee: []
created_date: '2026-09-02 10:24'
updated_date: '2026-09-17 20:35'
labels:
  - docs
  - mcp
dependencies: []
references:
  - mcp-min/auth.js
priority: low
ordinal: 41000
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
- [x] #1 The JSDoc on resolveAuth lists the precedence the function actually implements
- [x] #2 The repo is searched for other copies of the wrong order (tool descriptions, README, docs) and any found are corrected
<!-- AC:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
The JSDoc on `resolveAuth` now lists the order the function resolves in — explicit params, named `.pos` environment, `MPKIT_*`, first `.pos` entry — and says why a named environment does not fall back to `MPKIT_*`.

**A second wrong copy was in `docs/MCP_TOOLS.md`** ("Authentication Precedence"), listing environment variables second and the named environment third. Corrected, and both lower steps gained the sentence a reader actually needs: naming an environment settles it and fails rather than falling back, and omitting `env` picks whichever environment is first in the file — so name it on anything that writes. CLAUDE.md and `validate-params.test.js` already had the right order (fixed under TASK-3); the sweep found no others.

**The order is now checked, not just written.** `mcp-min/__tests__/auth.env-resolve.test.js` gained two blocks:
- every step pinned with all four sources present at once, which is the only arrangement that can tell one order from another — plus the rules the wrong comment hid: a named environment that is missing fails instead of falling back, and both the explicit params and `MPKIT_*` need all three parts or they fall through;
- a drift guard that reads the numbered list out of each place it is written — `mcp-min/auth.js`, `docs/MCP_TOOLS.md`, `CLAUDE.md` — maps each line to a resolution source and compares it with the order the tests just observed. The same mistake lived in two files at once, so a test of behaviour alone would not have caught it, and correcting one copy has already failed to correct the others.

Verified by mutation: 12 mutants, all killed — the JSDoc reordered, the JSDoc missing a step, each document reordered or truncated, and six behavioural mutants (MPKIT_* checked first, no "not found" error, explicit params losing, partial credentials accepted, the last `.pos` entry used instead of the first).

**Checking the documentation against the running code turned up a real defect**, filed and fixed as TASK-19: `resolveAuth` resolved a named environment through the CLI's `fetchSettings`, which answers from `MPKIT_*` first — so a named environment was ignored whenever those variables were set, and the answer still reported the name it was given. That is what "fix the comment" turned out to mean.

One doc edit was made for the guard's sake as well as the reader's: the docs' third step is now headed "`MPKIT_*` Environment Variables" rather than "Environment Variables", so a skimming reader sees which variables and each step is identifiable by the word that distinguishes it.
<!-- SECTION:FINAL_SUMMARY:END -->
