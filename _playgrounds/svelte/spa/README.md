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

**Three `// svelte-ignore state_referenced_locally` comments, each with its
reason.** Svelte warns when a prop is read at the top level of a component,
because the read captures its FIRST value — for an ordinary prop that is a bug. A
ViewModel is not an ordinary prop: it is an identity, the screen subscribes to it
once, and a parent that handed over a different one would be replacing the screen
rather than updating it. The comments say that rather than silencing it.

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
