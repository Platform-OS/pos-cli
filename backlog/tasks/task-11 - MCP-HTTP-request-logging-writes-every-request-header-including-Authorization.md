---
id: TASK-11
title: 'MCP HTTP request logging writes every request header, including Authorization'
status: To Do
assignee: []
created_date: '2026-09-02 10:24'
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
ordinal: 26000
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
- [ ] #1 Authorization, Cookie and equivalent sensitive headers are redacted in the MCP HTTP request log
- [ ] #2 Params logged by tool invocation paths mask token, password and credential values on both transports
- [ ] #3 Non-sensitive request and param detail is still logged, so DEBUG remains useful
- [ ] #4 A test asserts that a request carrying an Authorization header does not write it to the log
<!-- AC:END -->
