---
name: lanka-packages
description: Choose which lanka package solves a problem, and find its skill. Use when a lanka application needs a capability it does not have yet — storage, realtime, caching, prefetching, optimistic updates, list handling, validation, cookies, start-up stages or a devtool — or when deciding whether something belongs in application code at all.
license: MIT
metadata:
    author: lankajs
    package: lanka
    version: "1.2.0"
---

# lanka — which package, and what it costs

The framework is `lanka` plus optional packages. This skill routes; each package
has a skill of its own with the detail.

> [!NOTE]
> Only what the framework or a gate refuses is binding. Everything else here is a
> recommendation you can adapt.

## By the problem

| The problem                                             | The package                     | Its skill                    |
| ------------------------------------------------------- | ------------------------------- | ---------------------------- |
| screens, data, state, events                            | `lanka`                         | `lanka-core`                 |
| stale data after several refreshes; bursts; polling     | `@lankajs/async`                  | `lanka-async`                |
| a button that must not double-fire; instant feedback    | `@lankajs/optimistic`             | `lanka-optimistic`           |
| a table: sort, filter, paginate, stop re-rendering rows | `@lankajs/collection`             | `lanka-collection`           |
| localStorage, IndexedDB, encryption, persisted state    | `@lankajs/storage`                | `lanka-storage`              |
| avatars and thumbnails that reload or flicker           | `@lankajs/blob-cache`             | `lanka-blob-cache`           |
| cookies; stale caches after a new build shipped         | `@lankajs/browser`                | `lanka-browser`              |
| validating responses with zod / valibot                 | `@lankajs/zod`, `@lankajs/valibot`  | `lanka-zod`, `lanka-valibot` |
| retry, idempotency, timeouts, auth refresh, CSRF        | `@lankajs/plugin-http`            | `lanka-http`                 |
| realtime updates pushed by the server                   | `@lankajs/plugin-sse`             | `lanka-sse`                  |
| warming data or route code before the user asks         | `@lankajs/plugin-prefetch`        | `lanka-prefetch`             |
| ordered start-up stages that can redirect               | `@lankajs/plugin-bootstrap-steps` | `lanka-bootstrap-steps`      |
| seeing what the bus and the logger did                  | `@lankajs/plugin-devtools`        | `lanka-devtools`             |
| the `@lanka_di` wiring and its build-time check         | `@lankajs/tool-di`                | `lanka-di`                   |
| architectural boundaries as lint rules                  | `@lankajs/tool-eslint`            | `lanka-eslint`               |
| testing, and benchmarking                               | `@lankajs/tool-testing`           | `lanka-testing`              |

## Module or plugin, and why you should care

- A **module** is called by your app (`app → module`). Core does not know it
  exists; remove it and core works the same.
- A **plugin** is called by core (`app → core → plugin`) and is registered with
  `lanka.use(...)`. Every plugin declares `lanka` as a **peer dependency** — a
  normal dependency would give it its own copy of core, and its policy would
  install into an instance your app never uses.

## What NOT to install

- Both `@lankajs/zod` and `@lankajs/valibot`. Pick one; the point is that the choice
  is visible in your dependency list.
- `@lankajs/plugin-prefetch` before the app is measurably slow somewhere. It is
  three tiers of machinery for a problem you may not have.
- `@lankajs/blob-cache` for images whose URL can change. It never checks freshness.

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
