# @lankajs/tool-testing

**⚒ tool** · Test kit

> The only package allowed into core's internals, and therefore the one that justifies sealing them.

Runs before runtime — build, lint, test. Neither module nor plugin.

**Runs in:** node.

**How to use it:** [GUIDE.md](./GUIDE.md) — the user guide, with examples. **How to change it:** [SKILL.md](./SKILL.md).

## Contents

- `setupTests` — resets the registry, timers, mocks and DOM between tests
- `lankaTestHost` — a host for a spec that is not about the host
- `createLankaFakeTransport` — one answer, or a route per endpoint with `times` and `delayMs`
- `registerLankaFakes` — which double stands for which name, in all four locators
- `createLankaEventRecorder`, `createLankaLogRecorder` — what crossed the bus, what was logged
- `waitForLankaIdle` — the wire is clear and the work it started has settled
- `lankaValidatorConformance` — the assertions every `modules/validators/` package must pass
- `lankaStorageAdapterConformance` — the same, for every adapter behind `ILankaStorageAdapter`
- `createLankaFakeStorageAdapter` — a storage engine in a `Map`, and the port's second implementation

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

## A helper that waits, rejects

`waitForLankaIdle` and the event recorder's `waitFor` both fail on their deadline and
name their subject. A helper that resolved late and silently is how a suite fills with
tests that pass without the thing having happened — and those are the tests nobody can
tell apart from the ones that mean something.

## What the kit does NOT double

A ViewModel: it is the subject, and what it needs from outside arrives as parameters.

Storage was on this list until the port moved, and the reason it was here still holds:
this package depends on `lanka` and nothing else, so a double over a MODULE's port would
invert the direction the whole repository points. What changed is the port —
`ILankaStorageAdapter` is declared in `lanka/storage`, and the double stands over core's
interface rather than over `@lankajs/storage`.

---

Repository map: [../../README.md](../../README.md)
