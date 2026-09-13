# @lanka-playgrounds/astro

Atlas inside Astro: a server-rendered page, a client island, and the same two
host calls under a different bundler.

## Why a fourth application

To keep `@lankajs/host` honest. A seam used by exactly one framework is a seam
shaped like that framework — so the Astro page makes the same call the Next page
makes, and the island hydrates from a prop the same way the Next client component
does. If either were a Next adapter in disguise, this package could not be
written.

The integration itself is one line of config: Astro takes vite plugins, so
`lankaDiVite` is the same plugin the single-page application uses.

## What an island needs

Nothing from `@lankajs/host` except `hydrateLankaVM`. An island IS a client
component; only the `.astro` page that FETCHES needs the server half.

## `output: "server"`

Astro's default is static, and the page here reads `Astro.request.headers` —
which under a static build would be reading headers nobody sent.

## Running it

```bash
pnpm build                                      # once: astro.config.mjs reads tool-di's dist
pnpm --filter @lanka-playgrounds/_server start
pnpm --filter @lanka-playgrounds/astro dev      # http://localhost:4393
```
