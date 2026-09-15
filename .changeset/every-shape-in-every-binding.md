---
"@lankajs/tool-testing": minor
---

All NINE ways of building a ViewModel, in every binding, in the suite and in the
playground.

The conformance suite drove six shapes and one stateless factory; it now drives
every one core publishes — `createLankaVM`, `createLazyLankaVM`,
`ALankaVM.build()`, `createSharedStoreLankaVM`, `createLazySharedStoreLankaVM`,
`ALankaSharedStoreVM.build()`, `createStatelessLankaVM`,
`createLazyStatelessLankaVM` and `ALankaStatelessVM.build()`. The two that were
missing were the lazy and class STATELESS shapes, and nothing would have caught a
binding that broke on either.

`LANKA_VM_SHAPES` and `LANKA_STATELESS_VM_SHAPES` are published for a reason the
suite cannot serve: a binding's own IDIOM — a callable ViewModel, a Pinia-shaped
store, a Svelte store, a Solid store, a signal per field — is not what `mount`
drives. Each package now loops over the same two lists in its playground, so an
idiom is held to every shape the port is. A third-party binding author has the
same need the day they add a spelling of their own.

`createLankaFakeFormVM` now answers `ILankaFieldError` — a path in SEGMENTS —
rather than a shape of its own, so a screen written against the double reads
exactly like one written against a real validator. The React and Vue playgrounds
dropped their private copies of that ViewModel and use it: three copies of one
form was what `check-composition` called it.
