---
description: Run one plan phase end to end — read, build, test, measure, check, commit.
argument-hint: "<NN.M, or the phase name>"
allowed-tools: Read, Write, Edit, Grep, Glob, Bash
---

Take phase `$ARGUMENTS` of the active plan in `_plans/` to green, and commit it.

This is the harness loop. Do not pause between steps for approval; report at the
end.

## 1. Read

The phase, and the phases before it that it depends on. Then the `SKILL.md` that
owns each area it touches — the code says what IS, the canon says what MAY be.

## 2. Build

One change at a time. Prefer the narrow command while working:
`pnpm --filter <pkg> test`, `node scripts/check-<x>.mjs`.

## 3. Pin

Every invariant the phase introduces gets a test that names the defect it
prevents. A new published name also gets a playground scene — a unit test does
not satisfy `check-api`, on purpose.

## 4. Measure, if a hot path moved

The three-run A/B protocol from `skills/performance/SKILL.md`. Record a baseline
only for a win that survived all three runs.

## 5. Prove

```bash
pnpm run check:drift
pnpm check
```

Green, or the phase is not done. If coverage falls below a package's ratchet,
write the missing test — never lower the threshold. If a gate fails, fix the
code, never the gate, unless the gate itself is the bug — then say so explicitly.

## 6. Commit

`skills/commits/SKILL.md` owns the message. One phase, one commit; the reason and
the numbers in the body, in English.

## Report

What landed, what each test pins, any number measured, and anything the phase
called for that you deliberately did NOT do — with the reason. A phase that ends
with the chain red is two phases; say which half you finished.
