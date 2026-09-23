# Maintaining `@lankajs/typebox`

A bridge over `Compile`, a pointer parser, a per-schema cache, and an
inference helper.

## Boundary

- A **module**, on the `modules/validators/` shelf: the application calls it;
  core does not know it exists.
- It imports `lanka/validation`, `lanka/errors` and `typebox` — TypeBox 1.x.
  Nothing else. TypeBox 0.34 is the 1.x line of this package, and is not
  maintained here.
- **The bridge lives here, not in core.** It is knowledge about a specific
  library; core knows only the protocol.

## Invariants

1. **The reason for the package is pinned by a test.** TypeBox publishes no
   `~standard`, and `lankaTypeBoxValidator.test.ts` asserts its absence. If
   TypeBox ever ships Standard Schema, that test fails and the package's shape is
   up for review. The failure is the signal; it must not be deleted to make a run
   pass.

2. **The compiled checker is cached per schema, in a WEAK map.** Compiling is the
   slow part of TypeBox, so compiling per call would make this the slowest
   package in the family while the README advertises the fastest validator in
   JavaScript. Weak because the key is the consumer's schema: a strong map keeps
   every schema a screen ever built alive for the life of the tab, and that is a
   leak they cannot see, measure or clear.

3. **`HasCodec` is asked once, not per call.** Asked once per schema, a schema
   without a codec — most of them — pays for one pass and nothing else.

4. **The codec pass is `DecodeUnsafe` on a `Clone`.** Not `Decode`: that is a
   pipeline which re-checks and CLEANS, and cleaning drops the properties the
   schema did not name, so a schema would answer differently depending on
   whether a codec sat somewhere inside it. Not `DecodeUnsafe` on the body
   itself: it writes the decoded values back into the object it is handed, and
   the body is the caller's. Both are pinned by a scene that failed against each
   shortcut.

5. **A schema is recognised by `~kind`, never by `IsSchema`.** `IsSchema` is
   true of any object — any object is a JSON Schema — and `Compile` agrees, so a
   zod schema would compile to "accept everything".

6. **A pointer is parsed, never split.** `~1` is a literal `/` and `~0` a literal
   `~`, **in that order**: reversed, `~01` decodes to `/` instead of the literal
   `~1` it is. `typeBoxPointerSegments` is driven directly by its own test,
   because those are exactly the cases a schema is awkward to arrange.

7. **An index is a number.** JSON Pointer does not carry the difference between
   the second element of a list and a key spelled `"1"`; it is recovered from the
   shape of the segment, as every JSON Pointer implementation does.

8. **A throwing decode function is a refusal, not a crash.** A decode function is
   consumer code — a date that does not parse, an enum with no case.
   `validateSafe` promises to throw nothing.

9. **The validator is frozen.** It is a table of behaviour, and a mutable table
   is a table somebody can reach into. `check:forms` enforces this for every
   ambient table in the repository.

10. **The family is one surface.** `check:family` compares this barrel with the
    rest of `modules/validators/` after removing the vendor's name. The bridge is
    allowed to be thicker; the SURFACE is not allowed to be wider — which is why
    `ILankaTypeBoxValidator` is exported from its file and NOT from the barrel.

## Why the validator is not typed as `ILankaValidator`

Core's port takes a `TLankaSchema` — a Standard Schema — and a TypeBox schema is
not one. A validator declared as the port would reject every schema a consumer of
this package has, at compile time. The interface here is the port's shape member
for member; only the schema type differs, and it differs because the library
makes it impossible to share. `@lankajs/effect` has the same shape for the same
reason.

## Tests and coverage

Beside the validator, the pointer parser and the cache, plus the `_playground/`
scene. The playground's shared scenes come from
`@lankajs/tool-testing/lankaValidatorConformance`.

The cache is asserted through IDENTITY, never through timing: a timing assertion
passes on an idle machine and fails on a busy one, for reasons nobody caused.

Coverage is a ratchet: statements 99, branches 99, functions 99, lines 99.

## Performance

`lankaTypeBoxValidator.bench.ts`; baseline in `perf/typebox.perf.md`, in
yardsticks. It carries a fourth row the rest of the family does not: a schema
rebuilt per call, which is the cache never hitting.

**The number, measured on TypeBox 1.x: 1.72 yardsticks cached against 345.60
rebuilt — 200x.** That is the price of getting invariant 2 wrong, and it is why
the cache is not premature optimisation: without it this package would be the
slowest in the family by two orders of magnitude. On 0.34 the same two rows were
2.63 and 131 — TypeBox 1.x checks faster and compiles slower, so the cache went
from worth having to the whole reason the package is fast. Cached, it sits with
zod (1.68) and arktype (1.57).

## Before you finish

```bash
pnpm --filter @lankajs/typebox test
pnpm --filter @lankajs/typebox test:coverage
node scripts/check-family.mjs
pnpm check
```

## Traps

**Calling `Decode` "for simplicity".** It re-checks — every body validated
twice, and the package's whole claim is about the cost of one — and it cleans.
See invariant 4.

**Making the cache strong to "keep it simple".** See invariant 2.

**Reaching for `Value.Check` instead of the compiled checker.** It works and it is
several times slower; the compiled function is the reason to use TypeBox at all.

**Registering formats here.** TypeBox checks the standard names itself; any other
format is the application's registry to fill. A framework package filling it
would decide for every consumer and break the one that registered their own.

---

User-facing guide: [GUIDE.md](./GUIDE.md) · What it is: [README.md](./README.md)
· Repository router: [../../../AGENTS.md](../../../AGENTS.md)
