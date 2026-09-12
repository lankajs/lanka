# Maintaining `@lankajs/yup`

A synchronous bridge over `validateSync`, a path parser, and an inference helper.
The only package in `modules/validators/` an application genuinely cannot work
without.

## Boundary

- A **module**, on the `modules/validators/` shelf: the application calls it;
  core does not know it exists.
- It imports `lanka/validation`, `lanka/errors` and `yup`. Nothing else.
- **The bridge lives here, not in core.** It is knowledge about a specific
  library and a specific version; core knows only the protocol.

## Invariants

1. **The reason for the package is pinned by a test, not described.** yup's
   `~standard.validate` is `async` and returns a promise for every schema, so
   core's synchronous port refuses all of them. `lankaYupValidator.test.ts`
   asserts both halves — the promise, and core's refusal of the same schema. If
   yup ever ships a synchronous `~standard`, that test fails, and this package
   becomes an alias like the rest of the family. That failure is the signal, and
   it must not be deleted to make a run pass.

2. **`abortEarly: false`, always.** The port promises every issue in `errors`. A
   form that reveals one problem per submit makes a user fix three fields in
   three round trips.

3. **`inner` may be EMPTY.** yup refusing before it reaches the fields leaves the
   list empty and carries the message on the error itself. Reading `inner` alone
   reports a failure with no message — a refusal nobody can act on.

4. **A path is parsed, never split.** yup writes `tags[0].id`, and a key with a
   dot in it as `["a.b"]`. `split(".")` turns that one field into two that
   address nothing. `yupPathSegments` is driven directly by its own test for
   exactly the cases a schema is awkward to arrange.

5. **An index is a number.** A form distinguishes the second element of a list
   from a key spelled `"1"`.

6. **A non-`ValidationError` throw becomes the port's refusal.** yup throws a
   plain `Error` for a test that returned a promise. Passed through it reaches a
   consumer as a stray library message; it comes back worded like core's instead.

7. **The validator is frozen.** It is a table of behaviour, and a mutable table
   is a table somebody can reach into. `check:forms` enforces this for every
   ambient table in the repository.

8. **The family is one surface.** `check:family` compares this barrel with the
   rest of `modules/validators/` after removing the vendor's name. The bridge is
   allowed to be thicker; the SURFACE is not allowed to be wider.

## Tests and coverage

Beside the validator and beside the path parser, plus the `_playground/` scene.
The playground's shared scenes come from
`@lankajs/tool-testing/lankaValidatorConformance`, so this package cannot quietly
stop keeping a promise the others keep.

Coverage is a ratchet: statements 99, branches 99, functions 99, lines 99. Every
branch in the bridge is a place a consumer's data could pass unchecked, which is
why the number stays where it is.

## Performance

`lankaYupValidator.bench.ts`; baseline in `perf/yup.perf.md`, in yardsticks. The
third row is the one to watch: yup reports a refusal by THROWING, so the failure
path carries a `try`/`catch` the other packages' do not — and in a form a refusal
is not the rare case, it is what every keystroke before the last one produces.

## Before you finish

```bash
pnpm --filter @lankajs/yup test
pnpm --filter @lankajs/yup test:coverage
node scripts/check-family.mjs
pnpm check
```

## Traps

**"yup supports Standard Schema now, so this can be an alias."** It supports it
asynchronously, which is the one shape the port cannot use. Invariant 1 is the
test that will tell you when that changes.

**Adding a helper that has nothing to do with yup.** It will be wanted by another
package in the family a week later, and then it exists twice. It belongs in core.

**Re-exporting yup itself.** The application owns its schema library and its
version.

**Assuming the playground's mapping schema looks like zod's.** It cannot: yup's
`transform` runs during the cast, before the checks, so the schema describes the
domain and the transform produces it. The file says so beside the code.

---

User-facing guide: [GUIDE.md](./GUIDE.md) · What it is: [README.md](./README.md)
· Repository router: [../../../AGENTS.md](../../../AGENTS.md)
