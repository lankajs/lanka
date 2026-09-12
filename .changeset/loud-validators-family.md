---
"@lankajs/any-schema": major
"@lankajs/arktype": major
"@lankajs/effect": major
"@lankajs/typebox": major
"@lankajs/yup": major
"@lankajs/tool-testing": minor
"@lankajs/valibot": patch
"@lankajs/zod": patch
"lanka": patch
---

The validator family: five new packages, and three defects the mixing found

`modules/validators/` is now a family — one package per schema library, all
binding `ILankaValidator` — and it gained five members.

**`@lankajs/yup` is the one that is not optional.** yup implements Standard
Schema, but its `~standard.validate` is declared `async` and returns a promise
for every schema, so core's synchronous port refused **every yup schema in
existence**. The package bridges `validateSync(value, { abortEarly: false })`.

**`@lankajs/typebox`** bridges the one library that publishes no Standard Schema
at all, over a `TypeCompiler` checker cached per schema — compiling per call
would have made it the slowest package in the family while claiming the fastest.

**`@lankajs/effect`** holds still the Standard Schema wrapper Effect builds anew
on every call. **`@lankajs/arktype`** is core's port under a vendor's name, like
valibot.

**`@lankajs/any-schema`** is for the application that ended up with two schema
libraries — a merger, a vendored SDK, a screen older than the decision. It routes
by dialect, takes custom dialects for libraries lanka has never heard of, and
carries `createLankaSchema` for a shape with no library behind it at all. It is
not the recommended way to use lanka, and says so first.

Three defects, each found by a test rather than by reading:

- **`lanka`** — `readIssuePath` used `Array.prototype.map`, which preserves an
  Array subclass. arktype returns a `ReadonlyPath` carrying a cache, so
  `ILankaFieldError.path` came back with a library internal attached: it printed
  identically to a plain array and compared unequal.
- **`lanka`** — the port read `schema["~standard"]` unguarded, so a schema from
  another library produced "Cannot read properties of undefined". It refuses by
  name now, and its async refusal names `@lankajs/yup`.
- **`@lankajs/zod`** — its Standard Schema guard required `typeof schema ===
  "object"`, and an arktype schema is a FUNCTION. Every arktype schema went to
  the zod 3 bridge and died on `schema.safeParse is not a function`.

All six vendor validators now refuse a schema from another library with a
`LankaValidationError` naming the mismatch. Before this, five of the six threw a
raw `TypeError` out of `validateSafe` — a method that promises to throw nothing
the data caused.

**`@lankajs/tool-testing`** gains `lankaValidatorConformance`: the assertions
every validator package's playground must pass, so the family's promise is one
checked contract rather than six copies of a test file.

`lanka/internal` gains two primitives the tier exists for — a sibling package
needs them and must not reach into core's `src/`. `lankaValueOrThrow` is the
strict path built from the safe one, generic so each package keeps its own
inference; `lankaForeignSchemaMessage` is the sentence three packages have to say
identically when handed a schema from another library. A facade
`isStandardSchema` was proposed for the same duplication and refused: it would
answer `true` for every yup schema while `lankaStandardValidator` throws on every
yup schema, so the name would have told a consumer the exact wrong thing.
