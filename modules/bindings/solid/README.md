# @lankajs/solid

**▸ module** · Solid binding

> One function — `useLankaVM` — over a signal, and the access tracking core already does.

A library in the same box. The app imports and calls it; core does not know it exists.

**Runs in:** the browser and node.

**Requires:** Solid. Enforced by `check-runtime.mjs`, which refuses an import of any other.

**How to use it:** [GUIDE.md](./GUIDE.md) — the user guide, with examples. **How to change it:** [SKILL.md](./SKILL.md).

## Contents

- `useLankaVM` — the one name, and the same one every member of this shelf publishes
- core's six ViewModel factories, under core's own names and already wearing this framework's read — a declaration moves by its import line
- `toLankaCallableVM` — the same read applied to a ViewModel this package did not declare: a class, a library's, or one core built
- `renderWithLanka` (from `@lankajs/solid/testing`) — a render with a bootstrapped framework

## What a Solid call answers

An `Accessor`: `state().todos`. Solid has no re-render — a component function runs
ONCE and what updates is the DOM node that read the signal — so `renders()` in the
conformance suite counts what the reading effect ran, which is the closest thing
this framework has to the question every other binding answers directly.

## Access tracking still earns its place, for a different reason

Solid already skips work a signal did not feed, so a coarse binding would be less
wrong here than elsewhere. It would still be wrong: without tracking, every change
writes a new object into the signal and every effect reading ANY part of it re-runs.
The tracker is what keeps the signal unchanged when nothing a reader looked at moved.

## `onCleanup`, and the one case it is not there

Inside a component or a root, Solid releases the subscription with the owner. Called
outside one there is no owner, so the accessor carries `stop()` and the caller owns
it — the same seam `@lankajs/vue` has for the same reason, and neither framework
warns loudly enough for a note to be sufficient.

---

Repository map: [../../../README.md](../../../README.md)
