---
id: TASK-41
title: 'MCP: liquid-exec renders locals as blanks, with ok:true and no error'
status: To Do
assignee: []
created_date: '2026-09-22 06:43'
labels:
  - mcp
  - agent-facing
dependencies: []
references:
  - mcp-min/liquid/exec.js
  - lib/proxy.js
priority: high
ordinal: 81000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Found by an agent-perspective evaluation of the MCP server (2026-09-21), black-box, on `--profile dev`.

`liquid-exec`'s schema says of `locals`: *"Values the template can read as top-level Liquid variables"*, and of `template`: *'Template source, e.g. "Hello {{ name }}"'*.

Following the description exactly:

```
{ template: "Hello {{ name }}! n={{ n }} flag={{ flag }}", locals: {"name":"world","n":42,"flag":true} }
→ { "ok": true, "data": { "result": "Hello ! n= flag=", "error": null } }
```

**The description's own example renders empty**, with `ok: true` and `error: null`. The values do arrive — at `context.params.locals.*`, and again at `context.params.liquid_exec.locals.*` — which the evaluator found only by rendering `{{ context.params | json }}`. Through that path, nested objects and arrays work.

`mcp-min/liquid/exec.js` posts `locals` to `/api/app_builder/liquid_exec`; where the instance lands them is the platform's decision, so this is a description defect unless the tool transforms the template or the payload.

**Why it is the worst class of defect for an agent.** No error, no warning, `ok: true`, plausible output. An agent cannot tell "my locals did not arrive" from "my Liquid is wrong" from "the data really is empty", and a silent wrong answer costs more than a crash. It is also the one moment in the whole evaluation where the agent said it wanted to read pos-cli's source, because nothing in the server could tell it.

Two smaller things in the same result:

- The values are duplicated under `liquid_exec.locals`, paid for on every call.
- `data.error` is always `null` — a real render failure arrives as `ok: false` — so it invites a check that never fires.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 A template written the way the locals description says renders the values, or the description says exactly where they arrive
- [ ] #2 An agent can tell a local that did not arrive from one that is genuinely empty
- [ ] #3 The duplicate copy of locals in the payload is gone, or its reason is recorded
- [ ] #4 liquid-exec's always-null error field is removed or made capable of being non-null
- [ ] #5 A test renders a template with locals and asserts the substituted output, not just ok:true
<!-- AC:END -->
