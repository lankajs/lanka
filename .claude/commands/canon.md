---
description: Read or amend the canon — a SKILL.md and the gate that enforces it.
argument-hint: "[the rule, or the area]"
allowed-tools: Read, Write, Edit, Grep, Glob, Bash
---

Canon work for **lanka**: `$ARGUMENTS`

The canon is `skills/<rule>/SKILL.md`; its executable half is
`scripts/check-<rule>.mjs`. Neither is complete alone.

## Reading

Start at `skills/README.md`, then the one skill that owns the area. Do not read
all of them — one owner per rule is the whole point, and a second partial copy is
how a reader stops early and invents the rest. If two skills say the same thing,
that is a defect: report it.

## Amending

A rule is written down when it has been LEARNED — a defect it would have
prevented, a decision that was re-litigated twice. Not when it merely sounds
sensible.

1. **State the rule in one sentence**, in the imperative.
2. **Carry the reason with it.** What went wrong without it, concretely. A rule
   without its defect gets deleted by the next person who finds it inconvenient.
3. **Give it exactly one owner.** If it fits two skills, it belongs to the more
   specific one and the other gets a pointer, never a restatement.
4. **Make it fail.** A rule nothing checks diverges from the code silently. Add
   or extend `scripts/check-<rule>.mjs`, and follow `skills/gates/SKILL.md`:
   pure exported readers, a `run()`, `[tag]` per rule, and the count of what was
   examined in the success line.
5. **Prove the gate fails.** Break something on purpose, watch it go red, restore.
   A check that cannot fail reports success — and this repository has shipped one.
6. **Pin it.** `scripts/check-<rule>.test.mjs` asserts the readers against
   fixtures, including the case the gate exists to catch.

## Then

```bash
node scripts/check-<rule>.mjs
npx vitest run scripts/
node scripts/check-docs.mjs
pnpm check
```

If the new rule makes existing code fail, fix the code — or say plainly that the
rule is aspirational and scope it, in writing, to where it holds today.
