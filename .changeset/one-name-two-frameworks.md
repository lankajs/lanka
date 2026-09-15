---
"@lankajs/vue": minor
"@lankajs/tool-testing": minor
---

`@lankajs/vue` — the same ViewModel, read from a Vue component.

```vue
<script setup lang="ts">
const state = useLankaVM(todoVM);
</script>

<template>
  <li v-for="todo in state.todos" :key="todo.id">{{ todo.title }}</li>
</template>
```

The same name `@lankajs/react` publishes, on purpose: a consumer moving a screen
between frameworks rewrites the view and not the vocabulary. What differs is what
the call answers — a `ShallowRef` here, the state itself in React — because that
is the framework's own reactivity and the one thing a binding must not hide.

`lankaViewBindingConformance` gains two things the second binding found. Its
adapter now accepts a promise from `act` and from `renderToString`: the
signature was synchronous because React's `act` is, and Vue's scheduler is not.
No scene's assertion changed, which is the claim the suite exists to make.
