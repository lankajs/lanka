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

| Layer                            | What is in it                             | Runs in                          |
| -------------------------------- | ----------------------------------------- | -------------------------------- |
| gateway, locator, scenario bus   | transport, tagged failures, validation    | browser, node, react-native      |
| viewmodel                        | React and zustand                         | browser, react-native — a CLIENT |
| view                             | JSX                                       | the host's                       |

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

| Environment | Provides                                | Does not provide                        |
| ----------- | --------------------------------------- | --------------------------------------- |
| `browser`   | `window`, `document`, Web Storage, …    | `node:*`                                |
| `node`      | `node:*` builtins                       | the DOM                                 |
| `native`    | neither                                 | both                                    |

Tags: `[runtime-undeclared]`, `[runtime-not-kept]`,
`[runtime-unknown-environment]`.

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

In the source, not a build option: `tsup`'s banner is per build, not per entry,
so a banner would put the directive on all fourteen of core's entries and make
the whole framework client-only in a server build. A directive is a fact about
one module and belongs in that module.

`check-runtime.mjs` decides which entries those are by FOLLOWING IMPORTS from
each published subpath — not by folder, because core's root barrel sits above
`viewmodel/` and does not re-export it. It fails in both directions:

| Tag                         | The defect                                                  |
| --------------------------- | ----------------------------------------------------------- |
| `[client-boundary-missing]`  | the graph reaches React and the entry does not say so       |
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

| Reader                              | Document                                          |
| ----------------------------------- | ------------------------------------------------- |
| somebody choosing lanka             | `ARCHITECTURE.md` — "Inside another framework"     |
| somebody wiring the build           | `tools/di/GUIDE.md` — one recipe per host          |
| somebody writing a server loader    | `modules/host/GUIDE.md`                          |
| somebody's coding agent             | the shipped skills, generated from the guides      |

Every one of those is generated or hand-written where it stands; none of them is
allowed to state the rule differently from this file. When they disagree, this
file is the canon and the other is the bug.
