# @lanka-playgrounds/vue-spa

Atlas in Vue: a Vite single-page application, with single-file components and the
same ViewModels every other host reads.

Read [`../../README.md`](../../README.md) first — it says what these applications
are and, more importantly, what they are not.

## What only this one shows

**A compiler.** Every other Vue code in this repository is a render function:
`modules/bindings/vue`'s playground uses them because a BINDING needs no compiler,
and a `.vue` file there would be proving the wrong thing. An application is the
opposite — what it proves is a consumer's build, and a consumer writes SFCs. So
the screens here are `.vue` files, `vue-tsc` typechecks them, and `eslint-plugin-vue`
reads them.

**That start-up mentions no framework.** Read
[`src/startAtlasVue.ts`](./src/startAtlasVue.ts) beside
[`../../react/spa/src/startAtlasBrowser.ts`](../../react/spa/src/startAtlasBrowser.ts):
the plugins are the same plugins and the gateways are the same gateways. If lanka
knew which renderer it was under, a start-up file is where it would show.

## The claims, in the same words as React's

`_playgrounds/react/spa` asserts that a screen renders what the ViewModel holds,
shows what an action wrote without being told to re-read, shows the failure the
ViewModel named, and pages through what the ViewModel derived. This asserts the
same sentences. Reading the two side by side should show only each framework's own
syntax.

## Two suites, two environments

**The components** run under jsdom and reach no network.

**`atlas-vue.live.test.ts`** declares `@vitest-environment node` and starts the
REAL server. Nothing in it renders, which is the point: start-up is the half of a
Vue application that has no Vue in it. Under jsdom every request would fail on a
cross-realm `AbortSignal` — the reason every live suite in this folder says the
same thing.

## Running it

```bash
pnpm build                                          # once: the build tools read their own dist
pnpm --filter @lanka-playgrounds/_server start      # http://127.0.0.1:4380/api
pnpm --filter @lanka-playgrounds/vue-spa dev        # http://localhost:4391
```

`pnpm build` first is not optional: `vite.config.ts` is loaded by node rather than
by the bundler it configures, and node will not compile the TypeScript a workspace
link points at.
