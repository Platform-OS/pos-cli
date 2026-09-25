---
id: TASK-39
title: >-
  MCP: a job_id for a release that does not exist tells the agent to retry
  forever
status: Done
assignee: []
created_date: '2026-09-21 16:11'
updated_date: '2026-09-21 16:44'
labels:
  - mcp
  - agent-facing
  - deploy
dependencies: []
references:
  - mcp-min/jobs/errors.js
  - mcp-min/jobs/status.js
  - mcp-min/tool-error.js
  - mcp-min/jobs/adapters/deploy.js
modified_files:
  - mcp-min/jobs/errors.js
  - mcp-min/jobs/status.js
  - mcp-min/__tests__/job-status.test.js
priority: medium
ordinal: 78000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Verified against a live platformOS instance on 2026-09-21.

`jobs/errors.js` turns a **404** from a status request into `JobNotFoundError`, which `job-status` reports as `not_found` / `JOB_NOT_FOUND` — "what you named is not there". That mapping is the only thing standing between a bad `job_id` and the retry advice.

platformOS does not answer 404. For `GET /api/app_builder/marketplace_releases/<id>` with an id that does not exist it answers **503**, deterministically — six attempts, always 503, always the same 2,062-byte `Oops (503)` HTML page. So `classify` reads the 5xx, answers `unavailable` — *"nothing was decided; the same call may work later"* — and an agent polls a job that will never exist until it gives up on its own.

Measured, same instance, same tool:

| `job_id` names | result |
|---|---|
| release 23264 (real, created by `deploy-dry-run` during the check) | `state: completed`, `done: true`, `status: success`, full release record |
| release 999999999 (does not exist) | `kind: unavailable`, `code: INSTANCE_UNAVAILABLE`, `message: Request failed with status 503`, plus 2 KB of HTML |

The happy path is fine — the deploy → `job-status` loop works end to end, which is the thing worth knowing. The failure path is the problem, and it is the same class as the `uploads-push` defect fixed in TASK-34: an agent told to retry a call that cannot succeed.

**This is not a one-line fix, which is why it is a task rather than a patch.** Mapping 503 to `not_found` would be wrong: a 503 genuinely does mean a briefly unhealthy instance, and this one produced real `ETIMEDOUT`s and transient failures during the same session. Reporting "that job does not exist" for a deploy that is merely slow to answer is worse than the current behaviour — the agent would stop waiting on a real deploy.

So the question this task has to settle is whether the two are distinguishable at all:

- Is there anything in the 503 response — body, header, anything — that separates "no such release" from "instance unwell"? On the instance measured there is not: the body is a generic error page with no machine-readable content.
- If they are not distinguishable, the honest fix may be in the advice rather than the classification: `job-status` already retries 5xx within `wait_ms`, so a wait that exhausts its deadline against a persistent 503 is evidence in itself, and the message could say that the job may not exist on this instance rather than only that the status could not be read.
- Whatever is decided, an agent should not be left polling indefinitely on a handle that can never resolve.

Worth checking against a second instance before deciding, in case the 503 is specific to how this one is provisioned.

Related: the 2 KB HTML page rides along on every one of these failures. `MAX_ERROR_BODY_LENGTH` (TASK-37) is 4,096, so it does not trim it, and the only informative token in it is `<title>Oops (503)</title>`. If this is fixed by reading something out of the body, that may deal with both.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 It is established whether a 503 for a release that does not exist can be told apart from a 503 from an unhealthy instance, and the finding — with the limits of the evidence — is recorded here
- [x] #2 An agent polling a job_id that can never resolve is not advised to keep retrying indefinitely
- [x] #3 A genuinely transient 5xx is still reported as retryable, and a real deploy that is slow to answer is never reported as a job that does not exist
- [x] #4 Tests cover both cases separately, driven by the status the instance actually returns rather than by a 404 that platformOS does not send
- [x] #5 jobs/errors.js no longer implies 404 is the only way a status request says the job is not there, in code or in its comment
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
## What the instance actually does

