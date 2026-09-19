---
id: TASK-30
title: 'MCP: an expired token tells the agent nothing it can act on'
status: To Do
assignee: []
created_date: '2026-09-18 22:45'
labels:
  - mcp
  - agent-facing
dependencies: []
references:
  - mcp-min/run-tool.js
  - mcp-min/auth.js
  - mcp-min/instructions.js
  - bin/pos-cli-env-refresh-token.js
priority: medium
ordinal: 62000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
When an instance token expires, every authenticating tool starts failing with `kind: "auth"`. The
agent cannot fix it: `pos-cli env refresh-token` prompts for a password and a two-factor code, so
TASK-24 decided it must never be an MCP tool. That decision is right, and it leaves a gap — the
agent is told "Unauthorized" and has no idea that the remedy exists or who can run it.

The CLI already knows how to say this. `SwaggerProxy.client` answers a 401 with "To refresh your
token, execute the following command: pos-cli env refresh-token <environment>". Nothing on the MCP
path does.

An agent that is told the exact command can relay it to the person in one sentence instead of
retrying, guessing at credentials, or reporting the instance as broken.

Care is needed not to make this worse than the problem:

- The advice belongs to an expired or rejected *stored* credential, not to explicit `url`/`email`/
  `token` parameters the caller supplied — refreshing a `.pos` entry would not help there.
- It has to name the environment that actually failed, which `meta.auth` already carries.
- It must not become prose on every error. One field an agent can read, or one sentence on the
  `auth` kind only.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 A tool call that fails because a stored credential was rejected tells the caller that `pos-cli env refresh-token <env>` is the remedy, naming the environment that failed
- [ ] #2 The advice appears only for a rejected stored credential, never when the caller passed url/email/token explicitly, and a test covers both
- [ ] #3 It is carried in a field an agent can act on rather than only in prose, and the shape is the same one every error uses
- [ ] #4 No other error kind gains remedy text as a side effect
- [ ] #5 The server instructions say who can refresh a token, since the agent cannot, without restating it per tool
<!-- AC:END -->
