---
description: Verify, then write the commit — one change, with its reason and its numbers.
argument-hint: "[what to include, if the tree holds more than one change]"
allowed-tools: Read, Grep, Glob, Bash
---

Commit the work in **lanka**. Scope: `$ARGUMENTS`

## 1. Look at what is actually staged

```bash
git status
git diff
git diff --staged
```

If the tree holds two unrelated changes, they are two commits. Split them; do not
narrate one message covering both.

## 2. Prove it before writing the message

```bash
pnpm run check:drift
pnpm check
```

A commit that has not run the chain is a claim, not a result. If something is
red, fix it or say in the message that it is red and why — never quietly.

## 3. Write it

`skills/commits/SKILL.md` owns the message and is the only copy of those rules.
The four things it will hold you to:

- the subject makes a claim that could be false;
- the body says what was wrong before, why THIS shape, and what was tried and did
  not work;
- what you deliberately did not do is stated, not omitted;
- every number was measured three times, and "within noise" is a legal answer.

English, always — code, comments, docs and commit messages. Chat is Russian;
the repository is not.

## 4. Then

Commit. Do not push unless asked. Report the subject line and the checks that
were green when it landed.
