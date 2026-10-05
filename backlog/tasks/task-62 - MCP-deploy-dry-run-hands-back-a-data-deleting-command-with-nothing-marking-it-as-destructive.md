---
id: TASK-62
title: >-
  MCP: deploy-dry-run hands back a data-deleting command with nothing marking it
  as destructive
status: Done
assignee: []
created_date: '2026-09-29 11:14'
updated_date: '2026-09-29 12:04'
labels:
  - mcp
  - safety
dependencies: []
references:
  - >-
    /home/ecgtheow/Work/pos-cli-mcp-eval-archive/PLATFORMOS-CLI-MCP-EVAL-5.md
    (F1)
  - /home/ecgtheow/Work/pos-cli-mcp-eval-archive/ROUND-5-TRIAGE.md (D4)
  - >-
    /home/ecgtheow/Work/pos-cli-mcp-eval-archive/ROUND-4-TRIAGE.md (D2, where
    this was declined)
modified_files:
  - mcp-min/deploy/dry-run.js
  - mcp-min/__tests__/deploy.dry-run.test.js
  - mcp-min/__tests__/tool-surface.test.js
  - docs/MCP_TOOLS.md
  - CLAUDE.md
priority: high
ordinal: 2000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
When a full deploy is blocked by a table that still holds records, `deploy-dry-run` forwards the instance's own message verbatim. That message ends with a command that permanently deletes data:

```
Validation failed:
schema/eval_items.yml: cannot be deleted — 1 record(s) still exist. Delete all records of this type first.
pos-cli exec graphql <env> 'mutation { records_delete_all(table: "eval_items") { count } }'
```

Nothing in the result marks that command as destroying data, and nothing says a person should decide. `graphql-exec` is exposed on the same surface and will run it. An agent evaluation put it plainly: *"An agent in a hurry could run it through graphql-exec and destroy data to get a deploy through."* This is the tool whose entire purpose is to be the safe step before a deploy.

Round 4 saw the same message and declined to act, on the grounds that `details.remedy` belongs to the error envelope and a `would_fail` dry run is `ok: true`, and that structuring the platform's prose would mean pattern-matching it. Both remain true and neither addresses the risk: the question is not where a remedy field lives, it is that this result hands over a destructive command unlabelled.

The dry run does not need to parse the message to know the danger. It already identifies deletions that cost records structurally — `DESTROYS_DATA` / `dataLoss` in `mcp-min/deploy/dry-run.js` keys on the converter's `Tables` category for exactly this reason. The blocker can be reported from the same knowledge, beside the forwarded message rather than instead of it.

Second half of the same finding: a blocked full deploy reports no plan at all (`planComputed: false`), which is correct — measured in round 4, the instance answers `report: null` and computes nothing — but it leaves the agent with no move except the destructive one. `deploy-dry-run {partial: true}` shows the non-deletion half of the plan and is what two separate evaluations fell back to on their own. Nothing in the result tells them it is available.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 A dry run blocked by a deletion that costs records reports that fact as a field an agent can branch on, not only inside forwarded prose
- [x] #2 The report distinguishes a blocker that destroys data from one that does not, and says a person should decide the destructive one
- [x] #3 The danger is derived from what the tool already knows about the category, not from matching text in the instance's message
- [x] #4 The instance's own message is still forwarded unchanged, so nothing it says is lost
- [x] #5 A blocked full deploy points the caller at the partial dry run as the way to see the rest of the plan
- [x] #6 planComputed keeps its current meaning: absent lists still mean not computed, never nothing to change
- [x] #7 Tests cover a blocked run that destroys data, a blocked run that does not, and a run that is not blocked
- [x] #8 docs/MCP_TOOLS.md and the deploy-dry-run description describe whatever ships, and any description growth is recorded in the tools/list byte ledger
<!-- AC:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
A refused dry run now carries `blockers` beside the instance's message, and both halves of "does clearing this destroy data?" are answered structurally.

**What the result gains** (only on `verdict: would_fail`):

```javascript
blockers: {
  dataLoss: { count: 2, files: ["modules/community/public/schema/tag.yml", "modules/user/public/schema/profile.yml"],
              decidedBy: "a person: getting past these means deleting the records in those tables, and no deploy brings them back" },
  other: { count: 1 },
  restOfPlan: "Run this tool again with partial: true. …"
}
```

`other` is a count only, because `error.files` already names every refused file; `dataLoss` names its files again, for the same reason the computed path does — it is the one line in the answer that no second deploy can undo. `error.message` and `error.files` are untouched.

**The judgement never reads the message.** Two structural facts decide it: `TABLE_FILE` is the converter's own rule that `schema/*.yml` is a `Tables` file, and `inProject` is what a non-partial deploy deletes — whatever the build no longer has. The second half is what stops the flag crying wolf, and it was not obvious until it was measured.

**Measured against a live instance on 2026-09-29** (fk-block, three runs):

| run | refusal | reported |
|---|---|---|
| full, two-file project | `modules/community/public/schema/tag.yml` (12 records), `modules/user/public/schema/profile.yml` (1) | `dataLoss.count: 2` |
| partial, malformed `schema/t62_broken.yml` **present in the project** | `Body contains invalid YAML …` | no `dataLoss`, `other.count: 1` |
| full, both at once | all three files | `dataLoss.count: 2`, `other.count: 1` |

The second row is the false positive a path-only rule would have produced: the same `would_fail`, the same `error.files` shape, and no data at risk.

`restOfPlan` appears on a blocked full run only — a partial run has nothing narrower to suggest. It exists because a blocked full deploy computes no plan at all (`planComputed: false`, unchanged), and two evaluations found the partial dry run for themselves.

The description gained one clause naming `blockers.dataLoss` (+88 B, in the byte ledger; the dev budget was raised to 9,900 and both round-5 clauses argued there). Twelve tests cover the three cases the task asked for plus the module path spelling, the non-table deletion, the forwarding, and both `restOfPlan` branches. Seven mutations were run against the suite — dropping either half of the rule, reporting blockers on every verdict, `restOfPlan` on a partial run, a `decidedBy` that names nobody, miscounting `other`, and removing the description clause — and every one is caught by a named test.

Full MCP suite: 61 files, 1673 tests, green.
<!-- SECTION:FINAL_SUMMARY:END -->
