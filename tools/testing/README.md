# @lankajs/tool-testing

**⚒ tool** · Test kit

> The only package allowed into core's internals, and therefore the one that justifies sealing them.

Runs before runtime — build, lint, test. Neither module nor plugin.

**Runs in:** node.

**How to use it:** [GUIDE.md](./GUIDE.md) — the user guide, with examples. **How to change it:** [SKILL.md](./SKILL.md).

## Contents

- `setupTests` — resets the registry, timers, mocks and DOM between tests
- `lankaTestHost` — a host for a spec that is not about the host

## Why the kit exists

Without a public way to start over, tests reach into core's scenario registry directly,
and the absence of an API becomes N call sites that any registry refactor breaks.

`resetLanka()` creates a NEW instance and DISPOSES the previous one. Both are required:
cleaning leaves behind whatever nobody remembered to clean, and an instance dropped
without disposal keeps ViewModel subscriptions alive — they are declared at module level
and outlive any test, so the second test receives events the first subscribed to.

`renderWithLanka()` gives a fresh instance on EVERY call. A test that inherits foreign
subscriptions passes or fails depending on its neighbour — the worst kind of unreliable
test, because it goes red where nothing is broken.

The scenario double returns a REAL unsubscribe. A stub would make the test "the
ViewModel unsubscribes" prove only that a function was called.

---

Repository map: [../../README.md](../../README.md)
