---
"lanka": major
"@lankajs/tool-testing": major
"@lankajs/react": minor
---

The ViewModel is a store, and reading one from a screen is a separate package.

`createLankaVM` and its three siblings answered a React hook: `useTodoVM()`,
callable only inside a component. That made the framework React-only by its
SHAPE rather than by its imports — one file in core imported React, and the
contract imported it everywhere.

They now answer a ViewModel: `getState()`, `subscribe()`, `setState()`, a name
and a tracking flag. A screen reads one through its framework's binding —
`useLankaVM(todoVM)` from `@lankajs/react`, and the same call from every later
member of `modules/bindings/` — and a program with no framework reads
`getState()` directly. 33 of the 34 packages here now need no UI framework at
all, which `check-runtime.mjs` prints on every run.

`renderWithLanka` moved from `@lankajs/tool-testing` to
`@lankajs/react/testing`. The kit depends on `lanka` and nothing else, so it
could not be the one package that also decided which UI framework an application
uses.

## React keeps the hook

Losing the call signature is a fact about CORE, which may not know what a hook
is. It did not have to become a fact about React, and it has not: `@lankajs/react`
publishes `toLankaReactVM`, which hands the same ViewModel back callable.

```ts
const todoVM = createLankaVM({ … }); // framework-free, as Vue and Svelte get it
export const useTodoVM = toLankaReactVM(todoVM); // React's own spelling
```

```tsx
const { todos, load } = useTodoVM();
const count = useTodoVM((state) => state.todos.length);
const todos = useTodoVM.getState().todos; // outside a component, as always
```

One store either way. The call forwards to `useLankaVM`, the object forwards to
the ViewModel, and nothing about notification, access tracking or laziness
differs from reading the same ViewModel in Vue — which the five bindings'
conformance suite is what proves.

So a React application migrates by wrapping its ViewModels once and changing
nothing else:

```diff
-export const useTodoVM = createLazyLankaVM({ … });
+export const useTodoVM = toLankaReactVM(createLazyLankaVM({ … }));

-import { renderWithLanka } from "@lankajs/tool-testing";
+import { renderWithLanka } from "@lankajs/react/testing";
```

`useLankaVM(todoVM)` remains the portable spelling and the one the guides teach.
A codebase already on it needs nothing here.

## Names

Every published name survives. `TLankaStatelessVMHook` and
`TLankaSharedStoreVMHook` are `@deprecated` aliases of `ILankaReadableVM` and the
new `ILankaSharedStoreVM` — deprecated in CORE, where the word "Hook" now
describes nothing, and a published name is never removed. The word itself is not
deprecated: it moved to where it is true, as `TLankaReactVMHook` in
`@lankajs/react`.
