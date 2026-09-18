# @lanka-playgrounds/solid-spa

Atlas in Solid: a Vite single-page application, with compiled JSX and the same
ViewModels every other host reads.

Read [`../../README.md`](../../README.md) first — it says what these applications
are and, more importantly, what they are not.

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

## Two suites, two environments

**The components** run under jsdom and reach no network. `resolve.conditions`
names `development`, because Solid ships two builds and the production one omits
the ownership graph a test needs to dispose — a suite that silently got the other
leaks an owner per scene and reports nothing.

**`atlas-solid.live.test.ts`** declares `@vitest-environment node` and starts the
REAL server. Nothing in it renders, which is the point: start-up is the half of a
Solid application that has no Solid in it. Under jsdom every request would fail
on a cross-realm `AbortSignal` — the reason every live suite in this folder says
the same thing.

## Running it

```bash
pnpm build                                          # once: the build tools read their own dist
pnpm --filter @lanka-playgrounds/_server start      # http://127.0.0.1:4380/api
pnpm --filter @lanka-playgrounds/solid-spa dev      # http://localhost:4398
```

`pnpm build` first is not optional: `vite.config.ts` is loaded by node rather than
by the bundler it configures, and node will not compile the TypeScript a workspace
link points at.
