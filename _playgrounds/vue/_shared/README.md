# @lanka-playgrounds/vue-shared

What the Vue applications share and no other ecosystem can use.

Read [`../../README.md`](../../README.md) first.

## What is in here, and what is deliberately not

Everything here is the **View** layer. `ARCHITECTURE.md` draws the line at the top
of its layer table: a view renders and reads its ViewModel; a ViewModel owns state
and actions and knows nothing about a renderer.

So this package holds composables and a text rule. It holds no ViewModel at all —
those live in [`../../_shared`](../../_shared), have no Vue in them, and are read
unchanged by React, by a server and by a process with no screen.

**There is no `ViewModels/` folder here, and that is the point.** An effect belongs
in a view: "a screen appeared" is a fact about Vue, not about the application. A
ViewModel holding one could not be read from anywhere else, which would undo the
reason the port exists.

## One entry, unlike React's two

`@lanka-playgrounds/react-shared` splits at `/dom` because its ecosystem spans a
browser and a device, and React Native's types have no `<input>`. Every Vue host
here renders to a document, so there is nothing to split.

## Which spelling the screens use

`useLankaVM` — the name every binding on the shelf publishes — rather than
`defineLankaComposable`. Both are correct and the guide teaches both; the screens
use the portable one so that reading them beside React's shows only each
framework's own syntax. A consuming application picks whichever its team reads
more easily.
