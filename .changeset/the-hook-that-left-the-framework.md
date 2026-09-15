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

Every published name survives. `TLankaStatelessVMHook` and
`TLankaSharedStoreVMHook` are `@deprecated` aliases of `ILankaReadableVM` and the
new `ILankaSharedStoreVM`, because the word "Hook" stopped describing anything
and a published name is never removed.

`renderWithLanka` moved from `@lankajs/tool-testing` to
`@lankajs/react/testing`. The kit depends on `lanka` and nothing else, so it
could not be the one package that also decided which UI framework an application
uses.

Migrating: a ViewModel is no longer callable.

```diff
-export const useTodoVM = createLankaVM({ … });
+export const todoVM = createLankaVM({ … });

-const { todos, load } = useTodoVM();
+const { todos, load } = useLankaVM(todoVM);

-const count = useTodoVM((state) => state.todos.length);
+const count = useLankaVM(todoVM, (state) => state.todos.length);

-import { renderWithLanka } from "@lankajs/tool-testing";
+import { renderWithLanka } from "@lankajs/react/testing";
```

`useTodoVM.getState()` and `useTodoVM.subscribe()` keep working under the new
name — they were always the store's, and they are what a server loader, a test
and a headless consumer were already using.
