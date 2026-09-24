---
description: Run the whole check list the way CI does, and triage what fails.
argument-hint: "[package or gate id, to narrow]"
allowed-tools: Bash, Read, Grep, Glob
---

Run the checks for **lanka** and report honestly.

Narrowing argument (may be empty): `$ARGUMENTS`

## With no argument

```bash
pnpm check
```

It runs every check in `.specwarden/checks/`, the fast tier then the heavy one,
exactly as CI does. It needs Node 24 and a clean tree — `drift` refuses a dirty
one rather than report an uncommitted edit as drift. `pnpm run doctor` lists the
checks and the rule each holds without running them.

## With an argument

Run only what it names, then say what you did NOT run:

- a package → `pnpm --filter <pkg> test` and `pnpm --filter <pkg> test:coverage`
- a check → `pnpm exec specwarden check <id>` (`pnpm exec specwarden check --list` names them)
- a canon script by hand → `node scripts/check-<id>.mjs`
- every read-only check → `pnpm run check:fast`, seconds
- `scripts` → `npx vitest run scripts/`

## Reading the output

Every gate prints `[tag] where` and the count of what it looked at, and the
list fails a gate whose success line lost its count (`expect`). Report the
tag — it is what a person greps for — and check the count: `0 files`, or a number
far below the last run, means a filter matched nothing, not that the code got
cleaner. A vitest path filter matching nothing exits 0, and so does
`pnpm --filter <not-a-package>`.

## Then

State `PASS` or `FAIL at <step>`. Do not fix anything unless asked — report first
so the caller decides. If asked to fix: fix the code, never a threshold, never by
skipping a test.
