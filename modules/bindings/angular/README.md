# @lankajs/angular

**▸ module** · Angular binding

> One function — `useLankaVM` — over a signal, and the access tracking core already does.

A library in the same box. The app imports and calls it; core does not know it exists.

**Runs in:** the browser and node.

**Requires:** Angular. Enforced by `check-runtime.mjs`, which refuses an import of any other.

**How to use it:** [GUIDE.md](./GUIDE.md) — the user guide, with examples. **How to change it:** [SKILL.md](./SKILL.md).

## Contents

- `useLankaVM` — the one name, and the same one every member of this shelf publishes
- core's six ViewModel factories, under core's own names and already wearing this framework's read — a declaration moves by its import line
- `toLankaCallableVM` — the same read applied to a ViewModel this package did not declare: a class, a library's, or one core built

## What an Angular call answers

A `Signal`: `state().rows` in a component, `{{ state().rows }}` in a template. Zoneless
works with no extra step, because a signal is what zoneless change detection reads.

## The injection context, and why it is required rather than optional

`useLankaVM` must be called where Angular can inject — a constructor, a field
initialiser, a factory, or inside `runInInjectionContext`. It asserts that, and the
message names the fix.

That is stricter than the Vue and Solid bindings, which publish a `stop()` for a call
made outside their scope. Angular's reason is different: `DestroyRef` is the ONLY way
to know when the caller goes away, and a subscription with no way to learn that is a
leak with no owner. Where Vue and Solid degrade, Angular refuses — and refusing at the
call is better than a leak discovered in production.

## The injection context reaches a test too

`renderWithLanka` from `@lankajs/angular/testing` renders a component with a live
framework behind it, the way every other member of this shelf does. What differs is
underneath: Angular Testing Library drives `TestBed`, so a component here is compiled
rather than merely mounted — and a ViewModel read in a field initialiser is inside an
injection context, which is the one thing this binding insists on.

---

Repository map: [../../../README.md](../../../README.md)
