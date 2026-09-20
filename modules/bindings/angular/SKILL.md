# Maintaining `@lankajs/angular`

A subscription and a signal, and nothing else. One name the whole shelf shares —
`useLankaVM` — plus the six it shares since core's ViewModel factories were
re-published under core's own names, plus the two Angular-only spellings this
package is allowed to publish: `toLankaSignals` and `toLankaObservable`.

## Boundary

- A **module**: the application calls it, core does not know it exists. Removing
  the package must leave core working exactly as before.
- It may import `lanka` and `@angular/core`, and nothing else from this
  repository. No module imports another module; `check:runtime` refuses an import
  of any other UI framework, because `framework: "angular"` in the registry is a
  promise about what a consumer must have installed.
- **The access tracking is not here.** Which keys a component read, and whether a
  change touched them, is `createLankaAccessTracker` in core, published through
  `lanka/extend`.
- **rxjs is Angular's, not a dependency of this package's own making.**
  `toLankaObservable` exists because the ecosystem has fifteen years of
  `Observable` in it; the signal is still the default and the one `useLankaVM`
  answers.

## Invariants

1. **A defect in what a reader sees is fixed in core, not here.** If this package
   needs more than `ILankaReadableVM` and the tracker give it, the port has the
   defect and the fix belongs in core, for all five bindings at once.

2. **An injection context is REQUIRED, and the assertion stays.** `DestroyRef` is
   the only way to learn that the caller has gone, and a subscription with no way
   to learn that is a leak with no owner. `@lankajs/vue` and `@lankajs/solid`
   publish a `stop()` because both can still work without a scope; this one
   cannot, so it refuses at the call — and a refusal a developer reads once beats
   a leak found in production. That is why this package has no `stop()`, and why
   its absence is not a parity gap.

3. **The signal is `equal: () => false`, and `shouldNotify` is what decides.** A
   tracked read hands back the same proxy while the state object is unchanged and
   a signal compares by identity, so setting it would be a no-op exactly when the
   tracker did its job.

4. **A selected read updates only when the SELECTION moved.** The signal always
   wakes when set, which is right for a tracked read and wrong for a selected
   one — what the conformance suite's selector scenes refuse.

5. **The returned signal is read-only.** `asReadonly()` is the published shape: a
   writable signal would be a second way to move the screen, beside the
   ViewModel's actions.

6. **Zoneless needs no extra step, and nothing here may assume `zone.js`.** A
   signal is what zoneless change detection reads; a binding that reached for
   `NgZone` would make the package require the thing Angular is moving away from.

7. **The DECLARATION must not assert an injection context; the CALL must.**
   `src/_factories/` runs at module level, at import time, where no injection
   context exists — so the read those six pre-apply is `useLankaVM` and never
   `toLankaSignals`, which asserts one the moment it is called. Pre-applying
   `toLankaSignals` would make every declaration throw on import, which is the
   loudest possible version of invariant 2 and the reason this shape exists.
   Invariant 2 is unchanged: the assertion stays, it has simply moved to where a
   caller genuinely is inside a context.

8. **`src/_factories/` mirrors core's factories and adds nothing to them.** Each
   of the six is core's factory, core's config and core's overloads with this
   binding's read applied, and not a line more. A parameter type that is not the
   one core takes is a different interface, which is the one thing these six
   names promise not to be.

9. **The six are NOT idioms, and must not be declared as ones.** Every member of
   the shelf publishes them, which is what keeps the guide one guide — and
   `check-family` strips a declared idiom BEFORE comparing, so declaring them
   would remove them from the parity comparison and let a future member publish
   five of the six in silence. The registry's `idioms` list holds only
   `TLankaAngularCallableVM` and the two Angular spellings.

## Tests and coverage

Beside each unit, plus `_playground/playground.test.ts`, which reads a ViewModel
from a real component.

`renderWithLanka` from `@lankajs/angular/testing` drives `TestBed`, so a
component here is COMPILED rather than merely mounted — which is what puts a
field initialiser inside an injection context, the one thing this binding
insists on.

The shelf's real test is `lankaViewBindingConformance` from
`@lankajs/tool-testing`: thirty scenes written independently of any binding,
every one of them a mistake a binding can actually make. A behaviour that matters
is proved by adding a SCENE there, where all five packages answer it, not by a
test here.

Coverage is a ratchet: statements 99, branches 99, functions 99, lines 99. Add
the missing test; never lower a threshold.

## Before you finish

```bash
pnpm --filter @lankajs/angular test
pnpm --filter @lankajs/angular test:coverage
node scripts/check-api.mjs
node scripts/check-family.mjs
node scripts/check-runtime.mjs
pnpm check
```

## Traps

**Answering a shelf-wide question in this file.** Parity of CAPABILITY is the
promise; the only things this package may publish alone are the ones the registry
lists under `idioms`, and each needs a reason that names Angular — not a
preference.

**Relaxing the injection-context assertion** because a test or a module-level
read is inconvenient. See invariant 2: the assertion is the package's answer to a
leak it otherwise cannot detect, and `runInInjectionContext` is the fix the
message already names.

**Making `toLankaObservable` the default.** A signal is what zoneless reads; the
observable is the bridge for code that already speaks rxjs.

**Reading the underlying keys "for the side effect"** to work around the tracking
blind spot. It is dead code, a refactor or a lint autofix removes it, and the fix
is `enableAccessTrackingOptimization: false` on that ViewModel.

---

User-facing guide: [GUIDE.md](./GUIDE.md) · What it is: [README.md](./README.md)
· Repository router: [../../../AGENTS.md](../../../AGENTS.md)
