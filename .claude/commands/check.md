---
description: Run the full gate chain the way CI does, and triage what fails.
argument-hint: "[package or gate id, to narrow]"
allowed-tools: Bash, Read, Grep, Glob
---

Run the checks for **lanka** and report honestly.

Narrowing argument (may be empty): `$ARGUMENTS`

## With no argument

```bash
pnpm run check:drift
pnpm check
```

`check:drift` runs FIRST, as CI does: a registry that disagrees with what it
generated makes every later gate verify the wrong thing.

## With an argument

Run only what it names, then say what you did NOT run:

- a package → `pnpm --filter <pkg> test` and `pnpm --filter <pkg> test:coverage`
- a gate → `node scripts/check-<id>.mjs`
- `scripts` → `npx vitest run scripts/`

## Reading the output

Every gate prints `[tag] where` and the count of what it looked at. Report the
tag — it is what a person greps for — and check the count: `0 files`, or a number
far below the last run, means a filter matched nothing, not that the code got
cleaner. A vitest path filter matching nothing exits 0, and so does
`pnpm --filter <not-a-package>`.

## Then

State `PASS` or `FAIL at <step>`. Do not fix anything unless asked — report first
so the caller decides. If asked to fix: fix the code, never a threshold, never by
skipping a test.
