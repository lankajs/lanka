# @lankajs/tool-di

**⚒ tool** · The consumer contract

> The `@lanka_di` alias, scaffolding for six barrels, and a contract check before the build starts — for six bundlers, or for one with no adapter at all.

Runs before runtime — build, lint, test. Neither module nor plugin.

**Runs in:** node.

**How to use it:** [GUIDE.md](./GUIDE.md) — the user guide, with examples. **How to change it:** [SKILL.md](./SKILL.md).

## Contents

- `lanka-di where` — says which barrel directory this project uses
- `lanka-di migrate --to .lanka` — moves the barrels, and the tsconfig files that name them

## Why the package is not named after a bundler

The contract is six barrels an application publishes and the framework reads. Which
bundler sets the alias is a detail of the build, and naming the package after one of
them made the other look unsupported.

The root entry is what no bundler owns: the contract, the scaffolder, the verifier.
`/vite`, `/webpack`, `/turbopack`, `/rollup`, `/esbuild` and `/metro` are thin
adapters over the same three jobs, and `lankaDiSetup` is those three jobs for a
bundler with no adapter at all.

## Why no bundler is a dependency

A webpack plugin is an object with `apply`; a Metro adapter is a function of a config
object. Both are described structurally here and import nothing, so a vite consumer is
never asked to install webpack, and a React Native consumer is never asked for vite —
which is an optional peer, for its types alone.

## Why the vite adapter sets three things and not one

`resolve.alias` is the one whose absence fails loudly. The other two do not, and that
is why the adapter exists rather than a line in a guide.

`optimizeDeps.exclude` carries the alias because vite's dependency optimizer follows
aliases: untold, it walks `lanka`'s dist out of `node_modules`, through `@lanka_di`,
into the CONSUMER'S own source, and copies it into `node_modules/.vite/deps` — a cache
keyed by the lockfile, not by source and not by `.env.*`. The dev server then runs the
copy taken on the day the cache was written and reads that day's `import.meta.env`,
and nothing anywhere says so.

`ssr.noExternal` carries the package name, because an externalised module is loaded by
node — which has never heard of an alias vite invented.

All three come from one `lankaDiSetup` call, so they cannot name different things.
[GUIDE.md](./GUIDE.md) has the symptoms, and how to tell a poisoned cache from a bug.

## Why the directory has two names

`.lanka` is what a new project gets. `.lanka_di` is what the first consumers got, and
it is read exactly as willingly: an ALTERNATIVE, not a deprecation, with no warning
and no end date. `resolveLankaDiDir` reads the answer off the disk, so upgrading moves
nothing — the default decides one case, a project that has neither.

The ALIAS has one name. `@lanka_di` is written into the framework's own source, so it
is a promise the framework makes rather than a layout the consumer picks, and it
points at whichever directory the project turns out to use.

`lanka-di migrate` moves between them, because two of the three steps are invisible:
a stale `paths` mapping and a stale `include` do not fail, they silently un-type the
one file that wires the whole application.

---

Repository map: [../../README.md](../../README.md)