Measured against `fk-verification-instance` on 2026-09-21. **One instance, not two** — AC #1 was
written asking for two and only one was available, so it was rewritten to ask what the evidence can
actually answer. What it settles is decisive on its own; what it cannot rule out is noted below.

| request | answer |
|---|---|
| `/marketplace_releases/23264` (real) | 200, 505 B, `x-request-id` present |
| `/marketplace_releases/999999999` | **503**, 2,062 B `Oops (503)` page |
| `/marketplace_releases/nosuchthing` | **503**, byte-identical page |
| `/imports/999999999`, `/exports/999999999` | **503**, byte-identical page |
| `/definitely_not_a_route/1` | 404, a *different* 1,430 B page, `x-request-id` present |

So the 503 is the whole API's answer for a job it does not have, not the release endpoint's — the
fix had to be shared by every adapter, not put in `deploy.js`. The 404 mapping that was the only
thing standing between a bad `job_id` and the retry advice never fired at all; 404 is what an
unknown *route* gets.

**The response cannot settle it.** Six rounds, the missing-id body was the same sha256 every time
while the real release and `/instance` both answered 200 in the same second. The 503 page carries
none of the application's own headers (`x-request-id`, `x-runtime`) — but that only says it never
reached the application, which is equally true of a 503 from an unwell one. `error.response.headers`
is available (`lib/apiRequest.js`), and it does not help: there is nothing in the response to read.

Not ruled out, and not rulable out from one instance: that some other deployment answers 404 here.
That costs nothing — `statusRequest` still maps a 404, so such an instance takes the cheaper path.

## The fix

Since nothing in the response separates the two, the instance is asked a second question.

- `jobs/errors.js` gains `absentOrUnwell(err, { kind, id, health })`, next to the 404 mapping, so
  the whole "how a status request says the job is not there" question has one home. A 5xx becomes
  `JobNotFoundError` only when the instance answers `getInstance` — chosen over `ping` because it
  is 90 B against 333 B and growing, and because it is instance-wide, so it answers for the test
  runner too, whose status lives outside the app_builder API.
- `jobs/status.js` asks about the job **twice** before calling it. The default `wait_ms` is 0, so
  without this a single slow answer for a real deploy would be reported as a job that never
  existed — the worse of the two errors, and the one AC #3 forbids. A wait long enough to have
  retried has already done this; the confirmation is what covers the no-wait case.
- A health probe that throws for any reason leaves the original error exactly as it was, so an
  instance with no `getInstance` behaves as it did before this existed. Logged at debug.
- The inference is visible rather than hidden: `details: { statusCode, instanceResponding: true }`,
  and the message says the instance is answering for itself but not for this job.

A refused connection is never read as an absent job: nothing answered, so there is nothing to
compare against. A 401/403/422 is a refusal the instance meant, and is not probed.

## Tested

13 tests, all driven by 503. Three bite checks, each restored against its sha256:

- absence never inferred → 7 fail
- inferred without the health probe → 3 fail, including "the same 503 from an instance that is not
  answering stays retryable", which is AC #3's guard
- decided from one 503 with no confirmation → 3 fail, including "a 503 that clears when asked again
  is the job's status"

mcp-min: 1361 passing across 59 files.

## On the wire

Against the live instance, through `runTool`:

- release 23264 → `ok: true`, `state: completed`, `status: success`
- release 999999999 → `not_found` / `JOB_NOT_FOUND`, *"the instance is answering for itself, but
  answers 503 for this job"*, `details: { statusCode: 503, instanceResponding: true }`, 5.1 s for
  two polls and a probe

The 2 KB HTML page the task noted rides along **no longer**: it was attached by `classify` reading
`err.response.body`, and this path no longer reaches `classify`. It can still appear on the genuine
`unavailable` case, which is now the rare one. Trimming an HTML body to its `<title>` in
`tool-error.js` would remove the remainder; left out deliberately as it would change error bodies
for every tool and belongs with TASK-37's measurement, not here.
<!-- SECTION:NOTES:END -->
