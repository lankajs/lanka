---
"lanka": patch
---

A ViewModel declaring onInit or onReset is registered with bootstrap, so its hooks run

`onInit` runs inside `initializeScenario`, which only bootstrap calls on the
ViewModels registered with it — and registration followed scenario bindings
alone. A ViewModel with a hook and no `scenarioHandlers` was never initialised,
silently, and the red test said it plainly: `registerViewModel` called 0 times.

The binder now decides `needsBootstrap` once for all three families, from
bindings OR a declared hook. Each base reads its hooks through
`toLifecycleHooks()`, a protected member reporting only OVERRIDDEN ones, and the
functional bridges declare theirs as own properties — so `this.onInit()` means
the same thing in both styles.

**Consequence worth knowing:** `onReset` now fires on instance disposal for
hook-only ViewModels too, including `resetLanka()` between tests.

No published name changed: the new promise is a protected member.
