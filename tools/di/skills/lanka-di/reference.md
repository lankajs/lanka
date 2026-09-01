<!-- Generated from tools/di/GUIDE.md by scripts/skills.mjs. Edit the guide. -->

> **`@lankajs/tool-di@1.0.1`** — this document describes that version.
>
> Install: `npm install @lankajs/tool-di vite` (the peers are not optional; only npm adds a missing one for you).
>
> Complete code, compiled and run in CI: [tools/di/_playground/playground.test.ts](https://github.com/lankajs/lanka/blob/main/tools/di/_playground/playground.test.ts)

# @lankajs/tool-di — user guide

Wires your application to the framework: it creates the `@lanka_di` alias,
scaffolds the `.lanka_di/` barrels, and fails the **build** when a barrel no
longer exports what the framework calls by name.

One contract, every bundler. Which one you use is a detail of your build; the
barrels and the checks are the same either way.

## You will learn

- what `.lanka_di/` is and why the framework cannot import your code directly
- how to wire it in vite, webpack, Turbopack, rollup or esbuild
- how to wire it in a bundler this package has never heard of
- how a missing export becomes a build failure instead of a runtime `undefined`
- why scaffolding must be off in CI

## When to reach for this

Install it on day one, whichever bundler you use. Without the alias the framework
does not resolve at all: core imports `@lanka_di/Gateways` and three siblings at
module level.

Using something else entirely? The root entry knows nothing about a bundler —
see [Any other bundler](#any-other-bundler).

> [!NOTE]
> Everything below is how this package is _meant_ to be used, not how it must
> be. The framework bends at the seams it publishes — see
> [ARCHITECTURE.md](https://github.com/lankajs/lanka/blob/main/ARCHITECTURE.md) for what is checked and what is
> merely advice.

## Install

```bash
npm install -D @lankajs/tool-di
```

**vite:**

```ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { lankaDiVite } from "@lankajs/tool-di/vite";

export default defineConfig({
	plugins: [react(), lankaDiVite({ scaffold: !process.env.CI })],
});
```

**webpack:**

```js
const { lankaDiWebpack } = require("@lankajs/tool-di/webpack");

module.exports = {
	plugins: [lankaDiWebpack({ scaffold: !process.env.CI })],
};
```

**Turbopack** — it has no plugin API, so this is a config helper:

```js
const { lankaDiTurbopack } = require("@lankajs/tool-di/turbopack");

module.exports = {
	turbopack: { ...lankaDiTurbopack({ scaffold: !process.env.CI }) },
};
```

**rollup:**

```js
import { lankaDiRollup } from "@lankajs/tool-di/rollup";

export default { plugins: [lankaDiRollup({ scaffold: !process.env.CI })] };
```

**esbuild:**

```js
import { lankaDiEsbuild } from "@lankajs/tool-di/esbuild";

await esbuild.build({ plugins: [lankaDiEsbuild({ scaffold: !process.env.CI })] });
```

**Metro** (React Native, Expo) — it has no plugin array either, so this is a
function of the config, the way everything else in that ecosystem is:

```js
const { getDefaultConfig } = require("expo/metro-config");
const { lankaDiMetro } = require("@lankajs/tool-di/metro");

module.exports = lankaDiMetro(getDefaultConfig(__dirname), { scaffold: !process.env.CI });
```

It merges into `resolver.extraNodeModules`, so it composes with `withNativeWind`
and the rest instead of replacing what they wrote.

**Rspack** takes webpack's plugin unchanged — the object is the same shape, and
this one describes only what it touches.

That is the whole setup. Every adapter takes the same options and does the same
three jobs; on the first run any of them writes `.lanka_di/` for you and tells
you to commit it.

> [!NOTE]
> No bundler is a dependency of this package. Vite is an **optional** peer for
> its types alone; the other five are described structurally and imported not at
> all. Installing it never asks you for a bundler you do not use.

## What `.lanka_di/` is

Gateways, scenarios, singletons and shared stores are resolved **by name**, which
means the framework has to see your classes — and a package cannot import its own
consumer. So the direction is inverted: **your app publishes barrels** at one
well-known path, and the framework reads them through the `@lanka_di` alias.

The path is `.lanka_di/` at your project root, beside `package.json`, where
`.storybook/` and `.husky/` live and for the same reason: it is wiring, not
application source, and a tool that must find it needs to know only the root.

Six files:

| File              | Holds                                                           |
| ----------------- | --------------------------------------------------------------- |
| `Contract.ts`     | `lankaDiContractVersion` — which contract these barrels are for |
| `Host.ts`         | `lankaHost` — your base URL and your failure copy               |
| `Gateways.ts`     | one `export` line per gateway                                   |
| `Scenarios.ts`    | one per scenario                                                |
| `SharedStores.ts` | one per shared store                                            |
| `Singletons.ts`   | one per singleton                                               |

The four namespace barrels are read as namespaces: **adding a gateway is one
export line and no registration**, and an empty barrel is legal — which is what
lets a freshly scaffolded project boot before it has any gateways at all.

```ts
// .lanka_di/Gateways.ts
export { UserGateway } from "../src/gateways/UserGateway";
export { TodoGateway } from "../src/gateways/TodoGateway";
```

After that, `lankaGateways.userGateway` is typed.

## The three jobs the plugin does

1. **The alias.** `@lanka_di/*` resolves to `<root>/.lanka_di/*` without you
   writing it into your vite config. The framework imports through this alias, so
   getting it wrong is not a lint note — it is "module not found" at start-up.
2. **Scaffolding.** A new consumer gets working, empty barrels written for it.
3. **Verification.** A barrel that exists but no longer exports what the
   framework calls by name **fails the build**, naming the file and the symbol,
   instead of resolving to `undefined` and failing at runtime inside the locator,
   three layers from the cause.

It also reads your `tsconfig.json` and tells you what to add when a path mapping
or an include is missing. That check pays for itself because neither omission
fails on its own: TypeScript's wildcard `include` **skips dot-directories**, and
`.lanka_di` then compiles without types — silently.

## Turn scaffolding off in CI

```ts
lankaDi({ scaffold: !process.env.CI });
```

In CI, a `.lanka_di` that had to be generated means it was never committed — and
a build that quietly repairs itself hides that until the project is built on
another machine.

The plugin never overwrites a file you wrote. A missing file is scaffolded; a
file that exists and is wrong is **reported**, because overwriting your code to
satisfy a contract would destroy your work.

## Options

| Option     | Default                                   | Meaning                                  |
| ---------- | ----------------------------------------- | ---------------------------------------- |
| `root`     | vite's resolved root, webpack's `context` | Where `.lanka_di/` lives                 |
| `scaffold` | `true`                                    | Write missing barrels instead of failing |

The webpack plugin verifies **once per process**, on `beforeRun` and `watchRun`.
`beforeCompile` would fire on every rebuild, which in a dev server means
re-reading six files on each keystroke to learn what it learnt a second ago.

## One recipe per host framework

The adapter is chosen by the bundler, not by the framework — but a framework
often uses two, and that is the part worth writing down.

**Next.js.** Turbopack runs `next dev`, and webpack may still run the production
build, so both halves go in one `next.config.js`:

```js
const { lankaDiTurbopack } = require("@lankajs/tool-di/turbopack");
const { lankaDiWebpack } = require("@lankajs/tool-di/webpack");

const scaffold = !process.env.CI;

module.exports = {
	turbopack: { ...lankaDiTurbopack({ scaffold }) },
	webpack: (config) => {
		config.plugins.push(lankaDiWebpack({ scaffold }));
		return config;
	},
};
```

Add the path mapping by hand as well — `.lanka_di` is a dot-directory, and
`next dev` will not tell you it is untyped:

```json
{ "compilerOptions": { "paths": { "@lanka_di/*": [".lanka_di/*"] } } }
```

**React Router v7 and Remix** build with vite: `lankaDiVite` in
`vite.config.ts`, beside the framework's own plugin.

**TanStack Start** is vite too — same one plugin.

**Astro** takes vite plugins through `vite: { plugins: [...] }` in
`astro.config.mjs`.

**Expo and React Native** use Metro, which takes the config itself:

```js
module.exports = lankaDiMetro(getDefaultConfig(__dirname), { scaffold: !process.env.CI });
```

**Rspack** takes the webpack plugin unchanged. **Parcel**, **Rollup**,
**esbuild**, or anything else: the next section.

> [!NOTE]
> The alias is only the build half. What runs on a host framework's SERVER — one
> framework instance per request, per prerender and per revalidation — is
> [@lankajs/host](https://github.com/lankajs/lanka/blob/main/modules/host/GUIDE.md), and it is a different decision from
> this one.

## Any other bundler

There will never be enough adapters — a bundler arrives every year. So the thing
they are all built from is exported, and it is three lines:

```ts
import { lankaDiSetup } from "@lankajs/tool-di";

const lanka = lankaDiSetup({ root: process.cwd() });

lanka.verify(); // scaffolds, and throws on a barrel that lost an export
myBundler.configure({ alias: lanka.alias }); // { "@lanka_di": "…/.lanka_di" }
```

Anything that can do those three lines is supported, whether or not a file in
this package mentions it. `verify()` returns the paths it wrote, so you can
report them the way your build reports things —
`lankaDiScaffoldNotice(created)` is the sentence the six adapters use.

For a bundler with no alias map — rollup and esbuild are both like this — an
alias is a resolver: answer `${lanka.dir}/${name}.ts` for a specifier starting
`@lanka_di/`. That is exactly what those two adapters do, in nine lines each.

And for a pre-commit hook or a CI step that only wants the check:

```ts
import { verifyLankaDi } from "@lankajs/tool-di";

const report = verifyLankaDi(process.cwd(), { scaffold: false });
if (report.problems.length > 0) {
	console.error(report.problems.join("
"));
	process.exit(1);
}
```

## The contract version

`Contract.ts` carries a number. Inside a monorepo a version means nothing —
package and consumer update in one commit. Once published, "file present, export
present, different semantics" becomes possible: barrels written for a previous
contract that the check accepts while the framework reads something else.

Update it when you update the framework, not by hand.

## Common mistakes

**Adding `.lanka_di` to `.gitignore`.** It is your application's wiring, not
build output. Commit it.

**Leaving `scaffold: true` in CI.** See above.

**Registering a gateway twice** — once as an export line and once with
`locators.gateways.register(...)`. The barrel is enough.

**Putting the framework in a vendor chunk.** `lanka` imports your `.lanka_di`
barrels, so a manual chunk rule that captures the framework captures your
application graph with it — and the vendor chunks that graph needs then import
back into the framework's chunk. Circular chunks are not a build error: the
browser evaluates one of the two first, and on the wrong order a library reads an
export off a module that has not initialised yet, which is a blank screen before
any of your code runs. Leave `lanka` unassigned.

> [!IMPORTANT]
> Match a chunk rule against the package specifier — everything after the last
> `node_modules/` — never against the whole module id. Under pnpm an id carries
> the peer-resolved store directory, so
> `.pnpm/lanka@1.0.1_react@19.2.4_…/node_modules/lanka/…` contains "react", and an
> id-substring rule files the framework as a react dependency without anyone
> writing a rule about the framework at all.

**Wondering why `lankaGateways.x` is untyped.** Either the export line is
missing, or your `tsconfig` has no path mapping for `@lanka_di/*` — the plugin
prints exactly what to add.

## Recap

- Your app publishes barrels; the framework reads them. That is the only permitted inversion.
- Adding a gateway is **one export line** and no registration.
- Commit `.lanka_di/` — it is wiring, not build output.
- vite, webpack, Turbopack, rollup, esbuild — or none of them: `lankaDiSetup()` is the three lines every adapter is built from.
- No bundler is a dependency; vite is an optional peer for its types, the rest are described structurally.
- `scaffold: !process.env.CI`: a build that quietly repairs itself hides a missing commit.
- TypeScript's wildcard `include` skips dot-directories, which is why the path mapping must be explicit.

---

Maintaining this package: [SKILL.md](https://github.com/lankajs/lanka/blob/main/tools/di/SKILL.md) · What it is:
[README.md](https://github.com/lankajs/lanka/blob/main/tools/di/README.md) · The locator:
[../../core/GUIDE.md](https://github.com/lankajs/lanka/blob/main/core/GUIDE.md)
