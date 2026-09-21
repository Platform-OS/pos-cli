---
id: TASK-39
title: >-
  MCP: a job_id for a release that does not exist tells the agent to retry
  forever
status: To Do
assignee: []
created_date: '2026-09-21 16:11'
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
- [ ] #1 It is established, against at least two instances, whether a 503 for a release that does not exist can be told apart from a 503 from an unhealthy instance, and the finding is recorded here
- [ ] #2 An agent polling a job_id that can never resolve is not advised to keep retrying indefinitely
- [ ] #3 A genuinely transient 5xx is still reported as retryable, and a real deploy that is slow to answer is never reported as a job that does not exist
- [ ] #4 Tests cover both cases separately, driven by the status the instance actually returns rather than by a 404 that platformOS does not send
- [ ] #5 jobs/errors.js no longer implies 404 is the only way a status request says the job is not there, in code or in its comment
<!-- AC:END -->
