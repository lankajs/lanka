# Hosts

lanka is never the whole application. It sits inside somebody's Next, React
Router, TanStack Start, Astro or Expo project, and that project already owns
routing, rendering, bundling and — often — a data cache.

This skill owns two questions: **where each layer of the framework may run**, and
**what the framework refuses to do because the host already does it**.

`skills/surface/SKILL.md` owns what a name promises. This one owns where that
promise holds.

## The one rule

**A layer's environment follows from what it imports, and is declared, not
assumed.**

| Layer                          | What is in it                          | Runs in                      |
| ------------------------------ | -------------------------------------- | ---------------------------- |
| gateway, locator, scenario bus | transport, tagged failures, validation | browser, node, react-native  |
| viewmodel                      | a store, and the scenarios bound to it | browser, node, react-native  |
| view binding                   | ONE framework's way of subscribing     | wherever that framework runs |
| view                           | JSX, SFCs, templates                   | the host's                   |

The viewmodel row used to read "React and zustand — a CLIENT". It changed when
the hook left core: a ViewModel is a store now, `lanka/viewmodel` imports no UI
library, and a server component may read its state. What a SCREEN uses to read
one is the row below it, and there is one package per framework —
`modules/bindings/`, `skills/structure/SKILL.md` 5d.

This is the one checked rule of the framework (`gateways → ViewModels → views`,
imports one way) read in the direction of the environment. It is not a second
architecture: a gateway that could not run in node was already importing
something a gateway may not import.

## 1. Every package declares its environments

`runtime` in `scripts/registry.mjs`, from a closed list: `browser`, `node`,
`native`. All three means universal. The declaration reaches the package README,
so a consumer reads it without opening the source.

An ENTRY may declare its own and override the package's — `@lankajs/host` is
browser code plus a `/server` subpath that imports `node:async_hooks`. What a
consumer imports is a subpath, so a subpath is what has to be true.

`check-runtime.mjs` is the executable half. It walks the import graph of every
published entry, and that entry may only touch what EVERY environment declared
for it provides:

| Environment | Provides                             | Does not provide |
| ----------- | ------------------------------------ | ---------------- |
| `browser`   | `window`, `document`, Web Storage, … | `node:*`         |
| `node`      | `node:*` builtins                    | the DOM          |
| `native`    | neither                              | both             |

Tags: `[runtime-undeclared]`, `[runtime-not-kept]`,
`[runtime-unknown-environment]`.

### 1a. A UI framework is the second axis, and it is a field

`runtime` answers **where** a package can run. `framework` answers **what must
already be installed** for it to run at all, from the closed list in
`scripts/registry.mjs`: `react`, `vue`, `svelte`, `solid`, `angular`. The two are
independent — a binding is `["browser", "native"]` AND React — and almost every
package here declares neither the framework nor needs one.

**A field, not a directory**, and the precedent is `runtime` itself.
`@lankajs/browser` cannot run without a DOM and does not live in a `browser/`
folder. A `frameworks/` bucket would cross this axis with `kind`, which says how
a package relates to CORE rather than what it depends on — and a React-specific
plugin would then sit outside `plugins/`, giving every gate that asks "is this a
plugin" a second directory to read. `skills/structure/SKILL.md` 5c owns that.

`check-runtime.mjs` reads it in four directions:

| Tag                       | The defect                                                       |
| ------------------------- | ---------------------------------------------------------------- |
| `[framework-undeclared]`  | an entry imports a framework the package never declared          |
| `[framework-unused]`      | the package declares one no entry imports — a peer nobody needed |
| `[framework-unknown]`     | the declared name is not on the list                             |
| `[framework-in-manifest]` | the package SHIPS a framework to consumers while declaring none  |

The fourth is about the manifest rather than the code, and it is the one worth
the sentence: an import can be deleted while the dependency stays, and the
dependency is what an application installs. `lanka` peer-depending on `react`
puts React in a Vue application's install graph whether or not a line imports it.

**Importing and installing are different questions, and `zustand` is where they
part.** Its bare entry is React's binding — `create` calls hooks — so importing
it means React is RUNNING. But zustand 5.0.15 has no `dependencies` at all and
declares `react` as an OPTIONAL peer, and `zustand/vanilla` and
`zustand/middleware` contain zero import statements between them. Measured, not
assumed. So depending on zustand installs nothing, and a package may do it
without declaring a framework — while reaching for the bare entry still fails.

## 2. A guarded global is a capability, not a requirement

```ts
if (typeof EventSource !== "function") return; // degrade, do not throw
```

A global reached behind `typeof x` is a feature detection and does not narrow the
package's environments. An unguarded one does — because it is a requirement, and
the environment that lacks it gets a `ReferenceError` from inside the framework
instead of a decision from the package.

The gate reads guards per FILE, not per package: a guard three files away is not a
guard.

## 3. A node builtin lives behind its own entry point

`node:fs` is in `@lankajs/tool-di`, a package a browser bundle has no reason to
resolve; `node:async_hooks` is behind `@lankajs/host/server` for the same reason.
One stray import of either from application code would drag a node builtin into a
browser bundle, and a separate entry point makes that impossible rather than
merely discouraged.

The rule is about REACHABILITY, not intent: a universal package with one node
import is a browser build that breaks on a bundler with different tree-shaking.

