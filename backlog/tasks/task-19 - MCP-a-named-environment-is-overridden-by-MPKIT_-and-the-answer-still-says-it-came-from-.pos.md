---
id: TASK-19
title: >-
  MCP: a named environment is overridden by MPKIT_*, and the answer still says
  it came from .pos
status: Done
assignee: []
created_date: '2026-09-17 20:27'
updated_date: '2026-09-17 20:36'
labels:
  - bug
  - mcp
  - security
dependencies: []
references:
  - mcp-min/auth.js
  - lib/settings.js
  - mcp-min/__tests__/auth.env-resolve.test.js
priority: high
ordinal: 46000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Found while fixing TASK-10 (the JSDoc that documented the wrong precedence). The comment said the order was wrong; checking against the running code showed the *code* is wrong too, in a way the comment hid.

`resolveAuth` step 2 calls `fetchSettings(params.env, { exit: false })`, and `fetchSettings` is `settingsFromEnv() || settingsFromDotPos(environment)` (`lib/settings.js:54`) — so `MPKIT_*` is consulted **before** the named environment, inside the step that is supposed to resolve the name.

Reproduced on this branch (2026-09-17) in a directory with a `.pos` holding `staging` and `production`, with `MPKIT_URL/EMAIL/TOKEN` pointing at a third instance:

```
resolveAuth({ env: 'production' })  → { url: 'https://mpkit.example.com', …, source: '.pos(production)' }
resolveAuth({ env: 'nonexistent' }) → { url: 'https://mpkit.example.com', …, source: '.pos(nonexistent)' }
```

Two defects in one:
1. **The named environment is ignored.** An agent told to deploy to `production` deploys wherever `MPKIT_*` points. The write tools are all on this path: `deploy-start`, `data-import`, `data-clean`, `constants-set`, `uploads-push`, `sync-file`.
2. **The answer misreports where it went.** `source` is built from `params.env` regardless of what was resolved, and every tool echoes it in `meta.auth`, so the result claims the instance the caller asked for. `env: 'nonexistent'` does not even raise the "Environment not found" error the code has for it.

Who hits it: anyone with `MPKIT_*` exported — a shell used for CLI work, a CI runner, an editor that inherits the shell environment — which is the same population that has several `.pos` environments.

`mcp-min/auth.js`'s own inline comment already states the intended rule ("When an env name is given we resolve it directly without falling back to MPKIT_* — the caller is being explicit"); the implementation does not honour it.

**The CLI is a different case and must not change.** `pos-cli deploy staging` with `MPKIT_*` set has always used `MPKIT_*`, and CI depends on it. The fix belongs in `mcp-min/auth.js`: resolve the named environment from `.pos` directly.

While there: `settingsFromDotPos` is `files.getConfig()[env]`, a plain property read, so an env name of `constructor` or `__proto__` returns something from `Object.prototype` rather than nothing. In mcp-min that name comes from a model.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 With MPKIT_* set, resolveAuth({ env: name }) resolves the named .pos environment, not MPKIT_*
- [x] #2 With MPKIT_* set, an env name that is not in .pos throws "Environment '<name>' not found" rather than resolving to anything
- [x] #3 meta.auth.source names the environment that was actually used, and a test asserts the url matches that source
- [x] #4 An env name inherited from Object.prototype (constructor, __proto__, toString) resolves nothing and throws, on both the mcp-min path and settingsFromDotPos
- [x] #5 The CLI path is unchanged: fetchSettings still prefers MPKIT_* over .pos, pinned by a test
- [x] #6 CHANGELOG records the behaviour change, and CLAUDE.md notes that the two resolvers deliberately differ
<!-- AC:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
`resolveAuth` now resolves a named environment with `settingsFromDotPos(params.env)` — `.pos` and nowhere else — instead of the CLI's `fetchSettings`, which answers from `MPKIT_*` first. An environment that is not in `.pos` raises the "not found" error the code already had and could never reach, and `source` now names the environment whose credentials were actually used, which is what every tool echoes in `meta.auth`.

Reproduced before and after, with `.pos` holding `staging` and `production` and `MPKIT_*` pointing at a third instance:

```
before: { env: 'production' }  → https://mpkit.example.com,  source ".pos(production)"
        { env: 'nonexistent' } → https://mpkit.example.com,  source ".pos(nonexistent)"
after:  { env: 'production' }  → https://production.example.com, source ".pos(production)"
        { env: 'nonexistent' } → Error: Environment 'nonexistent' not found in .pos config
        { }                    → https://mpkit.example.com,  source "env"   (unchanged)
```

**The CLI is untouched and pinned.** `fetchSettings` still prefers `MPKIT_*`, because CI exports those variables and names an environment on the command line; a test asserts that order alongside the MCP one, and a mutant that "aligns" the two is killed. CLAUDE.md now says the difference is deliberate and why, so the next reader does not tidy it away.

**Hardened while there**: `settingsFromDotPos` was `files.getConfig()[env]`, so an environment named `constructor` or `toString` resolved to something off `Object.prototype`. It now checks own properties — one change serving both resolvers, since the CLI takes that name from an argument and the MCP server takes it from a model. An environment genuinely named `toString` still resolves, which a test pins so the guard cannot be tightened into a refusal.

**Tests** (`mcp-min/__tests__/auth.env-resolve.test.js`): the named-environment cases run against the real `lib/settings.js` and a real `.pos`, with `MPKIT_*` set, because the injected seam is exactly what hid this — the stub answered as the documentation claimed while the real resolver did something else. Plus the prototype names, the label-matches-the-url assertion, and the CLI contrast. `test/unit/settings.test.js` covers the own-property rule at the source.

**Mutation-tested: 6 mutants, all killed** — the named environment routed back through `fetchSettings`, the "not found" error removed, the source label hard-coded, the prototype guard removed, the guard made over-strict, and the CLI's order flipped.

Seam change: `ctx.settings.fetchSettings` is now `ctx.settings.settingsFromDotPos`. Seven test files stubbed the old name; each was renamed rather than given both, so no stub keeps a function nothing calls.
<!-- SECTION:FINAL_SUMMARY:END -->
