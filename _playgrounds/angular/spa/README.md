# @lanka-playgrounds/angular-spa

Atlas in Angular: one project that is both a zoneless single-page application and
a server renderer, over the same ViewModels every other host reads.

Read [`../../README.md`](../../README.md) first — it says what these applications
are and, more importantly, what they are not.

## One project, two entry points

This is the only ecosystem here whose server host is not a separate package.
React needed `next/`, Vue needed `nuxt/`, Svelte needed `sveltekit/`, because in
those frameworks the server story IS a separate project. Angular's is a second
call against the same component tree: [`src/main.ts`](./src/main.ts) bootstraps
into a document, [`src/Core/Server/renderAtlasPage.ts`](./src/Core/Server/renderAtlasPage.ts)
renders into a string, and the shell between them is the same `AtlasApp`.

A scene asserts exactly that, because it is the claim that would quietly stop
being true: if the server ever rendered a shell of its own, this would be two
applications wearing one name.

## What only this one shows

**Zoneless.** `provideZonelessChangeDetection` is the only change-detection
provider anywhere in the ecosystem, and neither manifest declares `zone.js`. What
the binding produces is a SIGNAL, and a signal is what zoneless change detection
already reads — a ViewModel that needed Zone would mean the framework had a
mechanism of its own to be patched.

**A shell with nothing in it.** In every other ecosystem the shell CONSTRUCTS the
ViewModels, because a prop is the only way to hand a component one. Here they
arrive from the injector, so the lifetime question is answered by a provider and
the shell has nothing left to do but name its children. A scene asserts the
component has no own properties at all.

**Where the ViewModels are built instead.** `startAtlasAngular` returns an
`ApplicationConfig` — the one Angular-shaped thing in a start-up file that is
otherwise identical to the other four. Two calls are two applications with two
sets of ViewModels, which is what lets a suite mount the shell twice; a provider
written at module level would be one store per PROCESS.

**A cache handed over by the injector, not by a parent.** The avatar cache is a
provider for the same reason the ViewModels are: it is a DEPENDENCY with the
injector's lifetime, not data a row owns. The row's own data — the avatar URL and
the crew member's name — are inputs, and the line between the two is the one
thing this ecosystem has to decide that the other four never face.

**Gateways that refuse to write during a render.** The server render is given a
`list` that answers from the rows the request scope already read — so a screen's
`ngOnInit`, which does not know it is on a server, gets what it asked for with no
second network call — and writes that reject. A render produces a string, and an
action that completed a mission halfway through producing one would have changed
the world for a page nobody has seen yet.

## The claims, in the same words as the other four

`_playgrounds/react/spa` asserts that a screen renders what the ViewModel holds,
shows what an action wrote without being told to re-read, shows the failure the
ViewModel named, and pages through what the ViewModel derived. This asserts the
same sentences. Reading the five side by side should show only each framework's
own syntax.

## Vite, not the Angular CLI

`lankaDiVite` is a Vite plugin, and an application built by the CLI's own pipeline
would need a different one. Showing the framework under Vite is showing it under
the build a consumer picking Angular today most likely has — and it is what lets
this package's suite compile real templates without a second toolchain.

`@analogjs/vite-plugin-angular` prints one warning per component file, "contains
Angular decorators but is not in the TypeScript program". It is the plugin's own
diagnostic about its AOT pass; the components compile through its JIT path, every
scene renders, and passing the plugin an explicit `tsconfig` changes nothing. It
is recorded here so the next reader does not spend an hour on it.

It is not entirely noise, and `AtlasAvatar` is where that surfaces: a component
compiled by JIT has no compiler to discover its inputs, so **`input()` and
`@Input()` are both unavailable here**. A signal input is never bound and the
first read is NG0950; a field decorator is emitted in the standard form — this
project has no `experimentalDecorators`, deliberately — and Angular refuses it
with "Standard Angular field decorators are not supported in JIT mode". The
`inputs` array in the component's metadata is data rather than syntax, so both
compilers read it the same way, and it is what every component here declares an
input with.

## Running it

```bash
pnpm build                                          # once: the build tools read their own dist
pnpm --filter @lanka-playgrounds/_server start      # http://127.0.0.1:4380/api
pnpm --filter @lanka-playgrounds/angular-spa dev    # http://localhost:4399
```

`ATLAS_API` overrides the address for the SERVER half, with no `VITE_` prefix;
the browser half reads `VITE_ATLAS_API`, because a browser bundle has no other
way to be told anything.
