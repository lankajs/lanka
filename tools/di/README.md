# @lankajs/tool-di

**⚒ tool** · The consumer contract

> The `@lanka_di` alias, scaffolding for six barrels, and a contract check before the build starts — for six bundlers, or for one with no adapter at all.

Runs before runtime — build, lint, test. Neither module nor plugin.

**Runs in:** node.

**How to use it:** [GUIDE.md](./GUIDE.md) — the user guide, with examples. **How to change it:** [SKILL.md](./SKILL.md).

## Why the package is not named after a bundler

The contract is `.lanka_di` — six barrels an application publishes and the framework
reads. Which bundler sets the alias is a detail of the build, and naming the package
after one of them made the other look unsupported.

The root entry is what no bundler owns: the contract, the scaffolder, the verifier.
`/vite`, `/webpack`, `/turbopack`, `/rollup`, `/esbuild` and `/metro` are thin
adapters over the same three jobs, and `lankaDiSetup` is those three jobs for a
bundler with no adapter at all.

## Why no bundler is a dependency

A webpack plugin is an object with `apply`; a Metro adapter is a function of a config
object. Both are described structurally here and import nothing, so a vite consumer is
never asked to install webpack, and a React Native consumer is never asked for vite —
which is an optional peer, for its types alone.

---

Repository map: [../../README.md](../../README.md)
