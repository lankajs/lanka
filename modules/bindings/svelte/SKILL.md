# Maintaining `@lankajs/svelte`

A subscription and an object of getters, and nothing else. The names the whole
shelf shares — `useLankaVM`, plus core's six ViewModel factories under core's own
names with this package's read already on them — and the Svelte-only spelling
this package is allowed to publish: `toLankaSvelteVM`.

## Boundary

- A **module**: the application calls it, core does not know it exists. Removing
  the package must leave core working exactly as before.
- It may import `lanka` and `svelte`, and nothing else from this repository. No
  module imports another module; `check:runtime` refuses an import of any other
  UI framework, because `framework: "svelte"` in the registry is a promise about
  what a consumer must have installed.
- **The access tracking is not here.** Which keys a component read, and whether a
  change touched them, is `createLankaAccessTracker` in core, published through
  `lanka/extend`.
- **No compiler, and no `.svelte` file in `src/`.** `createSubscriber` is plain
  TypeScript, which is why this package builds with `tsup` like every other one
  here and a consumer needs no plugin beyond the one their project already has.

## Invariants

1. **A defect in what a reader sees is fixed in core, not here.** If this package
   needs more than `ILankaReadableVM` and the tracker give it, the port has the
   defect and the fix belongs in core, for all five bindings at once.

2. **`createSubscriber`, not the store contract.** Svelte reads a `{ subscribe }`
   object as a store and a ViewModel nearly is one — the shapes differ only in
   that Svelte calls the listener immediately. Bridging that is two lines and was
   rejected anyway: the store contract is Svelte 4's way, it does not compose
   with `$state`, and a consumer would write `$todoVM` where every other
   framework writes a plain read.

3. **The properties are getters, and that is the tracking.** Svelte's reactivity
   is read-driven, which is the same question the tracker answers: reading
   `state.todos` records `todos` in the tracker AND registers the effect with
   Svelte's graph, in one access.

4. **The getters are defined from the CURRENT state, not served by a Proxy.**
   Svelte's compiler and `$inspect` walk an object's own descriptors, so a Proxy
   would track correctly and show a consumer nothing in devtools.

5. **A selected read answers one value under `current`, and must not carry the
   selection's own keys.** A selector may answer a number, and a number has no
   keys to define: the shape that carried them accepted `TSelected extends
object` and refused `(state) => state.count` — a member of this shelf
   NARROWING the shared name, which the conformance suite's selector scenes
   found. `.current` is Svelte's own convention, as `MediaQuery` and the rest of
   `svelte/reactivity` read.

6. **A selected read invalidates only when the SELECTION moved.** `update()`
   invalidates whoever read the view, and a selected reader waking on every
   change would be narrowing what it reads and nothing else.

7. **The third `useLankaVM` overload — the one taking `selector | undefined` —
   exists for WRAPPERS and must stay.** Without it a reader forwarding its own
   optional argument has to branch, and a branch here is two call sites where the
   consumer wrote one — two views over one ViewModel, and `stop()` releasing one
   of them. `toLankaCallableVM` in `_internal/` is such a wrapper, and so is
   every one a consumer writes.

8. **The six factories are the reader pre-applied, and nothing else.**
   `toLankaCallableVM` is `createLankaCallableVM` from core over this package's
   `useLankaVM`; it adds no state and no second store, so a ViewModel declared
   through `createLankaVM` here and the same one declared through
   `lanka/viewmodel` answer identically — laziness, `dispose` and `getStoreState`
   included. The wrapper itself is NOT published: Svelte never had a callable
   ViewModel to migrate from, so a name for it would be one the shelf has to keep
   for nobody. Only the type it declares, `TLankaSvelteCallableVM`, is, and the
   registry says why.

## Tests and coverage

Beside each unit, plus `_playground/playground.test.ts`, which reads a ViewModel
from a real component.

The shelf's real test is `lankaViewBindingConformance` from
`@lankajs/tool-testing`: thirty scenes written independently of any binding,
every one of them a mistake a binding can actually make. A behaviour that matters
is proved by adding a SCENE there, where all five packages answer it, not by a
test here.

Coverage is a ratchet: statements 99, branches 99, functions 99, lines 99. Add
the missing test; never lower a threshold.

## Before you finish

```bash
pnpm --filter @lankajs/svelte test
pnpm --filter @lankajs/svelte test:coverage
node scripts/check-api.mjs
node scripts/check-family.mjs
node scripts/check-runtime.mjs
pnpm check
```

## Traps

**Answering a shelf-wide question in this file.** Parity of CAPABILITY is the
promise; the only things this package may publish alone are the ones the registry
lists under `idioms`, and each needs a reason that names Svelte — not a
preference.

**Adding the store contract "as well", so `$todoVM` works.** Two ways to read one
ViewModel is two behaviours to keep equal, and the second one is Svelte 4's.

**Replacing the getters with a Proxy** because it is shorter. See invariant 4 —
the cost lands in devtools, where nothing fails.

**Reading the underlying keys "for the side effect"** to work around the tracking
blind spot. It is dead code, a refactor or a lint autofix removes it, and the fix
is `enableAccessTrackingOptimization: false` on that ViewModel.

---

User-facing guide: [GUIDE.md](./GUIDE.md) · What it is: [README.md](./README.md)
· Repository router: [../../../AGENTS.md](../../../AGENTS.md)
