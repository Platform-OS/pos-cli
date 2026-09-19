---
id: TASK-25
title: >-
  MCP: expose a dry-run deploy, so an agent can see what a deploy would change
  before causing it
status: Done
assignee: []
created_date: '2026-09-18 17:32'
updated_date: '2026-09-19 01:20'
labels:
  - mcp
  - agent-facing
  - deploy
dependencies: []
references:
  - lib/deploy/dryRunStrategy.js
  - mcp-min/deploy/start.js
  - bin/pos-cli-deploy.js
priority: high
ordinal: 55000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
`pos-cli deploy --dry-run` exists (lib/deploy/dryRunStrategy.js) and the MCP server does not expose it. `deploy-start` takes `partial` and nothing else, so over MCP an agent's only way to find out what a deploy does is to do it.

That matters more for an agent than for a person. A deploy that is not partial is the whole intended state of the instance: every file missing from the build is deleted there. A person running `pos-cli deploy` knows what is in their working tree; an agent that has been editing files, or that has just been handed a repository, does not — and the tool it would reach for to find out is the one that applies the change.

What the CLI's dry run does, and what makes it worth exposing: it builds the release archive, uploads it with `dry_run=true`, and the server validates it and reports which files would be upserted and which deleted, applying nothing. It validates the asset manifest the same way, sending it without uploading anything to S3, so the answer covers assets as well as code. That report — the blast radius, before the blast — is the highest-value deploy call an agent can make.

Design questions this task has to settle rather than assume:
- Whether this is a parameter on `deploy-start` or a tool of its own. A parameter keeps one tool and one schema, and costs almost nothing in tokens; a separate tool is harder to invoke by accident and can be marked read-only, which a client can then run without asking. Both have a real case; pick one and say why.
- What it returns, in a shape an agent can act on: the counts and the file lists that decide whether to proceed, not the CLI's formatted report.
- Whether it is synchronous or returns a `job_id`. A dry run still creates a release on the server and still waits for an asset report, so it may belong in the job_id/job-status pattern rather than answering inline.
- Whether a dry run is `readOnlyHint: true`. It applies nothing to the instance's files, but it does create a release record and write `tmp/release.zip` locally, so the honest answer may be no — and an annotation that overstates safety is worse than none.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 An agent can obtain, over MCP, the list of files a deploy would upsert and delete, without any change being applied to the instance
- [x] #2 The result reports what would be deleted distinctly from what would be added or updated, in a structure an agent can branch on rather than prose it must parse
- [x] #3 Assets are covered by the answer, not silently omitted
- [x] #4 The choice between a parameter on deploy-start and a separate tool is made deliberately and the reasoning is recorded
- [x] #5 The tool's annotations state what is actually true — a dry run that creates a release record or writes locally is not advertised as read-only
- [x] #6 A dry run cannot apply a deploy under any argument combination, and a test proves it
- [x] #7 deploy-start's description points to the dry run as the way to see the blast radius of a non-partial deploy first
- [x] #8 The added tool definition's cost against the tools/list byte budget is measured and accepted, not discovered later
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
`mcp-min/deploy/dry-run.js`, registered as `deploy-dry-run` and added to `--profile dev`.

**AC #4 — a separate tool, not a flag.** Three reasons, in the module's own header: a flag puts the
destructive path one boolean away from the safe one, and this call exists precisely for an agent
that does not yet know what a deploy would do; the two have different lifecycles, since
`deploy-start` mints a `job_id` and starts a background S3 upload that a dry run must not; and
annotations are per tool, so a client gating `destructiveHint: true` would gate the dry run too.
The request always carries `dry_run` and no branch omits it, which makes AC #6 structural rather
than merely tested — though it is tested, including with `dryRun: false` and `dry_run: false`
passed straight to the handler.

**AC #5 — `destructiveHint: false`, not `readOnlyHint`.** It applies nothing, but the API records a
release and an archive is written locally, so read-only would overstate it. Stated rather than left
absent because the specification defaults an absent `destructiveHint` to true, which would put it in
the same bucket as `deploy-start`. `tool-annotations.test.js` gained a third reviewed category for
it.

**Dev profile membership was forced, not chosen.** `deploy-start`'s description names the dry run
(AC #7), and `tool-selection.test.js` enforces that a description may not name a tool its profile
hides. The two travel together or neither does — which is the right answer anyway: `deploy-start`
is in `dev`, and without the dry run an agent there can only learn what a non-partial deploy deletes
by causing it.

**AC #8 — measured: 739 bytes.** Bare tools/list 20,109 → 20,848; dev 5,408 → 6,147, so its budget
was raised 6,000 → 6,500 with the reasoning recorded at the constant. The description was tightened
first rather than the budget being raised to fit the first draft.

Two defects found while building it, both in code this task wrote:

- The archive path was relative, and `fs.createReadStream` opens lazily — so it resolved against
  whatever the working directory was by the time the request body was read. Now `path.resolve`d at
  the call.
- A read stream with no `error` listener raises an **uncaught exception**, which in a server is the
  process rather than the call. It now has one, and is destroyed in `finally` so a push that throws
  does not leave the descriptor open. **`mcp-min/deploy/start.js` has the same two exposures and was
  left alone**, being outside this task; worth its own fix.

Four mutants, all killed: `dry_run` made conditional on a parameter, an asset failure reported as an
absence, counts lost when the API answers with a number instead of paths, and the tool writing
`tmp/release.zip` — the archive a concurrent `deploy-start` is streaming — instead of its own.

Also corrected `docs/MCP_TOOLS.md`'s `deploy-start` response example, which still showed `archive`
and `assets` outside `data`: drift left by TASK-27's envelope change.
<!-- SECTION:NOTES:END -->
