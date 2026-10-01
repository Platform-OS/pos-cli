---
id: TASK-31
title: >-
  MCP: a call that can change an instance must name it, not land on whichever
  .pos entry is first
status: Done
assignee: []
created_date: '2026-09-19 08:22'
updated_date: '2026-09-19 08:33'
labels:
  - mcp
  - security
  - safety
dependencies: []
modified_files:
  - mcp-min/auth.js
  - mcp-min/run-tool.js
  - mcp-min/schemas/auth.js
  - mcp-min/instructions.js
  - mcp-min/__tests__/env-required.test.js
  - mcp-min/__tests__/auth.env-resolve.test.js
  - mcp-min/__tests__/tool-surface.test.js
  - CLAUDE.md
  - docs/MCP_TOOLS.md
  - CHANGELOG.md
priority: high
ordinal: 63000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
`env` is optional on every authenticating tool, and it has to stay optional: `resolveAuth` (mcp-min/auth.js) supports four call styles and only one of them names an environment — explicit `url`+`email`+`token`, the named `.pos` environment, `MPKIT_*`, and finally the first entry in `.pos`. Marking `env` as `required` in the schemas would reject three of the four, break CI (which exports `MPKIT_*`) and break the explicit-credentials path that exists for reaching another instance. `CLAUDE.md` pins this and `mcp-min/__tests__/auth.env-resolve.test.js` enforces both orders with the reason.

But priority 4 is a guess. Nothing in the call named an instance, so "the first entry in `.pos`" is whichever happens to be first in a file the model never sees. For a tool that only reads, that is an inconvenience. For one that changes the instance it is the wrong instance changed, silently, with no way for the model to have known which it got — and `CLAUDE.md` already records this as a known consequence of advertising `env` as optional: "an MCP client that omits it lands on step 4 — the *first* `.pos` entry — including for mutating tools (`data-import`, `constants-set`, `uploads-push`)."

The server instructions tell the model to name `env` on anything that writes, but that is guidance in a string the client puts in a system prompt, and a model focused on a task forgets it. The fix is a guard at the resolution point, which is the only place that knows *how* the credentials were found.

**Refuse, with `ToolError.input`, when all of these hold:**

1. the tool may change the instance — `annotations.readOnlyHint !== true`, the annotation MCP already defines for exactly this, so the set is derived from the registry and a new tool inherits the rule rather than being added to a list;
2. credentials resolved through priority 4, the unnamed default — priorities 1, 2 and 3 all name an instance, explicitly or by configuration, and are untouched;
3. `.pos` holds more than one environment — with exactly one there is nothing to choose between, which keeps the solo-project flow working.

The error is `input`: the caller fixes it by adding an argument. Its message names the environments available and which one the call would have used, so a model can correct itself in one turn rather than guessing.

Scope check at the time of writing: 15 tools are guarded (liquid-exec, graphql-exec, migrations-generate, migrations-run, deploy-dry-run, deploy-start, data-import, data-export, data-clean, unit-tests-run, tests-run-async, sync-file, uploads-push, constants-set, constants-unset); 3 authenticate and only read (logs-fetch, migrations-list, constants-list); 12 never call `resolveAuth` at all. `job-status` reaches `resolveAuth` through `authForJob`, but is `readOnlyHint` and `authForJob` already resolves the same ambiguity better — by taking the environment whose origin matches the job's.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 A tool whose annotations do not say readOnlyHint, called with no env and no explicit credentials, against a .pos holding more than one environment, fails with ok:false, kind input and code ENV_REQUIRED, before any request reaches the instance
- [x] #2 The refusal names the environments in .pos and says which one the call would otherwise have used
- [x] #3 A read-only tool in the same situation still resolves to the first entry and succeeds
- [x] #4 The same tool succeeds when .pos holds exactly one environment, because there is nothing to choose between
- [x] #5 All four resolution paths still work for guarded tools: explicit url+email+token, a named env, MPKIT_* variables, and the single-environment default
- [x] #6 The guarded set is derived from the registry rather than hand-listed, and a test fails if a tool that may change an instance escapes the guard
- [x] #7 job-status is unaffected: it is read-only and authForJob resolves the job's instance by matching origin
- [x] #8 The rule is documented in CLAUDE.md beside the existing 'env must stay optional' note, and in docs/MCP_TOOLS.md
- [x] #9 Mutation-verified: removing the guard, and each of its three conditions in turn, fails a test
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Two pieces, deliberately split so no tool decides this for itself.

**`runTool` derives the policy** (`mcp-min/run-tool.js`): `mayChangeInstance: tool?.annotations?.readOnlyHint !== true`, spread onto the per-call context *after* the caller's ctx so it overrides anything passed in — which tools may land on an unnamed instance is the registry's decision, not a per-call one. Absent annotations mean "may change things", MCP's own default and the safe reading.

**`resolveAuth` enforces it** (`mcp-min/auth.js`, `requireNamedInstance`), at priority 4 only. Steps 1 to 3 each name an instance — in the arguments, in `.pos` by name, or in the environment a CI job exported — and are untouched. `resolveAuth` called directly, by `lib/` or the CLI, is unguarded: nothing outside `mcp-min` calls it (checked), and the rule is about MCP tools.

Not `required: env` in the schemas, which was the obvious-looking fix: `resolveAuth` has four call styles and only one passes `env`, so requiring it rejects explicit credentials, `MPKIT_*` in CI, and the single-environment default. The ambiguity is not "no env was passed", it is "nothing at all said which instance", and only `resolveAuth` can tell those apart.

**Scope, measured rather than assumed:** 15 tools guarded, 3 authenticate and only read (logs-fetch, migrations-list, constants-list), 12 never call `resolveAuth`. `job-status` reaches it via `authForJob` but is `readOnlyHint`, and `authForJob` already resolves the ambiguity better — by matching the job's origin.

**Verification.** `mcp-min/__tests__/env-required.test.js` (31 tests) derives the guarded set from the registry by calling each tool and seeing which resolved credentials, so a tool added later is covered without anyone remembering. It has a non-vacuity check pinning the three exempt tools by name. The five most damaging tools (`deploy-start`, `deploy-dry-run`, `data-import`, `uploads-push`, `sync-file`) are asserted individually, outside the sweep — a test must not rely on the thing it is testing to stay harmless — and no `tmp/` archive is produced, which is itself proof the guard ran before `makeArchive`. `auth.env-resolve.test.js` gained 10 tests covering the refusal, its message, one environment, read-only, and all four call styles still resolving.

**Four mutants, all killed**: guard removed entirely (19 failures), condition 1 dropped so it fires for read-only tools (9), condition 3 dropped so it fires with one environment (1), and the invoker's derivation inverted (21). Both files restored to their original sha256 afterwards.

**End-to-end over stdio**, with a real two-environment `.pos`: `constants-set` with no env → `isError: true`, `input`/`ENV_REQUIRED`, details `{environments:["prod","staging"],wouldHaveUsed:"prod"}`, before any network call; with `env=staging` it proceeds and reaches the network; `logs-fetch` with no env is never refused.

**Side effect worth having:** `env`'s shared description said "the first entry if omitted", now true only of the three read-only tools. Replaced with "Which environment in .pos to use." — the warning it used to carry is now a refusal delivered at the moment it matters. `tools/list` 17,997 → 17,727 bytes.

Full suite: 2,757 passed, 1 pre-existing failure (`test/unit/modules.test.js`, task-9).
<!-- SECTION:NOTES:END -->
