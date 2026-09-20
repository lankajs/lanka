---
"lanka": minor
"@lankajs/react": minor
"@lankajs/vue": minor
"@lankajs/svelte": minor
"@lankajs/solid": minor
"@lankajs/angular": minor
"@lankajs/tool-testing": minor
---

every binding publishes core's six ViewModel factories under core's own names, already wearing that framework's read

Declaring a ViewModel a screen will read took two steps: core's factory, then
that binding's conversion. Every ViewModel file in a consuming application
carried both, and the second one was pure ceremony — it said "React" in a file
that had already said it by importing from `@lankajs/react`.

Each of the five bindings now publishes `createLankaVM`, `createLazyLankaVM`,
`createStatelessLankaVM`, `createLazyStatelessLankaVM`,
`createSharedStoreLankaVM` and `createLazySharedStoreLankaVM` — core's names,
core's configs, core's overloads — with that framework's own `useLankaVM`
pre-applied and the ViewModel's members forwarded onto the result. A declaration
moves by changing its import line:

```ts
// before
import { createLankaVM } from "lanka/viewmodel";
import { toLankaReactVM } from "@lankajs/react";

const runVM = createLankaVM<IRunState, IRunActions>({ … });
export const useRunVM = toLankaReactVM(runVM);

// after
import { createLankaVM } from "@lankajs/react";

export const useRunVM = createLankaVM<IRunState, IRunActions>({ … });
```

They are not idioms of one package: all five publish the same six, so the shelf
stays parallel and the guide stays one guide. What differs is what the call
ANSWERS — a plain state in React, a `ShallowRef` in Vue, an `Accessor` in Solid,
a `Signal` in Angular, a view in Svelte — which is exactly what already differs
about `useLankaVM`.

`lanka/extend` gains `createLankaCallableVM`, the Proxy that makes an object a
function and a ViewModel at once. It was written inside `@lankajs/react` and is
in core now because all five bindings need it, and which members belong to the
function, what `in` must answer and what a lazy ViewModel does with a symbol have
one answer rather than five. `toLankaReactVM` is built on it and is unchanged in
behaviour — its twenty-eight scenes pass untouched.

`lankaViewBindingConformance` holds all five to ONE list of what these six
promise. A binding supplies `declare` — six one-line forwards to its own
factories — and the suite drives the same ViewModel config through every one of
them, asserting that the answer is still the ViewModel, that there is one store,
that a screen reads it and wakes for it, and that the three lazy factories build
nothing at the declaration nor to answer their own name. Twenty-two scenes per
binding, identical in all five. Two of the suite's own tests prove those scenes
REFUSE a binding whose lazy factory is eager and one whose declaration drops the
ViewModel, because a scene that cannot fail reports success.
`@lankajs/tool-testing` gains `ILankaConformingVMFactories` and
`ILankaConformanceActions` for it.

Nothing is removed. `useLankaVM`, `toLankaReactVM`, `toLankaSvelteVM`,
`toLankaSolidVM`, `defineLankaComposable`, `lankaVMToRefs`, `toLankaSignals` and
`toLankaObservable` all mean what they meant, and a ViewModel declared with
`lanka/viewmodel` still works everywhere — which is the spelling to keep when a
server component must read it, because a binding's barrel is client-only.
