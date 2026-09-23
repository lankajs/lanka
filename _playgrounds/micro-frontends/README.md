# @lanka-playgrounds/micro-frontends

Modules in four frameworks — React, Vue, Svelte, Angular — each built ON ITS
OWN, by Vite, webpack or Rspack, loaded onto one page by a shell. Some share the
shell's lanka; some carry their own, by accident or on purpose.

> [!NOTE]
> One framework per application is the recommendation, and nothing here
> changes it. Several frameworks on one page are ALLOWED and SUPPORTED — for a
> migration in progress, for modules owned by different teams, for
> micro-frontends — and this application is what holds that support to tests
> rather than to a paragraph. `ARCHITECTURE.md`, "Several frameworks in one
> application", is where the advice lives.

## Why this application exists

[`astro/`](../astro) puts four frameworks on one page, but in ONE bundle: one
build, one module graph, one `lanka` by construction. Nothing else proved the
arrangement where that stops being automatic — modules built by separate
pipelines, by different bundlers, which is where a bundler quietly inlines a
second copy of the framework and where two teams' output first meets.

## The matrix

`vitest.globalSetup.ts` runs every team's pipeline before the suites:
[`microFrontendPipelines.ts`](./src/Core/Build/microFrontendPipelines.ts) is
the list, [`buildWithVite`](./src/Core/Build/buildWithVite.ts) and
[`buildWithWebpack`](./src/Core/Build/buildWithWebpack.ts) and
[`buildWithRspack`](./src/Core/Build/buildWithRspack.ts) the three bundlers,
and [`isProvidedByThePage`](./src/Core/Build/isProvidedByThePage.ts) the one
rule all three apply — so two bundles of the same module differ in the bundler
and nothing else.

Seventeen bundles: every framework through every bundler, and each bundler
building modules that share lanka and modules that carry their own — the
table is beside the list it describes.
[`microFrontendPipelines.test.ts`](./src/microFrontendPipelines.test.ts)
holds the matrix to what it claims: every bundle built is loaded by some scene,
every framework goes through every bundler, and each bundler produces both a
module that shares lanka and one that carries its own. A bundle built and never
loaded would look covered and not be.

## The scenes

**[`oneLanka.test.ts`](./src/oneLanka.test.ts)** — modules from all three
bundlers over the shell's one lanka. The shell's scenario reaches all four
frameworks; a write that starts in one module — the React module's button,
through its own ViewModel's action — repaints the other three, whether they came
from webpack or from Rspack; and every module leaves with its ViewModels when the
shell closes the scope it handed over. Make webpack bundle lanka into the
modules that should share it and the scenes that load its bundles fail.

**[`relay.test.ts`](./src/relay.test.ts)** — applications with their own lanka,
joined by [`@lankajs/plugin-relay`](../../plugins/relay/GUIDE.md), mixed with
modules that share the shell's. The main scene is everything at once: one click
in a webpack-built React app running its own lanka repaints an Angular app
built by Vite running its own, and Svelte and Vue modules sharing the shell's —
four frameworks, two bundlers, three copies of lanka, one fact. The same page
again with every module moved to another bundler — React from Rspack, Vue from
Vite, each with its own lanka — says it holds whoever built what. An app that
loads after the one that assigned has LEFT is still handed the value, because
the shell retained it. Take the shell's relay away and every scene here fails.

**[`accident.test.ts`](./src/accident.test.ts)** — a module that bundled its own
lanka by accident, once per bundler: the copy warns as it loads, and the first
thing the module asks its own copy for names the other copy as the cause.

**[`toolDiUnderRspack.test.ts`](./src/toolDiUnderRspack.test.ts)** —
[`@lankajs/tool-di`](../../tools/di/GUIDE.md)'s webpack plugin, handed to
Rspack unchanged, as its guide tells a consumer to. Vite and webpack alias
`@lanka_di` to the test kit's fixture; Rspack wires it through the plugin, into
a barrel root the build empties first. The barrels are there afterwards, and the
bundles that carry lanka import none of them. Take the plugin out and the build
itself fails, on `Can't resolve '@lanka_di/Gateways'`.

## What each module is

One entry per framework, and the same entry whatever the arrangement: an
isolated module is the shared-lanka entry mounted by
[`mountIsolated`](./src/Core/Isolation/mountIsolated.ts), which starts its own
lanka, gives it a scope, and joins the channel. Isolation is a decision about
where a module runs, not a second way to write it.

- **Angular** is compiled in the page (JIT) and declared by calling
  `Component({...})(class)` rather than with a decorator, so one source goes
  through Vite, webpack and Rspack alike without an Angular plugin in any. Zoneless;
  the ViewModel reaches the component through an `InjectionToken`, since a
  component class per mount would collide on its selector.
- **Svelte** is the one module a bundler must be told about — Vite through its
  Svelte plugin, webpack and Rspack through the same `svelte-loader` — and the
  same `.svelte` file goes through all three.
- **React and Vue** need nothing beyond TypeScript: esbuild inside webpack,
  Rspack's built-in swc inside Rspack, Vite's own for Vite. The Vue module is a render function, so this package
  typechecks under plain `tsc` beside React.

## Constraints

- **Frameworks are provided by the page** in every bundle; only `lanka` differs.
  Whether a module ships its own React is a question about React.
- **Rollup builds one module per `vite build`**, since it would hoist what two
  entries share into a chunk both load — one copy of lanka. Webpack and Rspack
  build a pipeline in one compilation: with `splitChunks` off, each entry file
  carries its own copy of everything.
- **Bundles land in `dist/` inside this application**, which is load-bearing —
  `vitest.config.ts` says why, and why Svelte is inlined with the browser
  condition.
- **Each scene starts the shell itself.** The test kit's setup puts a fresh,
  unstarted instance in place before every test.
- **An isolated module joins the channel after its screen is mounted.** A value
  the page retained is handed over on joining, and joining last lands it on a
  subscriber directly.

## Running it

```bash
pnpm --filter @lanka-playgrounds/micro-frontends test
```

About a minute of the run is the seventeen builds. No dev server: there is no
page to look at that the suites do not already build and load.
