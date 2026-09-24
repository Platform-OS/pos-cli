---
id: TASK-60
title: 'Uploads fail after five minutes: raise Node''s request ceiling for file uploads'
status: In Progress
assignee: []
created_date: '2026-09-23 23:00'
updated_date: '2026-09-24 06:15'
labels:
  - bug
  - network
  - uploads
dependencies: []
priority: high
ordinal: 29000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
**The defect.** Node's global `fetch` (undici) applies `headersTimeout` — 300s by default — to the whole request *send*, and it does not reset as bytes move. Any upload needing more than five minutes therefore fails, whatever pos-cli does, and it reaches the user as `fetch failed`: no host, no reason.

Measured 2026-09-24 on Node 25.6.0 (built-in undici 7.19.2), against a local server reading at a controlled rate:

| what was sent | result |
| --- | --- |
| 96MB PUT into a server reading a steady 256KB/s, never stalling | **killed at 300.9s**, `UND_ERR_HEADERS_TIMEOUT`, after 64MB had arrived |
| the same upload, ceiling raised via a per-request dispatcher | **HTTP 200 at 384.8s**, all 96MB delivered |
| a send into a peer that reads nothing at all | fails at 301.4s, same error |
| a small request to a server that accepts and never answers | fails at 300.8s, same error |

The first two are a controlled pair: same body, same rate, only the ceiling differs. So the cap is on the transfer rather than on a stall, and raising it is what fixes this.

Thresholds: a 50MB archive needs more than **1.4 Mbit/s** sustained to finish inside 300s; 500MB needs 13 Mbit/s. A deploy over hotel wifi or a tethered phone sits inside the failing range.

**Who is affected.** Every path that sends a file through `apiRequest`: the asset archive (`lib/assets.js`, including the MCP `deploy-start` background upload), the module archive (`lib/modules.js`), the data-import ZIP (`lib/data/uploadFiles.js`, `bin/pos-cli-data-import.js`, `mcp-min/data/import.js`), an arbitrary ZIP (`bin/pos-cli-uploads-push.js`, `mcp-min/uploads/push.js`), the release archive, and single assets during sync (small enough not to hit it).

**What this is not.** Not a regression from #788 or #789 — the cap applies to any `fetch` and predates both. Not fixable with an `AbortSignal` deadline: a signal can only end a request *earlier* than the ceiling, never later. `lib/s3UploadFile.js` carries a comment saying a transfer is deliberately left unbounded so that a slow upload is not cut off; that intent is not achieved today and the comment must be corrected to match whatever lands here.

**Decisions taken up front, with reasons.**

1. **Raise the ceiling per request, not globally.** Only upload-shaped requests get the larger value; an ordinary JSON call keeps today's behaviour.
2. **The predicate is the body shape**: raw bytes (`Buffer`/`Uint8Array`/`ArrayBuffer` — a presigned PUT), a `FormData` the caller built (a presigned POST), or a form field carrying a file path. It has to match `apiRequest`'s own body-building, or a request gets the ceiling meant for the other kind.
3. **Finite, never `0`.** `0` disables the timeout, and nothing else bounds a transfer, so a dead socket would hang for ever. **20 minutes as implemented**: above every deadline pos-cli sets itself (the longest is `lib/portal.js`, 30s), so a bound somebody chose on purpose is what reports a timeout and this only catches a transfer nobody bounded. It covers 50MB at 0.33 Mbit/s and still terminates.
4. **One dispatcher per process.** An `Agent` owns a connection pool; constructing one per request leaks pools in the long-lived MCP server.
5. **Raise `headersTimeout` only.** `bodyTimeout` governs reading the *response*, which for these endpoints is a few bytes; widening it would loosen an unrelated bound.
6. **Keep the `lib/apiRequest.js` diff to a few lines** — predicate and dispatcher belong in their own module. `reduce-mcp-tool-surface` has just merged master with a large conflict in that file and will merge again.
7. **Declare `undici` as a direct dependency.** It already ships to users transitively (`yeoman-environment → fly-import → @npmcli/arborist → @npmcli/run-script → node-gyp → undici`), so this adds no new supply-chain surface. The risk is not the dependency but the coupling: `dispatcher` on `RequestInit` is an undici extension rather than a documented Node API, and a userland `Agent` is handed to Node's *built-in* undici, a different copy — 6.28.x into 7.19.2 in the measurement above, so it tolerates a major-version gap today, but neither project promises that. The failure mode is silent: an ignored option puts uploads back at 300s with nothing to see. Hence the guard test, run on every supported Node version.
8. **Alternative considered, not chosen:** `node:https`, which has no default request timeout and needs no dependency. It costs a second HTTP path inside `apiRequest`, with its own streaming and error normalisation. Revisit if the guard test fails on a supported Node version.

