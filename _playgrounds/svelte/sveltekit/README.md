# @lanka-playgrounds/svelte-kit

Atlas inside SvelteKit: a server load that scopes an instance per request, a hook
that sees every render, and a page hydrated from its data.

Read [`../../README.md`](../../README.md) first, then [`../spa`](../spa) — this
application is the same ecosystem with a server in front of it.

## Why a fourth server host

Next has a server component, Nuxt has a Nitro route, Astro has a page. If
`@lankajs/host` were a Next adapter wearing a general name, the fourth one is
where that would show. It does not: Kit's `load` hands over a real `Request`, and
every server that has a request has `AsyncLocalStorage`.

The only line that differs from Nuxt's is what gets passed —
`event.request.headers` is a `Headers`, `getRequestHeaders(event)` is a plain
object, and the host layer takes both without either being adapted.

## Three things only this host shows

**A hook that wraps the whole render.** `handle` in
[`src/hooks.server.ts`](./src/hooks.server.ts) runs around the `load` functions,
the components and the response together — a shape neither a server component nor
a route handler has, because each of those is one call.

**And a scope that is deliberately NOT opened in it.** The obvious move is to
wrap `resolve(event)` in `runLankaRequest` and let every `load` inherit the
instance. It is the wrong move: a `load` function that inherited its scope would
work without saying so, until the same function was called from a script, a test
or a queue worker where no hook ran. A scope visible at the call site is a scope
a reader can check. The hook carries CONFIGURATION instead — one answer to "where
is the API", read once per request rather than once per `load` — and a scene
asserts the two scope functions do not appear in it.

**A ViewModel per RENDER, which is the opposite of what Nuxt does.** Kit's
documentation says it outright: on a server, module-level state is shared by
every user connected to the process. A ViewModel declared beside the component
would be one store for the whole deployment, and two overlapping requests would
serve each other's rows. `_playgrounds/vue/nuxt` asserts the opposite — because
Vue's `<script setup>` IS `setup()`, and a module-level store was the only way
there to make hydration apply once. Read side by side the two look like a
contradiction; each is its own framework's rule, and both files say so at length.

## Two settings this application had to explain

**`verbatimModuleSyntax: false`.** Kit turns it on, and this repository consumes
its packages from SOURCE — a workspace link points at `core/src`, not at a built
`.d.ts` — so the stricter setting lands on the framework's files rather than on
this application's and reports forty errors in code this package does not own. A
consumer installing the tarball never meets it: a tarball ships declarations, and
declarations have no import style left to check.

**`kit.alias` rather than `paths`.** Every other application here declares
`@lanka_di` in its `tsconfig.json`. Kit GENERATES its tsconfig and warns that a
hand-written `paths` fights the generated one, so the alias is declared in
[`svelte.config.js`](./svelte.config.js) and Kit writes it into the build and the
types together — one answer instead of two that drift.

## What the suite does and does not render

Kit's own plugin is not in [`vitest.config.ts`](./vitest.config.ts): `sveltekit()`
builds a server bundle and a client bundle and owns the module graph, which a test
runner cannot then enter. What is asserted is the two halves either side of Kit —
the component, and the server functions the routes call. Nothing renders
`+page.svelte`, which would be testing Kit's own data loading.

The `@lanka_di` alias points at this application's OWN barrels rather than at the
test kit's fixture, for the reason the Next and Nuxt suites state: the server half
resolves gateways by name, and a fixture with empty barrels turns every such test
into a named refusal.

## Running it

```bash
pnpm build                                          # once: the build tools read their own dist
pnpm --filter @lanka-playgrounds/_server start      # http://127.0.0.1:4380/api
pnpm --filter @lanka-playgrounds/svelte-kit dev     # http://localhost:4397
```

`ATLAS_API` overrides the address, with no `VITE_` prefix: this application reads
it on the server, and a prefixed name is one the build substitutes into public
output.
