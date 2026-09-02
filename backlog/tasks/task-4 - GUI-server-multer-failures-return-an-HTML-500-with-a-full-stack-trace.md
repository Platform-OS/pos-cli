---
id: TASK-4
title: 'GUI server: multer failures return an HTML 500 with a full stack trace'
status: To Do
assignee: []
created_date: '2026-09-02 10:22'
labels:
  - bug
  - security
  - gui
dependencies: []
references:
  - lib/server.js
  - test/unit/server.validation.test.js
priority: high
ordinal: 19000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Pre-existing on `master`, unrelated to the Ajv validation branch, but found while reviewing it.

`lib/server.js` has no error-handling middleware. The only route with a body parser that can reject before the handler runs is the sync proxy at `PUT /api/app_builder/marketplace_releases/sync`, which is wrapped in `upload.fields([{ name: 'path' }, { name: 'marketplace_builder_file_body' }])`. A multipart request carrying any other file field never reaches the handler — multer calls `next(err)` and express's default error handler answers. Reproduced against a running server:

```
PUT /api/app_builder/marketplace_releases/sync   (file part named "bogus")
-> 500  Content-Type: text/html
   <pre>MulterError: Unexpected field<br>
     at wrappedFileFilter (/home/…/node_modules/multer/index.js:41:19)
     at Multipart.&lt;anonymous&gt; (/home/…/node_modules/multer/lib/make-middleware.js:284:7)
     … 8 more frames</pre>
```

Two problems. The response leaks absolute filesystem paths and a dependency stack trace, and pos-cli never sets `NODE_ENV=production`, so express always includes the stack. And the GUI server sets `Access-Control-Allow-Origin: *` (`lib/server.js:97-101`), so any page open in the developer's browser can trigger it and read the result.

It also contradicts the intent already documented in the file. `sendError` (`lib/server.js:38-41`) exists specifically so that "no error text is ever handed back for a browser to parse as HTML" — that guarantee holds for gateway rejections but not for parser rejections.

Fix by registering a JSON error-handling middleware after the routes (or by wrapping the `upload.fields` call so a `MulterError` becomes a 400 JSON body). A `MulterError` is caller error, so 400 is right; anything else should be a 502/500 with the message only, never the stack.

Note: an in-flight task (TASK-3) fixes a *different* unhandled-500 in the same handler — the missing-file case. That fix is already on the `add-ajv-input-validation` branch and does not cover this path, so the two do not conflict, but whoever picks this up should rebase on that branch if it has landed.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 A multipart request to the sync proxy carrying an unexpected file field receives a JSON response, not HTML
- [ ] #2 No response from lib/server.js contains a stack trace or an absolute filesystem path, regardless of NODE_ENV
- [ ] #3 A multer parser rejection is reported as 400 (caller error); other unhandled errors keep their existing status semantics
- [ ] #4 A test in test/unit covers the unexpected-file-field case and asserts the response content type is JSON
<!-- AC:END -->
