<!-- Generated from tools/init/GUIDE.md by scripts/skills.mjs. Edit the guide. -->

> **`@lankajs/tool-init@1.0.0`** — this document describes that version.
>
> Install: `npm install -D @lankajs/tool-init`.
>
> Complete code, compiled and run in CI: [tools/init/_playground/playground.test.ts](https://github.com/lankajs/lanka/blob/main/tools/init/_playground/playground.test.ts)

# @lankajs/tool-init — user guide

One command that wires lanka into a project: the barrels, the alias, the
packages your answers imply, and one feature written through every layer.

## You will learn

- how to wire lanka into a project you already have, in one command
- which eleven project shapes it knows, and what each one writes
- what it installs for each answer, and what it deliberately leaves to you
- why it never overwrites anything, and what that means the second time you run it

> [!NOTE]
> Everything below is how this package is _meant_ to be used, not how it must
> be. Every file it writes is a file you can write by hand — see
> [ARCHITECTURE.md](https://github.com/lankajs/lanka/blob/main/ARCHITECTURE.md) for what is checked and what is
> merely advice.

## When to reach for this

Reach for it **once**, on the day you add lanka to a project — and again each
time you add a package to it, because the second run is quiet.

It does **not** create the application. `npm create vite`, `create-next-app` and
`create-expo-app` already exist and are better at it. Run the one your project
wants, then run this inside it: what this writes is the part those cannot know
about, which is how the framework is wired into whatever they made.

Do not reach for it to learn the framework — [`lanka`'s
guide](https://github.com/lankajs/lanka/blob/main/core/GUIDE.md) is shorter than the project this writes. And do not
reach for it in a project that already has a `.lanka/` directory: it will not
break anything, but it will have almost nothing to do.

## Install

```bash
npm  install -D @lankajs/tool-init && npx lanka-init
pnpm add     -D @lankajs/tool-init && pnpm exec lanka-init
yarn add     -D @lankajs/tool-init && yarn lanka-init
bun  add     -d @lankajs/tool-init && bunx lanka-init
```

Or without installing anything, which is the usual way to run it once:

```bash
npx @lankajs/tool-init
```

## The three commands

```bash
lanka-init              # ask, then write the wiring and install the packages
lanka-init plan         # decide and report; write nothing, install nothing
lanka-init list         # every template and every answer, with what each installs
```

`lanka-init` with no flags asks five questions. Each one shows what taking an
answer installs, and Enter takes the template's own default. Answer them with
flags instead and it asks nothing it already knows:

```bash
lanka-init --template next-app --validator valibot --with devtools,prefetch --yes
```

| Option            | What it decides                                                       |
| ----------------- | --------------------------------------------------------------------- |
| `--template <id>` | what this project is. The eleven are below                            |
| `--validator`     | `zod` `valibot` `arktype` `yup` `typebox` `effect` `none`             |
| `--transport`     | `http` `graphql` `grpc` `none`                                        |
| `--storage`       | `web` `unstorage` `mmkv` `async-storage` `secure-store` `none`        |
| `--with a,b,c`    | extras: the inspector, prefetch, streams, the rules, the test kit, …  |
| `--api-url <url>` | what the host's `apiBaseUrl` is written as. Default `/api`            |
| `--root <path>`   | the project directory. Default: where you are                         |
| `--yes`           | ask nothing; take each template's own defaults                        |
| `--dry-run`       | the same as `lanka-init plan`                                         |
| `--no-install`    | write the files and leave the package manager alone                   |

**A question you are not there to answer is not asked.** In a pipe, in CI, or
with `--yes`, every unanswered question takes the template's default — so the
same command works in a terminal and in a script.

## The eleven templates

| `--template`    | What it is                     | What it wires the alias into        |
| --------------- | ------------------------------ | ----------------------------------- |
| `react-spa`     | React, built by Vite           | `vite.config.ts`                    |
| `vue-spa`       | Vue, built by Vite             | `vite.config.ts`                    |
| `svelte-spa`    | Svelte, built by Vite          | `vite.config.ts`                    |
| `solid-spa`     | Solid, built by Vite           | `vite.config.ts`                    |
| `angular-spa`   | Angular, built by Vite         | `vite.config.ts`                    |
| `next-app`      | Next, App Router               | `next.config.mjs` — both bundlers   |
| `nuxt-app`      | Nuxt                           | `nuxt.config.ts`                    |
| `sveltekit-app` | SvelteKit                      | `vite.config.ts`, beside Kit's own  |
| `expo-native`   | Expo, on a device              | `metro.config.js`                   |
| `vanilla-spa`   | No UI framework at all         | `vite.config.ts`                    |
| `node-service`  | No screen at all               | nothing — `tsconfig.json` paths     |

The three host frameworks — Next, Nuxt and SvelteKit — also install
[`@lankajs/host`](https://github.com/lankajs/lanka/blob/main/modules/host/GUIDE.md), because a server renders for
many users and one framework instance would be shared between them. Expo does
not: a device has one user, and there is no render to give its own instance to.
A node service is the case in between, which is why `host` is on the extras list
rather than in that template — work done for a CALLER needs it, and work the
process owns does not.

## What it writes

```
.lanka/                       the barrels the framework reads
  Contract.ts                 which contract they are written for
  Host.ts                     re-exports your host
  Gateways.ts                 one export line per gateway
  Scenarios.ts  SharedStores.ts  Singletons.ts
tsconfig.json                 the @lanka_di path mapping, and the include that reaches .lanka
vite.config.ts                the alias, for your build
eslint.config.mjs             imports go one way                         (--with eslint)
vitest.config.ts              the alias for the test run                (--with testing)
package.json                  only when there is none
src/
  Core/Configs/appHost.ts     the base URL and the three failure sentences
  Core/Interfaces/ITodo.ts
  Core/Validation/todoSchema.ts               (when something validates)
  Gateways/TodoGateway/TodoGateway.ts         the endpoints, and nothing else
  Scenarios/TodoCompleted/TodoCompleted.ts    a fact two screens can share
  ViewModels/todoVM.ts                        the state, the actions, what they react to
  Modules/Todo/TodoScreen.tsx                 the screen: one hook
  startApp.ts                                 one call: create, install plugins, bootstrap
```

**The feature is one shape, whatever the answers.** One gateway, one ViewModel,
one scenario, one screen — and the screen is the only file that knows which UI
framework you chose. A starter exists to be deleted; every shape it has is a
shape that has to stay correct through every version of the framework it
demonstrates, so there is one.

That is also why `--transport graphql` installs the plugin and names its guide
rather than writing a second gateway: the one it would write is the one your
first commit replaces.

## What it will never do

**Overwrite anything.** A file already there is reported and kept. That is what
makes the second run useful — adding a validator six months later writes exactly
one file — and it is why two of the things it reports are worth reading rather
than skipping:

```
Left alone
  = tsconfig.json    add `"@lanka_di/*": ["./.lanka/*"]` under compilerOptions.paths…
  = vite.config.ts   this build config is yours. Add the alias plugin to it…
```

Both are cases where keeping your file leaves something undone. **A missing path
mapping does not fail** — it silently un-types the files that wire the whole
application — and a missing alias plugin fails immediately, on the first import
of `@lanka_di/Gateways`.

**Guess a version.** The names come from this tool; the ranges come from the
package manager your project already uses, which is asked to add them. A range
written here would be whatever was current on the day this tool was built.

**Write your application.** It wires the framework and shows the layers once.
Everything after that is yours.

## After it runs

1. Open `src/Core/Configs/appHost.ts` and put your real base URL in it.
2. Open `src/Gateways/TodoGateway/TodoGateway.ts` and make it your first real
   gateway. Add the export line for it to `.lanka/Gateways.ts` — that one line
   is the whole of "registering" it.
3. Read the notes the command printed. Every package it installed that it did
   not write code for named its own guide there.

## Common mistakes

**Running it instead of a scaffolder.** It does not create an `index.html`, an
`app/` directory or an Expo entry point. Run the host's own tool first.

**Deleting `.lanka/` because it looks generated.** It is your wiring, and it is
the one directory the framework reads directly. Commit it.

**Importing `@lanka_di/…` from your own code.** Those barrels are the
framework's to read; `@lankajs/tool-eslint` refuses it, because a second route
to a gateway is invisible to the framework, cannot be substituted in a test and
cannot be disposed with the instance.

**Expecting the second run to update a file.** It will not. Nothing overwrites —
delete the file first if you want it rewritten.

## Recap

- `lanka-init` wires lanka into a project somebody else's scaffolder made.
- Five questions, or the same five as flags, or `--yes` for the defaults.
- `lanka-init plan` shows what would happen; `lanka-init list` shows what there is.
- It writes the barrels, the alias, the paths and one feature through every layer.
- It never overwrites, which is what makes running it again safe.
