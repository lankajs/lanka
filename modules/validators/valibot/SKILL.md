# Maintaining `@lankajs/valibot`

The thinnest package in the repository: a validator alias and an inference
helper. What matters here is resisting the urge to make it thicker.

## Boundary

- A **module**: the application calls it; core does not know it exists.
- It imports `lanka/validation` and `valibot`. Nothing else.
- **There is nothing to adapt.** valibot implements Standard Schema, so
  `lankaValibotValidator` _is_ `lankaStandardValidator` under a name that says
  which library the application chose.

## Invariants

1. **The package exists to make a choice explicit**, not to wrap. An application
   installs one validation package — this or `@lankajs/zod` — or neither. Anything
   added here that is not valibot-specific belongs in core.

2. **The asymmetry with `@lankajs/zod` is deliberate and must stay visible.** That
   package carries a bridge for zod 3, which does not expose Standard Schema;
   valibot has no such version. Adding code here to match the other package's
   size would be inventing work, and the README says so on purpose.

3. **The two packages are shaped identically otherwise** — same file layout, same
   exported names, same guide structure — so the difference a reader sees is the
   difference between the libraries rather than between wrapper depths.

4. **The alias is an alias, not a copy.** If core's validator changes, this
   follows. A re-implementation here would be a second behaviour under one name.

## Tests and coverage

Beside the validator, plus the `_playground/` scene.

Coverage is a ratchet: statements 99, branches 99, functions 99, lines 99 — the
highest in the repository, and easy to keep precisely because the package is
small. Anything that makes it hard to hold is probably code that does not belong
here.

Worth pinning: that the exported validator is core's (identity, not behaviour),
that an async schema is refused, and that the inferred type matches.

## Performance

`lankaValibotValidator.bench.ts`; baseline in `perf/valibot.perf.md`, in
yardsticks. It measures the library through the port. A change here that measures
faster almost certainly skipped validation — check what the bench asserts before
believing the number.

## Before you finish

```bash
pnpm --filter @lankajs/valibot test
pnpm --filter @lankajs/valibot test:coverage
pnpm check
```

## Traps

**Making it "match" the zod package.** See invariant 2.

**Wrapping the alias in a function "for future flexibility".** Future flexibility
at the cost of an indirection nobody can remove later, for a package whose whole
job is to be a name.

**Re-exporting valibot itself.** The application owns its schema library and its
version.

---

User-facing guide: [GUIDE.md](./GUIDE.md) · What it is: [README.md](./README.md)
· Repository router: [../../../AGENTS.md](../../../AGENTS.md)
