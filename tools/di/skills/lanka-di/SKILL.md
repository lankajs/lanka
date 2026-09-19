---
name: lanka-di
description: Wire an application to lanka with any bundler — vite, webpack, Turbopack, rollup, esbuild or one with no adapter — through the `@lanka_di` alias, the `.lanka`/`.lanka_di` barrels and the build-time contract check. Use when setting up a lanka project, when adding a gateway, scenario, singleton or shared store to the locator, when `@lanka_di/…` fails to resolve, when `lankaGateways.x` is untyped, or when moving between the two barrel directory names.
license: MIT
metadata:
    author: lankajs
    package: @lankajs/tool-di
    version: "1.0.2"
---

# @lankajs/tool-di

Consumer-side wiring. `reference.md` beside this file is the full guide.

> [!NOTE]
> Only what the framework or a gate refuses is binding. Everything else here is a
> recommendation you can adapt.

## Setup

```ts
// vite
import { lankaDiVite } from "@lankajs/tool-di/vite";
export default defineConfig({ plugins: [react(), lankaDiVite({ scaffold: !process.env.CI })] });
```

```js
// webpack — and Rspack, which takes the same object
const { lankaDiWebpack } = require("@lankajs/tool-di/webpack");
module.exports = { plugins: [lankaDiWebpack({ scaffold: !process.env.CI })] };

// Turbopack has no plugin API: this is a config helper
const { lankaDiTurbopack } = require("@lankajs/tool-di/turbopack");
module.exports = { turbopack: { ...lankaDiTurbopack() } };
```

`@lankajs/tool-di/rollup` and `/esbuild` are the same three jobs again, in those
bundlers' vocabularies.

Same options everywhere. No bundler is a dependency: vite is an optional peer for
its types, the rest are described structurally and imported not at all.

## A bundler with no adapter

There will never be enough adapters. The primitive they are built from is three
lines:

```ts
import { lankaDiSetup } from "@lankajs/tool-di";

const lanka = lankaDiSetup({ root: process.cwd() });
lanka.verify(); // scaffolds; throws on a barrel that lost an export
myBundler.configure({ alias: lanka.alias }); // { "@lanka_di": "…/.lanka" }
```

For a bundler with no alias map, an alias is a resolver: answer
`${lanka.dir}/${name}.ts` for a specifier starting `@lanka_di/`.

On the first run it writes `.lanka/` for you. **Commit it** — it is your
application's wiring, not build output.

## The directory has two legal names

`.lanka` and `.lanka_di`. **Both are supported and neither is deprecated.**

- `.lanka` is what a new project gets.
- `.lanka_di` is what earlier projects got, and it keeps working with no warning
  and no end date.

The plugin **finds the one the project has** — upgrading moves nothing. The
default decides one case only: a project with neither.

```bash
npx lanka-di where               # which one this project uses
npx lanka-di migrate --dry-run   # what moving would change
npx lanka-di migrate             # move to .lanka
npx lanka-di migrate --to .lanka_di
```

Migrating renames the directory and rewrites the `@lanka_di/*` mapping and the
`include` entry in every root `tsconfig*.json` — the last two matter because
neither fails when stale, it just leaves the barrels untyped.

**When you are asked which to use:** say both work, and recommend leaving an
existing project where it is. Reach for `migrate` only when somebody asks to
move, never as tidying.

The **alias** does not change with the directory: `@lanka_di` is what the
framework imports through, in both layouts.

To pin the choice instead of discovering it, pass
`dirname: ".lanka" | ".lanka_di"` to any adapter. It selects; it does not move.

## What the barrel directory is

Gateways, scenarios, singletons and shared stores are resolved **by name**, so
the framework has to see your classes — and a package cannot import its own
consumer. The direction is inverted: your app publishes barrels, the framework
reads them through `@lanka_di`.

| File              | Holds                                   |
| ----------------- | --------------------------------------- |
| `Contract.ts`     | `lankaDiContractVersion`                |
| `Host.ts`         | `lankaHost` — base URL and failure copy |
| `Gateways.ts`     | one `export` line per gateway           |
| `Scenarios.ts`    | one per scenario                        |
| `SharedStores.ts` | one per shared store                    |
| `Singletons.ts`   | one per singleton                       |

```ts
// .lanka/Gateways.ts
export { TodoGateway } from "../src/gateways/TodoGateway";
```

Adding a gateway is **one export line and no registration**. An empty barrel is
legal, which is what lets a new project boot before it has any.

