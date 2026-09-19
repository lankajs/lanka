---
"lanka": patch
"@lankajs/react": patch
"@lankajs/vue": patch
"@lankajs/svelte": patch
"@lankajs/solid": patch
"@lankajs/angular": patch
"@lankajs/tool-testing": minor
---

Six scenes added to the conformance suite, and three defects came out that every
binding's own green suite had agreed with.

The suite asked about one mount, one change and one reader. What it did not ask
about is where the bindings differed: a selector that builds its answer, several
changes in one turn, the actions sitting beside the state, a second reader
leaving, a key written the value it already held, and a reader whose read set
MOVES between renders. Those are the six, and they run for all five members.

**React crashed on the commonest selector there is.**
`useLankaVM(vm, (s) => ({ a: s.a }))` threw "Maximum update depth exceeded" on
the first paint: `useSyncExternalStore` reads the snapshot during render and
again after committing, and a fresh object never agrees with itself. The binding
now runs a selector once per state object and holds the answer, so the two reads
of one commit see the same reference. `useLankaShallow` is unchanged and still
worth reaching for — it is what stops the reader waking for changes outside its
selection — but it is no longer what stands between you and a crash.
`skills/parity/SKILL.md` already said this belonged in `useLankaVM` rather than
in an idiom on top of it.

**React showed the wrong ViewModel after a swap.** A component handed a
different ViewModel at the same mount point — an ordinary prop change — kept
reading the first one for ever: the access tracker closes over the ViewModel it
was built with, and it was built once per mounted component. The subscription WAS
rebuilt, so the screen woke on the new ViewModel's changes and then re-read the
old one's state. A live subscription and a frozen screen, with no error anywhere.

**Vue leaked a subscription per server request.** `useLankaVM` subscribed during
`setup`, and on a server nothing is ever unmounted — the instance's scope is
never stopped, so `onScopeDispose` never runs. Every render left a listener on a
module-level ViewModel for the life of the process. Inside a component the
subscription now starts in `onMounted`, a lifecycle a server never reaches, with
a catch-up read for a change that landed between setup and mount; outside a
component — a module-level read, a test, a bare `effectScope` — it opens
immediately, as before.

That last one was invisible because the scene that asks it was being SKIPPED,
for a reason that had stopped being true: the suite takes a promise from
`renderToString` and has since the second binding was written. `@lankajs/vue`
answers it now. `@lankajs/solid`, `@lankajs/svelte` and `@lankajs/angular` still
skip it and now say why, in the adapter, beside the skip.

`lanka/extend`'s own `createLankaViewSubscription` — advertised as the whole of a
view binding minus the framework — is run through the suite too. It had one
caller in the repository and no claim on the shelf's bar, which is the first
thing a promise a consumer is invited to build on loses.

## One thing the port promised without saying so

`ILankaReadableVM.getState()` answers the SAME object until something changes,
and every binding holds something against that identity — the access tracker
caches its recording proxy by it, and React now holds a selector's answer the
same way. Six factories keep the property and the interface never mentioned it,
so a consumer's own implementation that composed a fresh object per call would
reintroduce the React crash in code that looked correct in the other four. It is
written on the interface now.

`createLankaViewSubscription`'s first line called itself "the whole of what a
view binding is, minus the framework". It is the TRACKED half — every shipped
member also has a selector arm it deliberately does not serve — and it says so.
