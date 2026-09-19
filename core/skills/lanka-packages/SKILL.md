---
name: lanka-packages
description: Choose which lanka package solves a problem, and find its skill. Use when a lanka application needs a capability it does not have yet — reading a ViewModel from a React, Vue, Svelte, Solid or Angular screen, storage and its engine, realtime over SSE or WebSocket, GraphQL or gRPC-Web, a read cache, response validation, prefetching, optimistic updates, list handling, cookies, start-up stages, a devtool, or living inside Next, Nuxt, SvelteKit or Expo — or when deciding whether something belongs in application code at all.
license: MIT
metadata:
    author: lankajs
    package: lanka
    version: "1.3.0"
---

# lanka — which package, and what it costs

The framework is `lanka` plus optional packages. This skill routes; each package
has a skill of its own with the detail.

> [!NOTE]
> Only what the framework or a gate refuses is binding. Everything else here is a
> recommendation you can adapt.

## By the problem

| The problem                                             | The package           | Its skill          |
| ------------------------------------------------------- | --------------------- | ------------------ |
| screens, data, state, events                            | `lanka`               | `lanka-core`       |
| stale data after several refreshes; bursts; polling     | `@lankajs/async`      | `lanka-async`      |
| a button that must not double-fire; instant feedback    | `@lankajs/optimistic` | `lanka-optimistic` |
| a table: sort, filter, paginate, stop re-rendering rows | `@lankajs/collection` | `lanka-collection` |
| localStorage, IndexedDB, encryption, persisted state    | `@lankajs/storage`    | `lanka-storage`    |
| avatars and thumbnails that reload or flicker           | `@lankajs/blob-cache` | `lanka-blob-cache` |
| cookies; stale caches after a new build shipped         | `@lankajs/browser`    | `lanka-browser`    |
| Next, React Router, TanStack Start or Expo around lanka | `@lankajs/host`       | `lanka-host`       |

## Reading a ViewModel from a screen

Core imports no UI library, so this is the one package a rendering application
always adds. Install the one for its framework and no other — they are
alternatives, not layers:

| The framework       | The package        | Its skill       |
| ------------------- | ------------------ | --------------- |
| React, React Native | `@lankajs/react`   | `lanka-react`   |
| Vue, Nuxt           | `@lankajs/vue`     | `lanka-vue`     |
| Svelte, SvelteKit   | `@lankajs/svelte`  | `lanka-svelte`  |
| Solid               | `@lankajs/solid`   | `lanka-solid`   |
| Angular             | `@lankajs/angular` | `lanka-angular` |

All five publish `useLankaVM`, and the access tracking is core's rather than
each binding's — so what a screen re-renders for is the same answer in every
framework. What differs is what the call ANSWERS: the state itself in React, a
`ShallowRef` in Vue, getters in Svelte, an `Accessor` in Solid, a `Signal` in
Angular.

Nothing else needs one. Gateways, scenarios, the locator and
`viewModel.getState()` are plain calls with no view in them, and they run on a
server unchanged.

## What goes on the wire

Everything here is a plugin: core declares the extension point, and the plugin is
registered with `lanka.use(...)`.

| The problem                                       | The package                       | Its skill               |
| ------------------------------------------------- | --------------------------------- | ----------------------- |
| retry, idempotency, timeouts, auth refresh, CSRF  | `@lankajs/plugin-http`            | `lanka-http`            |
| the server pushes updates, one way                | `@lankajs/plugin-sse`             | `lanka-sse`             |
| the wire has to carry traffic BOTH ways           | `@lankajs/plugin-websocket`       | `lanka-websocket`       |
| the API is GraphQL, with or without subscriptions | `@lankajs/plugin-graphql`         | `lanka-graphql`         |
| the API is gRPC and the client is a browser       | `@lankajs/plugin-grpc`            | `lanka-grpc`            |
| warming data or route code before the user asks   | `@lankajs/plugin-prefetch`        | `lanka-prefetch`        |
| ordered start-up stages that can redirect         | `@lankajs/plugin-bootstrap-steps` | `lanka-bootstrap-steps` |
| seeing what the bus and the logger did            | `@lankajs/plugin-devtools`        | `lanka-devtools`        |

