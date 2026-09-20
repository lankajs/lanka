# @lankajs/svelte

**▸ module** · Svelte binding

> One function — `useLankaVM` — over `createSubscriber`, and the access tracking core already does.

A library in the same box. The app imports and calls it; core does not know it exists.

**Runs in:** the browser.

**Requires:** Svelte. Enforced by `check-runtime.mjs`, which refuses an import of any other.

**How to use it:** [GUIDE.md](./GUIDE.md) — the user guide, with examples. **How to change it:** [SKILL.md](./SKILL.md).

## Contents

- `useLankaVM` — the one name, and the same one every member of this shelf publishes
- core's six ViewModel factories, under core's own names and already wearing this framework's read — a declaration moves by its import line
- `toLankaCallableVM` — the same read applied to a ViewModel this package did not declare: a class, a library's, or one core built
- `renderWithLanka` (from `@lankajs/svelte/testing`) — a render with a bootstrapped framework

## `createSubscriber`, not the store contract

Svelte 5 reads a `{ subscribe }` object as a store, and a ViewModel nearly is one —
the shapes differ only in that Svelte calls the listener immediately and lanka does
not. Bridging that is two lines, and it was rejected anyway: the store contract is
Svelte 4's way, it does not compose with `$state`, and a consumer would have written
`$todoVM` where every other framework writes a plain read.

`createSubscriber` from `svelte/reactivity` is the current answer, and it is plain
TypeScript — which is why this package needs no compiler and builds with `tsup` like
every other one here. What a consumer gets back is an object whose properties are
getters, so reading one inside an effect or a template subscribes to it.

## The getters are the tracking, not a convenience

Svelte's reactivity is read-driven: it knows what an effect depends on because the
effect READ it. That is the same question `createLankaAccessTracker` answers, so the
two line up exactly — a component reading `state.todos` records `todos` in the
tracker AND registers with Svelte's graph in one access.

---

Repository map: [../../../README.md](../../../README.md)
