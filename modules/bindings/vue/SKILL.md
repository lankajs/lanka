# Maintaining `@lankajs/vue`

A subscription and a ref, and nothing else. The names the whole shelf shares —
`useLankaVM`, plus core's six ViewModel factories under core's own names — and
the two Vue-only spellings this package is allowed to publish:
`defineLankaComposable` and `lankaVMToRefs`.

## Boundary

- A **module**: the application calls it, core does not know it exists. Removing
  the package must leave core working exactly as before.
- It may import `lanka` and `vue`, and nothing else from this repository. No
  module imports another module; `check:runtime` refuses an import of any other
  UI framework, because `framework: "vue"` in the registry is a promise about
  what a consumer must have installed.
- **The access tracking is not here.** Which keys a component read, and whether a
  change touched them, is `createLankaAccessTracker` in core, published through
  `lanka/extend`. Every member of this shelf calls it, and that is what makes
  "a screen updates for the keys it read" a fact about lanka rather than a fact
  about Vue.
- **No client directive, and nothing standing in for one.** React Server
  Components make importing a hook a build error; Vue has no equivalent, so Nuxt
  renders this package on the server as ordinary code.

## Invariants

1. **A defect in what a reader sees is fixed in core, not here.** If this package
   needs more than `ILankaReadableVM` and the tracker give it, the port has the
   defect and the fix belongs in core, for all five bindings at once.

2. **The call answers a `ShallowRef`, and it stays one.** A template reads
   `state.todos` and a script reads `state.value.todos`. Flattening it would be a
   second reactivity system fighting the first, and every `watch` a consumer
   wrote would stop seeing changes.

3. **Inside a component the subscription starts at MOUNT, and nowhere else does
   it start later.** A server renders once and throws the tree away: nothing is
   mounted, the instance's scope is never stopped, `onScopeDispose` never runs —
   and a subscription opened in `setup` there is a listener on a module-level
   ViewModel that outlives the request, one leaked per request until the process
   dies. `onMounted` is the seam because it is the one lifecycle a server never
   reaches.

4. **`stop()` is published, and is not a convenience.** Inside a component or an
   `effectScope` it is called for you. A read made OUTSIDE one — module level, a
   test — has nobody to call it, and Vue warns about the first case and says
   nothing about the second.

5. **A tracked update assigns AND calls `triggerRef`.** A tracked read hands back
   the same proxy while the state object is unchanged and a shallow ref compares
   by identity, so an assignment alone is a no-op exactly when the tracker did
   its job.

6. **A selected read updates only when the SELECTION moved.** Without that the
   ref is set on every notification and the reader wakes for everything — the
   same call meaning one thing here and another in React, which the conformance
   suite's selector scenes refuse.

7. **The third `useLankaVM` overload — the one taking `selector | undefined` —
   exists for WRAPPERS and must stay.** Without it a composable forwarding its
   own optional argument has to branch, and a branch is two call sites of
   something that opens a subscription and registers an `onScopeDispose`.
   `toLankaCallableVM` is such a wrapper, and so is every one a consumer writes.

8. **`src/_factories/` mirrors core's factories and adds nothing to them.** Each
   of the six is core's factory, core's config and core's overloads, with this
   binding's read pre-applied — `toLankaCallableVM(coreFactory(config))` and not
   a line more. A parameter type that is not the one core takes is a different
   interface, which is the one thing these six names promise not to be; a
   behaviour added here would make Vue's answer differ from React's, which is
   what the shelf exists to prevent.

9. **The six are NOT idioms, and must not be declared as ones.** Every member of
   the shelf publishes them, which is what keeps the guide one guide. What
   differs is what the call ANSWERS — a `ShallowRef` here — exactly as it
   already does for `useLankaVM`. The registry's `idioms` list holds only the
   names the siblings do not have, and for this package that includes
   `TLankaVueCallableVM`: the ANSWER is the divergence, so the type naming it is
   Vue's alone while the factory names are not.

## Tests and coverage

Beside each unit, plus `_playground/playground.test.ts`, which reads a ViewModel
from a real component.

The shelf's real test is `lankaViewBindingConformance` from
`@lankajs/tool-testing`: thirty scenes written independently of any binding,
every one of them a mistake a binding can actually make — including the server
scene that found invariant 3. A behaviour that matters is proved by adding a
SCENE there, where all five packages answer it, not by a test here.

Coverage is a ratchet: statements 99, branches 99, functions 99, lines 99. Add
the missing test; never lower a threshold.

## Before you finish

```bash
pnpm --filter @lankajs/vue test
pnpm --filter @lankajs/vue test:coverage
node scripts/check-api.mjs
node scripts/check-family.mjs
node scripts/check-runtime.mjs
pnpm check
```

## Traps

**Answering a shelf-wide question in this file.** Parity of CAPABILITY is the
promise; the only things this package may publish alone are the ones the registry
lists under `idioms`, and each needs a reason that names Vue — not a preference.

**Unwrapping the ref to make a script read like a template.** See invariant 2.

**Starting the subscription in `setup` because it is simpler.** That is the leak
in invariant 3, and it is invisible in every client test.

**Reading the underlying keys "for the side effect"** to work around the tracking
blind spot. It is dead code, a refactor or a lint autofix removes it, and the fix
is `enableAccessTrackingOptimization: false` on that ViewModel.

---

User-facing guide: [GUIDE.md](./GUIDE.md) · What it is: [README.md](./README.md)
· Repository router: [../../../AGENTS.md](../../../AGENTS.md)
