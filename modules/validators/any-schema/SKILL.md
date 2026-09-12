# Maintaining `@lankajs/any-schema`

The validator family's HUB: a dialect table and a router. It binds no vendor,
which is what makes it different from its six neighbours.

## Boundary

- A **module**, on the `modules/validators/` shelf, and the family's `hub` in
  `scripts/registry.mjs` — so `check:family` compares the six vendor surfaces
  with each other and this one with nothing.
- It imports `lanka/validation`. **Nothing else**, at runtime.
- Every schema library and every vendor package is a **dev** dependency, for the
  playground alone.

## Invariants

1. **No runtime dependency on any schema library, ever.** The hub exists so an
   application pays only for the libraries it installed. One `import { Type }
   from "@sinclair/typebox"` in `src/` would make every consumer install TypeBox
   to validate a zod schema. The dialect table reads markers by shape for exactly
   this reason.

2. **Markers, never `instanceof`.** A duplicate copy of a library in a dependency
   tree produces schemas that fail `instanceof` and work perfectly. Refusing
   those would be a guard inventing a problem.

3. **yup is asked before `standard`.** A yup schema carries `~standard` — yup
   implements the specification — but its `validate` is `async`, so the
   synchronous port refuses every one of them. Asked in the other order, every
   yup schema is called "standard" and routed to a validator that cannot run it.
   The unit test names this, and it is not a reordering to tidy.

4. **A callable is a schema.** arktype's is a function with `~standard` on its
   prototype. A table reading only objects calls every arktype schema unknown.
   This defect has already shipped once, in `@lankajs/zod`'s own guard.

5. **"No validator registered" and "not a schema" are DIFFERENT refusals.** One
   is an install, the other is a bug in the calling code. A single message sends
   half the readers the wrong way.

6. **Both refusals throw, including from `validateSafe`.** A refused value is an
   outcome a form renders; an unusable schema is a wiring mistake, and returning
   it in `errors` would show a programmer's error to a user beside an input. Core
   and all six vendor packages do the same, and the reason is written in each.

7. **No `try`/`catch` ladder over the validators, ever.** It turns a wiring
   mistake into a value that passed on the third attempt, with a validator nobody
   chose, and it cannot tell an unregistered library from bad data.

8. **A custom dialect is asked BEFORE the built-in table, and in order.** That
   ordering is the extension point, not an implementation detail: it is what lets
   an application override a shipped dialect without forking anything. Reversing
   it would make the four built-ins unoverridable.

9. **A custom `accepts` is application code and is asked about ANY value.** It
   runs before anything has decided the value is a schema, so it sees `null`, a
   number, an object with a null prototype. One that throws is reported as a
   dialect that threw — naming the dialect — rather than crashing the router with
   a message about neither.

10. **`createLankaSchema` is not a schema library and must not grow into one.**
    No `string()`, no `object()`, no composition, no `optional`. Each of those is
    a step toward a seventh schema library written by the wrong people, and the
    six packages next door exist. Wanting composition is the signal to install
    one, and the guide says so in those words.

11. **A hand-written schema IGNORES its reader's return value when anything was
    reported.** That is what lets a reader collect several problems and end with
    one `return`; trusting the value would let a half-built object through beside
    its own errors.

12. **The issue list is built inside `validate`, never beside the schema.** A
    collector shared between calls is a schema that remembers the last body it
    refused, and the bug surfaces as an unrelated request failing under load.

13. **The table must agree with the six vendor guards.** Each vendor package has
   its own "is this mine"; this package has "whose is this". If they disagree the
   hub routes confidently to a validator that then refuses. The playground
   asserts both halves against the real libraries — that test is the only thing
   standing between the two readings, and it must not be weakened to a
   self-consistency check.

## Tests and coverage

The unit tests drive the table and the router with hand-built markers and
doubles, and use no schema library: a unit test that installed all six would make
the package look as though it needs them.

The `_playground/` is the mixed application — six libraries, four dialects, one
gateway — and it carries the full 6x6 matrix asserting that no pairing lets a raw
library error escape `validateSafe` and none accepts a foreign schema.

It also carries the two extension scenes, and they are the ones that decide
whether the extension point is real: a **superstruct** validator written in the
playground and registered as a custom dialect, and a partner's wire protocol read
by a schema written with `createLankaSchema`. Nothing in `src/` knows superstruct
exists — that is the point, and `superstruct` must stay a DEV dependency.

Coverage is a ratchet: statements 99, branches 99, functions 99, lines 99. Every
branch of the table is a place a schema could reach the wrong validator.

## Before you finish

```bash
pnpm --filter @lankajs/any-schema test
pnpm --filter @lankajs/any-schema test:coverage
node scripts/check-family.mjs
pnpm check
```

## Traps

**Adding a peer dependency "just for the types".** See invariant 1. The
structural interfaces in `_interfaces/` exist so none is needed.

**Promoting the playground's superstruct validator into `src/`.** It would make
superstruct a dependency of the package whose whole claim is that it has none,
and it would be a seventh vendor package written by the wrong people. A library
popular enough to deserve better gets its own package in `modules/validators/`.

**Giving `createLankaSchema` a combinator, "just one".** See invariant 10.

**Making `validate` infer an output type.** It cannot, across four dialects, and
an inference that works for one of them and silently widens for the others is
worse than `unknown`. The cost is documented; documenting it is the honest move.

**Recommending this package.** It is a way out of a situation, not a design. Its
own README, guide and skill all open by telling the reader to use one library.

**Marking a schema library's dialect by version sniffing.** A marker is what the
library puts on every schema; a version is what a lockfile happens to hold.

---

User-facing guide: [GUIDE.md](./GUIDE.md) · What it is: [README.md](./README.md)
· Repository router: [../../../AGENTS.md](../../../AGENTS.md)
