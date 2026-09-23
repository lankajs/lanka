# @lankajs/react

**▸ module** · React binding

> One hook — `useLankaVM` — and the access tracking core already does.

A library in the same box. The app imports and calls it; core does not know it exists.

**Runs in:** the browser, node and React Native — everywhere.

**Requires:** React. Enforced by `check-runtime.mjs`, which refuses an import of any other.

**How to use it:** [GUIDE.md](./GUIDE.md) — the user guide, with examples. **How to change it:** [SKILL.md](./SKILL.md).

## Contents

- `useLankaVM` — the one name, and the same one every member of this shelf publishes
- core's six ViewModel factories, under core's own names and already wearing this framework's read — a declaration moves by its import line
- `toLankaCallableVM` — the same read applied to a ViewModel this package did not declare: a class, a library's, or one core built
- `renderWithLanka` (from `@lankajs/react/testing`) — a render with a bootstrapped framework

## What this package is, and what it deliberately is not

It is a subscription and a render trigger. The ACCESS TRACKING — which state keys a
component read, and whether a change touched them — is `createLankaAccessTracker` in
core, published through `lanka/extend`, and every binding on this shelf calls it.
That is why the behaviour a consumer sees is the framework's rather than each
binding's re-reading of it, and it is what `lankaViewBindingConformance` checks.

So the whole of `useLankaVM` is a ref, a stable `subscribe` and
`useSyncExternalStore`. If it ever needs more than the port gives it, the port is
the thing with the defect.

## `"use client"` is here and not in core

React Server Components make an import of a hook a build error. Core has no hook any
more, so `lanka/viewmodel` is server-safe and this barrel carries the directive —
which is the split doing its job: a Next application's server components may read a
ViewModel's state, and only the components that RENDER it are client components.

## One binding for React and React Native

`useSyncExternalStore` is React's, not the DOM's. Expo installs this package and
nothing else changes — which is also why `runtime` says `browser, native` and not
`node`.

---

Repository map: [../../../README.md](../../../README.md)
