# Maintaining `@lankajs/effect`

A cache around `Schema.standardSchemaV1`, two delegations to core, and an
inference helper. What matters here is how much it refuses to do.

## Boundary

- A **module**, on the `modules/validators/` shelf: the application calls it;
  core does not know it exists.
- It imports `lanka/validation` and `effect`. Nothing else.
- **It binds one port and starts nothing.** No Effect runtime, no
  `Effect.runSync`, no `Layer`, no error channel.

## Invariants

1. **The reason for the cache is a MEASUREMENT, pinned by a test.**
   `Schema.standardSchemaV1(schema)` returns a different object on every call,
   and `standardEffectSchema.test.ts` asserts exactly that before asserting the
   cache. If Effect ever returns a stable wrapper — or puts `~standard` on the
   schema — that test fails, and the cache becomes dead weight to be removed
   rather than machinery nobody re-examined.

2. **The cache is WEAK.** The key is the consumer's schema object. A strong map
   would keep every schema a screen ever built alive for the life of the tab —
   a leak they cannot see, measure or clear.

3. **No Effect runtime is started here.** An application using Effect has one.
   A second one inside a validator is a second set of fibers, a second
   interruption story, and a second answer to "which runtime did this failure
   belong to". A consumer who wants the call inside an Effect wraps it; that is
   their composition to choose.

4. **The validator is frozen.** It is a table of behaviour, and a mutable table
   is a table somebody can reach into. `check:forms` enforces this for every
   ambient table in the repository.

5. **The family is one surface.** `check:family` compares this barrel with the
   rest of `modules/validators/` after removing the vendor's name — which is why
   `ILankaEffectValidator` is exported from its file and NOT from the barrel.

6. **Everything after the wrapper is core's.** Paths, messages, the async
   refusal: this package adds none of them and must not start. A behaviour worth
   having here is worth having for every validator, and that means core.

## Why the validator is not typed as `ILankaValidator`

Core's port takes a `TLankaSchema` — a Standard Schema — and an Effect schema is
not one until the wrapper makes it one. A validator declared as the port would
reject every schema a consumer of this package has, at compile time. The
interface here is the port's shape member for member; only the schema type
differs. `@lankajs/typebox` has the same shape for the same reason.

## Tests and coverage

Beside the validator and beside the cache, plus the `_playground/` scene. The
playground's shared scenes come from
`@lankajs/tool-testing/lankaValidatorConformance`.

The cache is asserted through IDENTITY, never through timing: a timing assertion
passes on an idle machine and fails on a busy one, for reasons nobody caused.

Coverage is a ratchet: statements 99, branches 99, functions 99, lines 99.

## Performance

`lankaEffectValidator.bench.ts`; baseline in `perf/effect.perf.md`, in
yardsticks. It carries a fourth row the thin packages do not: the wrapper rebuilt
per call, which is the cache never hitting.

**The number, measured: 26.81 yardsticks cached against 143.41 rebuilt — 5.3x.**
That row is why invariant 1 is a measurement rather than an opinion. Note the
first number too: Effect is the second dearest library in the family per object,
and no amount of caching here changes that — what the cache removes is the
wrapper, not the schema.

## Before you finish

```bash
pnpm --filter @lankajs/effect test
pnpm --filter @lankajs/effect test:coverage
node scripts/check-family.mjs
pnpm check
```

## Traps

**Adding `Effect`-flavoured returns — an `Either`, an `Effect`, a tagged error.**
It would be a second call shape in a family whose whole promise is one, and it
would drag Effect's runtime into a package that has none. See invariant 3.

**Making the cache strong.** See invariant 2.

**Re-implementing path or message handling because Effect words things
differently.** Core owns both, for every validator. A difference worth fixing is
worth fixing there.

**Re-exporting `effect` itself.** The application owns its schema library and its
version.

---

User-facing guide: [GUIDE.md](./GUIDE.md) · What it is: [README.md](./README.md)
· Repository router: [../../../AGENTS.md](../../../AGENTS.md)
