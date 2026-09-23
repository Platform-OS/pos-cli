---
id: TASK-9
title: >-
  modules.test.js: a unit test logs in to the production Partner Portal, and
  passes whether or not the check it exists for works
status: To Do
assignee: []
created_date: '2026-09-02 10:24'
updated_date: '2026-09-23 21:39'
labels:
  - bug
  - tests
  - modules
dependencies: []
references:
  - test/unit/modules.test.js
  - lib/modules.js
  - .github/workflows/tests.yaml
priority: medium
ordinal: 38000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
`test/unit/modules.test.js` → `publishVersion() — pre-flight validation` → *"does not error about directory when modules/ does not exist (single-dir workflow)"*.

**The original filing was wrong about the symptom that matters.** It recorded a 10-second timeout and asked whether CI was red. Measured 2026-09-23: **GitHub CI is green**, and the timeout only happens on a developer's machine. What is actually wrong is different, and neither half of it is a hang.

## Why it behaves differently in the two places

`publishVersion` (`lib/modules.js:190`) runs the pre-flight validation and then, with nothing left to refuse, continues:

```js
const { moduleName, moduleVersionName } = await prepareRelease();   // the thing under test
const token = await getToken(params);                               // everything after is not
```

```js
const password = process.env.POS_PORTAL_PASSWORD || await readPassword();
```

The three neighbouring pre-flight tests pass because validation **throws** first. This one's whole point is that validation **succeeds**, so execution carries on into `getToken`.

`.github/workflows/tests.yaml` sets `POS_PORTAL_PASSWORD` from secrets and runs `npm test`, so in CI the prompt is skipped. A developer has no such variable, so `readPassword()` waits for a person, the runner prints `Password:`, and the test times out at 10s.

Measured, same test, one variable apart:

| Environment | Result |
| --- | --- |
| CI, and locally with `POS_PORTAL_PASSWORD` set | passes, ~2.4s |
| Locally without it | hangs at `Password:`, fails at 10s |

## Defect 1 — it authenticates against production on every CI run

An earlier describe's `afterEach` deletes `PARTNER_PORTAL_HOST` (line 82), so `Portal.url()` falls back to its hardcoded default, `https://partners.platformos.com` (`lib/portal.js:28`). This describe registers **no nock interceptors**. So the call is real.

Measured with `POS_PORTAL_PASSWORD=dummy`, changing only the host:

```
PARTNER_PORTAL_HOST unset (what CI does)   → tests 2.39s
PARTNER_PORTAL_HOST=http://127.0.0.1:1     → tests  732ms
```

That gap is a live HTTPS round trip to the production Partner Portal, attempting a login with the CI secret, on every run of the suite. Note also that the file's own `PORTAL_URL` constant (line 22) **is** the production URL, so the describes that do use nock are intercepting production rather than a stand-in.

## Defect 2 — it passes without exercising what it was written for

The assertion is an absence:

```js
const dirErrorCalled = logger.Error.mock.calls.some(
  ([msg]) => typeof msg === 'string' && msg.includes('not found') && msg.includes('modules/user/')
);
expect(dirErrorCalled).toBe(false);
```

Once execution reaches `getToken`, the portal rejects the password and `logger.Error` is called with something — anything that is not the directory message satisfies this. It passed with `POS_PORTAL_PASSWORD=dummy`, which is how CI passes it too. **The test would stay green if the directory check broke, so long as it broke into a different message.** In CI it is not testing the thing it names.

## What this is not

Not a defect in `publishVersion`. Prompting for a password is correct for `pos-cli modules push`, and `POS_PORTAL_PASSWORD` is the documented way to run it unattended. The fault is entirely in the test: it does not stop where its assertion stops, and it depends on an ambient credential it never declares.

## The shape of the fix

Set `POS_PORTAL_PASSWORD` inside the test so the prompt cannot fire in either environment, and point `PARTNER_PORTAL_HOST` at an intercepted or unroutable host so nothing leaves the machine. Better still, assert on what `prepareRelease` did rather than on the absence of one string, so the test fails when the directory check does.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 The test makes no network request to partners.platformos.com, or to any real host: verified by pointing PARTNER_PORTAL_HOST at an unroutable address and seeing no change in behaviour
- [ ] #2 It behaves identically with and without POS_PORTAL_PASSWORD in the environment, so it does not depend on an ambient credential
- [ ] #3 It fails when the directory pre-flight check is broken: verified by breaking that check on purpose, not only by the test passing today
- [ ] #4 npm run test:unit passes on a developer machine with no pos-cli credentials set
- [ ] #5 Whether the other describes in this file should intercept a stand-in host rather than the production PORTAL_URL constant is decided and recorded, even if the answer is that nock makes it moot
<!-- AC:END -->
