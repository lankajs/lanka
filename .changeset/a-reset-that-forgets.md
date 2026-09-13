---
"lanka": minor
---

A scenario reset can forget declarations, so a suite can isolate a ViewModel

`lankaScenarioBootstrap.reset()` exists for test isolation and did not provide
it. It cleared subscriptions, the scenario registry and the bus — but not which
ViewModels had been DECLARED, and nothing else un-declares one. So the next
`bootstrap()` re-adopted every ViewModel ever built in the process, and a
finished test's ViewModel heard the next test's facts, running its handlers
against the double THAT test had created.

The symptom never reads as a stale subscriber. It is one extra call on somebody
else's mock, or a rejection surfacing inside a test that had already passed.

```ts
beforeEach(() => {
	lankaScenarioBootstrap.reset({ withDeclarations: true });
});
```

**Opt-in, and that is the design rather than caution.** The default is what an
APPLICATION needs and it is load-bearing: a module-level ViewModel is built once
per process, so the declaration is the only thing that lets a second instance
find it. Clearing it by default would bind its handlers to nothing for the rest
of the process, silently — the exact failure the list exists to prevent. A suite
whose ViewModels all live at module level should keep the default.

Forgetting is not a tombstone: a ViewModel declared again afterwards is adopted
again.

`ILankaScenarioResetConfig` is added to `lanka/scenario`. Nothing is removed and
`reset()` keeps its no-argument call.
