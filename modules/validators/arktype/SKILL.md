# Maintaining `@lankajs/arktype`

A validator alias and an inference helper. What matters here is resisting the
urge to make it thicker.

## Boundary

- A **module**, on the `modules/validators/` shelf: the application calls it;
  core does not know it exists.
- It imports `lanka/validation` and `arktype`. Nothing else.
- **There is nothing to adapt.** arktype implements Standard Schema
  synchronously, so `lankaArkTypeValidator` _is_ `lankaStandardValidator` under a
  name that says which library the application chose.

## Invariants

1. **The package exists to make a choice explicit**, not to wrap. An application
   installs one package from `modules/validators/`, or none. Anything added here
   that is not arktype-specific belongs in core.

2. **The thinness is deliberate and must stay visible.** `@lankajs/yup` carries a
   bridge because yup's Standard Schema implementation is asynchronous, and
   `@lankajs/typebox` carries one because TypeBox publishes none. Adding code here
   to match their size would be inventing work.

3. **The alias is an alias, not a copy.** If core's validator changes, this
   follows. A re-implementation here would be a second behaviour under one name,
   and the unit test pins it by IDENTITY for that reason.

4. **The family is one surface.** `check:family` compares this barrel with the
   rest of `modules/validators/` after removing the vendor's name; a capability
   added here alone is a capability an application loses when it swaps packages.

## Tests and coverage

Beside the validator, plus the `_playground/` scene. The playground's scenes come
from `@lankajs/tool-testing/lankaValidatorConformance` — the family's shared
assertions — so this package cannot quietly stop keeping a promise the others
keep. Add package-specific scenes beside that call, never instead of it.

Coverage is a ratchet: statements 99, branches 99, functions 99, lines 99 — easy
to hold precisely because the package is small. Anything that makes it hard to
hold is probably code that does not belong here.

## Performance

`lankaArkTypeValidator.bench.ts`; baseline in `perf/arktype.perf.md`, in
yardsticks. It measures the library through the port, and the three rows are the
family's three rows so the numbers can be read against zod's and valibot's. A
change here that measures faster almost certainly skipped validation — check what
the bench asserts before believing the number.

## Before you finish

```bash
pnpm --filter @lankajs/arktype test
pnpm --filter @lankajs/arktype test:coverage
node scripts/check-family.mjs
pnpm check
```

## Traps

**Making it "match" the yup or typebox package.** See invariant 2.

**Wrapping the alias in a function "for future flexibility".** Future flexibility
at the cost of an indirection nobody can remove later, for a package whose whole
job is to be a name.

**Re-exporting arktype itself.** The application owns its schema library and its
version.

**Assuming `issue.path` is a plain array.** arktype returns its own
`ReadonlyPath`, an Array subclass carrying a cache. Core flattens it with
`Array.from` — that is why, and it is pinned by a test in core.

---

User-facing guide: [GUIDE.md](./GUIDE.md) · What it is: [README.md](./README.md)
· Repository router: [../../../AGENTS.md](../../../AGENTS.md)
