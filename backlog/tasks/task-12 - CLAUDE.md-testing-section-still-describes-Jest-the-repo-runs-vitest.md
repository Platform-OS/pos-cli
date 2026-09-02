---
id: TASK-12
title: CLAUDE.md testing section still describes Jest; the repo runs vitest
status: To Do
assignee: []
created_date: '2026-09-02 10:24'
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
ordinal: 27000
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
- [ ] #1 The CLAUDE.md testing sections name vitest and the actual script names
- [ ] #2 The test:unit / test:integration / test:mcp-min split is documented, including which of them need MPKIT_* credentials
- [ ] #3 The pretest yeoman-fixture install is documented, with the failure it causes when skipped
- [ ] #4 No reference to Jest or --runInBand remains in CLAUDE.md
<!-- AC:END -->
