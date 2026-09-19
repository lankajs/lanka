---
"lanka": minor
"@lankajs/react": patch
---

`createLankaShallowHold` — the comparison that makes a selector mean something,
in core where all five bindings can reach it.

A selector narrows what a reader depends on, and a selector that BUILDS its
answer cannot say so: `(state) => ({ a: state.a })` is never identical to its own
previous result, every binding compares selections by identity, and the reader
therefore wakes for every change in the ViewModel including the keys the selector
exists to ignore.

```ts
import { createLankaShallowHold } from "lanka/viewmodel";

const hold = createLankaShallowHold<{ title: string; status: string }>();

// in any binding on the shelf
const view = useLankaVM(missionVM, (state) =>
	hold({ title: state.title, status: state.status }),
);
```

## Why it moved

It was `useLankaShallow` in `@lankajs/react` and nowhere else, declared as a
React idiom. An idiom is a SPELLING — `lankaVMToRefs` is meaningless without
Vue's refs, `toLankaObservable` without RxJS — and this was a capability: it
changes which notifications reach a reader, and it carries a policy (one level
deep, own keys, `Object.is`) that five packages inventing separately would have
answered five ways. `skills/parity/SKILL.md` 3c now carries the test that
distinguishes the two: could a sibling want it? A spelling cannot be wanted by
another framework; a capability can.

`useLankaShallow` keeps working and did not change shape. What is left in it is
the half that is genuinely React's: a component re-runs the hook on every render,
so the holding has to survive a render while the SELECTOR stays the current one —
a ref, which core cannot have. That asymmetry is also why the core name holds a
VALUE rather than wrapping a selector: a selector-level wrapper would be rebuilt
whenever the selector's identity moved, and an inline arrow is a new function
every render, so the holding would reset before it ever held anything.

The comparison's own scenes moved with it, to `core/src/viewmodel/`. React's spec
keeps the two that are its own and cannot be asked anywhere else — that the hold
survives a re-render, and that a selection computed from props does not go stale
— and each of them fails when the other arrangement wins.

One behaviour is deliberately not preserved: a selection that is legitimately
`undefined` is now held like any other. The React version keyed "have I held
anything yet" on the value being `undefined`, so such a selection was never
cached. It could not be observed — `Object.is(undefined, undefined)` is true, so
no reader woke for it — and a flag is the honest spelling either way.
