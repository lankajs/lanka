---
name: lanka-skills
description: Install and refresh the lanka packages' agent skills in a project with `lanka-skills sync`. Use when setting up a lanka project's agent tooling, after upgrading a lanka package, when a skill describes a version the app is not running, or when a sync reports a directory it left alone.
license: MIT
metadata:
    author: lankajs
    package: @lankajs/tool-skills
    version: "1.0.0"
---

# @lankajs/tool-skills

Copies each installed lanka package's skill into the project, at the version in
`node_modules`. `reference.md` beside this file is the full guide.

> [!NOTE]
> Only what the framework or a gate refuses is binding. Everything else here is a
> recommendation you can adapt.

```bash
npm  install -D @lankajs/tool-skills && npx lanka-skills sync
pnpm add     -D @lankajs/tool-skills && pnpm exec lanka-skills sync
yarn add     -D @lankajs/tool-skills && yarn lanka-skills sync
bun  add     -d @lankajs/tool-skills && bunx lanka-skills sync
```

`pnpm exec`, never `pnpm dlx` — `dlx` fetches a throwaway copy and would sync
skills for a package the project never installed.

## The commands

| Command                    | Does                                        |
| -------------------------- | ------------------------------------------- |
| `lanka-skills sync`        | copies them into `.claude/skills/`          |
| `lanka-skills list`        | says what would happen, writes nothing      |
| `sync --dry-run`           | the same, spelled the other way             |
| `sync --dir .agent/skills` | somewhere else                              |
| `sync --force`             | replace a directory this tool did not write |

Output:

```
  + lanka-core installed  (lanka@1.4.0)
  ~ lanka-http updated    (@lankajs/plugin-http@1.4.0)
  ! lanka-testing left alone — this tool did not write it; --force replaces it
```

## Reading the third line

Every directory the tool creates carries `.lanka-skill.json`. On the next run: no
directory → installed; marker present → replaced; **marker absent → left alone**.

So `left alone` means the directory is the consumer's — hand-written, or from
another source. It is not a failure and the run still exits 0.

## Versus the plugin marketplace

`/plugin install …@lankajs` takes the skill from the framework's **main branch**.
This takes it from **your `node_modules`**. Prefer this one: a skill teaching a
version the application is not running is worse than no skill, because it is
wrong confidently.

## Never do these

- **Never add a `postinstall` in the package itself.** It is deliberately absent:
  a hook would write into a repository on every install, in CI and in a
  container. A consumer may add one to their own `package.json`; that is their
  file and their call.
- **Never `--force` to "clean things up".** The directories it replaces are the
  ones somebody wrote by hand.
- **Never expect a sync after an upgrade.** Run it.
- **Never run it outside the project root.** It reads `./package.json` and
  `./node_modules`.
- **Never leave `.claude/skills/` uncommitted** and expect a teammate to have the
  skills. They are files.

## From a script

```ts
import { syncLankaSkills, lankaNodeSkillHost } from "@lankajs/tool-skills";

const plan = syncLankaSkills({ root: process.cwd(), host: lankaNodeSkillHost, dryRun: true });
```

`plan` is `{ install, update, conflict }`. Pass your own `ILankaSkillHost` to run
it against something that is not a disk.

## Symptom → cause

| What you see                     | What it is                                                |
| -------------------------------- | --------------------------------------------------------- |
| "nothing to do"                  | no installed lanka package ships a skill — check the root |
| a skill left alone               | that directory has no marker, so it is yours              |
| the skill describes an older API | the package was upgraded and no sync followed             |
| a teammate has no skills         | `.claude/skills/` was not committed                       |

## More

`reference.md` — the full guide, with every export and the marker's contents.
