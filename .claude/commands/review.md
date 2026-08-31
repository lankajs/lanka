---
description: Read-only review of finished work against the request, the canon and the gates.
argument-hint: "[what to review — defaults to the working tree]"
allowed-tools: Read, Grep, Glob, Bash
---

Review, do not edit. Target: `$ARGUMENTS` (empty → the working tree and the last
commit).

## Read

`git diff`, `git diff --name-only`, `git log -1 --stat`, then the `SKILL.md` that
owns each changed area. If `api/*.api.md` or `perf/*.perf.md` moved, those diffs
ARE the review of a promise and of a number — read them line by line.

## The five questions

1. **Was the whole request answered?** Scope quietly narrowed is the commonest
   defect. Name anything asked for and not delivered.
2. **Does it obey the canon that owns it?** Quote the rule; do not judge by taste.
   If the canon is silent, that is a finding for the canon, not a licence.
3. **Is anything now said twice?** A rule restated in a second file, a number
   copied into prose, a doc repeating what the generated map lists.
4. **Does every new invariant have a test that names it?** A comment saying "this
   must stay identical" and no test is a wish.
5. **Was every claim measured?** A "faster" from one run, a threshold raised, a
   baseline recorded for a change that made something dearer.

## Run, do not assume

```bash
pnpm run check:drift
pnpm check
```

If the caller says the checks passed, run them anyway. A green claimed and not
run is what this command exists to catch.

## Report

A verdict in one sentence, then findings as `path:line` + the rule quoted + the
smallest fix. Then the areas you reviewed and found CLEAN, so the caller knows
what ground was covered. Three real findings beat ten observations, and "ready"
is a verdict you are allowed to give.
