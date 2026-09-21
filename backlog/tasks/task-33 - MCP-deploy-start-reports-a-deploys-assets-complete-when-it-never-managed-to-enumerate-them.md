---
id: TASK-33
title: >-
  MCP: deploy-start reports a deploy's assets complete when it never managed to
  enumerate them
status: Done
assignee: []
created_date: '2026-09-21 12:10'
updated_date: '2026-09-21 12:45'
labels:
  - mcp
  - deploy
  - agent-facing
dependencies: []
references:
  - mcp-min/deploy/start.js
  - mcp-min/jobs/adapters/deploy.js
  - mcp-min/jobs/handle.js
  - mcp-min/deploy/dry-run.js
  - lib/apiRequest.js
modified_files:
  - mcp-min/deploy/start.js
  - mcp-min/deploy/dry-run.js
  - mcp-min/jobs/adapters/deploy.js
  - mcp-min/__tests__/deploy.start-job.test.js
priority: high
ordinal: 66000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
`deploy-start` mints its `job_id` with `flags: { assets: hasAssets }`. `hasAssets` comes from `files.getAssets()`, and that call sits inside a `try` whose `catch` records `assetsInfo = { error: … }` and carries on — deliberately, and rightly: the release is already in, so failing the whole call would report a deploy that happened as one that did not.

But `hasAssets` is still `false` when the handle is minted, so the handle asserts "this deploy carried no assets". `mcp-min/jobs/adapters/deploy.js` reads `flags.assets === false` as exactly that, skips `assetPhase` altogether, and `ASSET_STATES` maps `none` to `completed`.

Traced end to end:

```
handle flags: {"assets":false} -> job-status state: completed {"phase":"none"}
```

So the start response is honest — it carries `assets: { error }` — and every later `job-status` call is not: it reports the deploy finished with its assets in, when nothing ever looked for an asset. An agent that polls `job-status` is told the deploy succeeded, and that is precisely what both the tool description and the server instructions tell it to do.

The handle can already express the truth without a new field. `assets` is optional; omitting it sends the adapter down `assetPhase`, which answers `unknown` for a phase this process cannot see — the same answer a restarted server gives, and the honest one for "we never found out".

One thing to decide in the same change rather than inherit: `ASSET_STATES.unknown` currently maps to `completed`, on the reasoning that nothing will ever learn more about it. That is right for a server restarted between the deploy and the poll. It is not obviously right for a deploy whose enumeration threw inside this very process, where we know something went wrong rather than merely being unable to see it. Whichever way it goes, the reasoning belongs in the code, because both readings are defensible and the next reader will ask.

Separately, and in the same handler: the comment above `fs.createReadStream` in `deploy/start.js` (and the matching one in `deploy/dry-run.js`) explains that the path is resolved eagerly because "a read stream opens lazily … by the time the request body is read". The body is never read from that stream — `buildFormData` in `lib/apiRequest.js` sees `.path` on it and does `readFileSync` — so the comment describes a mechanism that does not run. `path.resolve` still matters, but only because it is what `readFileSync` receives. Correct the comment while the file is open; do not change the call, which matches `lib/push.js`.

Found in the branch review of 2026-09-21.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 When asset enumeration fails, the minted job handle does not claim the deploy carried no assets
- [x] #2 A job-status call for such a deploy does not report the asset phase as done; the result says the asset outcome is not known
- [x] #3 The deploy-start call still succeeds and still carries the enumeration error — a release that landed is never reported as a failed call
- [x] #4 A deploy that genuinely has no assets still reports completed with no asset phase, unchanged and still covered
- [x] #5 Tests cover all three paths separately: no assets, assets enumerated, enumeration threw
- [x] #6 If the meaning of ASSET_STATES.unknown changes, the reason is recorded in jobs/adapters/deploy.js and CLAUDE.md's statement that unknown is a real answer after a restart is updated to match
- [x] #7 The archive read-stream comments in deploy/start.js and deploy/dry-run.js describe what the code actually does, with no change to the call itself
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
`hasAssets` starts `undefined` rather than `false`, and the handle carries the `assets` flag only
once something has been learned: `flags: hasAssets === undefined ? {} : { assets: hasAssets }`.

That is the whole fix. `mint` drops an empty flags object, `parse` answers `flags: {}`, and the
adapter's existing `flags.assets === false ? none : assetPhase(...)` then routes an absent flag
down `assetPhase`, which has no local upload to look at and no asset status on the release, so it
answers `{ phase: 'unknown' }`. No new field, no new state, no change to the adapter's logic —
only its comment, to say that an absent flag is the starter admitting it never found out.

**`ASSET_STATES.unknown` was left at `completed`** (AC #6). `state` answers "is there anything
still to wait for", and there is not: nothing in this process or on the instance will ever learn
more about that asset phase. `failed` would have been the other reading, and it is wrong here —
the release genuinely landed, and `failed` in this adapter means the operation itself failed. What
the caller needed was for the *asset phase* to stop claiming it finished, and `phase: 'unknown'`
beside `deploy-start`'s own `assets: { error: … }` says exactly what happened. The existing comment
("`unknown` counts as settled: nothing here will ever learn more about it") already carries the
reasoning, so nothing was added to restate it.

AC #7: the archive read-stream comments in both deploy tools described a lazy stream whose body
gets read. Nothing reads that stream — `buildFormData` in `lib/apiRequest.js` sees `.path` on it
and calls `readFileSync` — so `path.resolve` matters because it is what `readFileSync` receives,
and `destroy()` in `finally` is what closes a descriptor that was opened and never used. Both
comments now say that; the calls are unchanged, since they match `lib/push.js`.

**Bite check**, with a sha256-verified restore: `hasAssets` reverted to `false` and the flag made
unconditional → `claims nothing about assets it could not enumerate` fails.

The new test drives the real path — `getAssets` rejects, the release is accepted — and asserts all
three things at once: the call still succeeds carrying the enumeration error, the handle's flags
are `{}`, and `job-status` answers `{ phase: 'unknown' }`. The existing "a deploy with no assets is
finished as soon as its release is in" case still asserts `{ phase: 'none' }`, so the two cannot be
confused again.

1416 mcp-min tests pass.
<!-- SECTION:NOTES:END -->
