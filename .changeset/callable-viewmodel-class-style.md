---
"lanka": minor
"@lankajs/react": minor
"@lankajs/vue": minor
"@lankajs/svelte": minor
"@lankajs/solid": minor
"@lankajs/angular": minor
"@lankajs/tool-testing": minor
---

one name for the class style, and the lazy stateless config stops sharing a name with a type it is not

**`toLankaCallableVM` is published by every binding.** The six factory names
answer a callable for a ViewModel declared THROUGH them, which left a class one
step behind: `createLankaVM(config)` was one line and `new RunVM().build()` still
had to be wrapped by hand — and four of the five bindings published no way to
wrap it, because their wrapper lived in `_internal/`.

```ts
// a ViewModel this package did not declare: a class, a library's, or one core built
export const useRunVM = toLankaCallableVM(new RunVM().build());
```

One name in all five, so the vocabulary does not change when a screen moves
between frameworks; what differs is what the call ANSWERS, exactly as for
`useLankaVM` and the six factories. `toLankaReactVM` is the older spelling of the
same function in `@lankajs/react`: still published, still correct, and new code
may write either.

**`TLankaLazyStatelessVMConfig` is published by `lanka/viewmodel`.** Core
declared `TLankaStatelessVMConfig` twice — the eager factory's, which was
published, and one local to the lazy factory, which is what that factory takes.
Annotating a shared config with the published name and passing it to
`createLazyStatelessLankaVM` failed to compile for a reason the published surface
did not explain.

The two are now two names, and the difference is written where a reader meets
it: the lazy config is `ILankaVMConfig` without `states`, so it hands
`createActions`, `onInit` and `onReset` the STATEFUL context — whose `set` takes
a `replace` argument on a ViewModel with nothing to replace — and it accepts
`enhancers` and `enableAccessTrackingOptimization`, which the stateless factory
does not read. Narrowing it to the eager config would refuse configs that compile
today, so the difference is named rather than removed.

Nothing is removed and nothing changed meaning. `toLankaReactVM`,
`TLankaStatelessVMConfig` and every other published name mean what they meant.
