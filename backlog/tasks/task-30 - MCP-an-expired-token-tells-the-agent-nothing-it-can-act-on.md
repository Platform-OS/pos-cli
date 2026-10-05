---
id: TASK-30
title: 'MCP: an expired token tells the agent nothing it can act on'
status: Done
assignee: []
created_date: '2026-09-18 22:45'
updated_date: '2026-09-21 16:51'
labels:
  - mcp
  - agent-facing
dependencies: []
references:
  - mcp-min/run-tool.js
  - mcp-min/auth.js
  - mcp-min/instructions.js
  - bin/pos-cli-env-refresh-token.js
modified_files:
  - mcp-min/auth.js
  - mcp-min/run-tool.js
  - mcp-min/instructions.js
  - mcp-min/__tests__/tool-envelope.test.js
  - mcp-min/__tests__/instructions.test.js
  - CLAUDE.md
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
- [x] #1 A tool call that fails because a stored credential was rejected tells the caller that `pos-cli env refresh-token <env>` is the remedy, naming the environment that failed
- [x] #2 The advice appears only for a rejected stored credential, never when the caller passed url/email/token explicitly, and a test covers both
- [x] #3 It is carried in a field an agent can act on rather than only in prose, and the shape is the same one every error uses
- [x] #4 No other error kind gains remedy text as a side effect
- [x] #5 The server instructions say who can refresh a token, since the agent cannot, without restating it per tool
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
## The shape

`refreshTokenRemedy(auth)` in `mcp-min/auth.js`, next to the resolver whose `source` it reads, so
the `.pos(<name>)` format and its one parser sit together. `runTool` attaches what it returns:

```json
"details": {
  "statusCode": 401,
  "body": "HTTP Token: Access denied.\n",
  "remedy": {
    "command": "pos-cli env refresh-token verification",
    "runBy": "a person at a terminal: it asks for a password and a second factor"
  }
}
```

`details` rather than a new top-level field (AC #3): it is already where every error puts what the
caller needs in order to act, and it *joins* what the instance said rather than replacing it.

`runBy` is not decoration. Without it the obvious next move for an agent holding a shell is to run
the command itself and hang on the password prompt — which is the same reason TASK-24 kept
`refresh-token` out of the tool registry in the first place.

## Where it is not attached, and why

- **Explicit `url`/`email`/`token`** — the caller supplied them; refreshing a `.pos` entry would not
  touch them.
- **`MPKIT_*`** — the environment the server was started in, which the command does not write
  either. Both are excluded by `source` not matching `.pos(...)`, not by a second list.
- **`AUTH_MISSING`** — `kind: auth`, but nothing resolved, so there is no environment to name.
  `resolveAuth` records `ctx.resolvedAuth` only after it succeeds, so this falls out for free.
- **Every other kind** (AC #4) — one `error.kind !== 'auth'` check. This matters more than it
  looks: `lib/utils/partnerPortal.js` exists because an instance whose Partner Portal is down
  cannot judge a token at all, and telling someone to refresh a working credential over that costs
  them a good one and stops being reproducible a minute later. Such an instance answers **503**, so
  it lands on `unavailable` and never reaches this.
- **The Partner Portal tools** (`mcp-min/portal/*`) do not call `resolveAuth` at all, so they
  cannot pick this up.

Residual, and matching what the CLI already does: `partnerPortal.js` says instances answer 503
"now", which implies an older one may still answer 401 for the same outage. `lib/ServerError.js`
gives the refresh advice on a 401 too, so this is no worse than the CLI and no better.

## Instructions (AC #5)

One clause added to the Credentials section, which is already gated on an exposed tool having
`env`: *"A rejected stored token needs a person to run pos-cli env refresh-token; no tool here can,
and the error names the command."* Who and why live here; the command with the environment filled in
lives on the error. Neither restates the other.

**The instructions budget went from 1200 to 1400.** The first phrasing took `full` to 1280 and
failed the test; trimmed, it fits at 1186 — fourteen bytes of headroom, which is a test that fails
on a reworded clause rather than on the growth it exists to catch, and teaches the next person to
raise the number without thinking. 1400 still refuses a paragraph. The reason is recorded at the
constant.

## Tested

10 tests in `tool-envelope.test.js`, driven through `runTool` with a tool that calls the real
`resolveAuth` and is then refused, so the `source` is produced rather than asserted. Three bite
checks, both files restored against their sha256:

- attached to every kind → 7 fail (the parametrised AC #4 guard)
- given for any credential source → 3 fail (explicit, `MPKIT_*`, and nothing resolved)
- never attached → 2 fail

mcp-min: 1375 passing across 59 files.

## On the wire

A `.pos` in a temp directory pointing at the live instance with a token it rejects, through
`graphql-exec`: real `401`, `kind: auth`, `code: UNAUTHORIZED`, and the remedy naming
`pos-cli env refresh-token verification` alongside the instance's own
`"HTTP Token: Access denied."`.
<!-- SECTION:NOTES:END -->
