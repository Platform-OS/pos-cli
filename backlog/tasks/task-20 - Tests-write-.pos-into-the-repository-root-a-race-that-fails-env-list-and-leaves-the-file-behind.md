---
id: TASK-20
title: >-
  Tests write .pos into the repository root: a race that fails env list, and
  leaves the file behind
status: Done
assignee: []
created_date: '2026-09-17 20:41'
updated_date: '2026-09-17 20:50'
labels:
  - tests
  - mcp
dependencies: []
references:
  - test/utils/fixtures.js
  - mcp-min/__tests__/http.test.js
  - mcp-min/__tests__/sse.test.js
  - test/unit/lib/commands.test.js
  - vitest.config.js
priority: medium
ordinal: 47000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Pre-existing on `master`; reproduced on this branch 3/3 (2026-09-17).

`test/utils/fixtures.js` writes `path.resolve('.pos')` — the repository root, since that is the vitest process's cwd. `mcp-min/__tests__/http.test.js` and `sse.test.js` both call it in `beforeAll` so that `envs-list` has something to list.

`test/unit/lib/commands.test.js > should run env list` spawns the real CLI with no `cwd`, so it also runs in the repository root, and asserts `No environments registered yet, please see pos-cli env add` — true only when no `.pos` is there. `vitest.config.js` runs files in parallel (`pool: 'forks'`, `fileParallelism: true`), so the assertion depends on which files happen to overlap.

**The cleanup makes it permanent.** `fixtures.js` saves the previous contents in a module-level variable and restores them in `removeDotPos`, which assumes it is the only writer. Each test file is its own process, so:

| | http.test.js | sse.test.js |
|---|---|---|
| beforeAll | no file → `originalDotPos = null`, writes | file exists → `originalDotPos = "{staging…}"`, writes |
| afterAll | null → unlinks | non-null → **writes it back** |

The file is resurrected after both finish. Observed: after the reproduction run a `.pos` was left in the repository root, and `commands.test.js` then failed **on its own**, with no MCP tests in the run. `.pos` is gitignored, so `git status` does not show it and it poisons every later run until someone notices.

A developer who keeps a real `.pos` in the repository root loses it to the same interleaving: their credentials are replaced by `{"staging": {"url": "https://staging.example.com"}}`.

Fix: no test writes a config into the repository root. The MCP tests get a temp directory and point `CONFIG_FILE_PATH` at a file inside it (`files.getConfig()` already honours it, absolute path first). `commands.test.js` runs the CLI in a temp cwd — every case there asserts a usage or "no environment" message, so a bare directory is what they all actually mean. `test/utils/fixtures.js` goes: a helper whose contract is "assumes it is the only writer" cannot be used safely from a parallel suite.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 No test writes .pos, or any other config, into the repository root; the MCP HTTP/SSE tests use CONFIG_FILE_PATH pointed at a temp directory
- [x] #2 test/unit/lib/commands.test.js runs the CLI in a temp working directory, and asserts that directory holds no .pos
- [x] #3 Running the three files together passes repeatedly, and leaves no .pos behind
- [x] #4 test/utils/fixtures.js is deleted and has no remaining callers
- [x] #5 A test fails if a test file starts writing a config into the repository root again
<!-- AC:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
No test writes a configuration into the repository root any more.

- `mcp-min/__tests__/http.test.js` and `sse.test.js` take a `.pos` of their own through a new helper, `mcp-min/__tests__/helpers/dot-pos.js`: a temp directory, `CONFIG_FILE_PATH` pointed at the file inside it, and a `cleanup()` that restores the variable and removes the directory.
- `test/unit/lib/commands.test.js` runs the CLI in a temp working directory. Every case there asserts what the CLI says when it has not been told enough — a usage error, or "No environment specified" — which is only true in a bare directory, so this is what they all already meant. `CONFIG_FILE_PATH` is dropped from their environment alongside `MPKIT_*`, for the same reason.
- `test/utils/fixtures.js` is deleted. Its save-and-restore kept "the previous contents" in a module-level variable, which cannot work across processes: the second file restored the first file's `.pos` after both had finished, which is why a `.pos` was left in the tree and `commands.test.js` then failed *on its own*, with no MCP tests in the run.
- `mcp-min/__tests__/list-envs.test.js` was doing the same thing under a different name (`.pos.test-5920`) and now uses a temp directory too — as do the two `.pos` files my own TASK-10 tests had started writing there.

**The guard**: `test/unit/test-isolation.test.js` scans every file under `test/` and `mcp-min/__tests__/` for a config written to the working directory (`path.resolve('.pos')`, `writeFileSync('.pos', …)`, `join(process.cwd(), …)`), asserts the deleted fixture helper has not come back, and fails if a `.pos` is sitting in the repository root — which is gitignored, so nothing else would show it.

Verified: the previously racing files run together three times, all 40 tests passing, leaving the tree clean; before the fix the same command failed 3/3. Mutation-tested: a test writing `.pos` into the root again, the CLI losing its temp `cwd`, a working directory that is not actually empty, and the fixture helper restored — all killed. The `cwd` mutant needed a better test than "it passes": `commands.test.js` now writes a `.pos` into a second temp directory and asserts `env list` prints that environment, so the working directory is proven rather than assumed.

Found while widening the docs guard for this: `TOOLS.md` and `DEPLOY.md`, two more documents from #689 describing the server that was never built (port 3030, `clients.json`, an `ADMIN_API_KEY` behind nginx, eleven tools under names nothing registers), and `CONTRIBUTING.md`'s instructions to create `src/tools/new.tools.ts` with Zod schemas under TypeScript strict. Both files deleted, CONTRIBUTING's MCP, code-standard and testing sections rewritten against the repository as it is, and `docs-tool-names.test.js` now sweeps every Markdown file in the root and `docs/` rather than four named ones — which is how `TOOLS.md` survived the sweep that deleted the four documents pointing at it.
<!-- SECTION:FINAL_SUMMARY:END -->
