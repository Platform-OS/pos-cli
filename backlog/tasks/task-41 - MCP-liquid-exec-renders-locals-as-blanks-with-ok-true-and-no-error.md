---
id: TASK-41
title: 'MCP: liquid-exec renders locals as blanks, with ok:true and no error'
status: Done
assignee: []
created_date: '2026-09-22 06:43'
updated_date: '2026-09-22 08:24'
labels:
  - mcp
  - agent-facing
dependencies: []
references:
  - mcp-min/liquid/exec.js
  - lib/proxy.js
modified_files:
  - mcp-min/liquid/exec.js
  - mcp-min/__tests__/liquid.exec.test.js
  - mcp-min/__tests__/tool-surface.test.js
  - CLAUDE.md
  - CHANGELOG.md
  - docs/MCP_TOOLS.md
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
- [x] #1 A template written the way the locals description says renders the values, or the description says exactly where they arrive
- [x] #2 An agent can tell a local that did not arrive from one that is genuinely empty
- [x] #3 The duplicate copy of locals in the payload is gone, or its reason is recorded
- [x] #4 liquid-exec's always-null error field is removed or made capable of being non-null
- [x] #5 A test renders a template with locals and asserts the substituted output, not just ok:true
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Measured the platform first rather than guessing where locals could land. Against the live
instance on 2026-09-22:

- top-level keys in the request body are **not** variables — `{content, name}` renders `{{ name }}`
  blank, so the platform has no locals mechanism to reach at all;
- the whole body arrives at `context.params`, and Rails' `wrap_parameters` copies it again under
  `liquid_exec` — that duplicate is the platform's, constructed server-side, and is not something
  this tool sends or can remove (AC #3, recorded rather than fixed);
- `{% assign x = context.params.locals.x %}` works, including nested objects, arrays and booleans;
- a Liquid failure reports the line it happened on, both in the message (`Liquid error (line 3)`)
  and in `diagnostic.stack[].line`.

That last one decided the design. Rewriting the caller's template is only safe if line numbers
survive, so the binding is **one line with no trailing newline** — measured: the same template
reports line 3 with the prefix and line 4 with a newline after it. A test pins the line count, and
the rule is in CLAUDE.md, because the obvious tidy-up (a newline for readability) silently breaks
the only way a caller can locate a fault in its own template.

Chose to bind rather than only fix the description. The parameter is called `locals` and a
description that says "read them at context.params.locals" leaves the name lying. Binding is safe
because **only the path is written into the template, never the value**: nothing needs escaping,
there is no injection surface, and objects/arrays/booleans arrive as themselves instead of as their
JSON. Both spellings work afterwards, a template's own `assign` still wins (it runs after), and a
call with no locals is byte-identical to before — the template is only touched when the caller asked
for locals.

AC #2 is met structurally rather than by echoing the input back: every bindable local *does* arrive,
so a blank can only be an empty value. The residue — a key that is not a Liquid name, or `context`,
which would shadow the object every binding reads through — is left at `context.params.locals` and
named in `data.unboundLocals`, which is absent when there is nothing to say. `bindLocals` never
indexes `locals` by a caller-supplied key, so `__proto__` is just a name here.

`data.error` removed (AC #4): null on every call that got that far, and a real failure has always
been `ok: false`.

The old test asserted `data.output` — a field the endpoint never returns, invented by its own fake —
so it proved nothing. Replaced with a stand-in *instance* that resolves `assign` and `{{ }}`, which
is what lets the tests assert `"Hello world! n=42 flag=true"` rather than `ok: true` (AC #5).

Byte budgets: bare `tools/list` 17,860 → 17,962, and the dev profile raised 6,500 → 6,600 while
sitting at 6,485 — fifteen bytes is the ceiling failing on a reworded clause rather than on growth,
which is the same argument recorded for the instructions budget in TASK-40.

Verified live end to end after the change: the description's own example, nested/array locals, the
platform path, an unbindable key, a template that reassigns a local, a call with no locals, and line
numbers preserved through a failure. 12 deliberate reverts, sha256-verified restore, all caught.
mcp-min 1459 passing across 61 files; test/unit 1329 with the pre-existing TASK-9 failure only.
<!-- SECTION:NOTES:END -->
