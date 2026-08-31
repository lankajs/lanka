---
name: lanka-di
description: Wire an application to lanka with any bundler — vite, webpack, Turbopack, rollup, esbuild or one with no adapter — through the `@lanka_di` alias, the `.lanka_di` barrels and the build-time contract check. Use when setting up a lanka project, when adding a gateway, scenario, singleton or shared store to the locator, when `@lanka_di/…` fails to resolve, or when `lankaGateways.x` is untyped.
license: MIT
metadata:
    author: lankajs
    package: @lankajs/tool-di
    version: "1.0.0"
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
myBundler.configure({ alias: lanka.alias }); // { "@lanka_di": "…/.lanka_di" }
```

For a bundler with no alias map, an alias is a resolver: answer
`${lanka.dir}/${name}.ts` for a specifier starting `@lanka_di/`.

On the first run it writes `.lanka_di/` for you. **Commit it** — it is your
application's wiring, not build output.

## What `.lanka_di/` is

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
// .lanka_di/Gateways.ts
export { TodoGateway } from "../src/gateways/TodoGateway";
```

Adding a gateway is **one export line and no registration**. An empty barrel is
legal, which is what lets a new project boot before it has any.

## Turn scaffolding off in CI

`scaffold: !process.env.CI`. In CI a `.lanka_di` that had to be generated means
it was never committed, and a build that quietly repairs itself hides that until
somebody builds on another machine.

The plugin never overwrites a file you wrote: a missing file is scaffolded, a
wrong one is **reported** with the file and the symbol.

## Without a bundler plugin

```ts
import { verifyLankaDi, lankaDiContract } from "@lankajs/tool-di";

const report = verifyLankaDi(process.cwd(), { scaffold: false });
// { dir, created: [], problems: [] }
```

The root entry knows nothing about a bundler. `lankaDiContract` carries the
alias, the dirname, the version and the barrel list, so a rollup or esbuild setup
hard-codes nothing either.

## Never do these

- **Never add `.lanka_di` to `.gitignore`.**
- **Never leave `scaffold: true` in CI.**
- **Never import your own `.lanka_di` barrels from application code.** They are
  the framework's one reading side; a second route is one the framework cannot
  see, substitute in a test, or dispose with the instance.
- **Never register a gateway twice** — the export line is enough.
- **Never hand-edit `Contract.ts`'s version.** It moves when the framework does.

## Symptom → cause

| What you see                             | What it is                                             |
| ---------------------------------------- | ------------------------------------------------------ |
| "module not found" for `@lanka_di/…`     | the plugin is missing from the vite config             |
| `lankaGateways.x` is untyped             | no export line, or no `@lanka_di/*` path in `tsconfig` |
| the build fails naming a file and symbol | a barrel exists and no longer exports what is called   |
| `.lanka_di` regenerated in CI            | it was never committed                                 |

TypeScript's wildcard `include` **skips dot-directories**, so `.lanka_di` compiles
without types unless the mapping is explicit — the plugin prints exactly what to
add.

## More

`reference.md` — the full guide, including the contract version and options.