## 4. The framework declares its own client boundary

React Server Components make an import of a hook a build error, and the fix
belongs to whoever knows which entry touches React — the framework, not the
consumer. `"use client";` is the FIRST LINE of the barrel that needs it, and
esbuild carries it into `dist/<entry>/index.js` untouched.

**This is ONE framework's rule, not a general client boundary.** RSC is React's
mechanism; Vue, Svelte, Solid and Angular have no equivalent and no use for the
directive. So the check is keyed on React's import list alone — an entry reaching
`vue` is a Vue entry, not a client entry — and a directive there would be cargo
that costs a consumer a server render.

**A `tool` is never asked.** `kind: "tool"` is defined as running before runtime
— build, lint, test — so nothing renders one and there is no server component for
the directive to protect. The gate discovered this itself the day
`@testing-library/react` joined the import list and it demanded a boundary from
`@lankajs/tool-testing`, a package `runtime: ["node"]` that no application
bundles. The exemption is written because the question does not apply, which is
the only reason an exemption may be written at all — see
`skills/gates/SKILL.md` §4.

In the source, not a build option: `tsup`'s banner is per build, not per entry,
so a banner would put the directive on all fourteen of core's entries and make
the whole framework client-only in a server build. A directive is a fact about
one module and belongs in that module.

`check-runtime.mjs` decides which entries those are by FOLLOWING IMPORTS from
each published subpath — not by folder, because core's root barrel sits above
`viewmodel/` and does not re-export it. It fails in both directions:

| Tag                          | The defect                                                                      |
| ---------------------------- | ------------------------------------------------------------------------------- |
| `[client-boundary-missing]`  | the graph reaches React and the entry does not say so                           |
| `[client-boundary-spurious]` | the entry says so and reaches no React — a subpath made client-only for nothing |

Type-only imports do not count: a type disappears at compile time, and an entry
that merely DESCRIBES a component runs nothing on the server. Neither do
`zustand/vanilla` and `zustand/middleware`, which contain no hook.

## 5. What the framework will not do because the host does it

| The host owns                              | So lanka has no                     |
| ------------------------------------------ | ----------------------------------- |
| routing, layouts, navigation               | router, no `<Link>`, no route table |
| SSR, streaming, hydration of the page      | renderer                            |
| bundling, env-var injection, asset hashing | bundler opinion beyond an alias     |
| the request cache and its revalidation     | second cache                        |
| styling, components                        | component library                   |

**A capability the host already has is not a feature — it is a second answer to
one question**, and the application ends up owning the disagreement. The
framework's contribution is the layer no host ships: gateways with tagged
failures and a validated body, a ViewModel per screen, and coordination between
screens that imports nobody.

Rejected twice for this reason: a lanka router thin wrapper (the host's is
better and already there), and caching inside the gateway (Next, RRv7 and
TanStack Start each have one, and two caches disagree on the first mutation).

**The row only holds while there IS a host.** A plain Vite SPA has no request
cache, so the slot is empty rather than taken, and two screens reading one
resource pay twice. Say so when advising: refusing to ship a cache is not the
same as refusing to be used with one, and the application fills the slot itself —
a `QueryClient` registered as a singleton, called from ViewModel actions.
`ARCHITECTURE.md` carries the three shapes and what must be divided up.

What that changed, and what it did not. The PORT is published — `lanka/cache`,
seven signatures and no implementation — because two libraries bind it and
`modules/query/` holds both. What core still ships is no cache: it declares the
shape and calls it from nowhere, the way it declares `ILankaTransport` and ships
one fetch-backed default.

The measurement behind "two": Apollo, urql and RTK Query are a transport AND a
cache, so they replace a layer rather than adapt to one; SWR's public surface has
no cache subscription and no cancellation. It was `@tanstack/query-core` and
`@nanostores/query` — which is also why `cancel` is OPTIONAL on the port, since
nanostores' fetcher never receives a signal.

## 5a. One name per rendering mode, when the modes differ in what may cross

`@lankajs/host/server` publishes `runLankaRequest` and `runLankaStatic` over one
scope, and the second name is not sugar: a request may carry the caller's `cookie`
into the API call, and a build may not. Output written once and served to
everybody must not carry one reader's identity, so the static call refuses headers
in the type AND at runtime.

The general form of the rule: **two modes get two names when they differ in what
is ALLOWED, and one name with a flag when they differ only in what happens.** A
boolean here would have been a default somebody flips, and the failure it flips
into is a data leak no test sees — the build succeeds and the page looks right to
whoever ran it.

## 6. Where the boundary is written for consumers

The rule lives here. The consumer-facing prose lives where a consumer looks:

| Reader                           | Document                                       |
| -------------------------------- | ---------------------------------------------- |
| somebody choosing lanka          | `ARCHITECTURE.md` — "Inside another framework" |
| somebody wiring the build        | `tools/di/GUIDE.md` — one recipe per host      |
| somebody writing a server loader | `modules/host/GUIDE.md`                        |
| somebody's coding agent          | the shipped skills, generated from the guides  |

Every one of those is generated or hand-written where it stands; none of them is
allowed to state the rule differently from this file. When they disagree, this
file is the canon and the other is the bug.
