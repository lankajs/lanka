<!-- Generated from tools/skills/GUIDE.md by scripts/skills.mjs. Edit the guide. -->

# @lankajs/tool-skills — user guide

The agent skills of the lanka packages you installed, copied into your project —
at the version you are actually running.

## You will learn

- how to install the agent skills of the packages you already have
- why the version matters, and what the marker file protects

## When to reach for this

Reach for it once your project has an AI coding agent working in it. It changes
nothing about how the application runs.

> [!NOTE]
> Everything below is how this package is _meant_ to be used, not how it must
> be. The framework bends at the seams it publishes — see
> [ARCHITECTURE.md](https://github.com/lankajs/lanka/blob/main/ARCHITECTURE.md) for what is checked and what is
> merely advice.

## Install

```bash
npm  install -D @lankajs/tool-skills && npx lanka-skills sync
pnpm add     -D @lankajs/tool-skills && pnpm exec lanka-skills sync
yarn add     -D @lankajs/tool-skills && yarn lanka-skills sync
bun  add     -d @lankajs/tool-skills && bunx lanka-skills sync
```

That is the whole thing. It reads your `package.json`, finds the lanka packages
your project actually resolves, and copies each one's skill into
`.claude/skills/`.

> [!NOTE]
> `pnpm exec`, not `pnpm dlx`: `dlx` fetches a throwaway copy from the registry
> and would sync the skills of a package your project never installed, which is
> the one thing this command exists to avoid.

**It resolves rather than guessing a path.** A workspace whose dependencies are
hoisted to the repository root, a manager that links instead of copying, Yarn's
Plug'n'Play with no `node_modules` at all — the command asks your project where
a package is, so all three answer.

## Why this and not the plugin marketplace

Both exist and they are not the same:

|            | `/plugin install …@lankajs`      | `npx lanka-skills sync`              |
| ---------- | ------------------------------ | ------------------------------------ |
| source     | the framework's git repository | your `node_modules`                  |
| version    | the main branch                | the version you installed            |
| updates    | on its own                     | when you run it                      |
| works with | Claude Code                    | any agent that reads a skills folder |

**Prefer this one where you can.** A skill that teaches a version your
application is not running is worse than no skill, because it is wrong
confidently.

## The commands

```bash
lanka-skills sync              # copy them in
lanka-skills list              # say what would happen, write nothing
lanka-skills sync --dry-run    # the same thing, spelled the other way
lanka-skills sync --dir .agent/skills
lanka-skills sync --force
lanka-skills --help
```

Output looks like this:

```
  + lanka-core installed  (lanka@1.4.0)
  ~ lanka-http updated    (@lankajs/plugin-http@1.4.0)
  ! lanka-testing left alone — this tool did not write it; --force replaces it
```

## It will not overwrite your work

Every directory it creates carries a `.lanka-skill.json` marker naming the
package and the version. On the next run:

- **no directory** → installed;
- **a directory with the marker** → replaced, because it is one of ours;
- **a directory without the marker** → **left alone**, and reported.

So a skill you wrote yourself, or installed from somewhere else, survives a sync.
`--force` is the explicit way to say otherwise.

Editing a skill this tool installed is fine, and the next sync will replace it —
the marker says the directory is ours, not that its contents are untouched. If
you want to keep your edits, delete the marker and the directory becomes yours.

## After an upgrade

```bash
npm update @lankajs/plugin-http
npx lanka-skills sync
```

There is deliberately **no postinstall hook**. Writing into your repository is
yours to ask for; a hook would do it on every install, in CI and inside a
container, and the first time anybody notices is a diff they did not make.

Add it to your own scripts if you want it automatic:

```json
{ "scripts": { "postinstall": "lanka-skills sync" } }
```

That is your call to make, in your file.

## Committing the result

Commit `.claude/skills/`. It is part of how your team works with the code, the
same way `.lanka_di/` is part of how the app is wired.

## Running it from a script

Everything the command does is exported, and every decision is a function over a
file-system port:

```ts
import { syncLankaSkills, lankaNodeSkillHost } from "@lankajs/tool-skills";

const plan = syncLankaSkills({
	root: process.cwd(),
	host: lankaNodeSkillHost,
	dryRun: true,
});

console.log(plan.conflict.map((source) => source.skill));
```

| Export                    | What it is                                          |
| ------------------------- | --------------------------------------------------- |
| `syncLankaSkills`         | find, plan, and copy                                |
| `planLankaSkillSync`      | decide only — install / update / conflict           |
| `findLankaSkillSources`   | which packages ship a skill, and at which version   |
| `runLankaSkillsCli`       | the command itself, given its arguments and streams |
| `lankaNodeSkillHost`      | the port over a real file system                    |
| `lankaSkillMarker`        | `.lanka-skill.json`                                 |
| `lankaDefaultSkillTarget` | `.claude/skills`                                    |

Pass your own `ILankaSkillHost` to run any of it against something that is not a
disk — that is how this package's own tests assert what it refuses to write.

## Common mistakes

**Expecting it to run itself after an upgrade.** It does not. See above.

**Wondering why a skill was skipped.** Read the line: `left alone` means the
directory has no marker, so it is yours.

**Running it in a folder that is not the project root.** It reads
`./package.json` and `./node_modules`; run it where those are.

**Committing nothing and expecting a teammate to have the skills.** They are
files; commit them.

## Recap

- `npx lanka-skills sync` copies the skill for the version in your `node_modules`.
- A directory without the marker is yours: it is reported, never replaced.
- There is no postinstall hook — writing into your repository is yours to ask for.
- Commit `.claude/skills/`, or a teammate has no skills.

---

Maintaining this package: [SKILL.md](https://github.com/lankajs/lanka/blob/main/tools/skills/SKILL.md) · What it is:
[README.md](https://github.com/lankajs/lanka/blob/main/tools/skills/README.md) · Repository map: [../../README.md](https://github.com/lankajs/lanka/blob/main/README.md)
