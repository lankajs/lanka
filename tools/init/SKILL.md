# Maintaining `@lankajs/tool-init`

A command that writes into somebody else's repository and then runs their
package manager. It is the second package here that does the first of those —
`@lankajs/tool-skills` is the other — and the only one that does the second.
Every rule below is about one of those two facts.

## Boundary

- A **tool**: a dev dependency and a command, usually run once through `npx`.
  Nothing here ships in an application bundle.
- It imports exactly one package of this repository: `@lankajs/tool-di`, for
  `lankaDiContract`. That is the barrel file names, the required exports and the
  contract version, and a copy of any of them here would be a second answer to
  "what is a barrel".
- It decides nothing on the consumer's behalf beyond what it wrote down. No
  git, no editor settings, no postinstall.

## Invariants

1. **Nothing is overwritten. Ever.** A file that exists is reported and kept,
   with `whenKept` saying what the project may still have to do itself. This
   command is run twice more often than it is run once — a project adds a
   validator six months later — and a scaffolder that rewrites what a team has
   edited is one nobody runs the second time.

2. **No version range is ever written.** Dependencies are NAMES; the ranges come
   from the package manager the project already uses, which is asked to add
   them. A range written here would be whatever was current on the day the tool
   was built, and it would be wrong in a way nobody looks at.

3. **A dependency the manifest already declares is left alone.** It is a version
   somebody chose. Asking for it again is how a scaffolder moves a range nobody
   asked it to touch.

4. **The manifest is written before the install runs.** `pnpm add` in a
   directory with no `package.json` is an error that would end the whole
   command, so `package.json` is one of the planned files and the ORDER inside
   `applyLankaInit` is what makes an empty directory work.

5. **An unknown id is refused where it is READ, by name, with the list beside
   it.** Everything below `readLankaInitChoices` holds the catalog's own answer
   OBJECTS rather than ids, so no later reader can meet one it does not
   understand. Adding an id lookup further down would put the same failure in
   four places.

6. **A question nobody can answer takes the default.** `null` from
   `askQuestion` — a pipe, a CI runner, `--yes` — is one case and not three.

7. **The catalog's CONTENT is a promise, not only its shape.** An entry may be
   added, and may be superseded by a better one beside it. An `id` is never
   removed: somewhere a script types it, and `--template next-app` disappearing
   in a minor is the same break as a removed export. That is
   `skills/surface/SKILL.md` §2 applied to data.

8. **Every default a template declares must exist and must be runnable there.**
   A default naming an absent answer refuses the template the moment somebody
   chooses it, with a message naming an id they never typed. The catalog's spec
   is what holds this.

## The shape, and why

**Four steps, each testable without the one before it.** `readLankaInitChoices`
turns flags and answers into decisions; `planLankaInit` turns decisions into
packages and files and touches nothing; `applyLankaInit` is the only part with a
disk; `runLankaInitCli` is the argument parsing and the printing. A consumer who
wants one of the four gets one of the four.

**`planLankaInit` is pure, and that is load-bearing.** It reads no disk, so a
plan can be printed, compared and asserted in one call. Whether a file is
already there is `applyLankaInit`'s question — which is why `lanka-init plan` is
`applyLankaInit` with `dryRun`, and not a second code path that could disagree
with the real one.

**One port with five members**, not a file half and a process half: a caller
holds exactly one of these and splitting it would put two parameters where every
call site passes the same object twice. Its header carries the promise that
makes that survivable — a consumer implements it, so **every member added later
arrives optional, with this package supplying the previous behaviour**.

**A CLI here answers a number, or a promise of one.** `runLankaSkillsCli` and
`runLankaDiCli` answer a number; this one asks questions, so it answers a
promise. That is the family's signature, written down so the next tool does not
invent a third.

## What is deliberately not here

**A second feature shape per transport.** A starter exists to be deleted, and
every shape it has is a shape that must stay correct through every version of
the framework it demonstrates. `--transport graphql` installs the plugin and
names its guide.

**A by-feature layout.** `ARCHITECTURE.md` presents by-layer and by-feature as
two shapes that have both worked, and this writes the first. If the second is
ever offered it is an additive field on the options — never a second command,
and never a change to what the existing one writes.

**A `--force`.** `@lankajs/tool-skills` has one because it can tell its own work
from a consumer's, through a marker file it writes. This cannot: everything it
writes is code the project then edits. Deleting the file is the way to have it
written again, and it is the honest one.

**A postinstall.** Same reason as `@lankajs/tool-skills`: writing into a
consumer's repository is theirs to ask for.

## Adding a template

Six fields and no code: a row in `TEMPLATES` with its `build`, its `framework`,
its packages and its defaults. Then, and only if the build is one nothing here
knows yet, an entry in `BUNDLER` in `lankaInitBuildFiles`, an entry in `SCRIPTS`
beside it, and — if the framework is a sixth binding — an entry in `SCREENS`.

The catalog's spec then holds it to the two rules nothing else would: that its
defaults name answers that exist, and that those answers can run where the
template runs. `planLankaInit`'s spec drives every template in the table, so a
row whose build has no config writer fails there rather than in somebody's
project.

## What to run

```bash
pnpm --filter @lankajs/tool-init test          # the units and the playground
pnpm --filter @lankajs/tool-init test:coverage # the ratchet
pnpm --filter @lankajs/tool-init typecheck
```

The generated code this package writes is TEXT, so no gate here compiles it.
What holds it honest is the playground, which asserts the shape of what was
written — that the barrel exports what the framework reads by name, that the
ViewModel reaches its gateway through the locator, and that nothing under `src/`
names `@lanka_di`.

**Compile it by hand after changing what it writes.** Ten lines, and it is the
only way to find out that a rename in core broke every project this command has
yet to create:

```bash
mkdir .tmp-init-demo
npx tsx tools/init/src/cli.ts --yes --no-install --root "$(pwd)/.tmp-init-demo" \
  --template node-service
# then point its tsconfig `paths` at the workspace sources rather than at
# node_modules — "lanka": ["../core/src/index.ts"], "lanka/*":
# ["../core/src/*/index.ts"], one line per @lankajs package it installed — and:
npx tsc -p .tmp-init-demo/tsconfig.json --noEmit
rm -rf .tmp-init-demo
```

Errors reported inside `core/` are the mapping's, not the starter's: a real
consumer reads built `.d.ts` under `skipLibCheck`. The ones to act on are the
ones in `.tmp-init-demo/`.

**A gate would be better than a procedure**, and this is the honest state rather
than the finished one: the shape is a script that writes the plan to a temporary
directory, writes that `paths` mapping from the registry, and runs `tsc` once.
It is not written, and until it is, this paragraph is what stands between a core
rename and every project created after it.