**Reporting.** When the raised ceiling does fire, the error must say so — `RequestError`, `code: 'ETIMEDOUT'`, the uri — so `ServerError` explains it and `classify` reads it as an unreachable host. Today an upload timeout is three words that name nothing.

**Reproduction to encode as a test.** A local HTTP server that reads the request at a throttled rate so the send outlasts a deliberately short ceiling, asserted twice: it fails at the short one and succeeds at the raised one. Scale it down so the suite stays fast — the six-minute version above proves the behaviour but must not be what CI runs.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 An upload whose send outlasts the default ceiling completes instead of failing, proved by a test that throttles the receiving end against a deliberately short ceiling so it runs in seconds rather than minutes
- [x] #2 The raised ceiling reaches only upload-shaped requests: a test asserts an ordinary JSON request is dispatched with the default and an upload is not
- [x] #3 Each upload shape has its own test — raw bytes, a caller-built FormData, and a form field carrying a file path — and a JSON body and a GET are asserted not to be treated as uploads
- [x] #4 A stalled upload still ends: a send into a peer that never reads fails at the configured ceiling rather than hanging, and no code path configures the ceiling as 0 or disabled
- [x] #5 An upload that exhausts the ceiling fails as RequestError with code ETIMEDOUT and the uri, not as 'fetch failed', asserted on an upload path
- [x] #6 Exactly one dispatcher is constructed per process and reused across requests, asserted rather than assumed
- [x] #7 The suite fails loudly on a Node version where the dispatcher option is ignored, and CI runs it on every Node version the package supports (22 and 24)
- [x] #8 Every new test is bite-checked: reverting the dispatcher wiring, and separately the FormData branch of the predicate, each makes its test fail
- [x] #9 lib/apiRequest.js grows by no more than a handful of lines; the predicate and the dispatcher live in their own module, so the pending reduce-mcp-tool-surface merge stays cheap
- [x] #10 undici is declared in package.json dependencies with an explicit version, and the version users actually install is recorded
- [x] #11 The comment in lib/s3UploadFile.js claiming transfers are deliberately unbounded is corrected, and the CHANGELOG records the user-visible change: an upload needing more than five minutes used to fail with 'fetch failed'
- [x] #12 The declared undici version range is chosen deliberately and the reason recorded: ^6 deduplicates onto the copy node-gyp already installs, ^7 matches what recent Node bundles internally but adds a second copy of about 1.7MB to every install
- [x] #13 Raising the ceiling never changes where the bytes go: when the process's global dispatcher is not a stock Agent (a proxy agent, for example), no dispatcher is supplied and the upload routes exactly as every other request does, asserted both ways so the stand-aside answer cannot pass vacuously
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implemented on branch `fix-uploads-capped-at-five-minutes` (from master 2867d47). Not committed — the working tree is left ready.

**Shape.** `lib/requestCeiling.js` is new and owns all of it: `UPLOAD_HEADERS_TIMEOUT_MS`, `isRawBody` (moved here from `apiRequest`, so the predicate and the body-building read one definition), `carriesAFile`, `uploadDispatcher` and `hitTheCeiling`. `lib/apiRequest.js` grew by 11 net lines: the import, two lines of wiring, and one line mapping a ceiling to `ETIMEDOUT`.

**Three things found while building it that changed the design.**

