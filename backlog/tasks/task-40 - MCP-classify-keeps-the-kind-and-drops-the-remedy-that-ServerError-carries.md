---
id: TASK-40
title: 'MCP: classify keeps the kind and drops the remedy that ServerError carries'
status: Done
assignee: []
created_date: '2026-09-22 06:43'
updated_date: '2026-09-22 07:55'
labels:
  - mcp
  - agent-facing
  - errors
dependencies: []
references:
  - lib/ServerError.js
  - mcp-min/tool-error.js
  - mcp-min/auth.js
  - mcp-min/instructions.js
modified_files:
  - mcp-min/tool-error.js
  - mcp-min/auth.js
  - mcp-min/instructions.js
  - mcp-min/__tests__/error-advice.test.js
  - mcp-min/__tests__/instructions.test.js
  - mcp-min/__tests__/auth.env-resolve.test.js
  - mcp-min/__tests__/job-status.test.js
  - mcp-min/__tests__/uploads.push.test.js
  - CLAUDE.md
  - CHANGELOG.md
  - docs/MCP_TOOLS.md
priority: high
ordinal: 80000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Found by comparing the CLI and the MCP path after an agent-perspective evaluation (2026-09-21) and a report from the field: `pos-cli tests run` prints *"Tests module not found. Please install the tests module: pos-cli modules install tests"*, while the MCP tool answered a bare 404.

That one is fixed (`mcp-min/tests/module-check.js`), and it is an instance of a general pattern.

**The CLI routes every API failure through `lib/ServerError.js`.** It has a handler per status, and each one carries a remedy or at least tells the operator not to bother reporting it. The MCP server deliberately replaced that with `classify` (`tool-error.js`) — necessarily, since `ServerError` prints and calls `process.exit`. But `classify` kept the *kind* and dropped the *advice*.

What `ServerError` says that the MCP path does not:

| case | the CLI says | MCP answers |
|---|---|---|
| 413 | "Archive you are trying to send is too large. Limit is 50MB." | bare `instance` + status |
| 503 `partner_portal_unavailable` | "This Instance could not reach the Partner Portal to verify your API token", with a clamped Retry-After, and that nothing is wrong with the token | generic `unavailable` (except in `job-status`, wired for TASK-39) |
| `ENOTFOUND` / `ECONNREFUSED` | distinguishes them, names the host | `unavailable`, one message for all |
| 502 / 504 / 500 | "We have been notified about it" — worth knowing, it stops an agent reporting it | bare kind |
| unknown env | `lib/settings.js`: "please see pos-cli env add" | `ENV_NOT_FOUND` with no next step |

TASK-30 established the shape for this — `details.remedy = { command, runBy }` — and the tests-module fix reuses it, so the pattern is set and the work is to apply it.

Two smaller findings from the same evaluation belong here, because they are the same surface:

- **`ENV_NOT_FOUND` does not list the environments** although `resolveAuth` has them in hand. It costs the agent an extra `envs-list` round trip, and `ENV_REQUIRED` already lists them.
- **`kind: "project"` is not in the documented taxonomy.** The instructions enumerate `input`, `not_found`, `auth`, `instance`, `unavailable` and promise "the kind says what to do next"; the evaluator's second call returned `kind: "project"`, `code: NO_DIRECTORIES`. Either document it or fold it into `input`. `ERROR_KINDS` has eight members and the instructions list five.

Do not port `ServerError`'s exit/print behaviour, and do not make every error grow prose: the remedy is a field, only where there is one to name.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 A 413, a Partner Portal outage and a DNS/connection failure each carry what the CLI tells an operator, in details.remedy where there is a command and in the message otherwise
- [x] #2 ENV_NOT_FOUND lists the environments that are configured, as ENV_REQUIRED already does
- [x] #3 Every kind ERROR_KINDS defines is either named in the server instructions or removed from the set
- [x] #4 No error kind gains prose it has no remedy for, and the instructions do not grow a per-status list
- [x] #5 Tests drive each case through runTool and assert the field, not the wording
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
The advice lives with the classification, in `classify` (`tool-error.js`), because that is the
only thing that reads a failure nobody classified — the same argument that put `kindForStatus`
there and body-bounding in `toResult`. Three shapes, none of them a general per-status vocabulary:

- `STATUS_ADVICE`, a `Map` (not an object: a status arriving as a string must not reach
  `Object.prototype` and turn a refusal into `undefined` advice) holding 413 — which also gets its
  own code, `PAYLOAD_TOO_LARGE` — and 500/502/504's "already notified". Nothing else. A status
  pos-cli knows nothing extra about keeps the bare message.
- The Partner Portal 503, told apart by `isPartnerPortalUnavailable` before `kindForStatus` runs:
  `PARTNER_PORTAL_UNAVAILABLE`, the instance's own reason passed through, `details.retryAfterSeconds`
  clamped by `lib/utils/partnerPortal.js`, and the sentence that the token is not the problem.
- A connection failure, which gains `details.host`. This is the real gap: `apiRequest` wraps the
  fetch error and its message is `fetch failed`, three words naming neither host nor cause. Origin
  only, so a query string a tool built cannot ride into the model's context. `networkCode` became
  `fromCauses(err, field)` so the same walk finds `hostname`. Verified against real Node 22 fetch
  failures, not just fakes: ENOTFOUND and ECONNREFUSED both arrive one `cause` level down, and
  `options.uri` is on the RequestError.

Nothing is added where there is nothing to add — no host found means the message is untouched,
which is what keeps `job-status`'s `fetch failed` assertions honest and stops prose that only
restates the code.

`ENV_NOT_FOUND` lists the configured names in the message and in `details.environments`. The
`pos-cli env add` remedy only when `.pos` holds nothing to choose between: with names present the
list *is* the fix, and a remedy on every mistyped env is how a field an agent should act on becomes
one it skips. `--url` is required and unknowable here, so it stays a placeholder and `runBy` says a
person finishes it. Reading `.pos` to list it is wrapped, since a second failure on the error path
would replace a name the caller can act on with one they cannot.

The instructions name all eight kinds. Not generated from `ERROR_KINDS` — those strings document
the table for a developer, and saying them verbatim costs ~200 bytes of every session — so
`instructions.test.js` derives the *required set* from the table instead and fails on a kind that
is not described. The refresh-token sentence was replaced by one general `details.remedy` rule
covering the three producers and the next one; net −32 bytes, and full landed at 1346 against the
1400 budget rather than needing it raised.

`error-advice.test.js` finds every `command:` in `mcp-min/` by walking the sources and extracting
the brace-balanced object it sits in — a fixed character window was the first attempt and did not
bite, because a remedy missing `runBy` borrowed the one from the remedy below it.

Not done, deliberately: `uploads-push` and the `/_tests/*` tools build their own errors and so do
not pick this up. For `uploads-push` that is right — its 413 would come from S3, where the 50MB
release limit is simply false. The kinds themselves are unchanged; ENOTFOUND stays `unavailable`
rather than becoming `input`, since the URL usually comes from `.pos` rather than from the call,
and the code plus the host now make the situation legible either way.

30 deliberate reverts, sha256-verified restore, all caught. mcp-min 1447 passing across 61 files;
test/unit 1329 with the pre-existing TASK-9 failure only.
<!-- SECTION:NOTES:END -->
