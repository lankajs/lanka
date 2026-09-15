---
"@lankajs/svelte": minor
"@lankajs/solid": minor
"@lankajs/tool-testing": minor
---

`@lankajs/svelte` and `@lankajs/solid` — the third and fourth bindings.

```svelte
<script lang="ts">
  const state = useLankaVM(todoVM);
</script>

{#each state.rows as row}<li>{row}</li>{/each}
```

```tsx
const state = useLankaVM(todoVM);
<For each={state().rows}>{(row) => <li>{row}</li>}</For>;
```

The same name every member of the shelf publishes. Svelte's answers an object of
getters, built on `createSubscriber` — so this package needs no compiler and
builds like every other one here. Solid's answers an `Accessor`.

`@lankajs/tool-testing` gains the two halves a binding is built from:
`prepareLankaRender` (the live instance, the doubles, the caller's setup and the
scenario layer, in that order) and `createLankaFakeVM` (the one ViewModel all
four playgrounds read, so four sets of deliberately identical claims are made
about the same thing).
