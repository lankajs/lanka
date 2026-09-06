---
"lanka": minor
---

`scenarioHandlers` accepts a factory, so a ViewModel declared at module level can
name its scenarios through the locator without reading it at import time.

A binding entry names its scenario, and an application names one as
`lankaScenarios.<name>` — a locator read. Written as an array literal in a module
body it happens while that module is EVALUATED, and a module body can run before
`createLanka` has: the locator then refuses with "lanka used before an instance
existed" and nothing renders.

Import order is not a defence. It holds inside one chunk, and a bundler decides
chunks — in ES modules the body of an imported chunk runs before the body of the
chunk importing it. Measured in a real application: 44 of its chunks were
statically imported by the entry, its ViewModels among them, so they evaluated
ahead of its own `createLanka` call and its whole browser-level suite died on the
first. Every unit test passed throughout, because a test runner evaluates modules
one at a time and never builds a chunk graph.

`gateways` and `services` have taken a factory for this exact reason since
`resolveLankaDependency` was written. Bindings were the field left out, and they
are the field that reads the locator most.

The array form is unchanged and still eager, in all three ViewModel families and
in both styles: a factory is read at bind time by the binder, and its presence
alone counts as "this ViewModel has scenarios" — counting them would be the very
read the form postpones.
