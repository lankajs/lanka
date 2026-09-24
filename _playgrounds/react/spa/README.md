# @lanka-playgrounds/react

Atlas in a browser: a Vite single-page application, and every package a browser
can run.

## What only this application can show

| Package                       | What it does here                                                        |
| ----------------------------- | ------------------------------------------------------------------------ |
| `@lankajs/storage`            | preferences in the plain store, the operator's name in the encrypted twin |
| `@lankajs/blob-cache`         | crew avatars, resolved synchronously so no `<img>` ever swaps its `src`   |
| `@lankajs/browser`            | the release guard, which ANSWERS rather than acting                       |
| `@lankajs/tanstack-query`     | a read cache under the ViewModels — the slot a host framework fills       |
| `@lankajs/plugin-sse`         | a server event becoming a fact                                            |
| `@lankajs/plugin-websocket`   | the same facts, both ways, with an outbox                                |
| `@lankajs/plugin-graphql`     | a `200` carrying `errors`, and a partial result kept                      |
| `@lankajs/plugin-grpc`        | a unary call, and a refusal that arrives in the headers                   |
| `@lankajs/plugin-prefetch`    | the priority ladder, installed and diagnosable                            |
| `@lankajs/plugin-devtools`    | the inspector, and a panel that does nothing in a production build        |

## No router

Every screen renders at once. A router would be the fifth framework in a folder
that is about the other four, and nothing here needs one to make its point.

## Running it

```bash
pnpm --filter @lanka-playgrounds/_server start  # the API, first
pnpm --filter @lanka-playgrounds/react dev      # http://localhost:4390
```

No `pnpm build` first, unlike the other three. Vite loads its config through
esbuild, so that config can import `tool-di` from TypeScript source; node loads
the Next, Astro and Metro configs itself, and node reads only a build.

## Where the wires are tested

`atlas-browser.live.test.ts` runs in NODE and opens the real server-sent stream
and the real socket against the real server. The component tests run in jsdom
with doubles and reach no network — the division every application ends up
making, and one [`../../README.md`](../../README.md) explains in full.
