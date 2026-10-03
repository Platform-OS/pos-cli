---
id: TASK-60
title: 'Uploads fail after five minutes: stream files instead of buffering them'
status: In Progress
assignee: []
created_date: '2026-09-23 23:00'
updated_date: '2026-09-24 10:40'
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
Any upload whose send takes longer than 300s fails with `fetch failed`: a deploy's release or asset archive, a module archive, a data-import ZIP, an `uploads push`. A 50MB archive needs 1.4 Mbit/s sustained to fit; hotel wifi and tethered phones often do not.

**Cause.** pos-cli reads every file into a Buffer, and Node's `fetch` sends a Buffer as a single chunk. undici's 300s `headersTimeout` is refreshed each time the socket accepts a chunk, so a one-chunk body turns it into a hard cap on the whole transfer. No `fetch` option raises it: an `AbortSignal` can only end a request earlier.

**Fix.** Open files with `fs.openAsBlob` instead of `readFileSync`. A file-backed Blob streams in pieces, each refreshing the timer, so the default timeout ends only a transfer that has stopped moving. No new dependency, and deploy memory no longer grows with the archive.

Measured on Node 24.10 (built-in undici 7.16): 32MB body, timeout shortened to 2s, server reading at 5MB/s.

| body | result |
| --- | --- |
| Buffer | cut off at the timeout |
| `fs.openAsBlob`, direct or as a multipart part | HTTP 200 after 6.5s |
| streamed into a peer that never reads | cut off at the timeout |
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 A presigned PUT, a presigned POST and a form field naming a file each complete on a real socket against a server that takes three times the shortened timeout to read the body
- [x] #2 The same body sent as a Buffer is cut off by that timeout, proving the timeout is in force
- [x] #3 No upload path reads a file into memory
- [x] #4 undici's UND_ERR_HEADERS_TIMEOUT and UND_ERR_BODY_TIMEOUT are reported as a timeout naming the host
- [x] #5 The CHANGELOG records the user-visible change and the stale comment in lib/s3UploadFile.js is corrected
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Branch `fix-uploads-capped-at-five-minutes`. A first implementation raised the timeout to 20 minutes through a per-upload undici `Agent`, on the premise that the timer never resets during the send. A socket experiment showed the premise wrong: undici refreshes it per accepted chunk, and the single-chunk Buffer body was the problem. That approach, its `undici` dependency and its upload predicate were dropped.
<!-- SECTION:NOTES:END -->
