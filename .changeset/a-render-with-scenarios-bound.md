---
"@lankajs/tool-testing": patch
---

`renderWithLanka` brings the scenario layer up, as it said it did

The helper's own docblock said it rendered "with a bootstrapped framework". It
awaited `lanka.bootstrap()` and never called `lankaScenarioBootstrap.bootstrap()`,
which is what BINDS a ViewModel's `scenarioHandlers`.

So every scene testing a scenario handler rendered a component whose handlers
were never attached — and the assertion that the screen did not change passed for
the wrong reason. Nothing threw and nothing warned. The only way to notice was a
test asserting "the fact arrived and the screen updated", which is exactly the
test nobody writes against a helper they trust.

Bootstrap runs after `setup?.(lanka)`, not before: `setup` is where a scene
registers its ViewModels and doubles, and binding happens against what exists
when it runs. Called first it would bind an empty registry — the same bug with
the order reversed.

**Worth re-reading your scenes after upgrading.** A scene that passed while its
handlers were inert may now genuinely exercise them, and that is the point.
