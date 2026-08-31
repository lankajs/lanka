---
name: lanka-host
description: Run lanka inside Next, React Router v7, TanStack Start, Astro or Expo — one framework instance per request for SSR and RSC, a build-time scope for SSG and ISR, and server data as a screen's first state. Use when adding server-side data loading to a lanka application, when a server-rendered page renders signed out, when deciding what may run on the server, or when reviewing code that imports `@lankajs/host`.
license: MIT
metadata:
    author: lankajs
    package: @lankajs/host
    version: "0.0.0"
---

# @lankajs/host

Two entries, and the split is load-bearing. `reference.md` beside this file is
the full guide.

> [!NOTE]
> Only what the framework or a gate refuses is binding. Everything else here is a
> recommendation you can adapt.

## Pick by the rendering mode

| The situation                                                  | Use                                      |
| -------------------------------------------------------------- | ---------------------------------------- |
| SSR, a server component, a loader, a server function or action | `runLankaRequest` from `@lankajs/host/server` |
| SSG, a prerender, ISR revalidation                             | `runLankaStatic` from `@lankajs/host/server`   |
| server data reaching a screen in the browser                   | `hydrateLankaVM` from `@lankajs/host`          |
| anything in the browser or on a phone                          | nothing here — the instance `startLanka` made |

```ts
// server: SSR / RSC / loader — identity travels
const posts = await runLankaRequest(
	{ apiBaseUrl: process.env.API_URL, headers: await headers() },
	() => lankaGateways.postGateway.published(),
);
```

```tsx
// client: the same data as the screen's first state
"use client";
hydrateLankaVM(usePostsVM, { posts }); // before the first read, once
```

```ts
// build: SSG / ISR — identity refused, in the types and at runtime
await runLankaStatic({ apiBaseUrl: process.env.API_URL }, () =>
	lankaGateways.postGateway.published(),
);
```

## The decision procedure

1. **Is a user waiting for this render?** Yes → `runLankaRequest`, and pass their
   headers. No → `runLankaStatic`.
2. **Does the work touch a ViewModel?** Then it does not belong on the server. A
   VM is a module-level store: on a server it is shared by every user at once.
   Fetch through the gateway, return plain data.
3. **Do you want to remember the answer?** That is your host's cache —
   `revalidate`, `revalidateTag`, a router loader's own caching. Do not add a
   second one around the gateway.
4. **Is this the browser?** Then you need none of `/server`. The instance from
   `startLanka` is already the right one.

## What crosses into the API call

`cookie` and `authorization`, and nothing else — `host` and `content-length`
describe the browser's connection to the host framework, not the framework's
connection to the API. For another header, name the whole list; `forward`
replaces the default rather than adding to it:

```ts
runLankaRequest({ apiBaseUrl, headers, forward: ["cookie", "x-tenant"] }, work);
```

A header the gateway sets itself is never overwritten.

## Rules that will bite

- **Never import `@lankajs/host/server` from a client component.** It imports
  `node:async_hooks`; the bundler will try to resolve that for the browser.
- **Never call a gateway on the server outside a scope.** The ambient facades
  fail by name — deliberately. The alternative would be reading whichever
  instance the process created last, which belongs to somebody else.
- **Never pass headers to `runLankaStatic`.** Output written once and served to
  everybody must not carry one reader's session. It throws.
- **Never treat `hydrateLankaVM` as a setter.** It applies once, before the first
  read. Everything after the first paint is an action.
- **Forgetting the headers is silent.** The page renders signed out and flips
  signed in on hydration. If that is what you are debugging, this is why.

## Symptoms

| What you see                                              | What it is                                            |
| --------------------------------------------------------- | ----------------------------------------------------- |
| a server render shows a signed-out page, the browser shows a signed-in one | `headers` not passed to `runLankaRequest`   |
| "lanka has no instance for this call … request scope"      | server work outside `runLankaRequest` / `runLankaStatic` |
| a screen refetches what the server already had            | `hydrateLankaVM` not called, or called after the first read |
| a static page shows one user's data to everybody          | headers reached a build — use `runLankaStatic`         |
| `node:async_hooks` cannot be resolved                     | `/server` imported from a client component            |
| two users' data mixing under load                         | one instance reused across requests instead of a scope per request |
