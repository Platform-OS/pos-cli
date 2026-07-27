---
id: TASK-1.25
title: >-
  Set up ESLint + typescript-eslint (checkJs) repo-wide to catch missing await /
  floating promises
status: To Do
assignee: []
created_date: '2026-07-24 10:32'
labels: []
dependencies: []
references:
  - lib/dns/cliHelpers.js
  - lib/dns/auth.js
  - lib/dns/export.js
  - lib/logger.js
parent_task_id: TASK-1
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
While fixing code-review findings on the dns command group, several `logger.Error/Warn/Info(...)` calls were found missing `await` (lib/dns/cliHelpers.js, lib/dns/auth.js, lib/dns/export.js) — logger's methods are all async, and skipping `await` risks lost output ordering or a `logger.Error({exit:true})` call's `process.exit(1)` firing later than expected relative to surrounding code.

This repo currently has **no ESLint setup at all** — no config file, no `eslint` devDependency (`npx eslint` only works by fetching a throwaway copy). A CLAUDE.md note documenting "always await logger calls" would not actually catch regressions automatically — it only works if a future session rereads and applies it, which is exactly the gap that caused the original miss. Real automatic enforcement needs a linter.

There is no plain-ESLint core rule for "floating promise" detection — it requires type information. The standard approach for a JS (non-TS) codebase is `typescript-eslint` configured with `allowJs`/`checkJs` in a `tsconfig.json` (no compilation, purely for type-aware linting), enabling `@typescript-eslint/no-floating-promises` (and likely `@typescript-eslint/no-misused-promises`). This catches ANY unawaited call to a function that returns a promise — not just `logger.*` — repo-wide.

The user explicitly chose the **full repo-wide** option over scoping to just `lib/dns/**`. Repo-wide is expected to surface many pre-existing violations: a repo-wide grep during this investigation found only ~110 of 292 `logger.*` calls are currently awaited (~38%), and there are likely other unawaited async calls beyond `logger` (fs/promises, network calls, etc.) once the type-aware rule runs.

Packages were test-installed and then fully reverted per user instruction (do not install anything until this task is picked up): `eslint`, `typescript-eslint`, `typescript` as devDependencies, plus a draft `tsconfig.json` with `allowJs`/`checkJs`/`noEmit`/`strict: false` scoped to `bin/**`, `lib/**`, `mcp-min/**`, `scripts/**` (excluding `gui/**` prebuilt bundles, `test/**`, `node_modules`, `coverage/**`, `examples/**`). That config shape is a reasonable starting point but wasn't validated against the full codebase.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 eslint, typescript-eslint, and typescript are added as devDependencies and an eslint.config.js (flat config) + tsconfig.json (allowJs/checkJs/noEmit, strict disabled to avoid unrelated type-error noise) are committed
- [ ] #2 @typescript-eslint/no-floating-promises (and no-misused-promises) is enabled and runs successfully via a new `npm run lint` script across bin/, lib/, mcp-min/, and scripts/
- [ ] #3 Every violation surfaced by the initial repo-wide run is triaged: genuine missing-await bugs are fixed, and any call sites that are intentionally fire-and-forget are given a narrow, commented eslint-disable (not a blanket rule-level disable)
- [ ] #4 CI (or at least a documented local command) runs the new lint script so future PRs get automatic feedback on missing await
- [ ] #5 CLAUDE.md is updated with a short note on the new lint command and the always-await-promise-returning-calls convention it now enforces
<!-- AC:END -->