1. *Importing undici at the top of the module cost ~125ms on every command.* `apiRequest` is on the path of `pos-cli env list` as much as of a deploy, so that was a startup regression for a library only uploads use. It is now imported inside `uploadDispatcher`, and the memoised value is the *promise*, so two uploads starting together share one Agent rather than racing to build two and leaking the loser's pool. Measured back at baseline afterwards: master 72–86ms, this branch 76–91ms. `test/unit/requestCeiling.test.js` pins it by spawning a fresh process and asserting undici is absent from the module cache after importing `apiRequest` and present after an upload — the second half is what stops the check passing vacuously.

2. *undici runs its timeouts on a coarse wheel.* A 300ms ceiling was measured firing at ~800ms, and a send finishing at 722ms beat it altogether. Test ceilings are therefore whole seconds against a ~3s send; a future reader shortening them would get flaky tests, so the file says why.

3. *A failed `import('undici')` is deliberately not caught.* A declared dependency that is missing is a broken install, and falling back would put uploads silently back under the five-minute cap — the exact silent failure this exists to prevent.

**Value chosen.** 20 minutes, above every deadline pos-cli sets itself (the longest is `lib/portal.js`, 30s), so a bound somebody chose on purpose is what reports a timeout and this only catches a transfer nobody bounded. Finite rather than `0`, so a socket that dies mid-upload cannot hold a deploy — or an MCP background asset upload nobody awaits — for ever.

**Dependency.** `undici@^6.28.1`. `npm ls undici` shows a single deduped copy shared with the one `node-gyp` already installs, so nothing extra is downloaded; `npm ci --dry-run` is clean. The lockfile change is 5 lines — npm's writer also wanted to drop `libc` metadata from unrelated optional dev packages, which was reverted.

**Verification.** `test/unit` 1379 passed, `mcp-min/__tests__` 439 passed. Five deliberate reverts were each confirmed to break the test that covers them, with sha256-verified restores: the dispatcher wiring, the `FormData` branch of the predicate, the `ETIMEDOUT` mapping, the upload/non-upload message branch, and the lazy import. One unrelated failure remains, `test/unit/modules.test.js`, which fails identically on pristine master (TASK-9).

**CI needs no change**: `.github/workflows/tests.yaml` already runs the unit suite on Node 22 and 24, on Ubuntu and Windows, which is where the version guard lives.

**Review pass found one real defect in the first implementation, now fixed.**

A dispatcher replaces the one the process would otherwise use, *routing included*. Node 24 installs an `EnvHttpProxyAgent` as the global dispatcher when `NODE_USE_ENV_PROXY` is set — measured here: the global dispatcher is `Agent` without the variable and `EnvHttpProxyAgent` with it. The first implementation always supplied a plain `Agent`, so on a corporate network every pos-cli request would have gone through the proxy *except an upload*, which would have tried to connect directly and been refused. That would have turned a five-minute cap into a total failure for exactly the users most likely to have one.

`uploadDispatcher` now supplies nothing when the global dispatcher is not a stock `Agent`, so those uploads run like every other request at the default ceiling. Compared by constructor name rather than `instanceof`, because the global one is built by Node's own copy of undici and is a different class object (7.19.2 against 6.28.1). Covered by a spawned test that runs both ways — with and without a proxy-aware global — so the stand-aside answer is evidence rather than a probe that never supplied anything, and bite-checked by forcing the override back on.

Giving proxied uploads the longer ceiling as well means constructing an `EnvHttpProxyAgent`, which does honour `headersTimeout` (measured) but which undici marks experimental and warns about on every construction. Recorded as a follow-up for somebody who needs it rather than shipped on a guess.

Also checked and found sound, so no change: no caller sends a file through the `json` parameter (`lib/proxy.js`'s `json: formData` payloads are metadata, the file having already gone to S3); a response-body timeout surfaces through the same mapping; the memoised promise resolving to `undefined` caches correctly; and the predicate matches `apiRequest`'s body-building in both directions.
<!-- SECTION:NOTES:END -->
