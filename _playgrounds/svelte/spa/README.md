# @lanka-playgrounds/svelte-spa

Atlas in Svelte: a Vite single-page application, with real components and the same
ViewModels every other host reads.

Read [`../../README.md`](../../README.md) first — it says what these applications
are and, more importantly, what they are not.

## What only this one shows

**A compiler, and one that rewrites the language.** Vue's SFC compiler leaves
JavaScript as JavaScript; Svelte 5's turns `$props()` into something else
entirely, and a getter read inside markup becomes a subscription.
`modules/bindings/svelte` can prove none of that — it is `createSubscriber` and a
render helper, and it builds with `tsup` like every other package here. What a
component proves is a consumer's BUILD.

**`svelte-check`, not `tsc`.** A `.svelte` file is markup and script in one, and
the TypeScript compiler cannot read one: a project that ran `tsc` here would
typecheck every file EXCEPT its components, and report success. The `typecheck`
script says so where somebody would otherwise change it back. For the same reason
there is no `declare module "*.svelte"` shim, which Vue's application does need —
a shim would REPLACE what `svelte-check` knows with `Record<string, unknown>`
props and stop every call site from being checked.

**Six `// svelte-ignore state_referenced_locally` comments, each with its
reason.** Svelte warns when a prop is read at the top level of a component,
because the read captures its FIRST value — for an ordinary prop that is a bug. A
ViewModel is not an ordinary prop: it is an identity, the screen subscribes to it
once, and a parent that handed over a different one would be replacing the screen
rather than updating it. The comments say that rather than silencing it.

The avatar's two are the same warning for the opposite reason: there the ABSENCE
of reactivity is the behaviour. An image's `src` is resolved once and never
swapped, because swapping it on a mounted image makes the browser decode the
frame again — which a person sees as a flicker.

**The other member of the query family.** React, Vue and Solid read through
`@lankajs/tanstack-query`; this application reads through
`@lankajs/nanostores-query`, and that is the point of it. The two are one
`parallel` family over one `ILankaReadCache`, and a family is only
interchangeable if something actually interchanges: the ViewModels above this
cache are the same ViewModels, and the only line that differs is the one that
builds it. No conformance suite can say that — it checks one member against the
port, never two members against each other.

## The claims, in the same words as React's and Vue's

`_playgrounds/react/spa` asserts that a screen renders what the ViewModel holds,
shows what an action wrote without being told to re-read, shows the failure the
ViewModel named, and pages through what the ViewModel derived. This asserts the
same sentences. Reading the three side by side should show only each framework's
own syntax — runes here, a single-file component there, JSX in the third.

Three scenes are this file's own, and they are about the keyed `{#each}`: one
asserts that a sort MOVES the existing nodes rather than rebuilding them, one
that a filter drops a row and restores it, and one that a filter which makes
pages disappear repaints the count instead of stranding a reader on page 2 of a
one-page list.

## Two suites, two environments

**The components** run under jsdom and reach no network. `resolve.conditions`
names `browser`, because Svelte's default export condition in node is its SERVER
build, where effects do not run at all — a suite that silently got that one would
assert nothing.

The start-up scenes sit in that same file and stub `fetch`, because what they
ask is which packages the start-up installs — the read cache under a name, the
inspector behind `exposeAs`, the prefetch slot occupied — and that is a question
about this application rather than about the API. Stubbing is also what keeps
them honest under jsdom, for the cross-realm reason below.

**`atlas-svelte.live.test.ts`** declares `@vitest-environment node` and starts the
REAL server. Nothing in it renders, which is the point: start-up is the half of a
Svelte application that has no Svelte in it. Under jsdom every request would fail
on a cross-realm `AbortSignal` — the reason every live suite in this folder says
the same thing.

## Running it

```bash
pnpm build                                          # once: the build tools read their own dist
pnpm --filter @lanka-playgrounds/_server start      # http://127.0.0.1:4380/api
pnpm --filter @lanka-playgrounds/svelte-spa dev     # http://localhost:4394
```

`pnpm build` first is not optional: `vite.config.ts` is loaded by node rather than
by the bundler it configures, and node will not compile the TypeScript a workspace
link points at.