SSE and WebSocket sit behind the SAME port, so the choice is one line in bootstrap
and not a rewrite. Take SSE unless the client has to SEND on the same connection.

## Pick exactly one from a family

Four decisions where the framework refuses to choose for you, because the right
answer is whichever library your application already has. Each family binds one
port, so every member publishes the same surface under a different vendor name.

| The decision                                | The members                                                                                                   | Its skill                                        |
| ------------------------------------------- | ------------------------------------------------------------------------------------------------------------- | ------------------------------------------------ |
| which schema library validates responses    | `@lankajs/zod`, `@lankajs/valibot`, `@lankajs/arktype`, `@lankajs/yup`, `@lankajs/typebox`, `@lankajs/effect` | `lanka-zod`, `lanka-valibot`, …                  |
| …and the app ended up with two of them      | `@lankajs/any-schema`                                                                                         | `lanka-any-schema`                               |
| which read cache sits under the ViewModels  | `@lankajs/tanstack-query`, `@lankajs/nanostores-query`                                                        | `lanka-tanstack-query`, `lanka-nanostores-query` |
| where `@lankajs/storage` writes off the web | `@lankajs/mmkv`, `@lankajs/react-native-async-storage`, `@lankajs/secure-store`, `@lankajs/unstorage`         | `lanka-mmkv`, `lanka-secure-store`, …            |
| which UI framework reads the ViewModels     | `@lankajs/react`, `@lankajs/vue`, `@lankajs/svelte`, `@lankajs/solid`, `@lankajs/angular`                     | `lanka-react`, `lanka-vue`, …                    |

The recommended member, when there is one: `@lankajs/zod` for schemas, and
`@lankajs/tanstack-query` for the read cache. Take another only for a reason you
can name — usually that the library is already in the application.

A storage engine is the one family you can skip entirely: in a browser
`@lankajs/storage` brings its own adapters. Install one when the app runs on a
device (`@lankajs/mmkv`, or `@lankajs/secure-store` for a token) or on a server
(`@lankajs/unstorage`).

## Build-time and test-time

| The problem                                            | The package             | Its skill       |
| ------------------------------------------------------ | ----------------------- | --------------- |
| the `@lanka_di` wiring and its build-time check        | `@lankajs/tool-di`      | `lanka-di`      |
| architectural boundaries as lint rules                 | `@lankajs/tool-eslint`  | `lanka-eslint`  |
| testing, and benchmarking                              | `@lankajs/tool-testing` | `lanka-testing` |
| keeping these skills matched to the installed versions | `@lankajs/tool-skills`  | `lanka-skills`  |

## Module or plugin, and why you should care

- A **module** is called by your app (`app → module`). Core does not know it
  exists; remove it and core works the same.
- A **plugin** is called by core (`app → core → plugin`) and is registered with
  `lanka.use(...)`. Every plugin declares `lanka` as a **peer dependency** — a
  normal dependency would give it its own copy of core, and its policy would
  install into an instance your app never uses.

## What NOT to install

- Two members of one family. Pick one; the point is that the choice is visible in
  your dependency list. `@lankajs/any-schema` is the exception, and only for an
  application that already carries two schema libraries.
- A second view binding. One application renders with one UI framework, and
  installing two puts two copies of `useLankaVM` in the import list.
- `@lankajs/plugin-prefetch` before the app is measurably slow somewhere. It is
  three tiers of machinery for a problem you may not have.
- `@lankajs/blob-cache` for images whose URL can change. It never checks freshness.
- A read cache before two screens read the same resource. One screen with its own
  ViewModel already has everywhere it needs to keep that data.

## Getting the skills

```bash
# Claude Code, from git
/plugin marketplace add lankajs/lanka
/plugin install lanka-storage@lankajs

# or from the packages you already installed, version-matched
npx lanka-skills sync
```

The second is worth preferring where it works: it installs the skill for the
version in your `node_modules`, not the one on the framework's main branch.
