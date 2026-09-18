# @lanka-playgrounds/vue-nuxt

Atlas inside Nuxt: a Nitro route that scopes an instance per request, and a
payload a component hydrates from.

Read [`../../README.md`](../../README.md) first.

## What only this one shows

**That `@lankajs/host` is a seam, not a Next adapter.** The same two calls the
Next application makes — `runLankaRequest` for a page somebody is waiting on,
`runLankaStatic` for one built ahead of time — made from a Nitro route handler.
Nitro has a request, and every server that has a request has `AsyncLocalStorage`.

**That the host layer takes both header shapes.** Next's `headers()` and a
loader's `request.headers` are `Headers`-like; `getRequestHeaders` is a plain
object. Neither is adapted here, because `runLankaRequest` takes both — which is
what makes it a seam rather than an adapter for whoever came first.

**Where Vue differs from React on a server-rendered page.** There is no
`"use client"` and nothing standing in for it: this component runs on both sides.
What makes a module-level ViewModel safe is that `hydrateLankaVM` applies ONCE
per store.

And the trap that has no React equivalent: **`<script setup>` IS the `setup()`
function.** Its body runs once per component INSTANCE, so a ViewModel declared
there is a new store for every mount — and hydration then applies to every one of
them. A second render with different data replaced the first one's rows, which is
exactly what hydration exists to refuse, and the screen looked right until two of
them existed. The ViewModel lives in a plain `<script>` block for that reason, and
a scene asserts it stays there.

## One store per process, and where that stops being right

Nothing user-specific is written into the module-level ViewModel: the server's
rows are hydrated and the screen reads. A page that wrote a USER's draft into it
would be writing into a store shared by every user that server is talking to.

That is the shape phase 14.8 of `_plans/14` is for — a ViewModel with a request's
lifetime — and until it exists the answer is the one
[`../../react/next/README.md`](../../react/next/README.md) gives: keep per-user
fields in component state, and keep the ViewModel for what the whole page shares.

## `nuxt prepare` before a typecheck

Nuxt GENERATES the types for its auto-imports into `.nuxt/`, and without that step
a typecheck reports every one of them as an unknown name. It is codegen from this
project rather than a network call, and it is what a Nuxt consumer runs — so
`typecheck` runs it first.

Our own files import by name anyway (`useFetch` from `nuxt/app`,
`defineEventHandler` from `h3`), which this repository prefers: a name with no
import line is a name a reader cannot follow.

## Running it

```bash
pnpm build                                        # once: the build tools read their own dist
pnpm --filter @lanka-playgrounds/_server start    # http://127.0.0.1:4380/api
pnpm --filter @lanka-playgrounds/vue-nuxt dev     # http://localhost:4392
```
