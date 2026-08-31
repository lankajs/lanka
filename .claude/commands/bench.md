---
description: Measure a change with the three-run A/B protocol and say whether it paid.
argument-hint: "<package> [operation]"
allowed-tools: Bash, Read, Grep, Glob
---

Measure, for **lanka**. Read `skills/performance/SKILL.md` first.

Target: `$ARGUMENTS`

## The unit

Never hertz. Every bench file registers `lankaBenchCalibration()` — a plain
property read — and the number reported is **how many of those one call costs**.
Hertz is a fact about one machine on one afternoon; the ratio survives the
machine and the thermal state.

## The protocol

1. Copy the file under test to the scratchpad before touching anything —
   `git checkout --` has silently thrown away an in-progress iteration here.
2. Three runs of the current code.
3. Three runs of the previous code (`git stash`, or restore the copy).
4. Restore, and report BOTH sets with their medians.

If the medians overlap, the verdict is **within noise** — say exactly that. A
speedup nobody can reproduce costs more than it saved.

```bash
pnpm --filter <package> bench      # print one package's numbers
node scripts/check-perf.mjs        # all baselines
node scripts/check-perf.mjs --write # record, only after a real improvement
```

## Before believing any number

Check the bench is measuring the operation and not: the memo (pass a fresh
argument), a neighbour's state (give each case its own instance), an unbounded
recorder in a fake transport, the harness's own `JSON.stringify`, a body whose
result nothing reads, or a missing runtime (`NaN` is a broken bench, not a fast
one).

## Then

Report the table, the median, the verdict, and what dominates the cost. Record
the baseline only for a win that survived all three runs, and only in the commit
that made it.
