---
id: TASK-47
title: >-
  MCP: deploy-start's default is the mode that deletes, and no argument says
  which directory it deploys
status: Done
assignee: []
created_date: '2026-09-22 06:45'
updated_date: '2026-09-23 18:04'
labels:
  - mcp
  - agent-facing
  - deploy
dependencies: []
references:
  - mcp-min/deploy/start.js
  - mcp-min/deploy/dry-run.js
  - mcp-min/check/run.js
modified_files:
  - mcp-min/deploy/start.js
  - mcp-min/deploy/dry-run.js
  - mcp-min/__tests__/deploy.start-job.test.js
  - mcp-min/__tests__/deploy.dry-run.test.js
  - docs/MCP_TOOLS.md
  - CHANGELOG.md
priority: medium
ordinal: 87000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Two design questions raised by the agent-perspective evaluation (2026-09-21), neither of which is a bug — which is why they are a decision rather than a fix.

**1. `partial` defaults to `false`, and `false` is the mode that deletes.**

The evaluator's complaint was aimed at the `env` guard (handled: the instructions now say the refusal is conditional on `.pos` holding more than one environment). But underneath it is a sharper point it only half made: a `deploy-start` call with **no arguments at all** is a full non-partial deploy, which removes every file on the instance that is missing from the local build.

That matches `pos-cli deploy`, which is the argument for keeping it. Against it: the CLI is run by a person who chose the directory they are standing in, and this is called by an agent that may not have built the project, cannot list what is on the instance (TASK-44), and reaches the destructive mode by omission rather than by choice.

Options, none free: default `partial` to `true`; require `partial` explicitly; keep the default and lean on `deploy-dry-run`, which now reports the delete list properly and refuses to be reached by a flag. Whatever is chosen, the reasoning belongs in the code, because the next reader will ask.

**2. Neither deploy tool takes `appPath`, and `check-run` does.**

So the deploy tools operate on the server's working directory, which is not visible from the schema. The evaluator only confirmed it matched its own directory because `check-run` echoes a resolved absolute `appPath` — an accident of a different tool.

For an operation that deletes by default, *"which directory am I deploying?"* should be answerable from the call itself, not inferred from a neighbour.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 A decision is recorded, in code, on whether a deploy with no arguments should be the mode that deletes
- [x] #2 An agent can tell which directory deploy-start and deploy-dry-run will deploy, from the tool's own schema or result
- [ ] #3 If appPath is added, it resolves the same way check-run's does and the two agree
- [x] #4 Whatever changes, deploy-dry-run and deploy-start still take the same arguments and mean the same thing by them
- [x] #5 Tests cover a deploy with no arguments at all, asserting the decided behaviour
<!-- AC:END -->



## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Both questions decided. **Part 1: the default stays. Part 2: both deploy tools now report the directory, and still do not accept one.**

## The evidence the decision was made on

Demonstrated against a live instance (fk-block) rather than argued. Deployed project A (two pages), then made the default call an agent would make from an unrelated project B — `{ env: 'block' }`, nothing else:

```
partial   = false | verdict = would_succeed
upserted  = {"count":1,"files":["views/pages/beta.liquid"]}
DELETED   = {"count":2,"files":["views/pages/alpha-two.liquid","views/pages/alpha.liquid"]}
archive   = {"fileCount":1}
keys      = applied, releaseId, partial, verdict, discarded, deleted,
            upserted, skipped, byCategory, assets, archive
```

Three things this settles:

- **`verdict: would_succeed`.** There is no error to catch; the instance is content to lose two thirds of its content.
- **No key named a directory.** `archive: { fileCount: 1 }` — one file, from nowhere in particular.
- **`EMPTY_ARCHIVE` did not fire.** That guard only catches a directory with nothing deployable in it; project B had one file, which is enough to pass it. The guard covers the case that is easy to notice anyway.

**The existing mitigation is real and worth stating:** `deleted.files` names the files, so an attentive caller would see unfamiliar paths. The dry run does its job. What was missing is the other half — which project the list is *for*.

## Part 1 — `partial` stays `false`, with the reasoning recorded

Changing it was rejected on two grounds. `false` is what `pos-cli deploy` does, so a deploy means the same thing on both surfaces; and defaulting to `partial` would leave stale files on the instance silently, which is a different wrong answer, not a safer one. Requiring it explicitly would break every existing caller to restate what `deploy-dry-run` already tells them.

The reasoning now sits beside the default in `start.js` rather than in this task, because the next reader will ask there.

## Part 2 — report the directory; do not accept one

Both tools return `appPath`, the resolved absolute directory they archived — the same field name and meaning `check-run` already publishes, which is what makes the two comparable. That closes the asymmetry the task describes: the one tool that changes nothing could say where it looked, and the two that delete could not.

**Accepting `appPath` was deliberately not done.** It is not a parameter, it is a refactor: `dir.available()` is `fs.existsSync('app')` and `lib/archive.js` globs with relative `cwd`s, so a root would have to be threaded through `lib/directories.js`, `lib/archive.js`, `lib/files.js` and `lib/assets.js` — all shared with the CLI. `process.chdir()` is not an alternative: this server answers concurrently, and process-wide state changed under a running deploy is exactly the defect CLAUDE.md records for `runWithAuth` setting `MARKETPLACE_*`. Filed as a follow-up rather than smuggled into a safety fix.

Reporting alone answers the question the task actually asks — *"which directory am I deploying?" should be answerable from the call itself* — and if the answer is the wrong project, the fix is to start the server elsewhere, which is a person's action either way.

## Verified live, after the change

The same scenario now answers `appPath = …/projB` beside a delete list naming projA's files, so the mismatch is visible in one result. `deploy-start` reports it too (`keys = id, appPath, job_id, status, archive, assets, params`).

## Testing

Four new tests across `deploy.start-job.test.js` and `deploy.dry-run.test.js`. Bite-checked, all three caught:

| Breakage | Failed |
| --- | --- |
| `deploy-start` stops naming the project | 1 |
| `deploy-dry-run` stops naming the project | 1 |
| `partial` silently defaults to `true` | 1 |

Files restored and sha256-verified. No tool description changed, so `tools/list` is unmoved and the byte ledger needed no entry.

Full `mcp-min` suite: 1592 passing, 2 failing — `tools-config-validation.test.js` and one `http-mcp-endpoint.test.js` case, both timeouts under parallel load. Both were confirmed to fail on a **stashed clean tree** as well and to pass in isolation, so neither is from this work.

## Cleanup

The demo deployed two pages to fk-block; both were deleted afterwards and the instance is back to `total_entries: 0`. The throwaway project directories were removed.
<!-- SECTION:FINAL_SUMMARY:END -->
