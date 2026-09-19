---
id: TASK-12
title: CLAUDE.md testing section still describes Jest; the repo runs vitest
status: Done
assignee: []
created_date: '2026-09-02 10:24'
updated_date: '2026-09-17 18:54'
labels:
  - docs
  - tests
dependencies: []
references:
  - CLAUDE.md
  - package.json
  - vitest.config.js
  - test/global-setup.js
priority: low
ordinal: 43000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Pre-existing on `master`. Low stakes but actively misleading, since CLAUDE.md is what agents working in this repo read first.

The "Testing" and "Testing Philosophy" sections describe a Jest setup that no longer exists:

- `npm run test-watch` — the script is `test:watch` (`package.json`)
- "Tests run with `--runInBand` to prevent race conditions" — vitest is configured with `pool: 'forks'` and `fileParallelism: true` (`vitest.config.js`)
- "`npm test` — Run all tests with Jest" — `npm test` is `vitest run`
- "Fixtures are in `/test/fixtures/`" is still true, but the section omits that `pretest` installs the yeoman fixtures and that skipping it makes `test/unit/generators.test.js` fail with a confusing interactive prompt

Also unmentioned: the `test:unit` / `test:integration` / `test:mcp-min` split, and the 60% coverage thresholds in `vitest.config.js` (which cover `lib/**` and `bin/**` but not `mcp-min/**`).

The claim that tests require live credentials is only half true now — `test/unit` and `mcp-min/__tests__` run without them (`test/global-setup.js` skips cleanup when no real credentials are present); only `test/integration` needs `MPKIT_*`. Worth saying, because it tells a new contributor what they can actually run.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 The CLAUDE.md testing sections name vitest and the actual script names
- [x] #2 The test:unit / test:integration / test:mcp-min split is documented, including which of them need MPKIT_* credentials
- [x] #3 The pretest yeoman-fixture install is documented, with the failure it causes when skipped
- [x] #4 No reference to Jest or --runInBand remains in CLAUDE.md
<!-- AC:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
CLAUDE.md's "Testing" and "Testing Philosophy" sections rewritten against `vitest.config.js` and `package.json`: vitest named as the runner and the only place it collects from (`test/**`, `mcp-min/__tests__/**` — a test file anywhere else never runs), the real script names including the `test:unit` / `test:integration` / `test:mcp-min` split and which of them need `MPKIT_*`, the `pretest` yeoman-fixture install and the hang it causes when skipped, the 60% coverage thresholds over `lib/**` and `bin/**` and why `mcp-min/**` sits outside them. `--runInBand` is replaced by what vitest actually does — `pool: 'forks'` with files in parallel — and the consequence: a test that writes to the repository root can fail another suite, so use a temp directory. The only remaining mention of Jest is the line saying it is not the runner.

Found and removed while checking the claim: `mcp/` (a Jest setup file and four CommonJS test files that `require('../storage')`, `../server`, `../auth`, `../proxy-wrapper` — none of which exist) and `jest.config.mcp-min.json`, which pointed Jest at `mcp-min/**/__tests__` with a coverage threshold. Nothing ran either: vitest's `include` does not cover `mcp/`, and Jest is not a dependency, so `npx jest` would have downloaded it. The commented-out `npx jest` line in `.github/workflows/tests.yaml` is gone too. `supertest` stays — `test/unit/server.test.js` and `server.validation.test.js` use it. Recorded in the CHANGELOG under Removals.
<!-- SECTION:FINAL_SUMMARY:END -->
