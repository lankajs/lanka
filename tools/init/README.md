# @lankajs/tool-init

**⚒ tool** · The first command

> One command that wires lanka into a project: a template, the packages it needs, the barrels, the build config and a feature written in the layers.

Runs before runtime — build, lint, test. Neither module nor plugin.

**Runs in:** node.

**How to use it:** [GUIDE.md](./GUIDE.md) — the user guide, with examples. **How to change it:** [SKILL.md](./SKILL.md).

## Contents

- `lanka-init` — asks what this project is, then writes the wiring and installs the packages
- `lanka-init list` — every template and every choice, with what each one installs
- `lanka-init plan` — the same decision, reported and not written

## Why a starter is one shape and not eleven

The eleven templates differ in the BUILD — which bundler adapter, which config file it
goes in, and which screen a binding reads — and agree on everything above that. The
feature this writes is one gateway, one ViewModel, one scenario and one screen, and the
screen is the only file that knows which UI framework was chosen.

A second feature shape per transport was the alternative, and it buys a beginner
nothing: a starter exists to be deleted, and every shape it has is a shape that has to
stay correct through every version of the framework it demonstrates. So `--transport
graphql` installs the plugin and names its guide; it does not write a second gateway
that the first commit will replace.

## What it will not do

**Overwrite anything.** A file that is already there is reported and kept, and the plan
names it. This command is run twice more often than it is run once — a project adds a
validator six months later — and a scaffolder that rewrites what a team has edited is a
scaffolder nobody runs the second time.

**Guess a version.** The dependency names come from the catalog here; the RANGES come
from the package manager the project already uses, which is asked to add them. A range
written by this tool would be the version that was current when this tool was built,
which is the one number it cannot know.

## Why it asks

Eleven templates and four axes beside them are a decision tree, and a decision tree
behind flags is one nobody walks: the flag that is not typed is the capability that is
not found. So an absent choice is a QUESTION when somebody is there to answer it, and the
template's default when nobody is — which is what `--yes`, a pipe and a CI runner all
mean.

---

Repository map: [../../README.md](../../README.md)
