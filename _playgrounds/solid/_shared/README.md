# @lanka-playgrounds/solid-shared

What the Solid applications share and no other ecosystem can use.

Read [`../../README.md`](../../README.md) first.

## What is in here, and what is deliberately not

Everything here is the **View** layer, the same line the Vue and Svelte
ecosystems draw: a view renders and reads its ViewModel; a ViewModel owns state
and actions and knows nothing about a renderer.

So this package holds a read path and a text rule. It holds no ViewModel at all —
those live in [`../../_shared`](../../_shared), have no Solid in them, and are
read unchanged by React, by Vue, by Svelte, by a server and by a process with no
screen.

## `use` in the name, and nothing about it is a hook

A Solid component runs ONCE. There is no render to be ordered against, so there
is no rule about calling `useAtlasMissions` conditionally or in a loop — the
prefix is a convention shared across the shelf, so a consumer moving a screen
between frameworks reads one guide.

The repository's lint configuration learned this the day this package arrived:
`react-hooks` was scoped to `_playgrounds/**/*.tsx` and would have reported
`rules-of-hooks` against these files. It now names React's own ecosystems, which
is the same mistake the config already records against Vue's `setup()`, made a
second time by a glob.

## Its own tsconfig, outside the repository's single program

Solid compiles JSX into its own reactive calls with its own `JSX` namespace, and
`jsx`/`jsxImportSource` are per-PROGRAM. A Solid component checked under React's
setting has every element typed as `React.JSX.Element` and rejects it, so this
package is checked by its own config — the same arrangement
`modules/bindings/solid` makes, for the same reason.

## Two shapes of scene, because Solid asks two questions

A rendered component answers "what is on the screen". A `createRoot` with an
effect inside answers "how many times did the reader run", which in a framework
with no re-render is the closest thing to counting renders — and it is the only
way to assert that a subscription stops when its owner is disposed.
