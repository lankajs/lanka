# @lankajs/vue

**▸ module** · Vue binding

> One composable — `useLankaVM` — and the access tracking core already does.

A library in the same box. The app imports and calls it; core does not know it exists.

**Runs in:** the browser.

**Requires:** Vue. Enforced by `check-runtime.mjs`, which refuses an import of any other.

**How to use it:** [GUIDE.md](./GUIDE.md) — the user guide, with examples. **How to change it:** [SKILL.md](./SKILL.md).

## Contents

- `useLankaVM` — the one name, and the same one every member of this shelf publishes
- `renderWithLanka` (from `@lankajs/vue/testing`) — a render with a bootstrapped framework

## What a Vue call answers, and why it differs from React's

`useLankaVM(vm)` hands back a `ShallowRef`, so a template reads `state.todos` and a
script reads `state.value.todos`. React hands back the state itself. That is the one
difference the shelf does NOT hide: it is the framework's own idea of reactivity, and a
binding that flattened it would be a second reactivity system fighting the first —
every `watch` a consumer wrote would stop seeing changes.

Everything else is identical, and `lankaViewBindingConformance` is what says so rather
than this paragraph: every scene this package runs is one `@lankajs/react` runs too,
and writing this package reworded none of them.

## No client directive, and nothing to replace it

React Server Components make importing a hook a build error; Vue has no equivalent and
needs no directive. Nuxt renders this package on the server as ordinary code.

## The effect scope, and the one case it is not there

Inside a component or an `effectScope`, the subscription is released by
`onScopeDispose` and a consumer does nothing. Called OUTSIDE one — a module-level read,
a test — there is no scope to attach to, so the returned ref carries `stop()` and the
caller owns it. Vue warns about the first case and says nothing about the second, which
is why the second is a published member rather than a note.

---

Repository map: [../../../README.md](../../../README.md)
