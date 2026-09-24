# @lanka-playgrounds/solid-spa

Atlas in Solid: one project that is both a Vite single-page application and a
server renderer, with compiled JSX and the same ViewModels every other host
reads.

Read [`../../README.md`](../../README.md) first — it says what these applications
are and, more importantly, what they are not.

## One project, two entry points

This is the second ecosystem here whose server host is not a separate package,
and it gets there from the opposite direction to the first. React needed `next/`,
Vue needed `nuxt/`, Svelte needed `sveltekit/`, because in those frameworks the
server story IS a separate project; Angular has a server renderer in the box.
Solid has neither, and needs neither: [`src/index.tsx`](./src/index.tsx) renders
into a document, [`src/Core/Server/renderAtlasPage.ts`](./src/Core/Server/renderAtlasPage.ts)
renders the same `AtlasApp` into a string with `renderToString`, and the shell
between them is one component.

**SolidStart is deliberately absent, and that is recorded rather than implied.**
Its 2.x line wants a Vite ahead of this repository's, and its 1.x line brings a
second Vite of its own — what moving would cost is in
[`modules/host/SKILL.md`](../../../modules/host/SKILL.md).
Nothing about the seam needed a meta-framework, which is the point worth taking
away: `runLankaRequest`, `runLankaStatic` and `hydrateLankaVM` are reached here
by a plain node function, unchanged from the four hosts that do have one.

A scene asserts the shell is the same shell, because it is the claim that would
quietly stop being true: if the server ever rendered a tree of its own, this
would be two applications wearing one name.

**The one thing the server half had to be told.** A Solid `onMount` does not run
on a server, so a screen left to fetch for itself is turned into a string while
still empty — and reports nothing. The rows are therefore read first, inside the
request scope, and handed to the shell as a prop that `hydrateLankaVM` makes the
ViewModel's first state.

## What only this one shows

**A framework with no re-render.** A Solid component body runs ONCE; what updates
is the DOM node that read the accessor. Every claim the other three applications
make about "shows what an action wrote" is made here too, and one scene in
[`../_shared`](../_shared) counts the component's runs to prove the mechanism is
different underneath.

**A suite with no flush in it.** Every other application in this folder reaches
for `flushSync`, `act()` or `nextTick` on nearly every line; there is not one
here, because an action's write reaches the reading node synchronously. The
absence is the assertion.

**`<Show>` and `<For>` rather than `&&` and `.map()`, and that is not style.**
The component runs once, so a `.map()` in the body would iterate the list it saw
on that single run and never again — a frozen screen with no error anywhere.
This is the one place where Solid's syntax is load-bearing.

**A shell whose obvious spelling is the correct one.** The ViewModels are built
inside `AtlasApp` rather than at module level, so the shell can be mounted twice
in one process. React's needs `useMemo` or a ref to promise the same thing and
Svelte's needs an instance script; here a `const` in the body already is one,
because the body is a constructor.

## The claims, in the same words as the other three

`_playgrounds/react/spa` asserts that a screen renders what the ViewModel holds,
shows what an action wrote without being told to re-read, shows the failure the
ViewModel named, and pages through what the ViewModel derived. This asserts the
same sentences. Reading the four side by side should show only each framework's
own syntax.

## Its own tsconfig, outside the repository's single program

`jsx` and `jsxImportSource` are per-PROGRAM, and Solid's JSX is not React's: a
Solid component checked under React's setting has every element typed as
`React.JSX.Element` and rejects it. `modules/bindings/solid` and
[`../_shared`](../_shared) say the same thing for the same reason.

## Three suites, and two vitest configs

**The components** run under jsdom and reach no network. `resolve.conditions`
names `development`, because Solid ships two builds and the production one omits
the ownership graph a test needs to dispose — a suite that silently got the other
leaks an owner per scene and reports nothing.

**`atlas-solid.live.test.ts`** declares `@vitest-environment node` and starts the
REAL server. Nothing in it renders, which is the point: start-up is the half of a
Solid application that has no Solid in it. Under jsdom every request would fail
on a cross-realm `AbortSignal` — the reason every live suite in this folder says
the same thing.

**`src/Core/Server/renderAtlasPage.test.ts`** runs under
[`vitest.server.config.ts`](./vitest.server.config.ts), and the second config is
not tidiness. The same components are compiled twice here:
`vite-plugin-solid` emits DOM instructions for a browser and string instructions
for a render, `solid-js/web` has a matching pair of runtimes chosen by export
condition, and the plugin decides which per CONFIG. Given the wrong half of
either pair a suite fails as "window is not defined" or as "Client-only API
called on the server side", both of them several frames from the line that
decided it. `test.projects` was tried first and is worse than useless: inside a
project entry the plugin stops seeing test mode and hands the BROWSER suite
Solid's server build. So `pnpm test` runs the two configs one after the other,
and each measures its own half to 100%.

## Running it

```bash
pnpm build                                          # once: the build tools read their own dist
pnpm --filter @lanka-playgrounds/_server start      # http://127.0.0.1:4380/api
pnpm --filter @lanka-playgrounds/solid-spa dev      # http://localhost:4398
```

`pnpm build` first is not optional: `vite.config.ts` is loaded by node rather than
by the bundler it configures, and node will not compile the TypeScript a workspace
link points at.

`ATLAS_API` overrides the address for the SERVER half, with no `VITE_` prefix;
the browser half reads `VITE_ATLAS_API`, because a browser bundle has no other
way to be told anything — and because what Vite inlines it also ships, so a
server's address must not carry the prefix that makes a value public.
