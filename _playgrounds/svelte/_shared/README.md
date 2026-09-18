# @lanka-playgrounds/svelte-shared

What the Svelte applications share and no other ecosystem can use.

Read [`../../README.md`](../../README.md) first.

## What is in here, and what is deliberately not

Everything here is the **View** layer, the same line
[`../../vue/_shared`](../../vue/_shared) draws: a view renders and reads its
ViewModel; a ViewModel owns state and actions and knows nothing about a renderer.

So this package holds a read path and a text rule. It holds no ViewModel at all —
those live in [`../../_shared`](../../_shared), have no Svelte in them, and are
read unchanged by React, by Vue, by a server and by a process with no screen.

## Why the suite is `.svelte.test.ts`

The suffix is what tells the compiler to treat a module as a rune module, and
`$effect.root` is the whole reason it has to. A getter read OUTSIDE an effect
answers correctly and subscribes to nothing — so a suite written as a plain
`.test.ts` would assert every value in the file and never once prove that a
change arrives.

There is no fixture component either. What the applications share is a function,
and a component between the assertion and the claim would put a second thing
under test. The compiled screens are asserted in [`../spa`](../spa), where a
compiler is the point.

## Which spelling the screens use

`useLankaVM` — the name every binding on the shelf publishes — rather than
`toLankaSvelteVM`, the `$`-store spelling a codebase that reads with `$vm` would
prefer. Both are correct and the guide teaches both; the screens use the portable
one so that reading them beside React's and Vue's shows only each framework's own
syntax. A consuming application picks whichever its team reads more easily.
