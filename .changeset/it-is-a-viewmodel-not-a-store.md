---
"@lankajs/vue": minor
"@lankajs/svelte": minor
"@lankajs/solid": minor
---

It is a ViewModel, and it is called one.

The three idioms that read like a store were NAMED after the shape they wear,
and that hid where the work lives: what holds the state, the actions and the
scenario bindings is the ViewModel. Pinia's noun is "store", Svelte's contract is
called a store, Solid's `createStore` is a store — those stay, because they are
somebody else's nouns and changing them would make the sentence wrong. What this
framework hands back is a ViewModel.

```diff
-import { defineLankaStore, lankaStoreToRefs } from "@lankajs/vue";
+import { defineLankaComposable, lankaVMToRefs } from "@lankajs/vue";

-import { toLankaSvelteStore } from "@lankajs/svelte";
+import { toLankaSvelteVM } from "@lankajs/svelte";

-import { toLankaSolidStore } from "@lankajs/solid";
+import { toLankaSolidVM } from "@lankajs/solid";
```

The types moved with them: `TLankaStore` → `TLankaVueVM`, `TLankaStoreRefs` →
`TLankaVMRefs`, `ILankaSvelteStore` → `ILankaSvelteVM`, `TLankaStoreUnsubscriber`
→ `TLankaVMUnsubscriber`, `TLankaSolidStore` → `TLankaSolidVM`.

`defineLankaComposable` is Vue's word for what it answers — a composable a
component calls — and it leaves `defineLankaVM` free for the scoped-ViewModel
work that phase 14.8 of the plan reserves it for.
