---
id: doc-1
title: 'Tests module: a raise ended the whole run — fixed upstream'
type: specification
created_date: '2026-09-29 12:41'
updated_date: '2026-09-29 13:47'
tags:
  - upstream
  - tests-module
  - mcp
  - resolved
---
**Module:** `tests` (pos-module-tests)
**Status:** **Fixed.** Not filed as a request — the fix was made directly, in `pos-module-tests` commit `a8e87e9`, *Fix test runner to handle raises without aborting entire run*.
**Raised by:** pos-cli, from TASK-67
**Date:** 2026-09-29

Kept because the analysis and the measurements are what justify the change, and because the
behaviour it describes is still live on every instance running a tests module older than that fix —
which is what `TEST_RUN_CRASHED` in `mcp-min/tests/crash-check.js` exists for.

## What was wrong

A test that raised at render time ended the whole run, and every other test's result was discarded
with it — including tests that had already completed. The runner answered HTTP 500 with the
platform's error page and reported nothing about the run.

`modules/tests/commands/run.liquid` ran the whole suite in one Liquid render: each result
accumulated in `contracts`, and the report was rendered by `test_formatter` **after** the loop. A
raise inside `include test.path` aborted that render, so the loop never finished, the formatter
never ran, and `contracts` died with it.

## What fixed it

Each test now runs inside `try`/`catch`. A raise is recorded on that test's own contract through the
existing `register_error` helper, under the error key `(raised)`, carrying the exception class,
file, line and message:

```liquid
assign err = null
try
  include test.path, registry: test.path, contract: contract
catch err
  assign raise_message = err.class_name | append: ': ' | append: err.message
  function contract = 'modules/tests/helpers/register_error', contract: contract, field_name: '(raised)', message: raise_message
endtry
```

**The `assign err = null` is load-bearing.** Measured: `err` is not cleared when a `try` block
completes, so without the reset the `catch` of every *later* test runs as well, on the error the
first one raised — turning one bad test into a suite-wide false alarm.

## Measurements (live instance, 2026-09-29)

Establishing the defect, before the fix:

| run | result |
|---|---|
| a passing test alone | `passed: true, matched: 1` |
| a raising test alone | HTTP 500, error page |
| both together, passing test first | HTTP 500 — **nothing about the passing test** |

After the fix, the same suite that had answered nothing:

| | before | after |
|---|---|---|
| `unit-tests-run {}` on a 17-test suite | `TEST_RUN_CRASHED`, nothing else | 17 matched, 38 assertions, **12 passing**, 4 raised, 1 assertion failure |

The four raises turned out to be one real, previously invisible bug in the instance's own code
(`modules/core/validations/uniqueness:29`, a GraphQL variable coercion error).

## Regression checks

- Five endpoints and formats compared before and after on raise-free runs — `run.js`, `run.html`,
  `?formatter=text`, `_tests.js`, and a failing run — all **byte-identical**, including the
  500-on-failure status.
- `pos-cli check run`: 44 files, 0 offences.
- A test that assigns `err` itself, and a test that uses its own `try`/`catch err` and passes:
  neither produces a false raise.
- HTML formatter renders `(raised)` correctly and still answers 500.

## What pos-cli does about it

- `unit-tests-run`'s description names the `(raised)` error key. It no longer warns that a raise
  ends the whole run: that was true of the old module and would now be a sentence about a version,
  paid on every request.
- `TEST_RUN_CRASHED` is unchanged and stays — it is only reachable on an instance running the older
  module, which makes reaching it the version check. It now carries `details.remedy` naming
  `pos-cli modules update tests && pos-cli deploy <env>`, at no cost until a run actually crashes.
- A run where a test raised is an ordinary failing run to `unit-tests-run`, because the body is
  parsed before the status. Pinned by a test.
