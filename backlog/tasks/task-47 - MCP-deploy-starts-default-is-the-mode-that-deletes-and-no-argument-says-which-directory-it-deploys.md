---
id: TASK-47
title: >-
  MCP: deploy-start's default is the mode that deletes, and no argument says
  which directory it deploys
status: To Do
assignee: []
created_date: '2026-09-22 06:45'
labels:
  - mcp
  - agent-facing
  - deploy
dependencies: []
references:
  - mcp-min/deploy/start.js
  - mcp-min/deploy/dry-run.js
  - mcp-min/check/run.js
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
- [ ] #1 A decision is recorded, in code, on whether a deploy with no arguments should be the mode that deletes
- [ ] #2 An agent can tell which directory deploy-start and deploy-dry-run will deploy, from the tool's own schema or result
- [ ] #3 If appPath is added, it resolves the same way check-run's does and the two agree
- [ ] #4 Whatever changes, deploy-dry-run and deploy-start still take the same arguments and mean the same thing by them
- [ ] #5 Tests cover a deploy with no arguments at all, asserting the decided behaviour
<!-- AC:END -->
