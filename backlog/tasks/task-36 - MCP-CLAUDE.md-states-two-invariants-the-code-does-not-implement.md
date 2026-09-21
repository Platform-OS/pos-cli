---
id: TASK-36
title: 'MCP: CLAUDE.md states two invariants the code does not implement'
status: To Do
assignee: []
created_date: '2026-09-21 12:11'
labels:
  - mcp
  - docs
dependencies: []
references:
  - CLAUDE.md
  - mcp-min/redact.js
  - mcp-min/auth.js
  - mcp-min/run-tool.js
  - mcp-min/tools.js
  - mcp-min/__tests__/env-required.test.js
priority: medium
ordinal: 72000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
CLAUDE.md is this repository's contract document — it is what a future change gets checked against, and several of its sections exist because a rule was broken once and someone wrote down why. A claim in it that the code does not honour is worse than no claim: it makes the correct side look like the defect, and the next person "fixes" whichever one they happened to read second.

Two such claims, both found in the branch review of 2026-09-21.

**1. How a session id is redacted.**

CLAUDE.md: *"A secret (`authorization`, `cookie`, `password`, `mcp-session-id`, `device_code`…) is replaced whole: part of a password is still a leak"*.

`mcp-min/redact.js` does not replace it whole. `mcp-session-id` normalises to `mcpsessionid`, which matches nothing in `SECRET_KEYS` or `SECRET_WORDS`, but does contain `session` from `MASKED_WORDS` — so it is masked. Verified:

```json
{ "mcp-session-id": "mcp...6f7", "authorization": "[redacted]", "cookie": "[redacted]" }
```

Nothing is leaking today: six characters of a UUID is not a usable session id. But the session id is a real capability on this server — it keys `sseSessions`, the map that decides which client's SSE stream a JSON-RPC response is written to — so it belongs on one side of the line or the other by decision, not by which word list it happened to match first. Either the key goes into `SECRET_KEYS`, or the sentence in CLAUDE.md is corrected.

**2. What the unnamed-instance guard is keyed on.**

CLAUDE.md and the JSDoc in `mcp-min/auth.js` both state the rule as *"a call that can change an instance has to name one"*. `mcp-min/run-tool.js:88` derives it as `tool?.annotations?.readOnlyHint !== true`, and `mcp-min/tools.js:5` defines `readOnlyHint` as "the tool changes nothing, **locally or** on the instance".

Those are not the same proposition. The behaviour is right today — all nineteen `resolveAuth` callers authenticate against an instance, checked one by one — so this is not a live bug. It is a trap: a tool that only writes a local file while reading an instance would inherit a refusal nobody decided on, and whoever added it would find the document saying one thing and the code doing another, with no way to tell which was intended.

Pick one. Either the documented rule becomes the implemented one ("a tool that is not `readOnlyHint`"), or the derivation gets a signal of its own that means what the rule says. The first is cheaper and probably right; it should be written down as a decision rather than as a description.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 mcp-min/redact.js and CLAUDE.md agree on how a session id is treated, and a test asserts whichever treatment is chosen
- [ ] #2 If the treatment changes, the test covers every spelling redaction normalises together: mcp-session-id, Mcp-Session-Id and mcpSessionId
- [ ] #3 Nothing else the log writes changes treatment as a side effect, covered by the existing redaction tests passing unchanged
- [ ] #4 CLAUDE.md and the JSDoc in mcp-min/auth.js state the unnamed-instance rule in the terms the code actually uses, or the code is changed to match the stated rule
- [ ] #5 __tests__/env-required.test.js still derives the guarded set from the registry rather than a hand-written list, so a tool added later cannot escape the guard
- [ ] #6 No behaviour changes without a test that fails against the current code
<!-- AC:END -->
