# @lanka-playgrounds/astro

Atlas inside Astro: a server-rendered page, FOUR client islands in four
frameworks, and the same two host calls under a different bundler.

## Why this application exists

To keep `@lankajs/host` honest. A seam used by exactly one framework is a seam
shaped like that framework — so the Astro page makes the same call the Next page
makes, and the island hydrates from a prop the same way the Next client component
does. If either were a Next adapter in disguise, this package could not be
written.

The integration itself is one line of config: Astro takes vite plugins, so
`lankaDiVite` is the same plugin the single-page application uses.

## Four islands, one page, one set of rows

React, Vue, Svelte and Solid, side by side, each receiving the SAME prop, calling
the SAME hydration and reading the SAME ViewModel out of
[`../_shared`](../_shared). What differs between them is each framework's own
syntax and nothing else.

This page is the strongest form of the claim `_plans/14` was written to make. A
framework that knew which renderer it was under could hide it in one application;
it could not hide it in four of them on one page.

Two of the four disagree about where the ViewModel lives, and both are right.
React's, Vue's and Solid's are at module level — one store per browser tab, which
is what an island's process is. Svelte's is in the instance script, because
Svelte 5's instance script runs once per mount and that is the lifetime that
stays correct if the component is ever rendered on a server. Each island's suite
asserts its own rule, which is why one of them expects a second mount to show
NEW rows where the others expect the first ones to survive.

## What an island needs

Nothing from `@lankajs/host` except `hydrateLankaVM`. An island IS a client
component; only the `.astro` page that FETCHES needs the server half.

## Two JSX dialects in one project

React and Solid both compile `.tsx`, and neither the bundler nor the typechecker
can guess which is which. The build is told with an `include` glob per
integration — without it whichever is listed first wins silently, and the loser's
component renders nothing while reporting no error. TypeScript is told by the
`@jsxImportSource solid-js` pragma on the Solid island's first line, because
`jsx` and `jsxImportSource` are per-PROGRAM and a per-file pragma is the only way
two dialects share one.

The `typecheck` here stays plain `tsc` for the same reason: `vue-tsc` cannot read
a `.svelte` file and neither reads Solid's dialect, so a per-framework compiler
would check one island and skip three. Vue is the one framework that then needs a
`*.vue` shim, and `src/vue-shims.d.ts` says what it costs.

## `output: "server"`

Astro's default is static, and the page here reads `Astro.request.headers` —
which under a static build would be reading headers nobody sent.

## Running it

```bash
pnpm build                                      # once: astro.config.mjs reads tool-di's dist
pnpm --filter @lanka-playgrounds/_server start
pnpm --filter @lanka-playgrounds/astro dev      # http://localhost:4393
```