## Turn scaffolding off in CI

`scaffold: !process.env.CI`. In CI a barrel directory that had to be generated
means it was never committed, and a build that quietly repairs itself hides that
until somebody builds on another machine.

The plugin never overwrites a file you wrote: a missing file is scaffolded, a
wrong one is **reported** with the file and the symbol.

## Without a bundler plugin

```ts
import { verifyLankaDi, lankaDiContract } from "@lankajs/tool-di";

const report = verifyLankaDi(process.cwd(), { scaffold: false });
// { dir, dirname, created: [], problems: [] }
```

The root entry knows nothing about a bundler. `lankaDiContract` carries the
alias, the default dirname, both legal dirnames, the version and the barrel list,
so a rollup or esbuild setup hard-codes nothing either. To ask where a given
project's barrels are, call `resolveLankaDiDir(root)` — `lankaDiContract.dirname`
is the DEFAULT, not the answer.

## Never do these

- **Never add the barrel directory to `.gitignore`.**
- **Never keep both `.lanka/` and `.lanka_di/`.** The framework reads one and the
  other keeps type-checking, so a gateway added to the wrong file is never seen
  and never reported.
- **Never call `.lanka_di` legacy or deprecated.** It is an alternative, with no
  warning and no end date.
- **Never leave `scaffold: true` in CI.**
- **Never import your own barrels from application code.** They are
  the framework's one reading side; a second route is one the framework cannot
  see, substitute in a test, or dispose with the instance.
- **Never register a gateway twice** — the export line is enough.
- **Never hand-edit `Contract.ts`'s version.** It moves when the framework does.
- **Never pin `lanka` into a manual chunk.** The framework imports your
  barrels, so a chunk holding the framework holds your application
  graph, and the vendor chunks that graph needs import back into it — circular
  chunks whose evaluation order decides whether the app boots. Leave the framework
  unassigned and let the bundler place it.
- **Never let vite's optimizer see `@lanka_di`.** The plugin puts it in
  `optimizeDeps.exclude` and your own entries merge with it. Putting the alias —
  or `lanka` — in `optimizeDeps.include` undoes that, and the optimizer then
  copies your source into `node_modules/.vite/deps`, where no edit of yours can
  invalidate it.
- **Never match a chunk rule against a module id.** Under pnpm an id carries the
  peer-resolved store directory, so
  `.pnpm/lanka@1.0.1_react@19.2.4_…/node_modules/lanka/…` contains "react" and an
  id-substring rule files the framework as a react dependency. Match the package
  specifier — everything after the last `node_modules/`.

## Symptom → cause

| What you see                                             | What it is                                             |
| -------------------------------------------------------- | ------------------------------------------------------ |
| "module not found" for `@lanka_di/…`                     | the plugin is missing from the vite config             |
| `lankaGateways.x` is untyped                             | no export line, or no `@lanka_di/*` path in `tsconfig` |
| the build fails naming a file and symbol                 | a barrel exists and no longer exports what is called   |
| the barrel directory regenerated in CI                   | it was never committed                                 |
| "are both present"                                       | `.lanka/` and `.lanka_di/` both exist; keep one        |
| edits to a barrel change nothing                         | you edited the directory the framework does not read   |
| "Cannot find package `@lanka_di/…`" on the server        | SSR externalised the framework; see the guide          |
| "Unable to resolve module `@lanka_di/…`" on React Native | `@lankajs/tool-di` older than the Metro fix            |
| edits to app source change nothing                       | vite froze your source in `.vite/deps` — see below     |
| `import.meta.env.VITE_*` is `""`                         | the same frozen copy, holding that day's env           |
| a blank screen, `… of undefined` at boot                 | the framework is in a manual chunk; the chunks circle  |

Those last two are one cause, and it is not your application: vite's dependency
optimizer followed `@lanka_di` out of `node_modules` and cached your source
under a key nothing you edit changes. Confirm with
`grep -l "#region src/" node_modules/.vite/deps/*.js` — any match is your source,
frozen. `@lankajs/tool-di` excludes the alias from the optimizer, so upgrading
the plugin fixes it and discards the bad cache on the next start; an app pinned
to an older one sets `optimizeDeps: { exclude: ["@lanka_di"] }` itself.

TypeScript's wildcard `include` **skips dot-directories**, so the barrels compile
without types unless the mapping is explicit — the plugin prints exactly what to
add, naming the directory this project actually uses.

## More

`reference.md` — the full guide, including the contract version and options.
