# Maintaining `@lankajs/solid`

A subscription and a signal, and nothing else. One name the whole shelf shares —
`useLankaVM` — plus the Solid-only spelling this package is allowed to publish:
`toLankaSolidVM`.

## Boundary

- A **module**: the application calls it, core does not know it exists. Removing
  the package must leave core working exactly as before.
- It may import `lanka` and `solid-js`, and nothing else from this repository. No
  module imports another module; `check:runtime` refuses an import of any other
  UI framework, because `framework: "solid"` in the registry is a promise about
  what a consumer must have installed.
- **The access tracking is not here.** Which keys a component read, and whether a
  change touched them, is `createLankaAccessTracker` in core, published through
  `lanka/extend`.
- **This package compiles its own JSX.** Solid transforms JSX into its own
  reactive calls and ships its own `JSX` namespace, so its `tsconfig.json` says
  so while the other thirty-seven take the base config. It is generated from
  `scripts/registry.mjs`: change the entry, not the file.

## Invariants

1. **A defect in what a reader sees is fixed in core, not here.** If this package
   needs more than `ILankaReadableVM` and the tracker give it, the port has the
   defect and the fix belongs in core, for all five bindings at once.

2. **The signal is `equals: false`, and `shouldNotify` is what decides.** A
   tracked read hands back the same proxy while the state object is unchanged and
   Solid compares by identity, so setting the signal would be a no-op exactly
   when the tracker did its job. What decides whether anything happens is the
   framework's answer, not the signal's.

3. **Access tracking earns its place here too, for a different reason.** Solid
   already skips work a signal did not feed, so a coarse binding would be less
   wrong here than elsewhere — and still wrong: without tracking every change
   writes a new object into the signal and every effect reading ANY part of it
   re-runs. The tracker is what keeps the signal unchanged, and an unchanged
   signal is work Solid never starts.

4. **`stop()` is published, and is not a convenience.** Inside a component or a
   root, `onCleanup` releases the subscription with the owner. A read made where
   there is no owner — module level, a test — has nobody to call it, and Solid
   warns about that case rather than handling it.

5. **A selected read updates only when the SELECTION moved.** Otherwise the same
   call means one thing here and another in React, which the conformance suite's
   selector scenes refuse.

6. **"A render" is a reading effect's run.** A Solid component function runs once
   and what updates is the DOM node that read the signal, so nothing here
   corresponds to a re-render; the conformance suite counts the reading effect
   instead. Do not add a render counter to make the numbers look like React's.

## Tests and coverage

Beside each unit, plus `_playground/playground.test.tsx`, which reads a ViewModel
from a real component tree.

The shelf's real test is `lankaViewBindingConformance` from
`@lankajs/tool-testing`: thirty scenes written independently of any binding,
every one of them a mistake a binding can actually make. A behaviour that matters
is proved by adding a SCENE there, where all five packages answer it, not by a
test here.

Coverage is a ratchet: statements 99, branches 99, functions 99, lines 99. Add
the missing test; never lower a threshold.

## Before you finish

```bash
pnpm --filter @lankajs/solid test
pnpm --filter @lankajs/solid test:coverage
node scripts/check-api.mjs
node scripts/check-family.mjs
node scripts/check-runtime.mjs
pnpm check
```

## Traps

**Answering a shelf-wide question in this file.** Parity of CAPABILITY is the
promise; the only things this package may publish alone are the ones the registry
lists under `idioms`, and each needs a reason that names Solid — not a
preference.

**Dropping the tracker because Solid is fine-grained already.** See invariant 3:
the granularity is inside the object, and the signal carries the object.

**Editing `tsconfig.json` directly** to fix a JSX error. It is generated, and
`check:drift` refuses a hand edit.

**Reading the underlying keys "for the side effect"** to work around the tracking
blind spot. It is dead code, a refactor or a lint autofix removes it, and the fix
is `enableAccessTrackingOptimization: false` on that ViewModel.

---

User-facing guide: [GUIDE.md](./GUIDE.md) · What it is: [README.md](./README.md)
· Repository router: [../../../AGENTS.md](../../../AGENTS.md)
