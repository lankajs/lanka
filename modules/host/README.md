# @lankajs/host

**▸ module** · Living inside another framework

> The two places lanka meets Next, React Router, TanStack Start or Expo: one instance per unit of server work, and one first state per screen.

A library in the same box. The app imports and calls it; core does not know it exists.

**Runs in:** the browser, node and React Native — everywhere · `@lankajs/host/server`: node.

**How to use it:** [GUIDE.md](./GUIDE.md) — the user guide, with examples. **How to change it:** [SKILL.md](./SKILL.md).

## Contents

- `hydrateLankaVM` — server data as a ViewModel's first state, in the browser
- `runLankaRequest` — SSR, RSC, loaders, server functions: an instance per request, carrying the caller's headers
- `runLankaStatic` — SSG and ISR: the same scope with identity refused

## Why a package and not a flag on `startLanka`

`node:async_hooks` exists in node and nowhere else. Core is universal — the browser,
node and React Native — and a single import of a node builtin inside it would put the
filesystem's neighbour in every browser bundle that tree-shaking failed to reach.

So core publishes a SEAM instead: `setLankaRuntimeResolver` in `lanka/internal`, which
replaces the question "which instance is active" with a strategy. Core ships no
strategy and knows of none; this package installs the one that knows what a request is.

## One mode per name, because they differ in what may cross in

`runLankaRequest` is for work with a user waiting — SSR, a server component, a loader,
a server function, a server action, a streamed chunk — and it forwards that user's
`cookie` and `authorization` into the API call. Without that, a signed-in page renders
signed out and flips on hydration, silently.

`runLankaStatic` is for work with no user: a prerender, a static route, an ISR
revalidation. It refuses headers, in the types and again at runtime, because output
served to everybody must not carry one reader's identity. A boolean flag would have
made that a default somebody flips; a second name makes it hard to write by accident.

## What still may not cross to the server

ViewModels. A ViewModel is a zustand store created at module level and read through
React hooks — one store per PROCESS, which on a server is one store shared by every
user connected to it. The gateway layer has no such state, which is exactly why it is
the layer that travels.

The handoff is data, not state: a loader returns what it fetched, the page passes it as
a prop, and `hydrateLankaVM` makes it the ViewModel's first state in the browser.

## No cache, deliberately

Next, React Router and TanStack Start each ship a request cache with revalidation. A
second cache here would disagree with theirs on the first mutation, and the application
would own the disagreement. A gateway returns data; whoever called it decides what to
remember — `revalidate`, `revalidateTag` and their siblings stay the host's.

---

Repository map: [../../README.md](../../README.md)
