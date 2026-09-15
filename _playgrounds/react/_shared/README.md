# @lanka-playgrounds/react-shared

What the three React applications share and no other ecosystem can use.

Read [`../../README.md`](../../README.md) first — it says what these applications
are and, more importantly, what they are not.

## What is in here, and what is deliberately not

Everything here is the **View** layer. `ARCHITECTURE.md` draws the line at the
top of its layer table: a view renders and reads its ViewModel; a ViewModel owns
state and actions and knows nothing about a renderer.

So this package holds hooks, a presentational component and a text rule. It holds
no ViewModel at all — those live in [`../../_shared`](../../_shared), have no
React in them, and are read unchanged by Vue, by a server and by a process with
no screen.

**There is no `ViewModels/` folder here, and that is the point.** An effect
belongs in a view: "a screen appeared" is a fact about React, not about the
application. A ViewModel holding one could not be read from anywhere else, which
would undo the whole reason the port exists.

```
src/
├── Core/Missions/          a plain helper: mission → one line of text
├── Modules/                the view layer, one folder per feature
│   └── AtlasMissionsModule/
│       ├── useAtlasMissions.ts          read
│       ├── useAtlasMissionsOnMount.ts   read, and fetch once mounted
│       ├── useAtlasHydratedMissions.ts  read, starting from the server's data
│       └── AtlasMissionSearch.tsx       the search box
└── _Testing/               fixtures the scenes share
```

## Two entries, split by what a renderer can do

`@lanka-playgrounds/react-shared` is DOM-free and is what the device application
imports. `@lanka-playgrounds/react-shared/dom` holds the half with `<input>` in
it, which does not exist in React Native's program at all — one barrel would have
dragged that component into a typecheck that cannot compile it.

The split is by renderer, not by folder name, and the manifest's `exports` is
where it is enforced.

## Why it exists

Three copies, collected. The hydrating hook was written twice word for word — the
Next client component and the Astro island — the mount effect twice, in the
browser and on the device, and the "one text node, not two" rule three times,
each with its own copy of the comment explaining why. Three copies of a rule is a
rule with no owner.

## What it is not

It is not a place for anything a second ecosystem could use. That belongs in
[`../../_shared`](../../_shared), whose import graph holds no UI framework and is
checked for it.
