---
id: TASK-11
title: 'MCP HTTP request logging writes every request header, including Authorization'
status: Done
assignee: []
created_date: '2026-09-02 10:24'
updated_date: '2026-09-17 20:08'
labels:
  - security
  - mcp
  - logs
dependencies: []
references:
  - mcp-min/http-server.js
  - mcp-min/stdio-server.js
  - mcp-min/auth.js
  - mcp-min/portal/env-add.js
  - mcp-min/log.js
priority: low
ordinal: 42000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Pre-existing on `master`, found while reviewing the Ajv validation branch.

`mcp-min/http-server.js:27-38` logs the full header object on every request:

```js
log.debug('HTTP request', {
  method: req.method,
  url: req.originalUrl || req.url,
  remoteAddress: req.ip || req.connection?.remoteAddress,
  headers: req.headers
});
```

Any `Authorization`, `Cookie` or `Mcp-Session-Id` header a client sends is written verbatim wherever `log.debug` goes. This is behind `DEBUG`, so it is not on by default, but `DEBUG=1` is the first thing anyone does when an MCP client misbehaves — which is exactly the situation where credentials are in play. `mcp-min/auth.js` already has a `maskToken` helper for precisely this reason, used when logging resolved auth.

Also worth checking the `/call` and `tools/call` debug lines in the same file (`http-server.js:100`, `:198`) and their stdio equivalents: they log `params` in full, and `data-import`, `env-add`, `constants-set` and the explicit-credentials path all carry secrets in params. `mcp-min/portal/env-add.js:80` logs the whole `params` object explicitly.

Redact a denylist of sensitive header names, and mask `token`/`password`/`value` in logged params (reusing `maskToken` where it fits) rather than dropping the logging — the request/param detail is genuinely useful for debugging.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Authorization, Cookie and equivalent sensitive headers are redacted in the MCP HTTP request log
- [x] #2 Params logged by tool invocation paths mask token, password and credential values on both transports
- [x] #3 Non-sensitive request and param detail is still logged, so DEBUG remains useful
- [x] #4 A test asserts that a request carrying an Authorization header does not write it to the log
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
TASK-15 (2026-09-17) added `POST /mcp` to the same Express app, so the request logger this task is about now also logs that endpoint's headers. Nothing there carries credentials today (`MCP-Protocol-Version`, `Mcp-Method`, `Mcp-Name`), but the SDK's HTTP handler does accept `authInfo` from a caller, so the fix should land before anything wires authentication into `/mcp`. The logger is still `mcp-min/http-server.js`'s first middleware, registered before Host/Origin validation.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Redaction is done once, in the logger, not per call site. `mcp-min/log.js` passes every data object through `redact()` (`mcp-min/redact.js`) and every message through `scrubString()` before writing to stderr or the log file, so a leak now needs a new *kind* of secret rather than a new logging line.

**Worse than the task described.** The headers and `/call` params were as filed, but two more sites wrote credentials outright:
- `env-add` logged its whole `params` object at **INFO** — no `DEBUG` needed — and that object carries the instance API token a caller passes. It now logs `tokenProvided: true` instead.
- The Partner Portal's device-token response, which *is* an access token, was logged whole at DEBUG (`waiter:tokenData`). It now logs `accessTokenReceived`, `error`, `errorDescription`.
- The verification URL logged at INFO carries a one-time user code in its query string; string scrubbing removes it.

**The rule.** Secrets (`authorization`, `cookie`, `password`, `mcp-session-id`, `device_code`, `refresh_token`, …) are replaced entirely — part of a password is still a leak, and one `Cookie` can hold several credentials. Credential *names* (`token`, `access_token`, `jwt`, …) are masked to `abc...xyz`: enough to say which credential was used, not enough to use, and the same shape `maskToken` already writes into tool results (a test pins the two together). Under 12 characters it is redacted instead. Key matching is normalised (`x-api-key`, `X_API_KEY`, `apiKey` are one name) and also matches the tail of a name, so an `X-Auth-Token` header or a `portalApiKey` setting is covered without anyone having listed it. `Token …` / `Bearer …` values and sensitive URL query parameters are scrubbed wherever they appear, including inside messages and error text.

**Kept useful** (AC #3): method, URL, remote address, user-agent, tool name, environment, instance URL, email, status codes and error messages all still appear. Starting with `DEBUG=1` is also quieter: the startup schema check probed every tool with `{}` and logged a "tool params rejected" line for each one with a required parameter — it now uses `schemaCompileError`, which asks the same question without logging.

**Hardened while there.** The log file is created `0600` and an existing one — every log written before this, which may hold credentials verbatim — is tightened once per process via `restrictToOwner`. Serialisation can no longer fail a request: cycles, bigints, Errors (which used to serialise to `{}`), Dates, Maps, Sets and binary are all handled, a getter that throws yields `[unserialisable]`, and structures are bounded (`MAX_DEPTH` 8, `MAX_STRING_LENGTH` 4096, `MAX_ARRAY_LENGTH` 100) so a `data-import` payload or a `Buffer` cannot become megabytes of log — a Buffer used to serialise as one entry per byte.

**Tests** (`mcp-min/__tests__/redact.test.js`, 84; `log-redaction.test.js`, 6): the rule itself, and then the log a *running* server writes — a real request carrying `Authorization`, `Cookie` and `Mcp-Session-Id`; `/call` with explicit credentials; `env-add` over stdio with a token, asserting the token reached `.pos` but never the log; and the full device-authorization flow with a stubbed Portal, asserting the access token, device code and user code are absent while `accessTokenReceived: true` is present. Each case asserts the call actually succeeded, so none can pass by the request having failed first.

**Mutation-tested: 31 mutants, all killed.** Two surviving mutants were fixed rather than argued away — one showed the "a log line never fails a request" guarantee was untested (added a throwing-getter case), the other that the explicit `Buffer.isBuffer` branch was dead code, since `ArrayBuffer.isView` already covers a Node Buffer and names it identically.

Documented in CLAUDE.md (a "Logging: one sink, redacted centrally" invariant, including the rule not to log whole params/bodies/upstream responses in the first place), the README (a Logs and Debugging section) and `mcp-min/README.md`. The CHANGELOG entry tells people to delete an existing `~/.pos-cli/logs/mcp-min.log` and rotate anything it recorded.
<!-- SECTION:FINAL_SUMMARY:END -->
