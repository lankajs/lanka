# @lanka-playgrounds/micro-frontends

Two modules in two frameworks — one React, one Vue — each built ON ITS OWN by
`vite build`, loaded onto one page by a shell that starts lanka once.

> [!NOTE]
> One framework per application is the recommendation, and nothing here
> changes it. Several frameworks on one page are ALLOWED and SUPPORTED — for a
> migration in progress, for modules owned by different teams, for
> micro-frontends — and this application is what holds that support to a test
> rather than a paragraph. `ARCHITECTURE.md`, "Several frameworks in one
> application", is where the advice lives.

## Why this application exists

[`astro/`](../astro) already puts four frameworks on one page, but in ONE
bundle: one build, one module graph, one `lanka` by construction. Nothing proved
the arrangement where that stops being automatic — modules built by separate
pipelines, which is where a bundler quietly inlines a second copy of the
framework.

## The claim

**One copy of `lanka` on the page is the whole requirement.** Everything else
may be duplicated, and here it is: each bundle carries its own copy of the
ViewModel factory, of the binding, and of the scenario definitions from
[`../_shared`](../_shared). The shell triggers a THIRD copy of
`atlasMissionAssigned`, from source, and both modules repaint.

Why that is enough is stated once, in `ARCHITECTURE.md`, "Several frameworks in
one application"; this suite is what keeps it true.

A module loaded AFTER the shell started lanka — the order a remote arrives in —
has its ViewModels adopted by the running instance, and hears scenarios like any
other. The first scene is in that order on purpose.

## The accident, reproduced by a bundler

The Vue module is built a second time with `lanka` NOT external, so the bundle
carries its own copy. That copy is never started, because the shell already
did — which is exactly what a real module in that position does. Its screen
renders correctly and never hears a scenario again.

Core makes that loud. A copy of `lanka` that loads onto a page where another
copy is running in development warns as it loads, and a copy asked for an
instance it does not have says that another copy has one. The second scene
asserts the warning, and the silence that follows it.

## How the builds are made

`vitest.globalSetup.ts` runs [`buildMicroFrontend`](./src/Core/Build/buildMicroFrontend.ts)
three times before the suite: both modules against one `lanka`, and the Vue
module carrying its own. The bundles land in `dist/` INSIDE this application,
and that is load-bearing — `vitest.config.ts` says why.

The UI frameworks are external in both variants. That keeps each build to a
second and is not part of the claim: whether a module ships its own React is a
question about React.

## Two constraints

- **Each scene starts the shell itself.** The test kit's setup puts a fresh,
  unstarted instance in place before every test, so a `startLanka` in
  `beforeAll` is not the running instance by the time a scene triggers, and the
  scenario reaches nobody.
- **Core checks as a copy LOADS, not only as one starts.** A bundled copy that
  is never started does nothing else the page can see, so a check on
  activation alone is silent about the commonest form of the accident.

## Running it

```bash
pnpm --filter @lanka-playgrounds/micro-frontends test
```

No dev server: there is no page to look at that the suite does not already
build and load.
