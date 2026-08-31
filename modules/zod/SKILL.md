# Maintaining `@lankajs/zod`

A validator named for its library, an inference helper, and the zod 3 bridge.
Deliberately thin — the interesting property of this package is how little it is
allowed to do.

## Boundary

- A **module**: the application calls it; core does not know it exists.
- It imports `lanka/validation` and `zod`. Nothing else.
- **It does not adapt zod to the framework.** There is nothing to adapt: zod 4
  implements Standard Schema and core accepts its schemas directly. Anything you
  are tempted to add here that is not zod-specific belongs in core, and anything
  core-specific belongs there too.

## Invariants

1. **The package exists to make a choice explicit**, not to wrap. An application
   installs one validation package — this or `@lankajs/valibot` — or neither. If a
   change here would also make sense in the valibot package, it belongs in core.

2. **`@lankajs/zod` and `@lankajs/valibot` are shaped identically on purpose**, so
   the difference between them is the difference between the libraries rather
   than between wrapper depths. The one asymmetry is real and must stay visible:
   valibot has no version lacking Standard Schema, so it needs no bridge.
   Inventing work for symmetry would be worse than the asymmetry.

3. **The zod 3 bridge lives here, not in core.** It is knowledge about a specific
   library and version; core knows only the protocol.

4. **The validator is frozen.** It is a table of behaviour, and a mutable table
   is a table somebody can reach into. `check:forms` enforces this for every
   ambient table in the repository.

5. **Schema detection is by `~standard`, not by version sniffing.** A consumer
   may hand a schema from any library, and the marker is the protocol's own.

6. **Errors come back as `"path: message"`.** A path-less issue keeps just the
   message. That format is what a form renders and what a log line reads.

## Tests and coverage

Beside the validator. Both paths matter: a Standard Schema schema and a zod 3
schema, plus the safe variants of each.

Coverage is a ratchet: statements 92, branches 83, functions 99, lines 92.

The zod 3 path is the one that rots — nothing else in the repository exercises
it. A test that constructs a schema object with `safeParse` and no `~standard`
keeps it honest without installing a second zod.

## Performance

`lankaZodValidator.bench.ts`; baseline in `perf/zod.perf.md`, in yardsticks.
Validation cost is dominated by the library, not by this file — when a change
here measures faster, check that you did not accidentally skip the validation.

## Before you finish

```bash
pnpm --filter @lankajs/zod test
pnpm --filter @lankajs/zod test:coverage
node scripts/check-forms.mjs
pnpm check
```

## Traps

**Adding a helper that has nothing to do with zod.** It will be needed by the
valibot package a week later, and then it exists twice.

**Dropping the zod 3 bridge because "everyone is on 4".** Removing a published
name is a major version. Deprecate with the four facts, keep it working.

**Re-exporting zod itself.** The application owns its schema library and its
version.

---

User-facing guide: [GUIDE.md](./GUIDE.md) · What it is: [README.md](./README.md)
· Repository router: [../../AGENTS.md](../../AGENTS.md)
