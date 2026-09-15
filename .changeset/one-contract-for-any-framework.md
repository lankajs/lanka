---
"lanka": minor
"@lankajs/tool-testing": minor
---

Writing a binding for a framework lanka does not ship is now a documented
contract rather than a reading of five packages.

`lanka/extend` publishes `createLankaViewSubscription(viewModel, onChange)` —
the four steps every shipped binding takes, written once: subscribe, ask whether
the change touched anything this reader READ, report the skip so the blind-spot
diagnostic can fire, and hand back a read that records and is live. What is left
to an author is how their framework is woken and how it says a reader has gone,
which is the only part nobody else can know.

```ts
export const useLankaVM = (viewModel) => {
	const view = createLankaViewSubscription(viewModel, () => myFramework.invalidate());
	myFramework.onTeardown(view.stop);

	return view.read;
};
```

The five shipped idioms were rewritten onto it, so the abstraction is the one
they use rather than one written for somebody else.

`lankaViewBindingConformance` now drives EVERY shape of ViewModel — plain, lazy,
`ALankaVM.build()`, shared-store, lazy shared-store, `ALankaSharedStoreVM.build()`
and stateless — so a binding that only ever met the plain factory is held to the
rest. Seven scenes, added rather than reworded, and every member of the shelf
answers them.

`@lankajs/tool-testing` also publishes `createLankaFakeFormVM`: a form whose two
fields are two ROOT keys, which is what makes "re-render the input that changed
and not its neighbour" a question a binding can be asked at all. Five copies of
that ViewModel would have diverged on the day one of them gained a key.

`tools/testing`'s guide now carries the whole authoring path: the port, the
mechanism, the proof, what the scenes hold a binding to, and how far an idiom of
its own may go.
