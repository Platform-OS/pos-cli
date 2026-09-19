---
id: TASK-26
title: 'MCP: expose the module lifecycle, which an agent currently cannot see at all'
status: To Do
assignee: []
created_date: '2026-09-18 17:32'
labels:
  - mcp
  - agent-facing
  - modules
dependencies: []
references:
  - bin/pos-cli-modules.js
  - lib/modules.js
  - lib/modules/staging.js
  - CLAUDE.md
priority: medium
ordinal: 56000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
`pos-cli modules` has 13 subcommands and the MCP server exposes none of them. An agent working in a platformOS project cannot list what modules are installed, read a module's version, or install a dependency — the entire dependency layer is invisible to it, while being one of the first things anyone needs to know about a project.

This is the largest single gap between the CLI and the MCP tool surface, and it is not an oversight of one command: the tools were written before this lifecycle reached its current shape (pos-module.json as the sole manifest, a resolved pos-module.lock.json with prod/dev sections and a per-module registries map, --frozen for CI).

Not all 13 belong over MCP, and this task has to choose rather than port everything — every tool costs tokens for every agent on every request. The shape of the decision:

- Reads are the obvious value and the cheapest: what is installed, at what versions, and what a given module is. An agent asked to work in an unfamiliar project needs these before anything else.
- Writes change the developer's working tree, not an instance. `install` and `update` download archives and replace directories under modules/ via staging (lib/modules/staging.js), and they rewrite pos-module.json and the lock file. That is a different kind of side effect from every tool this server has today, all of which act on a remote instance, and it deserves its own thought about annotations and about what an agent should be allowed to do unattended.
- `--frozen` exists so CI installs from the lock file without re-resolving. Whether an agent should ever resolve — or only ever install frozen — is a real question, because a resolving install can move versions the developer did not ask to move.
- Publishing (push, version, init, build) is a human release workflow with git commits and tags in it. Probably never, but say so rather than leave it unstated.
- `migrate` is a one-off conversion of legacy layouts. Probably a "later" at best.

Depends on nothing, but shares the description standard and the placement rule from TASK-23.2 — anything these tools need to say about credentials or environments belongs in the server instructions, not repeated per tool. The module commands that act purely on the working tree may need no credentials at all, which is itself worth being explicit about, since every existing tool takes them.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 An agent can discover what modules a project has installed and at what versions, without reading files itself
- [ ] #2 Each of the 13 module subcommands has a recorded decision — exposed, never, or later — with its reason
- [ ] #3 Tools that modify the developer's working tree are distinguishable from tools that act on an instance, both in their annotations and in what they say about themselves
- [ ] #4 A module tool that needs no credentials does not take them, and does not inherit the auth parameters by default
- [ ] #5 The choice about resolving versus frozen installs is made deliberately, and an agent cannot silently move a dependency version the developer pinned
- [ ] #6 Publishing commands that make git commits or tags are not exposed unless that was decided on purpose and recorded
- [ ] #7 The tools added are measured against the tools/list byte budget, and their effect on the dev profile is stated
- [ ] #8 Module tools follow the description standard from TASK-23.2, including saying when to prefer a neighbouring tool
<!-- AC:END -->
