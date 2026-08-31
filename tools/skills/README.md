# @lankajs/tool-skills

**⚒ tool** · Skill installer

> Puts each installed package's agent skill into the project, at the version actually installed.

Runs before runtime — build, lint, test. Neither module nor plugin.

**Runs in:** node.

**How to use it:** [GUIDE.md](./GUIDE.md) — the user guide, with examples. **How to change it:** [SKILL.md](./SKILL.md).

## Contents

- `lanka-skills sync` — copies the skills of the installed lanka packages into the project
- `lanka-skills list` — says what would be copied, and from which version

## Why a CLI and not a postinstall

Writing into a consumer's repository is theirs to ask for. A postinstall that created
files under `.claude/` would do it on every install, in CI and inside a container — and
the first time anybody notices is a diff they did not make.

## Why this exists beside the plugin marketplace

A skill installed from git describes the framework's main branch. This one describes the
code in the consumer's `node_modules`, because it is copied out of the tarball they
installed. That is the whole reason for a second transport: a skill teaching a version
the application is not running is worse than no skill, because it is wrong confidently.

## What it refuses to do

Overwrite a directory it did not write. Every directory it creates carries a marker file;
one without it belongs to the consumer — hand-written, or from somewhere else — and is
reported rather than replaced. `--force` is the explicit way to say otherwise.

---

Repository map: [../../README.md](../../README.md)
