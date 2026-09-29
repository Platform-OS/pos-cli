---
id: TASK-63
title: 'MCP: page-fetch has no way to ask for less than 16 KB of body'
status: Done
assignee: []
created_date: '2026-09-29 11:15'
updated_date: '2026-09-29 12:12'
labels:
  - mcp
dependencies: []
references:
  - >-
    /home/ecgtheow/Work/pos-cli-mcp-eval-archive/PLATFORMOS-CLI-MCP-EVAL-5.md
    (F4)
  - /home/ecgtheow/Work/pos-cli-mcp-eval-archive/ROUND-5-TRIAGE.md (D2)
  - >-
    /home/ecgtheow/Work/pos-cli-mcp-eval-archive/ROUND-4-TRIAGE.md (F11, where
    this was declined)
modified_files:
  - mcp-min/page/fetch.js
  - mcp-min/__tests__/page.fetch.test.js
  - mcp-min/__tests__/tool-surface.test.js
  - docs/MCP_TOOLS.md
  - CLAUDE.md
priority: medium
ordinal: 3000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
`page-fetch` always returns up to `MAX_BODY_BYTES` (16 KB) of a textual response, and a caller who wants only the status has no way to say so.

Measured in an agent evaluation: fetching a 10.8 MB text asset to confirm it had deployed cost **~10k tokens — 13% of the whole run — for a status code and a byte count**. The result was `status: 200, contentBytes: 10807019, truncated: true` followed by 16 KB of base64. Truncation is flagged honestly; the ceiling is simply fixed and large.

Round 4 reported the same shape at smaller scale (~450 tokens of a 404 error page) and it was declined, on the grounds that any rule for suppressing a body is a guess about which bodies matter, and a custom 404 page is exactly what an agent would want to see. That reasoning is still right, and it answers a different question: it argues against **guessing on the caller's behalf**, not against **letting the caller say**.

An optional cap — with a value meaning "headers only" — leaves every existing call unchanged and removes the whole class. A caller confirming a deploy asks for none; a caller debugging a page asks for the default.

Non-goals: do not change the default ceiling, and do not add a rule that decides which bodies are worth returning.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 A caller can ask page-fetch for no body at all, and for a smaller body than the default ceiling
- [x] #2 A call that passes nothing new behaves exactly as it does today, pinned by a test
- [x] #3 contentBytes still reports the response's real size whatever the caller asked for, so a bounded read never disguises a large resource
- [x] #4 Asking for no body does not stop status, headers and redirect reporting from working
- [x] #5 The body is still cut on a character boundary, so a bounded read is never returned corrupt
- [x] #6 Tests cover a body under the cap, one over it, a headers-only request, and a non-textual response
- [x] #7 The parameter is described in the tool schema and docs/MCP_TOOLS.md, and the tools/list byte ledger records the growth with its reason
<!-- AC:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
`page-fetch` takes `maxBodyBytes` (integer, 0–16384). `0` is status and headers only; omitted it is 16384, the ceiling this tool has always applied, so every existing call is unchanged.

**Measured against a live instance on 2026-09-29** — fk-block's home page, 69,357 bytes — as whole `runTool` results:

| call | result size |
|---|---|
| `{path: "/"}` | 17,506 B |
| `{path: "/", maxBodyBytes: 200}` | 608 B |
| `{path: "/", maxBodyBytes: 0}` | **392 B** |

`contentBytes` is 69,357 in all three. A bounded read never makes a large resource look small — that is what the ceiling costs and what this must not buy.

**`0` takes the unread path.** Where the response declares a `content-length`, the body is released rather than pulled off the network, exactly as a non-textual response already was. Without a declared length it is still read, because counting it is the only way to answer honestly.

**No rule was added about which bodies are worth returning.** That is what round 4 declined and was right to: a custom 404 page is exactly what an agent wants to see, and nothing here can know which body matters. This answers the other question — letting the caller say — so `maxBodyBytes` decides nothing on anyone's behalf.

`bodyOf` became `cutTo(text, maxBytes)`, keeping the streaming `TextDecoder` so a smaller cap is cut between characters, not through one. An omitted body always says why: `bodyOmitted: "maxBodyBytes: 0"` or the content type.

Sixteen tests were added (the cap absent, smaller, zero, over and under, multi-byte, non-textual, a redirect, a declared length, and the schema bounds). Nine mutations were run against the suite — ignoring the parameter, zero still returning a body, the cut ignoring the cap, zero reading a body it will not return, one omission reason for both cases, `contentBytes` reporting what was returned, an unbounded schema, a cut that splits a character, and a description that stops saying what zero does — and each is caught by a named test.

+151 B on `tools/list`, recorded in the byte ledger; the dev budget was raised to 10,050 with this argued alongside the round's other clauses.

Full MCP suite: 61 files, 1689 tests, green.
<!-- SECTION:FINAL_SUMMARY:END -->
