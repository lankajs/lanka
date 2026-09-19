---
name: lanka-init
description: Wire lanka into an existing project with `lanka-init` — the barrels, the bundler alias, the tsconfig paths, the packages a set of answers implies, and one feature written through every layer. Use when adding lanka to a project for the first time, when adding a lanka package to one that already has it, when a build cannot resolve `@lanka_di/Gateways`, or when deciding which lanka packages a project actually needs.
license: MIT
metadata:
    author: lankajs
    package: @lankajs/tool-init
    version: "0.0.0"
---

# @lankajs/tool-init

One command that wires lanka into a project somebody else's scaffolder made.
`reference.md` beside this file is the full guide.

> [!NOTE]
> Only what the framework or a gate refuses is binding. Everything else here is
> a recommendation you can adapt.

```bash
npx @lankajs/tool-init           # once, without installing anything
pnpm exec lanka-init             # when it is already a dev dependency
```

`pnpm exec`, never `pnpm dlx`, once the package is installed — `dlx` fetches a
throwaway copy and would write barrels from a contract version the project is
not on.

## The decision this skill exists for

**Run the host's own scaffolder FIRST.** `npm create vite`, `create-next-app`,
`create-expo-app`. `lanka-init` does not create an application: no
`index.html`, no `app/` directory, no Expo entry point. It writes the part those
tools cannot know about.

Then, in that project:

| The situation                             | The command                                     |
| ----------------------------------------- | ----------------------------------------------- |
| adding lanka for the first time           | `lanka-init`                                    |
| doing it inside a script or CI            | `lanka-init --template <id> --yes`              |
| deciding whether to                       | `lanka-init plan --yes`                         |
| choosing packages                         | `lanka-init list`                               |
| adding a package six months later         | `lanka-init --validator zod --yes`              |
| the build cannot resolve `@lanka_di/…`    | `lanka-init plan` — read what it left alone     |

## The five questions

`--template` is the only one that changes what code is written. The other four
change what is installed.

| Flag          | Answers                                                                |
| ------------- | ---------------------------------------------------------------------- |
| `--template`  | `react-spa` `vue-spa` `svelte-spa` `solid-spa` `angular-spa` `next-app` `nuxt-app` `sveltekit-app` `expo-native` `vanilla-spa` `node-service` |
| `--validator` | `zod` `valibot` `arktype` `yup` `typebox` `effect` `none`              |
| `--transport` | `http` `graphql` `grpc` `none`                                         |
| `--storage`   | `web` `unstorage` `mmkv` `async-storage` `secure-store` `none`         |
| `--with`      | `eslint` `testing` `skills` `devtools` `prefetch` `sse` `websocket` `bootstrap-steps` `async` `collection` `optimistic` `browser` `blob-cache` `host` `tanstack-query` `nanostores-query` |

An answer a template cannot run is not offered and is refused if typed: a
browser project is never given MMKV, and a device is never given the inspector.

## Reading what it printed

```
Wrote
  + .lanka/Gateways.ts          one export line per gateway; the locator is derived from them
  + src/ViewModels/todoVM.ts    the state, the actions and what they react to

Left alone
  = tsconfig.json               add `"@lanka_di/*": ["./.lanka/*"]` under compilerOptions.paths…
```

**`Left alone` is the section to act on.** Nothing is ever overwritten, so a
project that already had a `tsconfig.json` or a `vite.config.ts` still has to be
told about the alias. A missing path mapping does not fail anything — it
silently un-types the files that wire the whole application. A missing bundler
plugin fails immediately, on the first import of `@lanka_di/Gateways`.

## After it runs

1. Put the real base URL in `src/Core/Configs/appHost.ts`.
2. Replace `TodoGateway` with a real one, and add its export line to
   `.lanka/Gateways.ts`. That one line is the whole of registering it.
3. Read the notes it printed: every package it installed but wrote no code for
   named its own guide there.

## Refusals

- **Do not import `@lanka_di/…` from application code.** Those barrels are the
  framework's to read. `@lankajs/tool-eslint` refuses it: a second route to a
  gateway is invisible to the framework, cannot be substituted in a test, and
  cannot be disposed with the instance.
- **Do not delete `.lanka/` as generated output.** It is the project's wiring
  and it is committed.
- **Do not expect a second run to update a file.** Nothing overwrites. Delete
  the file if you want it written again.
- **Do not add a version range by hand to what it installed.** The package
  manager resolved those; this tool deliberately writes none.
