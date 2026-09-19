# Maintaining `@lankajs/react`

A subscription and a render trigger, and nothing else. One name the whole shelf
shares — `useLankaVM` — plus the two React-only spellings this package is allowed
to publish: `toLankaReactVM` and `useLankaShallow`.

## Boundary

- A **module**: the application calls it, core does not know it exists. Removing
  the package must leave core working exactly as before.
- It may import `lanka` and `react`, and nothing else from this repository. No
  module imports another module; `check:runtime` refuses an import of any other
  UI framework, because `framework: "react"` in the registry is a promise about
  what a consumer must have installed.
- **The access tracking is not here.** Which keys a component read, and whether a
  change touched them, is `createLankaAccessTracker` in core, published through
  `lanka/extend`. Every member of this shelf calls it, and that is what makes
  "a screen re-renders for the keys it read" a fact about lanka rather than a
  fact about React.
- `"use client"` belongs on this barrel and nowhere in core. Core has no hook any
  more, so `lanka/viewmodel` is server-safe; a directive there would make the
  whole framework client-only in a Next build.

## Invariants

1. **A defect in what a reader sees is fixed in core, not here.** If this package
   needs more than `ILankaReadableVM` and the tracker give it, the port has the
   defect and the fix belongs in core, for all five bindings at once. A
   workaround here makes React's behaviour differ from Vue's, which is the one
   thing the shelf exists to prevent.

2. **`subscribe` is keyed on the ViewModel and on WHETHER there is a selector,
   never on the selector itself.** A selector is usually an inline arrow with a
   fresh identity every render, so keying the subscription on it tore the
   subscription down and rebuilt it on every render — measured at 201
   subscriptions for 200 renders.

3. **A selected read runs the selector once per STATE object and holds the
   answer.** `useSyncExternalStore` reads the snapshot during render and again
   after commit and compares with `Object.is`, so a selector that builds its
   answer was never identical to its own previous result: "Maximum update depth
   exceeded" on the commonest selector there is. The memo closes that loop; it
   is not an optimisation.

4. **`getSnapshot` may close over this render's selector; `subscribe` may not.**
   Only `subscribe` is kept in an effect and has a stability requirement. The
   alternative — a ref written during render — is an impure render that React's
   own lint rule refuses.

5. **The server snapshot hands back the state, never the Proxy.** Tracking exists
   to skip renders a client would otherwise do, and a server renders once.

6. **One tracker per MOUNTED component, built lazily.** Two components over one
   ViewModel read different keys and must re-render for different changes. An
   initialiser argument would construct one per render and throw all but the
   first away.

7. **`useLankaShallow` is a wrapper at the call site, not an equality argument on
   the hook.** An `isEqual` parameter puts the comparison in the binding for
   every caller, including the ones whose selection is a string. The shape is
   React's own, so a consumer arriving from zustand has typed `useShallow`
   already.

8. **The third `useLankaVM` overload — the one taking `selector | undefined` —
   exists for WRAPPERS and must stay.** Without it a hook forwarding its own
   optional argument has to branch, and a branch around a hook call is what
   React's lint rule refuses outright. `toLankaReactVM` is such a wrapper, and so
   is every one a consumer writes.

9. **`toLankaReactVM` adds no state and changes no behaviour.** It is one Proxy
   over the same store, so a ViewModel read through it and the same one read in
   Vue answer identically — laziness, `dispose` and `getState()` included.

## Tests and coverage

Beside each unit, plus `_playground/playground.test.tsx`, which reads a
ViewModel from a real component tree.

The shelf's real test is `lankaViewBindingConformance` from
`@lankajs/tool-testing`: thirty scenes written independently of any binding,
every one of them a mistake a binding can actually make. A behaviour that matters
is proved by adding a SCENE there — where all five packages answer it — not by a
test here.

Coverage is a ratchet: statements 99, branches 93, functions 99, lines 99. Add
the missing test; never lower a threshold.

## Before you finish

```bash
pnpm --filter @lankajs/react test
pnpm --filter @lankajs/react test:coverage
node scripts/check-api.mjs
node scripts/check-family.mjs
node scripts/check-runtime.mjs
pnpm check
```

## Traps

**Answering a shelf-wide question in this file.** Parity of CAPABILITY is the
promise; the only things this package may publish alone are the ones the registry
lists under `idioms`, and each needs a reason that names React — not a preference.

**Flattening what the call answers.** React hands back the state itself, Vue a
`ShallowRef`, Solid an `Accessor`. That is the framework's own idea of
reactivity and the one thing the shelf deliberately does not hide.

**Reading the underlying keys "for the side effect"** to work around the tracking
blind spot. It is dead code, a refactor or a lint autofix removes it, and the fix
is `enableAccessTrackingOptimization: false` on that ViewModel.

**Moving `"use client"` into core to make an import work.** It would put the
directive on all seventeen of core's entries and make the whole framework
client-only in a server build.

---

User-facing guide: [GUIDE.md](./GUIDE.md) · What it is: [README.md](./README.md)
· Repository router: [../../../AGENTS.md](../../../AGENTS.md)
